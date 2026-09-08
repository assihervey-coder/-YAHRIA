// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Reproducible Workspace Attestation (Domain 19/21)
// Doc ID: YAHRIA-KRN-022 | R8 Supremacy Pack
//
// Supply-chain-grade attestation for every generated workspace
// (in-toto / SLSA provenance flavor, adapted to the constitution):
//
//   subject      — per-file {path, sha256, bytes}
//   merkleRoot   — single hash committing to the whole file set
//   provenance   — mission uid, generator identity, kernel version
//   signature    — HMAC-SHA256 over the canonical attestation body
//
// Consumers can verify WITHOUT the generator: recompute per-file
// hashes, the Merkle root, and the signature. Any divergence names
// the exact tampered paths. Two attestations can be DIFFed to prove
// no validated capability silently regressed (INV-172).
//
// NOTE: the demo signing key is a build constant. Production MUST
// move signing to a KMS/HSM and keep the key out of the repo (INV-132).
//
// Constitutional anchors:
//   INV-190 — versioned, reproducible executions
//   INV-172 — regression protection via attestation diff
//   INV-102 — assertion + verifiable evidence
// ═══════════════════════════════════════════════════════════════

import { sha256Canonical, hmacSha256Hex } from './canonical';
import { buildMerkleTree } from './merkle-evidence';
import { emitYahriaEvent } from './realtime';

export const ATTESTATION_KEY_ID = 'YAHRIA-DEV-ATTEST-KEY-V1';
const ATTESTATION_KEY = 'yahria-dev-attest-key-do-not-use-in-production'; // KMS in prod (INV-132)

export const KERNEL_VERSION = '1.0.0';

export interface SubjectEntry { path: string; sha256: string; bytes: number }
export interface AttestationMeta {
  generator: string;            // e.g. 'YAHRIA-STUDIO-CODER'
  missionUid?: string;
  runUid?: string;
  note?: string;
}

export interface Attestation {
  attestationUid: string;
  version: '1.0.0';
  predicateType: 'https://yahria.os/attestations/workspace/v1';
  subject: SubjectEntry[];
  merkleRoot: string;
  provenance: Required<Pick<AttestationMeta, 'generator'>> & AttestationMeta;
  kernelVersion: string;
  sealedAt: string;
  signature: string;
  keyId: string;
}

let attSeq = 0;

// ── AT-1. BUILD ────────────────────────────────────────────────────

export function buildAttestation(
  files: { path: string; content: string }[],
  meta: AttestationMeta,
  opts?: { now?: string },
): Attestation {
  if (files.length === 0) throw new Error('Refusing to attest an empty workspace (INV-102)');
  const deduped = new Map(files.map((f) => [f.path, f.content]));
  const subject: SubjectEntry[] = [...deduped.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path, content]) => ({ path, sha256: sha256Canonical(content), bytes: Buffer.byteLength(content, 'utf8') }));
  const merkleRoot = buildMerkleTree(subject.map((s) => s.sha256)).root;
  const sealedAt = opts?.now ?? new Date().toISOString();
  attSeq += 1;
  const body = {
    version: '1.0.0' as const,
    predicateType: 'https://yahria.os/attestations/workspace/v1' as const,
    subject,
    merkleRoot,
    provenance: { generator: meta.generator, missionUid: meta.missionUid, runUid: meta.runUid, note: meta.note },
    kernelVersion: KERNEL_VERSION,
    sealedAt,
  };
  const attestation: Attestation = {
    attestationUid: `AT-${String(attSeq).padStart(6, '0')}`,
    ...body,
    signature: hmacSha256Hex(ATTESTATION_KEY, body),
    keyId: ATTESTATION_KEY_ID,
  };
  emitYahriaEvent({
    type: 'supremacy.attestation.sealed',
    source: '19',
    severity: 'SUCCESS',
    message: `Attestation ${attestation.attestationUid} scellée — ${subject.length} fichier(s), racine ${merkleRoot.slice(0, 16)}…`,
    payload: { attestationUid: attestation.attestationUid, merkleRoot, files: subject.length },
  });
  return attestation;
}

// ── AT-2. VERIFY (independent of the generator) ────────────────────

export interface AttestationMismatch { path: string; kind: 'HASH' | 'SIZE' | 'MISSING' | 'EXTRA'; expected: string; actual: string }
export interface AttestationVerdict {
  valid: boolean;
  signatureValid: boolean;
  rootMatch: boolean;
  mismatches: AttestationMismatch[];
  verdict: 'TRUSTED' | 'MISMATCH' | 'TAMPERED_SIGNATURE';
}

export function verifyAttestation(att: Attestation, files: { path: string; content: string }[]): AttestationVerdict {
  // Signature first — body tampering is caught before content checks.
  const body = {
    version: att.version,
    predicateType: att.predicateType,
    subject: att.subject,
    merkleRoot: att.merkleRoot,
    provenance: att.provenance,
    kernelVersion: att.kernelVersion,
    sealedAt: att.sealedAt,
  };
  const signatureValid = hmacSha256Hex(ATTESTATION_KEY, body) === att.signature;

  const presented = new Map(files.map((f) => [f.path, f.content]));
  const mismatches: AttestationMismatch[] = [];
  for (const s of att.subject) {
    const content = presented.get(s.path);
    if (content === undefined) {
      mismatches.push({ path: s.path, kind: 'MISSING', expected: s.sha256.slice(0, 16) + '…', actual: 'absent' });
      continue;
    }
    const h = sha256Canonical(content);
    if (h !== s.sha256) {
      mismatches.push({ path: s.path, kind: 'HASH', expected: s.sha256.slice(0, 16) + '…', actual: h.slice(0, 16) + '…' });
      continue;
    }
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes !== s.bytes) {
      mismatches.push({ path: s.path, kind: 'SIZE', expected: String(s.bytes), actual: String(bytes) });
    }
  }
  const attestedPaths = new Set(att.subject.map((s) => s.path));
  for (const p of presented.keys()) {
    if (!attestedPaths.has(p)) {
      mismatches.push({ path: p, kind: 'EXTRA', expected: 'non attesté', actual: 'présent' });
    }
  }

  const recomputedRoot = buildMerkleTree(
    [...presented.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .filter(([p]) => attestedPaths.has(p))
      .map(([, content]) => sha256Canonical(content)),
  ).root;
  // Root match: the tree recomputed over the PRESENTED attested files
  // must equal the sealed root — any content change or missing file
  // breaks it (EXTRA files are excluded from the recompute).
  const rootMatch = att.subject.length > 0 && recomputedRoot === att.merkleRoot;

  const valid = signatureValid && rootMatch && mismatches.length === 0;
  emitYahriaEvent({
    type: 'supremacy.attestation.verified',
    source: '19',
    severity: valid ? 'SUCCESS' : 'CRITICAL',
    message: valid
      ? `Attestation ${att.attestationUid} VÉRIFIÉE — signature + racine + contenu intacts`
      : `Attestation ${att.attestationUid} REJETÉE — ${mismatches.length} divergence(s), signature ${signatureValid ? 'valide' : 'INVALIDE'}`,
    payload: { attestationUid: att.attestationUid, valid, mismatches },
  });
  return {
    valid,
    signatureValid,
    rootMatch,
    mismatches,
    verdict: !signatureValid ? 'TAMPERED_SIGNATURE' : valid ? 'TRUSTED' : 'MISMATCH',
  };
}

// ── AT-3. DIFF (regression guard between two sealed states) ────────

export interface AttestationDiff {
  added: { path: string; sha256: string }[];
  removed: { path: string; sha256: string }[];
  modified: { path: string; from: string; to: string }[];
  unchanged: number;
}

export function diffAttestations(before: Attestation, after: Attestation): AttestationDiff {
  const a = new Map(before.subject.map((s) => [s.path, s.sha256]));
  const b = new Map(after.subject.map((s) => [s.path, s.sha256]));
  const added: AttestationDiff['added'] = [];
  const removed: AttestationDiff['removed'] = [];
  const modified: AttestationDiff['modified'] = [];
  let unchanged = 0;
  for (const [path, hash] of b) {
    const prev = a.get(path);
    if (prev === undefined) added.push({ path, sha256: hash });
    else if (prev !== hash) modified.push({ path, from: prev.slice(0, 16) + '…', to: hash.slice(0, 16) + '…' });
    else unchanged += 1;
  }
  for (const [path, hash] of a) {
    if (!b.has(path)) removed.push({ path, sha256: hash });
  }
  return { added, removed, modified, unchanged };
}


