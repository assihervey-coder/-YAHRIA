// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Merkle Evidence Sealing (Domain 11)
// Doc ID: YAHRIA-KRN-016 | R8 Supremacy Pack
//
// Upgrades the linear SHA-256 evidence chain to a MERKLE DAG:
//   • O(log n) inclusion proofs for any single evidence record
//   • O(1) bundle integrity via a single root hash
//   • TAMPER LOCALIZATION: the bundle stores the sealed leaf hash per
//     uid, so an audit names the EXACT records that were altered,
//     removed, or injected — never just "it broke".
//
// Cross-runtime parity: pure hashing over ordered leaves; a
// byte-identical Python twin lives in yahria-core (R8 parity).
//
// Constitutional anchors:
//   INV-033 — sealed evidence immutable
//   INV-110 — evidence integrity lifecycle
//   INV-191 — deterministic construction (leaf order = seal order)
// ═══════════════════════════════════════════════════════════════

import { sha256Hex } from './canonical';
import { emitYahriaEvent } from './realtime';

export interface MerkleTree {
  leaves: string[];        // leaf hashes (order = seal order)
  levels: string[][];      // levels[0] = leaves … last = [root]
  root: string;
  leafCount: number;
}

export interface MerkleProofStep { hash: string; direction: 'L' | 'R' }
export interface MerkleProof { index: number; leafHash: string; path: MerkleProofStep[]; root: string }

export interface EvidenceBundle {
  bundleUid: string;
  root: string;
  leafCount: number;
  sealedAt: string;
  sealHash: string;          // sha256 over canonical {root, leafCount, sealedAt}
  order: string[];           // evidenceUid per slot
  leafHashes: string[];      // sealed contentHash per slot (localization anchor)
}

// ── ME-1. TREE CONSTRUCTION (odd node duplicated — Bitcoin-style) ──

export function buildMerkleTree(leafHashes: string[]): MerkleTree {
  if (leafHashes.length === 0) {
    const empty = sha256Hex('');
    return { leaves: [], levels: [[empty]], root: empty, leafCount: 0 };
  }
  const levels: string[][] = [[...leafHashes]];
  let current = levels[0];
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      next.push(sha256Hex(left + right));
    }
    levels.push(next);
    current = next;
  }
  return { leaves: [...leafHashes], levels, root: current[0], leafCount: leafHashes.length };
}

// ── ME-2. INCLUSION PROOF (O(log n) witness) ───────────────────────

export function merkleInclusionProof(tree: MerkleTree, index: number): MerkleProof {
  if (index < 0 || index >= tree.leafCount) {
    throw new Error(`Leaf index ${index} out of bounds (0..${tree.leafCount - 1})`);
  }
  const path: MerkleProofStep[] = [];
  let i = index;
  for (let level = 0; level < tree.levels.length - 1; level++) {
    const nodes = tree.levels[level];
    const sibling = i % 2 === 0
      ? (i + 1 < nodes.length ? nodes[i + 1] : nodes[i])
      : nodes[i - 1];
    path.push({ hash: sibling, direction: i % 2 === 0 ? 'R' : 'L' });
    i = Math.floor(i / 2);
  }
  return { index, leafHash: tree.leaves[index], path, root: tree.root };
}

export function verifyInclusionProof(leafHash: string, proof: MerkleProof, root: string): boolean {
  if (proof.root !== root) return false;
  let acc = leafHash;
  for (const step of proof.path) {
    acc = step.direction === 'R' ? sha256Hex(acc + step.hash) : sha256Hex(step.hash + acc);
  }
  return acc === root;
}

// ── ME-3. BUNDLE SEALING ───────────────────────────────────────────

let bundleSeq = 0;

export function sealEvidenceBundle(
  records: { evidenceUid: string; contentHash: string }[],
  opts?: { now?: string },
): { bundle: EvidenceBundle; tree: MerkleTree } {
  if (records.length === 0) throw new Error('Refusing to seal an empty evidence bundle — a seal must commit to something (INV-033)');
  const sealedAt = opts?.now ?? new Date().toISOString();
  const order = records.map((r) => r.evidenceUid);
  const leafHashes = records.map((r) => r.contentHash);
  const tree = buildMerkleTree(leafHashes);
  bundleSeq += 1;
  const bundle: EvidenceBundle = {
    bundleUid: `BND-${String(bundleSeq).padStart(6, '0')}`,
    root: tree.root,
    leafCount: records.length,
    sealedAt,
    sealHash: sha256Hex(`${sha256Hex(tree.root)}|${records.length}|${sealedAt}`),
    order,
    leafHashes,
  };
  emitYahriaEvent({
    type: 'supremacy.merkle.sealed',
    source: '11',
    severity: 'SUCCESS',
    message: `Faisceau de preuves scellé — racine Merkle ${bundle.root.slice(0, 16)}… (${records.length} feuilles)`,
    payload: { bundleUid: bundle.bundleUid, root: bundle.root, sealHash: bundle.sealHash },
  });
  return { bundle, tree };
}

// ── ME-4. TAMPER AUDIT WITH EXACT LOCALIZATION ─────────────────────

export interface BundleAnomaly {
  type: 'HASH_MISMATCH' | 'MISSING' | 'EXTRA' | 'SEAL_MISMATCH';
  index: number | null;
  evidenceUid: string;
  detail: string;
}

export interface BundleAudit {
  intact: boolean;
  sealValid: boolean;
  recomputedRoot: string | null;
  anomalies: BundleAnomaly[];
  verdict: 'SEALED_INTACT' | 'TAMPERED';
}

/**
 * Audit presented records against a sealed bundle.
 * Detects and LOCALIZES: altered records (HASH_MISMATCH at slot i),
 * deletions (MISSING), post-seal injections (EXTRA), and tampered
 * bundle metadata (SEAL_MISMATCH).
 */
export function auditEvidenceBundle(
  records: { evidenceUid: string; contentHash: string }[],
  bundle: EvidenceBundle,
): BundleAudit {
  const anomalies: BundleAnomaly[] = [];
  const byUid = new Map(records.map((r) => [r.evidenceUid, r]));
  const presentUids = new Set(records.map((r) => r.evidenceUid));

  // 0) Bundle metadata integrity (root/count/time commit).
  const recomputedSeal = sha256Hex(`${sha256Hex(bundle.root)}|${bundle.leafCount}|${bundle.sealedAt}`);
  if (recomputedSeal !== bundle.sealHash) {
    anomalies.push({
      type: 'SEAL_MISMATCH', index: null, evidenceUid: '*',
      detail: `sealHash du faisceau invalide — métadonnées (racine/compteur/date) modifiées après scellement`,
    });
  }

  // 1) Deletions — sealed uid absent from presented records.
  bundle.order.forEach((uid, i) => {
    if (!presentUids.has(uid)) {
      anomalies.push({ type: 'MISSING', index: i, evidenceUid: uid, detail: `preuve scellée au slot ${i} absente — suppression détectée` });
    }
  });

  // 2) Injections — presented uid never sealed.
  for (const r of records) {
    if (!bundle.order.includes(r.evidenceUid)) {
      anomalies.push({ type: 'EXTRA', index: null, evidenceUid: r.evidenceUid, detail: 'enregistrement jamais scellé — injection post-scellement détectée' });
    }
  }

  // 3) Alterations — same uid at its slot, different content hash.
  bundle.order.forEach((uid, i) => {
    const rec = byUid.get(uid);
    if (!rec) return;
    if (rec.contentHash !== bundle.leafHashes[i]) {
      anomalies.push({
        type: 'HASH_MISMATCH', index: i, evidenceUid: uid,
        detail: `slot ${i} : hash présenté ${rec.contentHash.slice(0, 16)}… ≠ hash scellé ${bundle.leafHashes[i].slice(0, 16)}… — contenu altéré`,
      });
    }
  });

  const intact = anomalies.length === 0;
  emitYahriaEvent({
    type: 'supremacy.merkle.audited',
    source: '11',
    severity: intact ? 'SUCCESS' : 'CRITICAL',
    message: intact
      ? `Audit Merkle ${bundle.bundleUid} : intact (racine ${bundle.root.slice(0, 16)}…, ${bundle.leafCount} feuilles)`
      : `FALSIFICATION DÉTECTÉE dans ${bundle.bundleUid} — ${anomalies.length} anomalie(s) localisée(s)`,
    payload: { bundleUid: bundle.bundleUid, anomalies, verdict: intact ? 'SEALED_INTACT' : 'TAMPERED' },
  });
  return {
    intact,
    sealValid: !anomalies.some((a) => a.type === 'SEAL_MISMATCH'),
    recomputedRoot: buildMerkleTree(bundle.leafHashes).root,
    anomalies,
    verdict: intact ? 'SEALED_INTACT' : 'TAMPERED',
  };
}
