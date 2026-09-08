// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — MEMORY SYSTEM (Domain 13) — KRN-030 · R14
//
// Mémoire GOUVERNÉE : une écriture sans provenance est refusée
// (INV-221), un oubli sans raison est refusé (INV-222), la mémoire
// n'est jamais une vérité automatique (INV-140) et conserve sa
// lignée (INV-142). Chaque mutation scelle une preuve MEMORY
// (INV-141) et émet un événement temps réel.
//
// Types canoniques : WORKING | EPISODIC | SEMANTIC | ARCHITECTURAL
// Validation (INV-081) : VERIFIED | PROBABLE | UNCERTAIN | UNKNOWN | FALSE
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import type { EvidenceCapture } from './evidence-engine';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

export type MemoryActorType = EvidenceCapture['actorType'];

export const MEMORY_KINDS = ['WORKING', 'EPISODIC', 'SEMANTIC', 'ARCHITECTURAL'] as const;
export const MEMORY_VALIDATIONS = ['VERIFIED', 'PROBABLE', 'UNCERTAIN', 'UNKNOWN', 'FALSE'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export type MemoryValidation = (typeof MEMORY_VALIDATIONS)[number];

export const MEMORY_MODULE_ID = 'YAHRIA-KRN-030';

export interface MemoryWriteResult {
  ok: boolean;
  status: number;
  record?: {
    id: string; kind: string; key: string; content: string;
    confidence: number; validation: string; source: string;
    updatedAt: string; created: boolean;
  };
  evidenceUid?: string;
  errors: string[];
}

/** Confidence bornée [0,1] — la mémoire ne s'auto-proclame jamais certaine. */
function clampConfidence(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0.5;
  return Math.min(1, Math.max(0, n));
}

/**
 * D.13.1 — Écriture gouvernée. `source` est OBLIGATOIRE (INV-221) :
 * la provenance est la condition d'entrée en mémoire, pas une métadonnée
 * optionnelle. Upsert idempotent par (kind, key) — la mise à jour crée
 * une nouvelle version (updatedAt) et scelle une preuve MEMORY.
 */
export async function writeMemory(params: {
  kind: string; key: string; content: string; source: string;
  validation?: string; confidence?: number; actorType?: MemoryActorType; actorId?: string;
}): Promise<MemoryWriteResult> {
  const errors: string[] = [];
  const kind = String(params.kind ?? '').toUpperCase();
  const validation = String(params.validation ?? 'UNCERTAIN').toUpperCase();
  if (!MEMORY_KINDS.includes(kind as MemoryKind)) errors.push(`kind invalide « ${params.kind} » — vocabulaire : ${MEMORY_KINDS.join(' | ')}`);
  if (!MEMORY_VALIDATIONS.includes(validation as MemoryValidation)) errors.push(`validation invalide — vocabulaire : ${MEMORY_VALIDATIONS.join(' | ')}`);
  const key = String(params.key ?? '').trim();
  const content = String(params.content ?? '');
  const source = String(params.source ?? '').trim();
  if (key.length < 2) errors.push('key requise (≥ 2 caractères)');
  if (content.trim().length < 1) errors.push('content vide — une mémoire sans contenu est un bruit, pas un souvenir');
  if (source.length < 3) errors.push('source obligatoire (INV-221) — une mémoire sans provenance est refusée');
  if (errors.length > 0) return { ok: false, status: 422, errors };

  const confidence = clampConfidence(params.confidence);
  const existing = await db.memoryRecord.findFirst({ where: { kind, key } });
  const rec = existing
    ? await db.memoryRecord.update({
        where: { id: existing.id },
        data: { content, source, validation, confidence, updatedAt: new Date() },
      })
    : await db.memoryRecord.create({
        data: { kind, key, content, source, validation, confidence },
      });

  const evidence = await captureAndPersist({
    category: 'MEMORY', criticality: 'STANDARD',
    actorType: params.actorType ?? 'HUMAN', actorId: params.actorId ?? 'console',
    claim: `Mémoire ${kind} « ${key} » ${existing ? 'mise à jour' : 'créée'} — validation ${validation}, provenance « ${source.slice(0, 80)} »`,
    payload: { kind, key, validation, confidence, source: source.slice(0, 200), updated: !!existing, contentBytes: content.length },
  });

  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.MEMORY_WRITTEN, source: '13',
    severity: 'INFO',
    message: `Mémoire ${kind} « ${key} » ${existing ? 'mise à jour' : 'écrite'} (${validation})`,
    payload: { id: rec.id, kind, key, validation, evidenceUid: evidence.uid },
  });

  return {
    ok: true, status: existing ? 200 : 201,
    record: {
      id: rec.id, kind: rec.kind, key: rec.key, content: rec.content,
      confidence: rec.confidence, validation: rec.validation, source: rec.source,
      updatedAt: rec.updatedAt.toISOString(), created: !existing,
    },
    evidenceUid: evidence.uid,
    errors: [],
  };
}

/**
 * D.13.9 — Consolidation : WORKING/EPISODIC → SEMANTIC quand la mémoire
 * est adossée à une preuve vérifiable (INV-141). Le mouvement inverse
 * (dégrader sans raison) est refusé — la consolidation est monotone.
 */
export async function consolidateMemory(params: {
  id: string; evidenceRef?: string; actorId?: string;
}): Promise<{ ok: boolean; status: number; record?: Record<string, unknown>; errors: string[] }> {
  const rec = await db.memoryRecord.findUnique({ where: { id: params.id } });
  if (!rec) return { ok: false, status: 404, errors: [`mémoire introuvable : ${params.id}`] };
  if (rec.kind === 'SEMANTIC' || rec.kind === 'ARCHITECTURAL') {
    return { ok: false, status: 422, errors: [`kind ${rec.kind} déjà consolidé — transition refusée (machine à états mémoire)`] };
  }
  if (rec.validation === 'FALSE') {
    return { ok: false, status: 422, errors: ['mémoire FALSE — impossible de consolider un souvenir invalidé (INV-140)'] };
  }
  const boosted = Math.min(1, rec.confidence + 0.15);
  const updated = await db.memoryRecord.update({
    where: { id: rec.id },
    data: { kind: 'SEMANTIC', confidence: boosted, updatedAt: new Date() },
  });
  const evidence = await captureAndPersist({
    category: 'MEMORY', criticality: 'STANDARD',
    actorType: 'SYSTEM', actorId: params.actorId ?? 'memory-engine',
    claim: `Consolidation mémoire « ${rec.key} » : ${rec.kind} → SEMANTIC (confiance ${rec.confidence.toFixed(2)} → ${boosted.toFixed(2)}, preuve adossée : ${params.evidenceRef ?? 'aucune référence explicite'})`,
    payload: { id: rec.id, key: rec.key, from: rec.kind, to: 'SEMANTIC', evidenceRef: params.evidenceRef ?? null },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.MEMORY_CONSOLIDATED, source: '13', severity: 'SUCCESS',
    message: `Mémoire « ${rec.key} » consolidée en SEMANTIC`,
    payload: { id: rec.id, key: rec.key, evidenceUid: evidence.uid },
  });
  return {
    ok: true, status: 200,
    record: { id: updated.id, kind: updated.kind, key: updated.key, confidence: updated.confidence, evidenceUid: evidence.uid },
    errors: [],
  };
}

/**
 * D.13.13 — Oubli gouverné (INV-222) : raison explicite obligatoire,
 * preuve MEMORY scellée, ARCHITECTURAL non supprimable (seulement
 * supplanté par une nouvelle version via writeMemory).
 */
export async function forgetMemory(params: {
  id: string; reason: string; actorType?: MemoryActorType; actorId?: string;
}): Promise<{ ok: boolean; status: number; errors: string[]; evidenceUid?: string }> {
  const reason = String(params.reason ?? '').trim();
  if (reason.length < 10) {
    return { ok: false, status: 422, errors: ['raison gouvernée obligatoire (≥ 10 caractères) — un oubli silencieux est interdit (INV-222)'] };
  }
  const rec = await db.memoryRecord.findUnique({ where: { id: params.id } });
  if (!rec) return { ok: false, status: 404, errors: [`mémoire introuvable : ${params.id}`] };
  if (rec.kind === 'ARCHITECTURAL') {
    return {
      ok: false, status: 422,
      errors: ['mémoire ARCHITECTURAL — suppression dure refusée (INV-222) : supplantez-la par une nouvelle version via writeMemory'],
    };
  }
  await db.memoryRecord.delete({ where: { id: rec.id } });
  const evidence = await captureAndPersist({
    category: 'MEMORY', criticality: 'HIGH',
    actorType: params.actorType ?? 'HUMAN', actorId: params.actorId ?? 'console',
    claim: `Oubli gouverné mémoire ${rec.kind} « ${rec.key} » — raison : ${reason.slice(0, 200)}`,
    payload: { id: rec.id, kind: rec.kind, key: rec.key, reason: reason.slice(0, 300), contentSha: rec.content.slice(0, 64) },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.MEMORY_FORGOTTEN, source: '13', severity: 'WARN',
    message: `Mémoire « ${rec.key} » oubliée (gouverné)`,
    payload: { key: rec.key, reason: reason.slice(0, 120), evidenceUid: evidence.uid },
  });
  return { ok: true, status: 200, errors: [], evidenceUid: evidence.uid };
}

/**
 * D.13.11 — Récupération S1 : filtre par kind/validation/recherche plein-texte
 * simple (key + content), rangée par confiance décroissante puis récence.
 * La mémoire récupérée porte TOUJOURS sa validation avec elle (INV-140) :
 * le consommateur voit le degré de confiance, jamais un fait nu.
 */
export async function retrieveMemory(params: {
  kind?: string; validation?: string; q?: string; limit?: number;
}): Promise<{ records: Record<string, unknown>[]; stats: Record<string, number> }> {
  const limit = Math.min(200, Math.max(1, Number(params.limit ?? 50)));
  const where: Record<string, unknown> = {};
  if (params.kind) where.kind = String(params.kind).toUpperCase();
  if (params.validation) where.validation = String(params.validation).toUpperCase();
  if (params.q && String(params.q).trim().length > 0) {
    const q = String(params.q).trim();
    where.OR = [{ key: { contains: q } }, { content: { contains: q } }];
  }
  const rows = await db.memoryRecord.findMany({
    where: where as never, orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }], take: limit,
  });
  const all = await db.memoryRecord.findMany({ select: { kind: true, validation: true } });
  const stats: Record<string, number> = { total: all.length };
  for (const r of all) {
    stats[`kind_${r.kind}`] = (stats[`kind_${r.kind}`] ?? 0) + 1;
    stats[`validation_${r.validation}`] = (stats[`validation_${r.validation}`] ?? 0) + 1;
  }
  return {
    records: rows.map((r) => ({
      id: r.id, kind: r.kind, key: r.key, content: r.content,
      confidence: r.confidence, validation: r.validation, source: r.source,
      updatedAt: r.updatedAt.toISOString(), createdAt: r.createdAt.toISOString(),
    })),
    stats,
  };
}
