// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Evidence Engine (Domain 11)
// Doc ID: YAHRIA-KRN-005 | Source: EVIDENCE_MANIFEST.md
// CLAIM + PROVENANCE + INTEGRITY + CONTEXT + TIME + LINEAGE = VERIFIABLE EVIDENCE
// ═══════════════════════════════════════════════════════════════

import { createHash } from 'crypto';
import type { EvidenceState } from './types';

export type EvidenceCategory =
  | 'CODE' | 'BUILD' | 'TEST' | 'EXECUTION' | 'TOOL' | 'AGENT' | 'MODEL'
  | 'POLICY' | 'SECURITY' | 'CONFIGURATION' | 'DATABASE' | 'ARTIFACT'
  | 'TRACE' | 'METRIC' | 'AUDIT' | 'RELEASE' | 'DEPLOYMENT' | 'INCIDENT'
  | 'FORENSIC' | 'REPLAY';

export type Criticality = 'CRITICAL' | 'HIGH' | 'STANDARD' | 'LOW' | 'INFORMATIONAL';

export interface EvidenceCapture {
  category: EvidenceCategory;
  criticality: Criticality;
  actorType: 'HUMAN' | 'AGENT' | 'SYSTEM' | 'TOOL' | 'MODEL';
  actorId: string;
  claim: string;
  payload?: Record<string, unknown>;
  executionId?: string;
  taskId?: string;
  traceId?: string;
  tenantContext?: string;
  organizationContext?: string;
  policyVersion?: string;
}

export interface EvidenceRecord {
  evidenceUid: string;
  category: EvidenceCategory;
  criticality: Criticality;
  state: EvidenceState;
  actorType: string;
  actorId: string;
  claim: string;
  payload: string | null;
  contentHash: string;
  prevHash: string | null;
  createdAt: string;
}

let seq = 0;
const hashChain: string[] = [];

/** Align the UID counter with durable storage (survives process restarts). */
export function setSeqStart(n: number) {
  if (n > seq) seq = n;
}

function nextUid(category: EvidenceCategory): string {
  seq += 1;
  return `EV-${category}-${String(seq).padStart(6, '0')}`;
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// Canonical lifecycle: DECLARED → CAPTURED → NORMALIZED → HASHED → LINKED → VERIFIED → SEALED
export const EVIDENCE_LIFECYCLE: EvidenceState[] = [
  'DECLARED', 'CAPTURED', 'NORMALIZED', 'HASHED', 'LINKED', 'VERIFIED', 'SEALED',
];

export function captureEvidence(input: EvidenceCapture): EvidenceRecord {
  const payloadJson = input.payload ? JSON.stringify({ ...input.payload, capturedAt: new Date().toISOString() }) : null;
  const prevHash = hashChain.length > 0 ? hashChain[hashChain.length - 1] : null;
  const contentHash = hashPayload({
    category: input.category,
    claim: input.claim,
    actor: `${input.actorType}:${input.actorId}`,
    payload: payloadJson,
    prevHash,
  });
  hashChain.push(contentHash);
  return {
    evidenceUid: nextUid(input.category),
    category: input.category,
    criticality: input.criticality,
    state: 'HASHED',
    actorType: input.actorType,
    actorId: input.actorId,
    claim: input.claim,
    payload: payloadJson,
    contentHash,
    prevHash,
    createdAt: new Date().toISOString(),
  };
}

export function verifyEvidence(record: EvidenceRecord): { ok: boolean; reason: string } {
  if (record.state === 'SEALED' || record.state === 'VERIFIED') {
    // recompute integrity
    const recomputed = hashPayload({ category: record.category, claim: record.claim, actor: `${record.actorType}:${record.actorId}`, payload: record.payload, prevHash: record.prevHash });
    if (recomputed !== record.contentHash) {
      return { ok: false, reason: 'INTEGRITY FAILURE: recomputed hash differs — evidence CORRUPTED (INV-110)' };
    }
    return { ok: true, reason: 'Integrity verified: content hash matches (INV-110)' };
  }
  if (['EXPIRED', 'DISPOSED', 'INVALID', 'CORRUPTED'].includes(record.state)) {
    return { ok: false, reason: `Evidence in terminal failure state ${record.state} — cannot verify` };
  }
  return { ok: false, reason: `Evidence not yet in verifiable state (current: ${record.state})` };
}

// EVIDENCE MINIMUM CONTRACT check (EVIDENCE_MANIFEST §9)
export function checkMinimumContract(input: EvidenceCapture): { ok: boolean; missing: string[] } {
  const required: (keyof EvidenceCapture)[] = [
    'category', 'criticality', 'actorType', 'actorId', 'claim',
  ];
  const missing = required.filter((k) => input[k] === undefined || input[k] === null || input[k] === '');
  const contextRequired = input.criticality === 'CRITICAL' || input.criticality === 'HIGH';
  if (contextRequired && !input.executionId && !input.taskId && !input.traceId) {
    missing.push('executionId|taskId|traceId (critical evidence requires execution context)');
  }
  return { ok: missing.length === 0, missing };
}
