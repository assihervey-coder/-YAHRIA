// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Property-Based Constitutional Fuzzer (Domain 20.9)
// Doc ID: YAHRIA-KRN-020 | R8 Supremacy Pack
//
// Instead of testing EXAMPLES, this module ATTACKS the constitution
// with thousands of seeded-random inputs and asserts PROPERTIES:
//
//   P0 SCHEMA          — every machine declares unique states, a valid
//                        initial state and non-empty transitions.
//   P1 SAFE_WALKS      — random legal walks NEVER leave the declared
//                        state set (guarded transitions are the only door).
//   P2 ABSORBING       — terminal states have NO outgoing transition:
//                        no random hop can resurrect a sealed artifact.
//   P3 ILLEGAL_REJECT  — every undeclared (from,to) hop is rejected with
//                        the exact constitutional message (silent
//                        transitions are prohibited).
//   P4 DENY_BY_DEFAULT — for any random policy request that matches no
//                        rule, the effect is DENY with matchedRule=null
//                        (INV-052/INV-133 holds under fuzzing).
//   P5 TAMPER_EVIDENCE — mutating ONE byte of any captured evidence
//                        breaks verification; the untouched record passes.
//
// Determinism: xorshift32 with a RECORDED seed — a failure is always
// reproducible from {seed, iterations} alone (INV-191).
// ═══════════════════════════════════════════════════════════════

import { ALL_MACHINES, canTransition } from './state-machines';
import { evaluatePolicy, SEED_POLICY_RULES } from './policy-engine';
import type { PolicyRequest } from './types';
import { captureEvidence, verifyEvidence } from './evidence-engine';
import { emitYahriaEvent } from './realtime';

// ── FZ-1. SEEDED PRNG (xorshift32 — deterministic across runtimes) ─

export function xorshift32(seed: number): () => number {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000; // [0, 1)
  };
}

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

// ── FZ-2. PROPERTY RESULTS ─────────────────────────────────────────

export interface PropertyResult {
  id: string;
  title: string;
  iterations: number;
  violations: { iteration: number; detail: string }[];
  proved: boolean;        // violations.length === 0
  ms: number;
}

export interface FuzzReport {
  seed: number;
  iterationsPerProperty: number;
  properties: PropertyResult[];
  totalExecutions: number;
  allProved: boolean;
  ms: number;
  constitutionVersion: 'V1.0.0';
}

// ── FZ-3. INDIVIDUAL PROPERTY ATTACKS ──────────────────────────────

function fuzzSchema(): PropertyResult {
  const t0 = Date.now();
  const violations: PropertyResult['violations'] = [];
  for (const m of ALL_MACHINES) {
    if (new Set(m.states).size !== m.states.length) {
      violations.push({ iteration: 0, detail: `${m.name}: états dupliqués` });
    }
    if (!m.states.includes(m.initial)) {
      violations.push({ iteration: 0, detail: `${m.name}: état initial ${m.initial} non déclaré` });
    }
    for (const t of m.terminal) {
      if (!m.states.includes(t)) violations.push({ iteration: 0, detail: `${m.name}: état terminal ${t} non déclaré` });
      if (m.transitions.some((tr) => tr.from === t)) {
        violations.push({ iteration: 0, detail: `${m.name}: transition SORTANTE depuis le terminal ${t} — absorption rompue` });
      }
    }
    for (const tr of m.transitions) {
      if (!m.states.includes(tr.from) || !m.states.includes(tr.to)) {
        violations.push({ iteration: 0, detail: `${m.name}: transition ${tr.from}→${tr.to} référence un état non déclaré` });
      }
    }
  }
  return { id: 'P0', title: 'SCHEMA: machines bien formées, terminaux absorbants', iterations: ALL_MACHINES.length, violations, proved: violations.length === 0, ms: Date.now() - t0 };
}

function fuzzSafeWalks(iterations: number, rnd: () => number): PropertyResult {
  const t0 = Date.now();
  const violations: PropertyResult['violations'] = [];
  for (let i = 0; i < iterations; i++) {
    const m = pick(rnd, ALL_MACHINES);
    let state = m.initial;
    const walkLen = 1 + Math.floor(rnd() * 8);
    for (let s = 0; s < walkLen; s++) {
      const legal = m.transitions.filter((tr) => tr.from === state);
      if (legal.length === 0) break; // terminal or absorbing
      const next = pick(rnd, legal).to;
      const check = canTransition(m, state, next);
      if (!check.ok) {
        violations.push({ iteration: i, detail: `${m.name}: marche légale rejetée ${state}→${next}` });
        break;
      }
      state = next;
      if (!m.states.includes(state)) {
        violations.push({ iteration: i, detail: `${m.name}: la marche a atteint un état NON DÉCLARÉ ${state}` });
        break;
      }
    }
  }
  return { id: 'P1', title: 'SAFE_WALKS: les marches légales ne quittent jamais l\'ensemble déclaré', iterations, violations, proved: violations.length === 0, ms: Date.now() - t0 };
}

function fuzzTerminalAbsorption(iterations: number, rnd: () => number): PropertyResult {
  const t0 = Date.now();
  const violations: PropertyResult['violations'] = [];
  for (let i = 0; i < iterations; i++) {
    const m = pick(rnd, ALL_MACHINES);
    const terminal = pick(rnd, m.terminal);
    const anywhere = pick(rnd, m.states);
    if (terminal === anywhere) continue;
    const check = canTransition(m, terminal, anywhere);
    if (check.ok) {
      violations.push({ iteration: i, detail: `${m.name}: transition ${terminal}→${anywhere} autorisée — terminal non absorbant` });
    }
  }
  return { id: 'P2', title: 'ABSORBING: aucun terminal n\'a de transition sortante (fuzz dynamique)', iterations, violations, proved: violations.length === 0, ms: Date.now() - t0 };
}

function fuzzIllegalRejection(iterations: number, rnd: () => number): PropertyResult {
  const t0 = Date.now();
  const violations: PropertyResult['violations'] = [];
  for (let i = 0; i < iterations; i++) {
    const m = pick(rnd, ALL_MACHINES);
    const from = pick(rnd, m.states);
    const to = pick(rnd, m.states);
    const declared = m.transitions.some((tr) => tr.from === from && tr.to === to);
    const check = canTransition(m, from, to);
    if (!declared && check.ok) {
      violations.push({ iteration: i, detail: `${m.name}: ${from}→${to} NON déclarée mais ACCEPTÉE — transition silencieuse` });
    }
    if (!declared && !check.ok && !/is not declared in/.test(check.reason ?? '')) {
      violations.push({ iteration: i, detail: `${m.name}: message de rejet non constitutionnel pour ${from}→${to}` });
    }
  }
  return { id: 'P3', title: 'ILLEGAL_REJECT: toute transition non déclarée est rejetée (message exact)', iterations, violations, proved: violations.length === 0, ms: Date.now() - t0 };
}

const ACTIONS = ['filesystem.read', 'filesystem.write', 'network.egress', 'evolution.promote', 'constitution.amend', 'tool.execute', 'execution.run', 'model.inference', 'random.action.*'];
const RESOURCES = ['host.secrets', 'host.workspace', 'workspace.overlay', 'workspace.snapshot', 'production', 'sandbox.default', 'router.primary', 'unregistered.tool', 'somewhere.else'];

function fuzzDenyByDefault(iterations: number, rnd: () => number): PropertyResult {
  const t0 = Date.now();
  const violations: PropertyResult['violations'] = [];
  for (let i = 0; i < iterations; i++) {
    const req: PolicyRequest = {
      actorType: pick(rnd, ['HUMAN', 'AGENT', 'SYSTEM', 'TOOL', 'MODEL'] as PolicyRequest['actorType'][]),
      actorId: `fuzz-${Math.floor(rnd() * 1000)}`,
      action: pick(rnd, ACTIONS),
      resource: pick(rnd, RESOURCES),
    };
    const ev = evaluatePolicy(req, SEED_POLICY_RULES);
    // Property: if no rule matched, effect MUST be DENY (never ALLOW, never undefined).
    if (ev.matchedRule === null && ev.effect !== 'DENY') {
      violations.push({ iteration: i, detail: `${req.action} @ ${req.resource}: règle absente mais effect=${ev.effect} — deny-by-default violé` });
    }
    if (ev.matchedRule !== null && !SEED_POLICY_RULES.some((r) => r.ruleId === ev.matchedRule)) {
      violations.push({ iteration: i, detail: `matchedRule inconnue: ${ev.matchedRule}` });
    }
  }
  return { id: 'P4', title: 'DENY_BY_DEFAULT: toute requête sans règle explicite → DENY (INV-052/133)', iterations, violations, proved: violations.length === 0, ms: Date.now() - t0 };
}

function fuzzTamperEvidence(iterations: number, rnd: () => number): PropertyResult {
  const t0 = Date.now();
  const violations: PropertyResult['violations'] = [];
  const clock = '2026-09-07T00:00:00.000Z';
  for (let i = 0; i < iterations; i++) {
    const claim = `fuzz claim ${i} — ${Math.floor(rnd() * 1e9)}`;
    const rec = captureEvidence({
      category: 'TEST', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: 'fuzzer',
      claim, payload: { n: Math.floor(rnd() * 1e6) },
    }, { now: clock });
    rec.state = 'VERIFIED';
    const okBefore = verifyEvidence(rec).ok;

    // flip one character in the payload
    const flipAt = Math.floor(rnd() * Math.max(rec.payload!.length, 1));
    const chars = rec.payload!.split('');
    const original = chars[flipAt];
    chars[flipAt] = original === 'X' ? 'Y' : 'X';
    const tampered = { ...rec, payload: chars.join('') };
    const okAfter = verifyEvidence(tampered).ok;

    if (!okBefore) violations.push({ iteration: i, detail: `preuve intacte rejetée: ${claim}` });
    if (okAfter) violations.push({ iteration: i, detail: `altération d'1 octet NON détectée: ${claim}` });
  }
  return { id: 'P5', title: 'TAMPER_EVIDENCE: 1 octet altéré ⇒ vérification échoue; preuve intacte ⇒ passe', iterations, violations, proved: violations.length === 0, ms: Date.now() - t0 };
}

// ── FZ-4. ORCHESTRATOR ─────────────────────────────────────────────

export function fuzzConstitution(opts?: { iterations?: number; seed?: number }): FuzzReport {
  const t0 = Date.now();
  const iterations = Math.min(Math.max(opts?.iterations ?? 2000, 10), 50_000);
  const seed = opts?.seed ?? 20260907;
  const rnd = xorshift32(seed);

  const properties: PropertyResult[] = [
    fuzzSchema(),
    fuzzSafeWalks(iterations, rnd),
    fuzzTerminalAbsorption(iterations, rnd),
    fuzzIllegalRejection(iterations, rnd),
    fuzzDenyByDefault(iterations, rnd),
    fuzzTamperEvidence(Math.min(iterations, 500), rnd),
  ];
  const totalExecutions = properties.reduce((s, p) => s + p.iterations, 0);
  const allProved = properties.every((p) => p.proved);
  const ms = Date.now() - t0;
  emitYahriaEvent({
    type: 'supremacy.fuzz.completed',
    source: '20',
    severity: allProved ? 'SUCCESS' : 'CRITICAL',
    message: allProved
      ? `Fuzzing constitutionnel: ${properties.length} propriétés PROUVÉES (${totalExecutions} exécutions, seed ${seed})`
      : `Fuzzing constitutionnel: VIOLATION détectée — ${properties.filter((p) => !p.proved).map((p) => p.id).join(', ')}`,
    payload: { seed, iterations, totalExecutions, allProved },
  });
  return { seed, iterationsPerProperty: iterations, properties, totalExecutions, allProved, ms, constitutionVersion: 'V1.0.0' };
}
