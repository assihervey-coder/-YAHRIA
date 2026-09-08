// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — LEARNING ENGINE (Domain 14) — KRN-032 · R14
//
// Apprentissage fondé sur les FAITS enregistrés uniquement
// (INV-226) : invocations d'outils, runs d'agents, événements
// d'échec. Aucun auto-rapport de modèle n'entre dans le moteur.
//
//   Seuil d'insight (INV-225) : OBSERVED < 3 échantillons ≤ VALIDATED.
//   Promotion (INV-150/151) : décision gouvernée, réversible,
//   aboutit à une mémoire SEMANTIC tracée (pont D.14 → D.13).
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { writeMemory, MEMORY_MODULE_ID as MEMORY_KRN } from './memory';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

export const LEARNING_MODULE_ID = 'YAHRIA-KRN-032';
export const INSIGHT_THRESHOLD = 3; // INV-225

/** Confiance dérivée des échantillons — déterministe, jamais auto-proclamée. */
export function learningConfidence(samples: number): number {
  return Math.min(0.95, 0.3 + 0.1 * Math.max(0, samples));
}

/** Pure function testable (D.20 gate) — séparation proposition/approbation. */
export function identitySeparationOk(proposer: string, approver: string): boolean {
  return String(proposer ?? '').trim().toUpperCase() !== String(approver ?? '').trim().toUpperCase();
}

async function nextUid(prefix: string): Promise<string> {
  const rows = await db.learningInsight.findMany({
    orderBy: { createdAt: 'desc' }, take: 200, select: { insightUid: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)$/.exec(r.insightUid);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(6, '0')}`;
}

interface InsightDraft {
  kind: string; subject: string; metric: Record<string, unknown>;
  recommendation: string; samples: number; evidenceRefs: string[];
}

/**
 * D.14.3/4/5 — Mining déterministe des faits enregistrés. Upsert par
 * (kind, subject) : un insight PROMOTED/RETIRED n'est plus touché
 * (décision gouvernée respectée), les autres voient leurs métriques
 * rafraîchies et leur état monter OBSERVED → VALIDATED au seuil.
 */
export async function mineInsights(): Promise<{
  ok: boolean; created: number; refreshed: number;
  insights: { insightUid: string; kind: string; subject: string; state: string; samples: number }[];
  note: string;
}> {
  const invocations = await db.toolInvocation.findMany({
    orderBy: { createdAt: 'desc' }, take: 500,
    select: { id: true, toolId: true, ok: true, ms: true },
  });
  const agentRuns = await db.agentRun.findMany({
    orderBy: { startedAt: 'desc' }, take: 300,
    select: { id: true, state: true, agent: { select: { key: true } } },
  });
  const failures = await db.failureEvent.findMany({
    orderBy: { createdAt: 'desc' }, take: 300,
    select: { id: true, failureType: true, source: true, fingerprint: true },
  });

  const drafts: InsightDraft[] = [];

  // TOOL_RELIABILITY — taux de succès + latence par outil (faits mesurés)
  const byTool = new Map<string, { n: number; ok: number; ms: number; refs: string[] }>();
  for (const inv of invocations) {
    const b = byTool.get(inv.toolId) ?? { n: 0, ok: 0, ms: 0, refs: [] };
    b.n += 1; if (inv.ok) b.ok += 1; b.ms += inv.ms;
    if (b.refs.length < 25) b.refs.push(inv.id);
    byTool.set(inv.toolId, b);
  }
  for (const [toolId, b] of byTool) {
    const rate = b.ok / b.n;
    const recommendation = b.n < INSIGHT_THRESHOLD
      ? `Échantillon insuffisant (${b.n} < ${INSIGHT_THRESHOLD}) — continuer l'observation avant toute décision.`
      : rate >= 0.9
        ? `Outil fiable (${Math.round(rate * 100)}% sur ${b.n} appels, moyenne ${Math.round(b.ms / b.n)} ms) — maintien sans action.`
        : rate >= 0.5
          ? `Fiabilité médiane (${Math.round(rate * 100)}%) — surveiller, examiner les ${b.n - b.ok} échec(s) avant de promouvoir quoi que ce soit.`
          : `Fiabilité faible (${Math.round(rate * 100)}% sur ${b.n}) — investiguer l'outil AVANT toute nouvelle automatisation qui en dépend.`;
    drafts.push({
      kind: 'TOOL_RELIABILITY', subject: toolId,
      metric: { samples: b.n, successRate: Number(rate.toFixed(3)), avgMs: Math.round(b.ms / b.n), failures: b.n - b.ok },
      recommendation, samples: b.n, evidenceRefs: b.refs,
    });
  }

  // AGENT_PERFORMANCE — verdicts des runs par agent canonique
  const byAgent = new Map<string, { n: number; done: number; refs: string[] }>();
  for (const r of agentRuns) {
    const key = r.agent?.key ?? 'inconnu';
    const b = byAgent.get(key) ?? { n: 0, done: 0, refs: [] };
    b.n += 1; if (r.state === 'COMPLETED') b.done += 1;
    if (b.refs.length < 25) b.refs.push(r.id);
    byAgent.set(key, b);
  }
  for (const [agentKey, b] of byAgent) {
    const rate = b.done / b.n;
    drafts.push({
      kind: 'AGENT_PERFORMANCE', subject: agentKey,
      metric: { samples: b.n, completedRate: Number(rate.toFixed(3)) },
      recommendation: b.n < INSIGHT_THRESHOLD
        ? `Historique trop court (${b.n} runs) — aucune inférence de performance légitime.`
        : rate >= 0.8
          ? `Agent constant (${Math.round(rate * 100)}% de complétion) — confier des missions plus larges est DISCUTABLE, décision gouvernée requise.`
          : `Complétion ${Math.round(rate * 100)}% — revoir les missions typiques confiées à cet agent avant de l'automatiser davantage.`,
      samples: b.n, evidenceRefs: b.refs,
    });
  }

  // FAILURE_PATTERN — empreintes d'échec récurrentes (INV-152)
  const byFailure = new Map<string, { n: number; refs: string[]; source: string; msg: string }>();
  for (const f of failures) {
    const key = `${f.failureType}@${f.source}`;
    const b = byFailure.get(key) ?? { n: 0, refs: [], source: f.source, msg: f.failureType };
    b.n += 1;
    if (b.refs.length < 25) b.refs.push(f.id);
    byFailure.set(key, b);
  }
  for (const [key, b] of byFailure) {
    if (b.n < 2) continue; // un échec isolé n'est pas un pattern
    drafts.push({
      kind: 'FAILURE_PATTERN', subject: key,
      metric: { samples: b.n },
      recommendation: `Pattern récurrent (${b.n} occurrences de ${b.msg} sur ${b.source}) — prévoir une stratégie de récupération structurée plutôt qu'un retry aveugle (INV-092).`,
      samples: b.n, evidenceRefs: b.refs,
    });
  }

  let created = 0; let refreshed = 0;
  const outInsights: { insightUid: string; kind: string; subject: string; state: string; samples: number }[] = [];
  for (const d of drafts) {
    const existing = await db.learningInsight.findFirst({ where: { kind: d.kind, subject: d.subject } });
    const state = d.samples >= INSIGHT_THRESHOLD ? 'VALIDATED' : 'OBSERVED';
    if (existing) {
      if (existing.state === 'PROMOTED' || existing.state === 'RETIRED') {
        outInsights.push({ insightUid: existing.insightUid, kind: d.kind, subject: d.subject, state: existing.state, samples: d.samples });
        continue; // décision gouvernée — non mutée par le mining
      }
      await db.learningInsight.update({
        where: { id: existing.id },
        data: {
          metric: JSON.stringify(d.metric), recommendation: d.recommendation,
          confidence: learningConfidence(d.samples), state,
          evidenceRefs: JSON.stringify(d.evidenceRefs),
        },
      });
      refreshed += 1;
      outInsights.push({ insightUid: existing.insightUid, kind: d.kind, subject: d.subject, state, samples: d.samples });
    } else {
      const insightUid = await nextUid('LRN');
      const row = await db.learningInsight.create({
        data: {
          insightUid, kind: d.kind, subject: d.subject,
          metric: JSON.stringify(d.metric), recommendation: d.recommendation,
          confidence: learningConfidence(d.samples), state,
          evidenceRefs: JSON.stringify(d.evidenceRefs),
        },
      });
      created += 1;
      outInsights.push({ insightUid: row.insightUid, kind: d.kind, subject: d.subject, state: row.state, samples: d.samples });
    }
  }

  await captureAndPersist({
    category: 'MODEL', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: 'learning-engine',
    claim: `Mining apprentissage : ${created} insight(s) créé(s), ${refreshed} rafraîchi(s) — sources : ${invocations.length} invocations, ${agentRuns.length} runs, ${failures.length} échecs (faits enregistrés uniquement, INV-226)`,
    payload: { created, refreshed, sources: { invocations: invocations.length, agentRuns: agentRuns.length, failures: failures.length } },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.LEARNING_MINED, source: '14', severity: 'INFO',
    message: `Apprentissage : ${created} créé(s), ${refreshed} rafraîchi(s) — ${outInsights.filter((i) => i.state === 'VALIDATED').length} au seuil VALIDATED`,
    payload: { created, refreshed },
  });

  return {
    ok: true, created, refreshed, insights: outInsights,
    note: `Mining fondé exclusivement sur les faits enregistrés (INV-226). Seuil VALIDATED = ${INSIGHT_THRESHOLD} échantillons (INV-225). Aucune action automatique n'a été déduite — les recommandations restent des recommandations.`,
  };
}

/**
 * D.14.7 — Promotion gouvernée d'un insight VALIDATED vers la mémoire
 * sémantique (pont D.14 → D.13). Réversible : l'insight passe PROMOTED,
 * la mémoire créée reste une mémoire (INV-140) — jamais une politique.
 */
export async function promoteInsightToMemory(params: {
  insightUid: string; actorId?: string;
}): Promise<{ ok: boolean; status: number; errors: string[]; memoryKey?: string; evidenceUid?: string }> {
  const rec = await db.learningInsight.findUnique({ where: { insightUid: params.insightUid } });
  if (!rec) return { ok: false, status: 404, errors: [`insight introuvable : ${params.insightUid}`] };
  if (rec.state !== 'VALIDATED') {
    return { ok: false, status: 422, errors: [`insight ${rec.state} — seule une insight VALIDATED (≥ ${INSIGHT_THRESHOLD} échantillons, INV-225) peut être promue vers la mémoire`] };
  }
  const key = `learning.${rec.kind.toLowerCase()}.${rec.subject}`;
  const write = await writeMemory({
    kind: 'SEMANTIC', key,
    content: `${rec.recommendation} [métrique: ${rec.metric}]`,
    source: `${LEARNING_MODULE_ID} ← insight ${rec.insightUid}`,
    validation: 'PROBABLE', confidence: rec.confidence,
    actorType: 'SYSTEM', actorId: params.actorId ?? 'learning-engine',
  });
  if (!write.ok) return { ok: false, status: write.status, errors: write.errors };
  await db.learningInsight.update({ where: { id: rec.id }, data: { state: 'PROMOTED' } });
  const evidence = await captureAndPersist({
    category: 'MODEL', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: params.actorId ?? 'learning-engine',
    claim: `Promotion gouvernée insight ${rec.insightUid} → mémoire ${key} (réversible : insight marqué PROMOTED, INV-151)`,
    payload: { insightUid: rec.insightUid, memoryKey: key, memoryEvidenceUid: write.evidenceUid },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.LEARNING_VALIDATED, source: '14', severity: 'SUCCESS',
    message: `Insight ${rec.insightUid} promu en mémoire ${key}`,
    payload: { insightUid: rec.insightUid, key, evidenceUid: evidence.uid },
  });
  return { ok: true, status: 200, errors: [], memoryKey: key, evidenceUid: evidence.uid };
}

export const LEARNING_BRIDGE_NOTE = `Pont D.14→D.13 via ${MEMORY_KRN} — la mémoire produite reste soumise à INV-140 (jamais une vérité automatique).`;
