// ═══════════════════════════════════════════════════════════════
// R7.1 — Parity fixture generator (TypeScript side)
// Runs the TS constitutional kernel and dumps deterministic
// outputs to yahria-core/tests/fixtures/parity/fixtures.json.
// The pytest parity grid replays the same inputs against the
// Python port and asserts zero divergence.
// Usage: npx tsx scripts/r7-parity-fixtures.ts
// ═══════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

import {
  ALL_MACHINES,
  canTransition,
} from '../src/lib/yahria/state-machines';
import { INVARIANTS, INVARIANT_FAMILIES } from '../src/lib/yahria/invariants';
import { DOMAINS, FORBIDDEN_DEPENDENCIES, GOVERNANCE_PLANES } from '../src/lib/yahria/domains';
import { SEED_POLICY_RULES, evaluatePolicy } from '../src/lib/yahria/policy-engine';
import {
  captureEvidence,
  checkMinimumContract,
  hashPayload,
  setSeqStart,
  verifyEvidence,
} from '../src/lib/yahria/evidence-engine';
import {
  ROUTE_THRESHOLDS,
  agreementCheck,
  extractSignals,
  route,
  scoreComplexity,
  scoreUncertainty,
  system1,
  uncertaintyLevel,
} from '../src/lib/yahria/hybrid-reasoning';
import type { PolicyRequest } from '../src/lib/yahria/types';
import type { PolicyRuleDef } from '../src/lib/yahria/policy-engine';
import type { EvidenceCapture } from '../src/lib/yahria/evidence-engine';
import type { S2Result } from '../src/lib/yahria/hybrid-reasoning';

// ── 1. STATE MACHINES: exhaustive pair matrix ───────────────────────
const pairMatrix: unknown[] = [];
for (const machine of ALL_MACHINES) {
  for (const from of machine.states) {
    for (const to of machine.states) {
      pairMatrix.push({
        machine: machine.name,
        from,
        to,
        result: canTransition(machine, from, to),
      });
    }
  }
}

const machineStructures = ALL_MACHINES.map((m) => ({
  name: m.name,
  domain: m.domain,
  states: m.states,
  initial: m.initial,
  terminal: m.terminal,
  transitions: m.transitions,
}));

// ── 2. INVARIANTS + DOMAINS ─────────────────────────────────────────
const invariantsSection = {
  count: INVARIANTS.length,
  invariants: INVARIANTS,
  families: INVARIANT_FAMILIES,
};

const domainsSection = {
  count: DOMAINS.length,
  domains: DOMAINS,
  forbiddenDependencies: FORBIDDEN_DEPENDENCIES,
  governancePlanes: GOVERNANCE_PLANES,
};

// ── 3. POLICY: request battery ──────────────────────────────────────
const policyRequests: PolicyRequest[] = [
  { actorType: 'AGENT', actorId: 'coder-1', action: 'filesystem.read', resource: 'host.secrets' },
  { actorType: 'AGENT', actorId: 'coder-1', action: 'filesystem.write', resource: 'host.workspace' },
  { actorType: 'AGENT', actorId: 'coder-1', action: 'filesystem.write', resource: 'workspace.overlay' },
  { actorType: 'AGENT', actorId: 'coder-1', action: 'filesystem.read', resource: 'workspace.snapshot' },
  { actorType: 'AGENT', actorId: 'coder-1', action: 'filesystem.read', resource: 'workspace.other' },
  { actorType: 'AGENT', actorId: 'coder-1', action: 'filesystem.exec', resource: 'workspace.overlay' },
  { actorType: 'SYSTEM', actorId: 'fabric', action: 'network.egress', resource: 'internet' },
  { actorType: 'AGENT', actorId: 'evolver', action: 'evolution.promote', resource: 'production' },
  { actorType: 'AGENT', actorId: 'evolver', action: 'evolution.promote', resource: 'staging' },
  { actorType: 'HUMAN', actorId: 'root', action: 'constitution.amend', resource: 'INV-001' },
  { actorType: 'TOOL', actorId: 'tool-x', action: 'tool.execute', resource: 'unregistered.fs' },
  { actorType: 'TOOL', actorId: 'tool-x', action: 'tool.execute', resource: 'registered.fs' },
  { actorType: 'SYSTEM', actorId: 'fabric', action: 'execution.run', resource: 'sandbox.standard' },
  { actorType: 'SYSTEM', actorId: 'fabric', action: 'execution.run', resource: 'host.direct' },
  { actorType: 'MODEL', actorId: 'router-1', action: 'model.inference', resource: 'router.primary' },
  { actorType: 'MODEL', actorId: 'router-1', action: 'model.finetune', resource: 'router.primary' },
  { actorType: 'AGENT', actorId: 'ghost', action: 'totally.unknown.action', resource: 'unknown.resource' },
  { actorType: 'TOOL', actorId: 't', action: 'filesystem.write', resource: 'workspace.overlayX' },
];

const policyBattery = policyRequests.map((request) => ({
  request,
  result: evaluatePolicy(request, SEED_POLICY_RULES),
}));

// wildcard + disabled-rule semantics (beyond seed set)
const customRules: PolicyRuleDef[] = [
  { ruleId: 'X-001', name: 'wildcard allow fs', effect: 'ALLOW', scope: 'FILESYSTEM', action: 'filesystem.*', resource: 'workspace.*', priority: 5, reason: 'wildcard test', version: '0.1.0' },
  { ruleId: 'X-002', name: 'disabled rule never matches', effect: 'DENY', scope: 'FILESYSTEM', action: 'filesystem.read', resource: 'workspace.snapshot', priority: 1, active: false, reason: 'disabled', version: '0.1.0' },
  { ruleId: 'X-003', name: 'priority ordering probe', effect: 'REQUIRE_APPROVAL', scope: 'FILESYSTEM', action: 'filesystem.read', resource: 'workspace.snapshot', priority: 7, reason: 'lower precedence than X-001', version: '0.1.0' },
];
const customBattery = [
  { action: 'filesystem.write', resource: 'workspace.overlay' },
  { action: 'filesystem.read', resource: 'workspace.snapshot' },
].map((r) => {
  const request: PolicyRequest = { actorType: 'AGENT', actorId: 'probe', action: r.action, resource: r.resource };
  return { request, result: evaluatePolicy(request, customRules) };
});

// ── 4. EVIDENCE ─────────────────────────────────────────────────────
const hashBattery = [
  'hello',
  'chaîne française — é à ü œ',
  '',
  42,
  true,
  null,
  ['a', 1, true, null],
  { b: 2, a: 1 },
  { nested: { deep: ['x', { y: 1 }] }, unicode: 'préuvé' },
  { k: 'value with "quotes" and \\ backslash and \n newline and \t tab' },
].map((payload, i) => ({ i, payload, hash: hashPayload(payload) }));

const FIXED_T0 = '2026-01-15T10:00:00.000Z';
const FIXED_T1 = '2026-01-15T10:00:01.000Z';
const FIXED_T2 = '2026-01-15T10:00:02.000Z';

const capA = captureEvidence(
  { category: 'CODE', criticality: 'STANDARD', actorType: 'AGENT', actorId: 'coder-1', claim: 'file written', payload: { path: 'src/app.ts', bytes: 120 } },
  { now: FIXED_T0 },
);
const capB = captureEvidence(
  { category: 'TEST', criticality: 'CRITICAL', actorType: 'SYSTEM', actorId: 'fabric', claim: 'tests passed', payload: { passed: 12, failed: 0 }, executionId: 'EX-1' },
  { now: FIXED_T1 },
);
setSeqStart(41);
const capC = captureEvidence(
  { category: 'TEST', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'fabric', claim: 'chain continues', executionId: 'EX-1' },
  { now: FIXED_T2 },
);

const verifyBattery = (() => {
  const sealed = { ...capB, state: 'SEALED' as const };
  const tampered = { ...capB, state: 'SEALED' as const, claim: 'tests passed (tampered)' };
  const stillHashed = capA;
  const expired = { ...capB, state: 'EXPIRED' as const };
  const corruptedState = { ...capB, state: 'CORRUPTED' as const };
  return [
    { label: 'sealed-ok', record: sealed, result: verifyEvidence(sealed) },
    { label: 'sealed-tampered', record: tampered, result: verifyEvidence(tampered) },
    { label: 'hashed-not-verifiable', record: stillHashed, result: verifyEvidence(stillHashed) },
    { label: 'expired', record: expired, result: verifyEvidence(expired) },
    { label: 'corrupted-state', record: corruptedState, result: verifyEvidence(corruptedState) },
  ];
})();

const contractBattery = [
  { label: 'minimal-ok', input: { category: 'CODE', criticality: 'STANDARD', actorType: 'AGENT', actorId: 'a', claim: 'c' } },
  { label: 'missing-claim', input: { category: 'CODE', criticality: 'STANDARD', actorType: 'AGENT', actorId: 'a', claim: '' } },
  { label: 'critical-no-context', input: { category: 'TEST', criticality: 'CRITICAL', actorType: 'SYSTEM', actorId: 's', claim: 'x' } },
  { label: 'critical-with-trace', input: { category: 'TEST', criticality: 'CRITICAL', actorType: 'SYSTEM', actorId: 's', claim: 'x', traceId: 'TR-1' } },
  { label: 'missing-two', input: { category: 'CODE', criticality: 'LOW', actorType: '', actorId: 'a', claim: null } },
].map(({ label, input }) => ({ label, result: checkMinimumContract(input as unknown as EvidenceCapture) }));

const evidenceSection = {
  hashBattery,
  captures: { capA, capB, capC },
  chainLinkage: {
    aPrev: capA.prevHash,
    bPrevEqualsAHash: capB.prevHash === capA.contentHash,
    cPrevEqualsBHash: capC.prevHash === capB.contentHash,
    aHash: capA.contentHash,
    bHash: capB.contentHash,
    cHash: capC.contentHash,
  },
  uids: { a: capA.evidenceUid, b: capB.evidenceUid, c: capC.evidenceUid },
  verifyBattery,
  contractBattery,
  lifecycle: ['DECLARED', 'CAPTURED', 'NORMALIZED', 'HASHED', 'LINKED', 'VERIFIED', 'SEALED'],
};

// ── 5. HYBRID REASONING ─────────────────────────────────────────────
const reasoningRequests = [
  'status',
  'show system status',
  'list tasks',
  'montre les tâches',
  'explain the evidence chain',
  'explique les invariants',
  'build me a REST API',
  'construis un module d\'authentification',
  'then after that step 2',
  '1. deploy 2. verify',
  'maybe somehow or something',
  'peut-être approximativement',
  'delete production secrets',
  'déploie en production puis supprime',
  'api database schema migration',
  'x',
  'ab',
  'what is the task graph status and explain the execution fabric evidence flow',
  'crée un composant puis génère les tests, ensuite liste les preuves',
  'design the security policy for the sandbox engine',
];

const routingBattery = reasoningRequests.map((request) => {
  const signals = extractSignals(request);
  return {
    request,
    signals,
    complexity: scoreComplexity(signals),
    uncertainty: scoreUncertainty(signals),
    decision: route(request),
  };
});

const s1Battery = [
  'status of the system',
  'list all tasks please',
  'show me the agents',
  'montre les exécutions',
  'explain how evidence sealing works',
  'explique le graphe de dépendances',
  'build a whole new platform from scratch',
].map((goal) => {
  const r = system1(goal, 0.3);
  return { goal, baseUncertainty: 0.3, result: { ...r, ms: undefined } };
});

const agreementBattery = (() => {
  const s1ok = system1('list tasks', 0.2);
  const s2like: S2Result = {
    answer: '[S2] plan',
    plan: [
      { index: 1, action: 'resolve entity type', detail: 'd', owner: 'explorer', requiresApproval: false },
      { index: 2, action: 'query registry', detail: 'd', owner: 'explorer', requiresApproval: false },
      { index: 3, action: 'render listing', detail: 'd', owner: 'verifier', requiresApproval: false },
    ],
    reasoning: 'r',
    uncertainty: 0.2,
    ms: 0,
    modelUsed: 'YAHRIA-S2-LLM',
  };
  const s2diverge: S2Result = {
    ...s2like,
    plan: [
      { index: 1, action: 'perceive', detail: 'd', owner: 'explorer', requiresApproval: false },
      { index: 2, action: 'implement', detail: 'd', owner: 'coder', requiresApproval: false },
    ],
  };
  const s1none = system1('build a platform', 0.2);
  const s2any = s2like;
  return [
    { label: 'same-responsibilities', result: agreementCheck(s1ok, s2like) },
    { label: 'diverge', result: agreementCheck(s1ok, s2diverge) },
    { label: 'no-template', result: agreementCheck(s1none, s2any) },
  ];
})();

const uncertaintyLevels = [0, 0.05, 0.15, 0.16, 0.4, 0.41, 0.7, 0.71, 1].map((u) => ({
  u,
  level: uncertaintyLevel(u),
}));

const reasoningSection = {
  thresholds: ROUTE_THRESHOLDS,
  routingBattery,
  s1Battery,
  agreementBattery,
  uncertaintyLevels,
};

// ── WRITE ───────────────────────────────────────────────────────────
const fixtures = {
  meta: {
    generatedAt: 'FIXED (parity fixtures contain no wall-clock timestamps)',
    kernelDocIds: ['YAHRIA-KRN-000', 'YAHRIA-KRN-001', 'YAHRIA-KRN-002', 'YAHRIA-KRN-003', 'YAHRIA-KRN-004', 'YAHRIA-KRN-005', 'YAHRIA-KRN-006'],
    note: 'ms fields excluded from s1 (non-deterministic). Evidence clock injected via opts.now.',
  },
  state_machines: { structures: machineStructures, pairMatrix, pairCount: pairMatrix.length },
  invariants: invariantsSection,
  domains: domainsSection,
  policy: { seedRules: SEED_POLICY_RULES, battery: policyBattery, customRules, customBattery },
  evidence: evidenceSection,
  reasoning: reasoningSection,
};

const outPath = resolve(__dirname, '../yahria-core/tests/fixtures/parity/fixtures.json');
mkdirSync(resolve(__dirname, '../yahria-core/tests/fixtures/parity'), { recursive: true });
writeFileSync(outPath, JSON.stringify(fixtures, null, 2), 'utf-8');

console.log(`fixtures written: ${outPath}`);
console.log(`  state-machine pairs : ${fixtures.state_machines.pairCount}`);
console.log(`  invariants          : ${invariantsSection.count}`);
console.log(`  domains             : ${domainsSection.count}`);
console.log(`  policy seed rules   : ${SEED_POLICY_RULES.length}`);
console.log(`  policy cases        : ${policyBattery.length + customBattery.length}`);
console.log(`  evidence cases      : ${hashBattery.length + verifyBattery.length + contractBattery.length} + 3 captures`);
console.log(`  routing cases       : ${routingBattery.length}`);
console.log(`  s1 cases            : ${s1Battery.length}`);
