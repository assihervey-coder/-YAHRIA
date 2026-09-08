// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — SELF-EVOLUTION & META-INTELLIGENCE (Domain 15)
// KRN-033 · R14
//
// L'évolution PROPOSE, elle ne modifie JAMAIS la production
// (INV-228, graphe des dépendances interdites : Self-Evolution ↛
// production). Pipeline gouverné (INV-162) :
//
//   DRAFTED → SUBMITTED → UNDER_REVIEW → APPROVED|REJECTED
//           → SCHEDULED → PROMOTED → ROLLED_BACK
//
//   - Séparation proposition/approbation exigée PAR LE SYSTÈME
//     (INV-161/227) : le proposant ne peut pas approuver.
//   - Plan de rollback OBLIGATOIRE avant PROMOTED (INV-163).
//   - Toute transition scelle une preuve EVOLUTION (INV-110).
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

export const EVOLUTION_MODULE_ID = 'YAHRIA-KRN-033';

export const EVOLUTION_KINDS = ['PROMPT', 'STRATEGY', 'MODEL_ROUTING', 'WORKFLOW', 'AGENT_GENOME'] as const;
export const EVOLUTION_RISKS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const EVOLUTION_TRANSITIONS: Record<string, string[]> = {
  DRAFTED: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['SCHEDULED'],
  SCHEDULED: ['PROMOTED'],
  PROMOTED: ['ROLLED_BACK'],
  REJECTED: [], ROLLED_BACK: [],
};

export function assertEvolutionTransition(from: string, to: string): { ok: boolean; reason?: string } {
  const allowed = EVOLUTION_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return { ok: false, reason: `transition évolution illégale ${from} → ${to} (autorisées : ${allowed.join(', ') || 'aucune'})` };
  }
  return { ok: true };
}

/** Machine exposée pour le gate qualité D.20. */
export const EVOLUTION_MACHINE = {
  name: 'EVOLUTION',
  states: Object.keys(EVOLUTION_TRANSITIONS),
  transitions: Object.entries(EVOLUTION_TRANSITIONS).flatMap(([from, tos]) =>
    tos.map((to) => ({ from, to, guard: 'governed', authority: 'evolution-plane' }))),
};

export interface EvolutionActor { type: 'HUMAN' | 'AGENT'; id: string }
/**
 * Identité attributable (INV-201) — le label porte TOUJOURS l'id :
 * deux humains distincts sont deux identités distinctes (INV-227 juge
 * l'identité, pas le type d'acteur).
 */
export function actorLabel(a: EvolutionActor): string {
  const id = String(a.id ?? '').trim() || 'inconnu';
  return `${a.type === 'HUMAN' ? 'HUMAN' : 'AGENT'}:${id}`;
}

async function nextEvoUid(): Promise<string> {
  const rows = await db.evolutionProposal.findMany({
    orderBy: { createdAt: 'desc' }, take: 200, select: { proposalUid: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)$/.exec(r.proposalUid);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `EVO-${String(max + 1).padStart(6, '0')}`;
}

async function sealProposal(proposalUid: string, claim: string, payload: Record<string, unknown>, criticality: 'STANDARD' | 'HIGH' = 'STANDARD') {
  const evidence = await captureAndPersist({
    category: 'POLICY', criticality, actorType: 'SYSTEM', actorId: 'evolution-plane',
    claim, payload: { proposalUid, ...payload },
  });
  return evidence.uid;
}

export async function createProposal(params: {
  title: string; kind: string; rationale: string;
  sourceInsightUid?: string; riskClass?: string;
  proposedBy: EvolutionActor;
}): Promise<{ ok: boolean; status: number; errors: string[]; proposalUid?: string; evidenceUid?: string }> {
  const errors: string[] = [];
  const title = String(params.title ?? '').trim();
  const rationale = String(params.rationale ?? '').trim();
  const kind = String(params.kind ?? '').toUpperCase();
  const riskClass = String(params.riskClass ?? 'LOW').toUpperCase();
  if (title.length < 6) errors.push('titre requis (≥ 6 caractères)');
  if (rationale.length < 20) errors.push('rationale requis (≥ 20 caractères) — une évolution sans justification n\'entre pas dans le pipeline');
  if (!EVOLUTION_KINDS.includes(kind as (typeof EVOLUTION_KINDS)[number])) errors.push(`kind invalide — vocabulaire : ${EVOLUTION_KINDS.join(' | ')}`);
  if (!EVOLUTION_RISKS.includes(riskClass as (typeof EVOLUTION_RISKS)[number])) errors.push(`riskClass invalide — vocabulaire : ${EVOLUTION_RISKS.join(' | ')}`);
  if (errors.length > 0) return { ok: false, status: 422, errors };

  if (params.sourceInsightUid) {
    const insight = await db.learningInsight.findUnique({ where: { insightUid: params.sourceInsightUid } });
    if (!insight) return { ok: false, status: 422, errors: [`sourceInsightUid « ${params.sourceInsightUid} » introuvable — lignée obligatoire (INV-034)`] };
  }

  const proposalUid = await nextEvoUid();
  await db.evolutionProposal.create({
    data: {
      proposalUid, title, kind, rationale,
      sourceInsightUid: params.sourceInsightUid ?? null,
      riskClass, state: 'DRAFTED',
      proposedBy: actorLabel(params.proposedBy),
    },
  });
  const evidenceUid = await sealProposal(proposalUid, `Proposition d'évolution ${proposalUid} créée (${kind}, risque ${riskClass}) par ${actorLabel(params.proposedBy)}`, { kind, riskClass, proposedBy: actorLabel(params.proposedBy) });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.EVOLUTION_PROPOSED, source: '15', severity: 'INFO',
    message: `Proposition ${proposalUid} : ${title.slice(0, 80)}`,
    payload: { proposalUid, kind, riskClass },
  });
  return { ok: true, status: 201, errors: [], proposalUid, evidenceUid };
}

export async function decideProposal(params: {
  proposalUid: string; action: 'submit' | 'review' | 'approve' | 'reject' | 'schedule' | 'promote' | 'rollback';
  actor: EvolutionActor; reason?: string; experiment?: Record<string, unknown>; rollbackPlan?: string;
}): Promise<{ ok: boolean; status: number; errors: string[]; state?: string; evidenceUid?: string }> {
  const rec = await db.evolutionProposal.findUnique({ where: { proposalUid: params.proposalUid } });
  if (!rec) return { ok: false, status: 404, errors: [`proposition introuvable : ${params.proposalUid}`] };
  const reason = String(params.reason ?? '').trim();
  const actor = actorLabel(params.actor);

  const target: Record<string, string> = {
    submit: 'SUBMITTED', review: 'UNDER_REVIEW', approve: 'APPROVED', reject: 'REJECTED',
    schedule: 'SCHEDULED', promote: 'PROMOTED', rollback: 'ROLLED_BACK',
  };
  const to = target[params.action];
  const gate = assertEvolutionTransition(rec.state, to);
  if (!gate.ok) return { ok: false, status: 422, errors: [gate.reason!] };

  // INV-161/227 — séparation mécanique proposition/approbation
  if (params.action === 'approve' || params.action === 'reject') {
    if (!identityOk(actor, rec.proposedBy)) {
      return {
        ok: false, status: 422,
        errors: [`INV-161/227 : « ${actor} » a PROPOSÉ cette évolution — le proposant ne peut pas être la seule autorité d'approbation. Une identité distincte doit décider.`],
      };
    }
    if (reason.length < 10) {
      return { ok: false, status: 422, errors: ['raison gouvernée obligatoire (≥ 10 caractères) pour approve/reject (INV-121)'] };
    }
  }
  // INV-163 — rollback plan obligatoire pour risque élevé avant APPROVED
  if (params.action === 'approve' && ['HIGH', 'CRITICAL'].includes(rec.riskClass)) {
    const plan = String(params.rollbackPlan ?? rec.rollbackPlan ?? '').trim();
    if (plan.length < 15) {
      return { ok: false, status: 422, errors: [`risque ${rec.riskClass} : plan de rollback explicite obligatoire avant APPROVED (INV-163)`] };
    }
    if (params.rollbackPlan) await db.evolutionProposal.update({ where: { id: rec.id }, data: { rollbackPlan: params.rollbackPlan.slice(0, 2000) } });
  }
  // INV-162 — expérimentation documentée avant PROMOTED
  if (params.action === 'promote') {
    if (!rec.experiment && !params.experiment) {
      return { ok: false, status: 422, errors: ['INV-162 : PROPOSAL → EXPERIMENT → BENCHMARK → VERIFY → APPROVE → PROMOTE — aucun résultat d\'expérimentation enregistré, promotion refusée'] };
    }
    const plan = String(params.rollbackPlan ?? rec.rollbackPlan ?? '').trim();
    if (plan.length < 15) {
      return { ok: false, status: 422, errors: ['INV-163 : plan de rollback requis avant PROMOTED'] };
    }
    if (params.rollbackPlan) await db.evolutionProposal.update({ where: { id: rec.id }, data: { rollbackPlan: params.rollbackPlan.slice(0, 2000) } });
  }
  if (params.action === 'rollback' && reason.length < 10) {
    return { ok: false, status: 422, errors: ['raison gouvernée obligatoire (≥ 10 caractères) pour un rollback (INV-201)'] };
  }

  const data: Record<string, unknown> = { state: to };
  if (params.action === 'approve' || params.action === 'reject') {
    data.decidedBy = actor;
    data.decisionReason = reason.slice(0, 1000);
  }
  if (params.experiment) data.experiment = JSON.stringify(params.experiment).slice(0, 8000);
  await db.evolutionProposal.update({ where: { id: rec.id }, data: data as never });

  const criticality = ['approve', 'reject', 'promote', 'rollback'].includes(params.action) ? 'HIGH' : 'STANDARD';
  const evidenceUid = await sealProposal(
    rec.proposalUid,
    `Évolution ${rec.proposalUid} : ${rec.state} → ${to} (${params.action}) par ${actor}${reason ? ` — raison : ${reason.slice(0, 150)}` : ''}`,
    { action: params.action, from: rec.state, to, actor, reason: reason.slice(0, 300) },
    criticality,
  );
  // INV-228 : PROMOTED n'exécute RIEN — cela enregistre la décision gouvernée.
  const note = to === 'PROMOTED'
    ? ' (décision enregistrée — AUCUNE mutation de production exécutée par le moteur d\'évolution, INV-228)'
    : '';
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.EVOLUTION_DECIDED, source: '15',
    severity: ['reject', 'rollback'].includes(params.action) ? 'WARN' : 'SUCCESS',
    message: `Proposition ${rec.proposalUid} : ${to}${note}`,
    payload: { proposalUid: rec.proposalUid, to, actor },
  });
  return { ok: true, status: 200, errors: [], state: to, evidenceUid };
}

function identityOk(approver: string, proposer: string): boolean {
  return approver.trim().toUpperCase() !== proposer.trim().toUpperCase();
}
