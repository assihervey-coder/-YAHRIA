// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — API GATEWAY (Domain 17) — KRN-034 · R14
//
// Surface externe versionnée /api/v1 gouvernée :
//   - Clés API stockées en SHA-256 UNIQUEMENT (INV-229) — le
//     plaintext est retourné UNE fois à l'émission, jamais relisible.
//   - Scopes hiérarchiques read < write < admin ; requête hors
//     scope → 403, clé inconnue/révoquée → 401 (INV-230).
//   - Rate limit par clé (fenêtre glissante 60 s) PERSISTÉ en base
//     (INV-235) — partagé par toutes les instances, plus de compteur
//     mémoire contournable par scaling horizontal.
//   - Chaque appel versionné émet un événement observabilité.
// ═══════════════════════════════════════════════════════════════

import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

export const API_GATEWAY_MODULE_ID = 'YAHRIA-KRN-034';

export type ApiScope = 'read' | 'write' | 'admin';
export const SCOPE_HIERARCHY: Record<ApiScope, number> = { read: 1, write: 2, admin: 3 };

export interface IssuedKey {
  id: string; name: string; keyPrefix: string;
  plaintext: string; // retourné UNE seule fois (INV-229)
  scopes: string[]; rateLimitPerMin: number;
}

export async function issueApiKey(params: {
  name: string; scopes?: string[]; rateLimitPerMin?: number; actorId?: string;
}): Promise<{ ok: boolean; status: number; errors: string[]; key?: IssuedKey }> {
  const name = String(params.name ?? '').trim();
  const scopesRaw = params.scopes ?? ['read'];
  const scopes = scopesRaw.map((s) => String(s).toLowerCase());
  if (name.length < 3) return { ok: false, status: 422, errors: ['nom de clé requis (≥ 3 caractères)'] };
  if (scopes.length === 0 || scopes.some((s) => !(s in SCOPE_HIERARCHY))) {
    return { ok: false, status: 422, errors: [`scopes invalides — vocabulaire : ${Object.keys(SCOPE_HIERARCHY).join(' | ')}`] };
  }
  const rateLimitPerMin = Math.min(600, Math.max(5, Number(params.rateLimitPerMin ?? 60)));

  const secret = `yah_live_${randomBytes(24).toString('hex')}`;
  const keyHash = createHash('sha256').update(secret).digest('hex');
  const keyPrefix = secret.slice(0, 16);
  const row = await db.apiKey.create({
    data: { name, keyPrefix, keyHash, scopes: scopes.join(','), rateLimitPerMin },
  });
  const evidence = await captureAndPersist({
    category: 'SECURITY', criticality: 'HIGH', actorType: 'HUMAN', actorId: params.actorId ?? 'console',
    claim: `Clé API émise « ${name} » — prefix ${keyPrefix}, scopes [${scopes.join(', ')}], rate ${rateLimitPerMin}/min — hash SHA-256 stocké, plaintext NON conservé (INV-229)`,
    payload: { id: row.id, name, keyPrefix, scopes, rateLimitPerMin },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.APIKEY_ISSUED, source: '17', severity: 'INFO',
    message: `Clé API « ${name} » émise (${scopes.join(', ')})`,
    payload: { id: row.id, keyPrefix, evidenceUid: evidence.uid },
  });
  return {
    ok: true, status: 201, errors: [],
    key: { id: row.id, name, keyPrefix, plaintext: secret, scopes, rateLimitPerMin },
  };
}

export async function revokeApiKey(params: {
  id: string; reason: string; actorId?: string;
}): Promise<{ ok: boolean; status: number; errors: string[] }> {
  const reason = String(params.reason ?? '').trim();
  if (reason.length < 10) return { ok: false, status: 422, errors: ['raison de révocation obligatoire (≥ 10 caractères) — INV-201'] };
  const row = await db.apiKey.findUnique({ where: { id: params.id } });
  if (!row) return { ok: false, status: 404, errors: ['clé introuvable'] };
  if (row.revokedAt) return { ok: false, status: 422, errors: ['clé déjà révoquée'] };
  await db.apiKey.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  const evidence = await captureAndPersist({
    category: 'SECURITY', criticality: 'HIGH', actorType: 'HUMAN', actorId: params.actorId ?? 'console',
    claim: `Clé API « ${row.name} » révoquée — raison : ${reason.slice(0, 200)}`,
    payload: { id: row.id, keyPrefix: row.keyPrefix, reason: reason.slice(0, 300) },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.APIKEY_REVOKED, source: '17', severity: 'WARN',
    message: `Clé API « ${row.name} » révoquée`,
    payload: { id: row.id, evidenceUid: evidence.uid },
  });
  return { ok: true, status: 200, errors: [] };
}

// ── AG-2. VERIFICATION + RATE LIMIT (persisté DB, INV-235) ──────
// Chaque appel enregistre un fait ApiRateEvent ; la fenêtre glissante
// 60 s est comptée en base — toutes les instances voient les mêmes
// faits. Débordement concurrent borné (comptage optimiste), purge
// opportuniste des faits > 10 min.

const RATE_WINDOW_MS = 60_000;
const RATE_PRUNE_MS = 600_000;
const RATE_PRUNE_PROBABILITY = 0.05;

export type AuthFailure = 'MISSING' | 'UNKNOWN' | 'REVOKED' | 'RATE_LIMITED';

export interface ApiAuth {
  ok: boolean;
  failure?: AuthFailure;
  keyId?: string; keyName?: string; keyPrefix?: string;
  scopes?: string[]; rateLimitPerMin?: number;
  detail: string;
}

export async function verifyApiKey(presented: string | null): Promise<ApiAuth> {
  const token = String(presented ?? '').trim();
  if (!token) {
    return { ok: false, failure: 'MISSING', detail: 'clé API absente — fournissez Authorization: Bearer yah_live_… (INV-230)' };
  }
  const keyHash = createHash('sha256').update(token).digest('hex');
  const row = await db.apiKey.findUnique({ where: { keyHash } });
  if (!row) {
    return { ok: false, failure: 'UNKNOWN', detail: 'clé inconnue — 401, aucun contournement (INV-133/230)' };
  }
  if (row.revokedAt) {
    return { ok: false, failure: 'REVOKED', keyId: row.id, detail: `clé « ${row.name} » révoquée le ${row.revokedAt.toISOString()}` };
  }
  // Sliding 60 s window per key — PERSISTED (INV-235), shared by all instances
  const now = Date.now();
  await db.apiRateEvent.create({ data: { keyId: row.id } });
  const windowCount = await db.apiRateEvent.count({
    where: { keyId: row.id, ts: { gte: new Date(now - RATE_WINDOW_MS) } },
  });
  if (windowCount > row.rateLimitPerMin) {
    return { ok: false, failure: 'RATE_LIMITED', keyId: row.id, keyName: row.name, detail: `rate limit dépassé (${row.rateLimitPerMin}/min) — réessayez plus tard` };
  }
  if (Math.random() < RATE_PRUNE_PROBABILITY) {
    await db.apiRateEvent.deleteMany({ where: { ts: { lt: new Date(now - RATE_PRUNE_MS) } } }).catch(() => undefined);
  }
  await db.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return {
    ok: true, keyId: row.id, keyName: row.name, keyPrefix: row.keyPrefix,
    scopes: row.scopes.split(','), rateLimitPerMin: row.rateLimitPerMin,
    detail: `clé « ${row.name} » acceptée (${row.rateLimitPerMin}/min)`,
  };
}

export function scopeCovers(granted: string[] | undefined, needed: ApiScope): boolean {
  const level = SCOPE_HIERARCHY[needed];
  return (granted ?? []).some((s) => s in SCOPE_HIERARCHY && SCOPE_HIERARCHY[s as ApiScope] >= level);
}

export function logV1Call(input: { keyName: string; resource: string; method: string; status: number; ms: number }): void {
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.API_V1_CALL, source: '17', severity: 'INFO',
    message: `API v1 ${input.method} /api/v1/${input.resource} → ${input.status} (${input.ms} ms) · clé « ${input.keyName} »`,
    payload: { resource: input.resource, method: input.method, status: input.status, ms: input.ms },
  });
}
