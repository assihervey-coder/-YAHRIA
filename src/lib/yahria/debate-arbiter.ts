// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Multi-Agent Debate Arbiter (Domain 06.10/06.13)
// Doc ID: YAHRIA-KRN-018 | R8 Supremacy Pack
//
// When uncertainty is high (INV-081) a single planner is not enough.
// The arbiter runs a STRUCTURED ADVERSARIAL DEBATE between roles:
//
//   PROPOSER  — drafts the plan
//   CHALLENGER — attacks it (unsupported claims, ungated risks,
//                vagueness, missing specs, unbounded complexity)
//   SECURITY  — joins when risk terms are present (sandbox, secrets,
//               policy bypass attempts)
//   JUDGE     — scores each round on a published rubric, decides,
//               and RECORDS DISSENT instead of hiding it.
//
// Fully deterministic heuristic debaters (runs offline, INV-191);
// an LLM proposer hook is provided for richer drafts. Either way the
// JUDGE and CHALLENGER stay rule-based — the referee never hallucinate.
//
// Constitutional anchors:
//   INV-081 — uncertainty representable (DEFERRED is a first-class verdict)
//   INV-080 — every plan must end with independent verification
//   INV-073 — autonomy is governed; CHALLENGER enforces gates
//   INV-161 — separation of proposal and approval
// ═══════════════════════════════════════════════════════════════

import type { PlanStep } from './types';
import { extractSignals, scoreUncertainty } from './hybrid-reasoning';
import { emitYahriaEvent } from './realtime';

// ── DA-1. TYPES ────────────────────────────────────────────────────

export type DebateRole = 'PROPOSER' | 'CHALLENGER' | 'SECURITY' | 'JUDGE';
export type ObjectionType =
  | 'NO_VERIFIER' | 'UNGATED_RISK' | 'VAGUE_STEP' | 'MISSING_SPEC'
  | 'OVERCOMPLEX' | 'POLICY_BYPASS' | 'UNVERIFIABLE_CLAIM';
export type Consensus = 'UNANIMOUS' | 'MAJORITY' | 'CONTESTED';
export type DebateDecision = 'APPROVED_PLAN' | 'REVISED_PLAN' | 'DEFERRED';

export interface Objection {
  objectionId: string;
  round: number;
  by: DebateRole;
  type: ObjectionType;
  targetStep: number | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  quote: string;
  demand: string;
  resolved: boolean;
}

export interface DebateRound {
  round: number;
  proposal: PlanStep[];
  objections: Objection[];
  revision: PlanStep[];
  rubric: { verification: number; gatedRisk: number; clarity: number; objectionsResolved: number };
  score: number;
  judgeNote: string;
}

export interface DebateVerdict {
  decision: DebateDecision;
  plan: PlanStep[];
  confidence: number;          // 0..1 (1 − residual uncertainty)
  residualUncertainty: number;
  consensus: Consensus;
  rounds: DebateRound[];
  dissent: Objection[];        // never discarded — audit trail (INV-082)
  auditTrail: { seq: number; role: DebateRole; act: string; ms: number }[];
  securityJoined: boolean;
}

export interface DebateInput {
  goal: string;
  baseUncertainty?: number;
  maxRounds?: number;
  draftProposer?: (goal: string) => PlanStep[]; // optional LLM-backed proposer
}

const AGENTS = ['explorer', 'architect', 'planner', 'coder', 'debugger', 'tester', 'reviewer', 'security', 'verifier'];

// ── DA-2. PROPOSER (deterministic default draft) ───────────────────

function defaultProposer(goal: string): PlanStep[] {
  const steps: PlanStep[] = [
    { index: 1, action: 'perceive', detail: `Assemble world state for: "${goal.slice(0, 60)}"`, owner: 'explorer', requiresApproval: false },
    { index: 2, action: 'implement solution', detail: 'Apply the change', owner: 'coder', requiresApproval: false },
  ];
  // Risk-shaped goals get the risky step verbatim — the CHALLENGER's job
  // is to catch it. This is deliberate: the debate must have material.
  if (/\b(deploy|production|delete|drop|secret|token|policy)\b/i.test(goal)) {
    steps.push({ index: 3, action: 'apply to production', detail: 'Deploy changes directly', owner: 'coder', requiresApproval: false });
  }
  return steps;
}

// ── DA-3. CHALLENGER (rule-based adversarial critique) ─────────────

function challenge(round: number, plan: PlanStep[], goal: string, securityJoined: boolean): Objection[] {
  const objections: Objection[] = [];
  const push = (o: Omit<Objection, 'objectionId' | 'round' | 'resolved'>) => {
    objections.push({
      objectionId: `OBJ-R${round}-${String(objections.length + 1).padStart(2, '0')}`,
      round, resolved: false, ...o,
    });
  };
  const signals = extractSignals(goal);

  const hasVerifier = plan.some((p) => p.owner === 'verifier' || /verif|test|prove/i.test(p.action));
  if (!hasVerifier) {
    push({
      by: 'CHALLENGER', type: 'NO_VERIFIER', targetStep: null, severity: 'HIGH',
      quote: 'aucune étape de vérification indépendante',
      demand: 'INV-080 exige un verdict par un vérificateur indépendant du générateur — ajouter une étape verifier',
    });
  }
  plan.filter((p) => /\b(production|deploy|delete|drop|secret|token)\b/i.test(`${p.action} ${p.detail}`) && !p.requiresApproval).forEach((p) => {
    push({
      by: securityJoined ? 'SECURITY' : 'CHALLENGER', type: 'UNGATED_RISK', targetStep: p.index, severity: 'CRITICAL',
      quote: `étape ${p.index} « ${p.action} » opère sur un actif à risque sans garde`,
      demand: 'marquer requiresApproval=true — INV-073: AUTONOMIE < POLITIQUE',
    });
  });
  if (securityJoined && plan.some((p) => /\b(host|secret|credential)\b/i.test(`${p.action} ${p.detail}`))) {
    push({
      by: 'SECURITY', type: 'POLICY_BYPASS', targetStep: null, severity: 'CRITICAL',
      quote: 'une étape référence des secrets ou l’hôte',
      demand: 'router par le Policy Engine avant exécution (INV-120, POL-001/POL-002)',
    });
  }
  plan.filter((p) => p.detail.trim().length < 25 || /\b(maybe|peut-être|somehow|approx)\b/i.test(p.detail)).forEach((p) => {
    push({
      by: 'CHALLENGER', type: 'VAGUE_STEP', targetStep: p.index, severity: 'MEDIUM',
      quote: `étape ${p.index} sous-spécifiée: "${p.detail.slice(0, 40)}"`,
      demand: 'expliciter l’entrée, la sortie et le critère d’achèvement de l’étape',
    });
  });
  if (signals.hasAmbiguity) {
    push({
      by: 'CHALLENGER', type: 'MISSING_SPEC', targetStep: null, severity: 'HIGH',
      quote: 'le but contient de l’ambiguïté non résolue',
      demand: 'marquer les éléments inconnus REQUIRES_SPECIFICATION (INV-210: ne jamais deviner)',
    });
  }
  if (plan.length > 8) {
    push({
      by: 'CHALLENGER', type: 'OVERCOMPLEX', targetStep: null, severity: 'LOW',
      quote: `${plan.length} étapes pour un plan unique`,
      demand: 'décomposer en sous-graphes de tâches (D.7) — complexité non bornée rejetée',
    });
  }
  plan.filter((p) => /guarantee|100%|certain|toujours sûr/i.test(`${p.action} ${p.detail}`)).forEach((p) => {
    push({
      by: 'CHALLENGER', type: 'UNVERIFIABLE_CLAIM', targetStep: p.index, severity: 'HIGH',
      quote: `étape ${p.index} affirme une certitude invérifiable`,
      demand: 'remplacer par un critère mesurable + preuve (INV-102)',
    });
  });
  return objections;
}

// ── DA-4. PROPOSER REVISION (deterministic fixes per objection) ────

function revise(plan: PlanStep[], objections: Objection[], goal: string): PlanStep[] {
  let next = plan.map((p) => ({ ...p }));
  for (const o of objections) {
    if (o.type === 'NO_VERIFIER' && !next.some((p) => p.owner === 'verifier' || /verif|test|prove/i.test(p.action))) {
      next.push({
        index: next.length + 1, action: 'verify independently',
        detail: 'Verification indépendante: tests + lint + policy + preuve scellée (INV-080)',
        owner: 'verifier', requiresApproval: false,
      });
    }
    if (o.type === 'UNGATED_RISK' && o.targetStep !== null) {
      next = next.map((p) => (p.index === o.targetStep ? { ...p, requiresApproval: true } : p));
    }
    if (o.type === 'POLICY_BYPASS' && !next.some((p) => p.action === 'policy gate')) {
      next.unshift({
        index: 0, action: 'policy gate',
        detail: 'Évaluer chaque accès sensible par le Policy Engine avant toute exécution (INV-120)',
        owner: 'security', requiresApproval: true,
      });
    }
    if (o.type === 'VAGUE_STEP' && o.targetStep !== null) {
      next = next.map((p) => p.index === o.targetStep
        ? { ...p, detail: `Entrée: état du monde courant · Sortie: artefact vérifiable · Action: ${p.action} · Critère d'achèvement: verdict verifier PASS (INV-080)` }
        : p);
    }
    if (o.type === 'MISSING_SPEC' && !next.some((p) => /REQUIRES_SPECIFICATION|declare unknowns/i.test(`${p.action} ${p.detail}`))) {
      next.push({
        index: next.length + 1, action: 'declare unknowns',
        detail: 'Éléments ambigus marqués REQUIRES_SPECIFICATION (INV-210) — spécification humaine requise avant exécution',
        owner: 'planner', requiresApproval: false,
      });
    }
    if (o.type === 'OVERCOMPLEX') {
      next = next.slice(0, 7);
      if (!next.some((p) => /delegate remainder/i.test(p.action))) {
        next.push({ index: 8, action: 'delegate remainder', detail: 'Sous-graphes de tâches délégués à D.7 (complexité bornée)', owner: 'planner', requiresApproval: false });
      }
    }
    if (o.type === 'UNVERIFIABLE_CLAIM' && o.targetStep !== null) {
      next = next.map((p) => p.index === o.targetStep
        ? { ...p, detail: `${p.detail} — critère mesurable: assertions de test + preuve scellée (INV-102)` }
        : p);
    }
  }
  next = next
    .sort((a, b) => a.index - b.index)
    .map((p, i) => ({ ...p, index: i + 1 }));
  objections.forEach((o) => { o.resolved = true; });
  return next;
}

// ── DA-5. JUDGE (published rubric, deterministic scoring) ──────────

const RUBRIC_WEIGHTS = { verification: 0.30, gatedRisk: 0.25, clarity: 0.20, objectionsResolved: 0.25 };
const APPROVAL_THRESHOLD = 0.75;

function judge(plan: PlanStep[], objections: Objection[], round: number): { rubric: DebateRound['rubric']; score: number; note: string } {
  const verification = plan.some((p) => p.owner === 'verifier' || /verif|test|prove/i.test(p.action)) ? 1 : 0;
  const riskSteps = plan.filter((p) => /\b(production|deploy|delete|drop|secret|token)\b/i.test(`${p.action} ${p.detail}`));
  const gatedRisk = riskSteps.length === 0 ? 1 : riskSteps.filter((p) => p.requiresApproval).length / riskSteps.length;
  const clarity = plan.length === 0 ? 0 : plan.filter((p) => p.detail.trim().length >= 25 && !/\b(maybe|peut-être|somehow)\b/i.test(p.detail)).length / plan.length;
  const objectionsResolved = objections.length === 0 ? 1 : objections.filter((o) => o.resolved).length / objections.length;
  const rubric = {
    verification: Number(verification.toFixed(3)),
    gatedRisk: Number(gatedRisk.toFixed(3)),
    clarity: Number(clarity.toFixed(3)),
    objectionsResolved: Number(objectionsResolved.toFixed(3)),
  };
  const score = Number((
    RUBRIC_WEIGHTS.verification * verification +
    RUBRIC_WEIGHTS.gatedRisk * gatedRisk +
    RUBRIC_WEIGHTS.clarity * clarity +
    RUBRIC_WEIGHTS.objectionsResolved * objectionsResolved
  ).toFixed(4));
  const worst = objections.filter((o) => !o.resolved).sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  const note = score >= APPROVAL_THRESHOLD
    ? `Score ${score.toFixed(2)} ≥ ${APPROVAL_THRESHOLD} — plan accepté au tour ${round}`
    : `Score ${score.toFixed(2)} < ${APPROVAL_THRESHOLD} — plan retourné au PROPOSER${worst ? ` (objection dominante: ${worst.type})` : ''}`;
  return { rubric, score, note };
}

function severityRank(s: Objection['severity']): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[s];
}

// ── DA-6. ORCHESTRATOR ─────────────────────────────────────────────

export function runDebate(input: DebateInput): DebateVerdict {
  const t0 = Date.now();
  const goal = input.goal;
  const maxRounds = input.maxRounds ?? 2;
  const signals = extractSignals(goal);
  const baseUncertainty = input.baseUncertainty ?? scoreUncertainty(signals);
  const securityJoined = signals.hasRiskTerms;
  const auditTrail: DebateVerdict['auditTrail'] = [];
  let seq = 0;
  const log = (role: DebateRole, act: string) => {
    seq += 1;
    auditTrail.push({ seq, role, act, ms: Date.now() - t0 });
  };

  log('PROPOSER', input.draftProposer ? 'brouillon via proposeur externe (LLM hook)' : 'brouillon via proposeur déterministe');

  let proposal = (input.draftProposer ?? defaultProposer)(goal);
  const rounds: DebateRound[] = [];
  let finalPlan = proposal;
  let dissent: Objection[] = [];
  let accepted = false;

  for (let r = 1; r <= maxRounds; r++) {
    const objections = challenge(r, proposal, goal, securityJoined);
    log(securityJoined ? 'SECURITY' : 'CHALLENGER', `tour ${r}: ${objections.length} objection(s) levée(s)`);
    // revise() mutates the ORIGINAL objections (resolved flags) so the
    // judge credits this round's resolutions — copies are archived after.
    const revision = revise(proposal, objections, goal);
    const verdict = judge(revision, objections, r);
    log('JUDGE', `tour ${r}: score ${verdict.score.toFixed(2)} — ${verdict.note}`);
    rounds.push({
      round: r,
      proposal: proposal.map((p) => ({ ...p })),
      objections: objections.map((o) => ({ ...o })),
      revision,
      rubric: verdict.rubric,
      score: verdict.score,
      judgeNote: verdict.note,
    });
    finalPlan = revision;
    dissent = objections.filter((o) => !o.resolved);
    if (verdict.score >= APPROVAL_THRESHOLD) { accepted = true; break; }
    proposal = revision;
  }

  const lastScore = rounds[rounds.length - 1]?.score ?? 0;
  const residualUncertainty = accepted
    ? Math.max(0.10, baseUncertainty * (1 - lastScore) + 0.05)
    : Math.min(1, Math.max(baseUncertainty, 0.75));
  const consensus: Consensus = dissent.length === 0
    ? 'UNANIMOUS'
    : dissent.some((d) => d.severity === 'CRITICAL')
      ? 'CONTESTED'
      : 'MAJORITY';
  const decision: DebateDecision = accepted
    ? (rounds.length > 1 || finalPlan !== proposal ? 'REVISED_PLAN' : 'APPROVED_PLAN')
    : 'DEFERRED';

  const verdict: DebateVerdict = {
    decision,
    plan: finalPlan,
    confidence: Number((1 - residualUncertainty).toFixed(4)),
    residualUncertainty: Number(residualUncertainty.toFixed(4)),
    consensus,
    rounds,
    dissent,
    auditTrail,
    securityJoined,
  };
  emitYahriaEvent({
    type: 'supremacy.debate.resolved',
    source: '06',
    severity: decision === 'DEFERRED' ? 'WARN' : 'SUCCESS',
    message: `Débat constitutionnel: ${decision} (consensus ${consensus}, ${rounds.length} tour(s), ${dissent.length} dissident(s) enregistré(s))`,
    payload: { decision, consensus, rounds: rounds.length, dissent: dissent.length },
  });
  return verdict;
}

export { AGENTS as DEBATE_AGENT_VOCABULARY };
