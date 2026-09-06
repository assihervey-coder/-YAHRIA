// ═══════════════════════════════════════════════════════════════
// R8 SUPREMACY PACK — Proof Suite (tsx scripts/r8-supremacy-tests.ts)
// Exercises the 8 supremacy functions with REAL outputs and FAILS
// (exit 1) if any constitutional property breaks.
// ═══════════════════════════════════════════════════════════════

import { buildProofCertificate, verifyProofCertificate, standardPredicates, PROOF_CHECKERS } from '../src/lib/yahria/proof-carrying';
import { sealEvidenceBundle, auditEvidenceBundle, merkleInclusionProof, verifyInclusionProof, buildMerkleTree } from '../src/lib/yahria/merkle-evidence';
import { analyzeBlastRadius, type BlastGraph } from '../src/lib/yahria/blast-radius';
import { runDebate } from '../src/lib/yahria/debate-arbiter';
import { recordTimeline, replayTimeline, bisectReplay } from '../src/lib/yahria/time-travel';
import { fuzzConstitution, xorshift32 } from '../src/lib/yahria/fuzz-constitution';
import { selfHeal } from '../src/lib/yahria/self-heal';
import { buildAttestation, verifyAttestation, diffAttestations } from '../src/lib/yahria/attestation';
import { captureEvidence } from '../src/lib/yahria/evidence-engine';
import { canonicalJson, sha256Canonical } from '../src/lib/yahria/canonical';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const hr = (t: string) => console.log(`\n═══ ${t} ${'═'.repeat(Math.max(4, 62 - t.length))}`);

// ── 1. PROOF-CARRYING CODE ────────────────────────────────────────
hr('1. PROOF-CARRYING CODE — preuve embarquée ré-exécutable');
const goodFile = `import { createHash } from 'crypto';
export function checksum(x: string): string {
  return createHash('sha256').update(x).digest('hex');
}
`;
const { certificate, proofHash } = buildProofCertificate(
  { path: 'src/lib/checksum.ts', text: goodFile },
  standardPredicates('src/lib/checksum.ts', goodFile),
  { now: '2026-09-07T10:00:00.000Z' },
);
console.log(`  certificate=${certificate.certificateUid} predicates=${certificate.predicates.length} proofHash=${proofHash.slice(0, 24)}…`);
check('certificat VALIDE après ré-exécution indépendante', verifyProofCertificate(certificate).status === 'VALID');

const tamperedCert = JSON.parse(JSON.stringify(certificate)) as typeof certificate;
tamperedCert.predicates = tamperedCert.predicates.map((p) => ({ ...p, outcome: 'PASS' as const }));
tamperedCert.predicates[2].detail = 'falsified claim';
check('certificat FALSIFIÉ détecté (TAMPERED)', verifyProofCertificate(tamperedCert).status === 'TAMPERED');

const badFile = `import net from 'net';
const token = 'NOT-A-REAL-SECRET-TEST-FIXTURE-000000';
// TODO: implement
export function dial() { return net.connect(80);
`;
const badCert = buildProofCertificate({ path: 'src/net/client.ts', text: badFile }, standardPredicates('src/net/client.ts', badFile), { now: '2026-09-07T10:00:01.000Z' }).certificate;
const badVerdict = verifyProofCertificate(badCert);
check('fichier dangereux → INVALID', badVerdict.status === 'INVALID');
if (badVerdict.status === 'INVALID') {
  console.log(`     prédicats échoués: ${badVerdict.failed.map((f) => `${f.checker}(${f.invariant})`).join(', ')}`);
  check('≥3 défauts captés (import/secret/placeholder/délimiteurs)', badVerdict.failed.length >= 3, `got ${badVerdict.failed.length}`);
}

// ── 2. MERKLE EVIDENCE ────────────────────────────────────────────
hr('2. MERKLE EVIDENCE — scellement + localisation de falsification');
const clock = '2026-09-07T00:00:00.000Z';
const records = Array.from({ length: 8 }, (_, i) => captureEvidence({
  category: 'TEST' as const, criticality: 'STANDARD' as const, actorType: 'SYSTEM' as const,
  actorId: 'r8-suite', claim: `evidence record #${i}`, payload: { i },
}, { now: clock }));
const { bundle, tree } = sealEvidenceBundle(records, { now: clock });
console.log(`  bundle=${bundle.bundleUid} root=${bundle.root.slice(0, 24)}… leaves=${bundle.leafCount} depth=${tree.levels.length - 1}`);
check('racine Merkle déterministe', bundle.root === buildMerkleTree(records.map((r) => r.contentHash)).root);

const proof3 = merkleInclusionProof(tree, 3);
check(`preuve d'inclusion O(log n) pour la feuille 3 (chemin=${proof3.path.length})`, verifyInclusionProof(proof3.leafHash, proof3, bundle.root));

const tampered = records.map((r) => ({ ...r }));
tampered[3] = { ...tampered[3], contentHash: 'f'.repeat(64) };
const audit = auditEvidenceBundle(tampered, bundle);
check('altération d\'une feuille → TAMPERED', audit.verdict === 'TAMPERED');
check('falsification LOCALISÉE au slot 3 / uid exact', audit.anomalies.some((a) => a.type === 'HASH_MISMATCH' && a.index === 3 && a.evidenceUid === records[3].evidenceUid),
  JSON.stringify(audit.anomalies));

const deleted = records.filter((_, i) => i !== 6).map((r) => ({ ...r }));
const auditDel = auditEvidenceBundle(deleted, bundle);
check('suppression détectée (MISSING au slot 6)', auditDel.anomalies.some((a) => a.type === 'MISSING' && a.index === 6));

const injected = [...records.map((r) => ({ ...r })), { evidenceUid: 'EV-INTRUDER-000001', contentHash: 'a'.repeat(64) }];
const auditInj = auditEvidenceBundle(injected, bundle);
check('injection post-scellement détectée (EXTRA)', auditInj.anomalies.some((a) => a.type === 'EXTRA' && a.evidenceUid === 'EV-INTRUDER-000001'));

check('faisceau intact → SEALED_INTACT', auditEvidenceBundle(records, bundle).verdict === 'SEALED_INTACT');

// ── 3. BLAST RADIUS ───────────────────────────────────────────────
hr('3. BLAST RADIUS — impact sémantique + auto-DENY constitutionnel');
const graph: BlastGraph = {
  nodes: [
    { path: 'src/lib/yahria/policy-engine.ts', domain: '12', tested: true },
    { path: 'src/app/api/yahria/policy/route.ts', domain: '17', tested: false },
    { path: 'src/components/yahria/policy-panel.tsx', domain: '18', tested: false },
    { path: 'src/lib/studio.ts', domain: '06', tested: true },
    { path: 'src/lib/studio-pipeline.ts', domain: '08', tested: true },
    { path: 'src/app/page.tsx', domain: '18', tested: false },
  ],
  edges: [
    { from: 'src/app/api/yahria/policy/route.ts', to: 'src/lib/yahria/policy-engine.ts' },
    { from: 'src/components/yahria/policy-panel.tsx', to: 'src/lib/yahria/policy-engine.ts' },
    { from: 'src/lib/studio-pipeline.ts', to: 'src/lib/studio.ts' },
    { from: 'src/app/page.tsx', to: 'src/components/yahria/policy-panel.tsx' },
  ],
};
const rPolicy = analyzeBlastRadius(graph, 'src/lib/yahria/policy-engine.ts', { changeType: 'modify' });
console.log(`  policy-engine.ts → verdict=${rPolicy.verdict} risk=${rPolicy.riskScore} affectés=${rPolicy.affectedCount} profondeur=${rPolicy.maxDepth}`);
check('mutation du noyau de gouvernance (D.12) sans approbation → DENY', rPolicy.verdict === 'DENY' && rPolicy.governanceCoreHit);
check('invariants INV-180/INV-181 cités', rPolicy.invariantsHit.some((i) => i.id === 'INV-180') && rPolicy.invariantsHit.some((i) => i.id === 'INV-181'));
check('fermeture transitive correcte (3 dépendants)', rPolicy.affectedCount === 3, `got ${rPolicy.affectedCount}`);

const rPolicyApproved = analyzeBlastRadius(graph, 'src/lib/yahria/policy-engine.ts', { changeType: 'modify', approved: true });
check('même mutation AVEC approbation → REQUIRE_APPROVAL (garde maintenue)', rPolicyApproved.verdict === 'REQUIRE_APPROVAL');

const cycleGraph: BlastGraph = {
  nodes: [
    { path: 'a.ts', domain: '06', tested: true },
    { path: 'b.ts', domain: '08', tested: true },
    { path: 'c.ts', domain: '07', tested: true },
  ],
  edges: [
    { from: 'a.ts', to: 'b.ts' },
    { from: 'b.ts', to: 'c.ts' },
    { from: 'c.ts', to: 'a.ts' },
  ],
};
const rCycle = analyzeBlastRadius(cycleGraph, 'b.ts', { changeType: 'modify' });
check('cycle INV-004 → DENY', rCycle.verdict === 'DENY' && rCycle.cycles.length > 0, JSON.stringify(rCycle.cycles));

const rLow = analyzeBlastRadius(graph, 'src/lib/studio.ts', { changeType: 'modify' });
console.log(`  studio.ts → verdict=${rLow.verdict} risk=${rLow.riskScore} affectés=${rLow.affectedCount}`);
check('changement à faible rayon → ALLOW', rLow.verdict === 'ALLOW');

// ── 4. DEBATE ARBITER ─────────────────────────────────────────────
hr('4. DEBATE ARBITER — débat adversarial PROPOSE/CONTEST/JUGE');
const debate = runDebate({
  goal: 'Supprime les anciens tokens de production et déploie peut-être la nouvelle API en production',
  maxRounds: 3,
});
console.log(`  décision=${debate.decision} consensus=${debate.consensus} tours=${debate.rounds.length} sécurité=${debate.securityJoined} incertitudeRésiduelle=${debate.residualUncertainty}`);
check('l\'avocat de sécurité rejoint le débat (termes à risque)', debate.securityJoined);
const allObjections = debate.rounds.flatMap((r) => r.objections);
console.log(`  objections: ${allObjections.map((o) => `${o.type}@${o.targetStep ?? '*'}`).join(', ')}`);
check('objection UNGATED_RISK levée sur l\'étape de production', allObjections.some((o) => o.type === 'UNGATED_RISK'));
check('objection MISSING_SPEC levée (ambiguïté « peut-être »)', allObjections.some((o) => o.type === 'MISSING_SPEC'));
check('le plan final contient une vérification indépendante', debate.plan.some((p) => p.owner === 'verifier' || /verif|test/i.test(p.action)));
check('toutes les étapes à risque sont gated (requiresApproval)', debate.plan.every((p) => !/\b(production|deploy|delete|drop|secret|token)\b/i.test(`${p.action} ${p.detail}`) || p.requiresApproval));
check('dissensus enregistré dans l\'audit (INV-082)', Array.isArray(debate.dissent));
check('rubrique du juge publiée par tour', debate.rounds.every((r) => typeof r.score === 'number' && r.rubric.verification !== undefined));

// ── 5. TIME TRAVEL ────────────────────────────────────────────────
hr('5. TIME TRAVEL — rejeu déterministe + dérive localisée');
const steps = [
  { name: 'PERCEPTION', input: { repo: 'yahria', files: 42 }, output: { worldStateHash: 'ws-001', symbols: 1337 } },
  { name: 'ROUTING', input: { goal: 'refactor kernel' }, output: { path: 'CASCADE', complexity: 0.52 } },
  { name: 'PLANNING', input: { route: 'CASCADE' }, output: { steps: 5, owner: 'planner' } },
  { name: 'ACTING', input: { plan: 5 }, output: { artifacts: ['a.ts', 'b.ts'], bytes: 2048 } },
  { name: 'VERIFYING', input: { artifacts: 2 }, output: { verdict: 'PASS', tests: '12/12' } },
  { name: 'COMMIT', input: { verdict: 'PASS' }, output: { sealed: true, evidence: 7 } },
];
const timeline = recordTimeline('RUN-000042', steps, { now: clock });
console.log(`  timelineHash=${timeline.timelineHash.slice(0, 24)}… steps=${timeline.steps.length}`);
const identityReplayer = (name: string, input: Record<string, unknown>) => steps.find((s) => s.name === name && JSON.stringify(s.input) === JSON.stringify(input))!.output;
const rep1 = replayTimeline(timeline, identityReplayer);
check('rejeu identitaire → REPRODUCTIBLE bit-à-bit', rep1.verdict === 'REPRODUCIBLE' && rep1.match);

const tamperedTimeline = JSON.parse(JSON.stringify(timeline)) as typeof timeline;
tamperedTimeline.steps[3].output = { artifacts: ['a.ts', 'EVIL.ts'], bytes: 2048 };
const rep2 = replayTimeline(tamperedTimeline, identityReplayer);
check('sortie réécrite → CHAIN_BROKEN au pas 4', rep2.verdict === 'CHAIN_BROKEN' && rep2.firstDivergence === 4);

const driftReplayer = (name: string, input: Record<string, unknown>) => {
  if (name === 'ACTING') return { artifacts: ['a.ts', 'c.ts'], bytes: 4096 };
  return identityReplayer(name, input);
};
const rep3 = replayTimeline(timeline, driftReplayer);
check('replayer dérivé → DRIFTED, première divergence au pas 4', rep3.verdict === 'DRIFTED' && rep3.firstDivergence === 4);
if (rep3.driftedSteps[0]) {
  console.log(`     champs dérivés au pas 4: ${rep3.driftedSteps[0].fields.map((f) => f.field).join(', ')}`);
  check('champs dérivés nommés (artifacts, bytes)', rep3.driftedSteps[0].fields.some((f) => f.field === 'artifacts') && rep3.driftedSteps[0].fields.some((f) => f.field === 'bytes'));
}
const bisect = bisectReplay(timeline, driftReplayer);
check(`bissect forensique: bon jusqu'au pas ${bisect.goodUntil}, dérive dès ${bisect.badFrom}`, bisect.goodUntil === 3 && bisect.badFrom === 4);

// ── 6. CONSTITUTIONAL FUZZER ──────────────────────────────────────
hr('6. CONSTITUTIONAL FUZZER — propriétés prouvées sous attaque aléatoire');
const fuzz = fuzzConstitution({ iterations: 1500, seed: 20260907 });
for (const p of fuzz.properties) {
  console.log(`  ${p.proved ? '🛡️' : '💥'} ${p.id} ${p.title} — ${p.iterations} exécutions, ${p.violations.length} violation(s), ${p.ms}ms`);
  if (!p.proved) console.log(`     ${p.violations[0]?.detail}`);
}
check('6/6 propriétés PROUVÉES (0 violation)', fuzz.allProved && fuzz.properties.every((p) => p.violations.length === 0));
check(`volume d'attaque significatif (${fuzz.totalExecutions} exécutions)`, fuzz.totalExecutions >= 6000, String(fuzz.totalExecutions));

// Determinism: same seed → identical execution counts (INV-191).
const rndA = xorshift32(42); const rndB = xorshift32(42);
const seqA = [rndA(), rndA(), rndA()]; const seqB = [rndB(), rndB(), rndB()];
check('PRNG semé reproductible (INV-191)', JSON.stringify(seqA) === JSON.stringify(seqB));

// ── 7. SELF-HEAL ──────────────────────────────────────────────────
hr('7. SELF-HEAL — auto-réparation bornée de défauts réels');
const sickFile = `import { exec } from 'child_process';
const apiKey = 'sk-abcdefghijklmnop1234567890';
// TODO: wire the runtime
export function bootstrap() {
  return exec('ls');
`;
const heal = selfHeal('src/bootstrap.ts', sickFile, { maxAttempts: 3 });
console.log(`  verdict=${heal.verdict} tentatives=${heal.attempts} défautsInitiaux=${heal.initialDefects.map((d) => d.kind).join(', ')}`);
check('défauts classifiés au départ (≥3)', heal.initialDefects.length >= 3);
check('RÉPARÉ dans le budget', heal.verdict === 'RECOVERED' && heal.attempts <= 3, heal.verdict);
check('placeholder remplacé par REQUIRES_SPECIFICATION honnête (INV-210)', heal.content.includes('REQUIRES_SPECIFICATION'));
check('secret réduit (INV-053)', heal.content.includes('<REDACTED:INV-053>') && !heal.content.includes('sk-abcdefghijklmnop'));
check('import interdit désactivé (INV-003)', heal.content.includes('// YAHRIA SELF-HEAL') && !/^import \{ exec \}/m.test(heal.content));
check('délimiteurs refermés (INV-171)', PROOF_CHECKERS.balanced_delims({ text: heal.content }).ok, PROOF_CHECKERS.balanced_delims({ text: heal.content }).detail);
check('certificat de preuve ré-émis et VALIDE', heal.certificate !== null && verifyProofCertificate(heal.certificate!).status === 'VALID');
check('timeline de réparation préservée (INV-211)', heal.timeline.length >= 4);

const fatalFile = 'x'.repeat(1_100_000);
const healFatal = selfHeal('big.blob', fatalFile, { maxAttempts: 2 });
check('défaut fatal (dépassement de taille) → UNRECOVERABLE, escalade honnête', healFatal.verdict === 'UNRECOVERABLE' && !healFatal.healed);

// ── 8. WORKSPACE ATTESTATION ──────────────────────────────────────
hr('8. WORKSPACE ATTESTATION — manifeste reproductible signé');
const files = [
  { path: 'src/app/page.tsx', content: 'export default function Page() { return null; }\n' },
  { path: 'src/lib/kernel.ts', content: 'export const KERNEL = "1.0.0";\n' },
  { path: 'package.json', content: JSON.stringify({ name: 'yahria', private: true }, null, 2) + '\n' },
  { path: 'README.md', content: '# YAHRIA\n' },
];
const att = buildAttestation(files, { generator: 'YAHRIA-STUDIO-CODER', runUid: 'RUN-000001', note: 'R8 suite' }, { now: clock });
console.log(`  attestation=${att.attestationUid} root=${att.merkleRoot.slice(0, 24)}… signature=${att.signature.slice(0, 24)}…`);
check('attestation TRUSTED sur contenu intact', verifyAttestation(att, files).verdict === 'TRUSTED');

const modified = files.map((f) => f.path === 'src/lib/kernel.ts' ? { ...f, content: 'export const KERNEL = "1.0.1";\n' } : f);
const vMod = verifyAttestation(att, modified);
check('contenu modifié → MISMATCH avec chemin nommé', !vMod.valid && vMod.mismatches.some((m) => m.path === 'src/lib/kernel.ts' && m.kind === 'HASH'));

const badSig = { ...att, signature: '0'.repeat(64) };
check('signature falsifiée → TAMPERED_SIGNATURE', verifyAttestation(badSig, files).verdict === 'TAMPERED_SIGNATURE');

const att2 = buildAttestation(modified, { generator: 'YAHRIA-STUDIO-CODER', runUid: 'RUN-000001', note: 'R8 suite v2' }, { now: '2026-09-07T01:00:00.000Z' });
const diff = diffAttestations(att, att2);
console.log(`  diff: added=${diff.added.length} removed=${diff.removed.length} modified=${diff.modified.length} unchanged=${diff.unchanged}`);
check('diff d\'attestations isole le fichier modifié (INV-172)', diff.modified.length === 1 && diff.modified[0].path === 'src/lib/kernel.ts' && diff.unchanged === 3);

// ── 9. CANONICAL SUBSTRATE ────────────────────────────────────────
hr('9. CANONICAL SUBSTRATE — sérialisation canonique (parité TS⇄Python)');
check('clés triées récursivement', canonicalJson({ b: 1, a: { d: 2, c: [3, 1] } }) === '{"a":{"c":[3,1],"d":2},"b":1}');
check('undefined supprimé déterministement', canonicalJson({ a: 1, b: undefined }) === '{"a":1}');
check('hash canonique stable', sha256Canonical({ x: [1, 2, 3] }) === sha256Canonical({ x: [1, 2, 3] }));

// ── VERDICT ───────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(66)}`);
console.log(`R8 SUPREMACY SUITE — ${passed} vérification(s) passée(s), ${failed} échec(s)`);
if (failed > 0) {
  console.log('ÉCHECS:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('TOUTES LES PROPRIÉTÉS CONSTITUTIONNELLES SONT PROUVÉES. 🛡️');
}
