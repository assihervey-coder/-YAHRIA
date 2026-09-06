// ═══════════════════════════════════════════════════════════════
// R8 PARITY FIXTURES — TS reference → Python twin (yahria-core)
// Generates yahria-core/tests/fixtures/supremacy/merkle.json from
// the authoritative TypeScript implementation. The pytest suite then
// proves the Python twin produces byte-identical results (R7.1 method).
// Run: npx tsx scripts/r8-supremacy-fixtures.ts
// ═══════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { sealEvidenceBundle, merkleInclusionProof, verifyInclusionProof, auditEvidenceBundle } from '../src/lib/yahria/merkle-evidence';
import { canonicalJson, sha256Canonical } from '../src/lib/yahria/canonical';

const records = Array.from({ length: 8 }, (_, i) => ({
  evidenceUid: `EV-TEST-${String(i + 1).padStart(6, '0')}`,
  contentHash: sha256Canonical({ record: i, claim: `parity leaf ${i}` }),
}));

const { bundle, tree } = sealEvidenceBundle(records, { now: '2026-09-07T00:00:00.000Z' });

const proofs = [0, 3, 7].map((i) => {
  const p = merkleInclusionProof(tree, i);
  return {
    index: i,
    leafHash: p.leafHash,
    path: p.path,
    root: p.root,
    valid: verifyInclusionProof(p.leafHash, p, bundle.root),
  };
});

// Tamper case: leaf 5 altered → audit must localize slot 5.
const tampered = records.map((r, i) => (i === 5 ? { ...r, contentHash: 'f'.repeat(64) } : r));
const auditTamper = auditEvidenceBundle(tampered, bundle);
const auditIntact = auditEvidenceBundle(records, bundle);

const fixture = {
  meta: { generator: 'scripts/r8-supremacy-fixtures.ts', pack: 'R8', sealedAt: bundle.sealedAt },
  canonical: [
    { input: { b: 1, a: { d: 2, c: [3, 1] } }, expected: canonicalJson({ b: 1, a: { d: 2, c: [3, 1] } }) },
    { input: { a: 1, b: undefined }, expected: canonicalJson({ a: 1, b: undefined }) },
    { input: { x: [1, 2, 3] }, expectedSha256: sha256Canonical({ x: [1, 2, 3] }) },
  ],
  merkle: {
    leaves: records.map((r) => r.contentHash),
    order: bundle.order,
    root: bundle.root,
    leafCount: bundle.leafCount,
    sealHash: bundle.sealHash,
    proofs,
    auditIntact: { verdict: auditIntact.verdict, anomalies: auditIntact.anomalies },
    auditTamper: { verdict: auditTamper.verdict, anomalies: auditTamper.anomalies },
    tamperSlot: 5,
  },
};

const out = 'yahria-core/tests/fixtures/supremacy/merkle.json';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Fixtures R8 écrites: ${out}`);
console.log(`  root TS de référence: ${bundle.root}`);
console.log(`  preuves valides: ${proofs.every((p) => p.valid)}, audit altéré: ${auditTamper.verdict} @slot ${auditTamper.anomalies[0]?.index}`);
