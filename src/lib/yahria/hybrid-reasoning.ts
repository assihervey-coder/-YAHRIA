// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — HYBRID REASONING ENGINE (Domain 06 — Cognitive Core)
// Doc ID: YAHRIA-KRN-006 | Spec: HYBRID_REASONING_SPECIFICATION.md
//
// Dual-process cognitive architecture:
//   SYSTEM 1 — Fast deterministic path (rules, patterns, cached plans)
//   SYSTEM 2 — Deep deliberative path (LLM reasoning, multi-step planning)
//   CASCADE  — S1 first; escalate to S2 when uncertainty > threshold
//
// Constitutional constraints:
//   INV-080 — model output is not fact → verdict requires verification
//   INV-081 — uncertainty must be representable (VERIFIED/PROBABLE/UNCERTAIN/UNKNOWN/FALSE)
//   INV-082 — decisions preserve context
//   D.6 governance — reasoning cannot bypass policy
// ═══════════════════════════════════════════════════════════════

import type { RouterDecision, ReasoningSignals, PlanStep, WorldState } from './types';

// ── HR-1. SIGNAL EXTRACTION ────────────────────────────────────────

const MULTI_STEP_PATTERNS = [/\bthen\b/i, /\bafter that\b/i, /\bstep (\d|one|two|three)/i, /\b(et puis|puis|ensuite|étape)\b/i, /\d\.\s/];
const AMBIGUITY_PATTERNS = [/\bmaybe\b/i, /\bsomehow\b/i, /\bor something\b/i, /\bpeut-être\b/i, /\bapproximativement\b/i, /\bn'importe comment\b/i];
const CREATION_VERBS = [/\b(build|create|implement|design|generate|write|refactor|migrate|add feature)\b/i, /\b(construis|crée|implémente|génère|conçois)\b/i];
const QUERY_VERBS = [/\b(show|list|what|status|explain|summarize|where|how many)\b/i, /\b(montre|liste|explique|statut)\b/i];
const RISK_TERMS = [/\b(deploy|production|delete|drop|secret|password|token|policy|payment|billing)\b/i, /\b(déploie|production|supprime|supprimer|secret)\b/i];
const TECH_TERMS = [/\b(api|database|schema|migration|auth|security|sandbox|agent|task|evidence|graph)\b/i];

export function extractSignals(request: string): ReasoningSignals {
  const keywordMatches: string[] = [];
  for (const p of [...MULTI_STEP_PATTERNS, ...AMBIGUITY_PATTERNS, ...CREATION_VERBS, ...QUERY_VERBS, ...RISK_TERMS, ...TECH_TERMS]) {
    const m = request.match(p);
    if (m) keywordMatches.push(m[0].toLowerCase());
  }
  return {
    length: request.length,
    hasMultiStep: MULTI_STEP_PATTERNS.some((p) => p.test(request)),
    hasAmbiguity: AMBIGUITY_PATTERNS.some((p) => p.test(request)),
    hasCreationVerb: CREATION_VERBS.some((p) => p.test(request)),
    hasQueryVerb: QUERY_VERBS.some((p) => p.test(request)),
    hasRiskTerms: RISK_TERMS.some((p) => p.test(request)),
    keywordMatches: Array.from(new Set(keywordMatches)).slice(0, 10),
  };
}

// ── HR-2. UNCERTAINTY & COMPLEXITY SCORING (INV-081) ───────────────

export function scoreComplexity(signals: ReasoningSignals): number {
  let c = 0;
  c += Math.min(signals.length / 400, 0.25);                     // verbosity
  if (signals.hasMultiStep) c += 0.30;                            // multi-step composition
  if (signals.hasCreationVerb) c += 0.25;                         // generative work
  if (signals.hasQueryVerb) c -= 0.15;                            // simple retrieval
  if (signals.hasAmbiguity) c += 0.15;                            // ambiguity tax
  if (signals.hasRiskTerms) c += 0.10;                            // risk → deliberation
  c += Math.min(signals.keywordMatches.length * 0.02, 0.10);
  return Math.max(0, Math.min(1, c));
}

export function scoreUncertainty(signals: ReasoningSignals): number {
  let u = 0.08;                                                   // base entropy
  if (signals.hasAmbiguity) u += 0.35;
  if (signals.hasMultiStep && !signals.hasCreationVerb) u += 0.05;
  if (signals.length < 25) u += 0.20;                             // underspecified request
  if (signals.hasRiskTerms) u += 0.10;                            // high stakes → more caution
  return Math.max(0, Math.min(1, u));
}

// ── HR-3. ROUTER (the hybrid decision) ─────────────────────────────

export const ROUTE_THRESHOLDS = {
  S1_MAX_COMPLEXITY: 0.45,
  S1_MAX_UNCERTAINTY: 0.30,
  CASCADE_UNCERTAINTY: 0.45,
  ESCALATE_COMPLEXITY: 0.65,
};

export function route(request: string): RouterDecision {
  const signals = extractSignals(request);
  const complexity = scoreComplexity(signals);
  const uncertainty = scoreUncertainty(signals);

  // Hard rule: risk terms always get deliberation regardless of score
  if (signals.hasRiskTerms && (complexity > 0.3 || uncertainty > 0.25)) {
    return {
      path: 'SYSTEM_2', complexity, uncertainty, signals,
      escalationReason: 'RISK_TERMS: high-stakes request requires deep deliberation (HR-3.R1)',
      rationale: `complexity=${complexity.toFixed(2)}, uncertainty=${uncertainty.toFixed(2)} + risk vocabulary → System 2`,
    };
  }
  // Fast path: simple, certain, non-risky
  if (complexity <= ROUTE_THRESHOLDS.S1_MAX_COMPLEXITY && uncertainty <= ROUTE_THRESHOLDS.S1_MAX_UNCERTAINTY) {
    return {
      path: 'SYSTEM_1', complexity, uncertainty, signals, escalationReason: null,
      rationale: `simple + confident (complexity=${complexity.toFixed(2)} ≤ 0.45, uncertainty=${uncertainty.toFixed(2)} ≤ 0.30) → System 1 fast path`,
    };
  }
  // Cascade: attempt S1, escalate on uncertainty
  if (complexity < ROUTE_THRESHOLDS.ESCALATE_COMPLEXITY && uncertainty < ROUTE_THRESHOLDS.CASCADE_UNCERTAINTY + 0.25) {
    return {
      path: 'CASCADE', complexity, uncertainty, signals,
      escalationReason: `moderate complexity (${complexity.toFixed(2)}) → try S1, escalate if S1 uncertainty > ${ROUTE_THRESHOLDS.CASCADE_UNCERTAINTY}`,
      rationale: 'CASCADE: cheap attempt first, verified escalation (HR-4)',
    };
  }
  // Deep path
  return {
    path: 'SYSTEM_2', complexity, uncertainty, signals,
    escalationReason: `complexity ${complexity.toFixed(2)} ≥ ${ROUTE_THRESHOLDS.ESCALATE_COMPLEXITY} → System 2`,
    rationale: 'deep deliberative path (HR-3.D1)',
  };
}

// ── HR-4. SYSTEM 1 — DETERMINISTIC FAST PATH ───────────────────────

export interface S1Result {
  answer: string;
  plan: PlanStep[];
  uncertainty: number;       // residual uncertainty after fast path
  template: string;
  ms: number;
}

const S1_TEMPLATES: { match: RegExp; template: string; makePlan: (goal: string) => PlanStep[] }[] = [
  {
    match: /\b(status|statut|état|etat|health|santé|sante)\b/i,
    template: 'SYSTEM_STATUS_REPORT',
    makePlan: (g) => [
      { index: 1, action: 'collect system metrics', detail: 'Gather domain statuses, agent states, execution counts', owner: 'explorer', requiresApproval: false },
      { index: 2, action: 'format report', detail: 'Compose human-readable status summary', owner: 'verifier', requiresApproval: false },
    ],
  },
  {
    match: /\b(list|liste|show|montre)\b.*\b(tasks?|tâches|agents?|executions?|exécutions|evidence|preuves)\b/i,
    template: 'CANONICAL_ENTITY_LISTING',
    makePlan: (g) => [
      { index: 1, action: 'resolve entity type', detail: `Parse requested entity from: "${g.slice(0, 60)}"`, owner: 'explorer', requiresApproval: false },
      { index: 2, action: 'query registry', detail: 'Fetch canonical records with states', owner: 'explorer', requiresApproval: false },
      { index: 3, action: 'render listing', detail: 'Present with state machines and criticality', owner: 'verifier', requiresApproval: false },
    ],
  },
  {
    match: /\b(explain|explique)\b/i,
    template: 'CONCEPT_EXPLANATION',
    makePlan: (g) => [
      { index: 1, action: 'resolve concept', detail: `Identify concept in: "${g.slice(0, 60)}"`, owner: 'explorer', requiresApproval: false },
      { index: 2, action: 'retrieve canonical definition', detail: 'Look up constitution / invariants / domain specs', owner: 'architect', requiresApproval: false },
      { index: 3, action: 'compose explanation', detail: 'Answer with sources and invariants cited', owner: 'verifier', requiresApproval: false },
    ],
  },
];

export function system1(goal: string, baseUncertainty: number): S1Result {
  const t0 = Date.now();
  for (const t of S1_TEMPLATES) {
    if (t.match.test(goal)) {
      return {
        answer: `[S1:${t.template}] Deterministic plan produced from canonical template for "${goal.slice(0, 80)}".`,
        plan: t.makePlan(goal),
        uncertainty: Math.max(0.05, baseUncertainty * 0.6),
        template: t.template,
        ms: Date.now() - t0,
      };
    }
  }
  // No template matched — S1 fails, residual uncertainty stays high → cascade escalation
  return {
    answer: `[S1:NO_TEMPLATE] No deterministic template matched. Cannot answer without guessing (INV-210).`,
    plan: [],
    uncertainty: 1.0,
    template: 'NONE',
    ms: Date.now() - t0,
  };
}

// ── HR-5. SYSTEM 2 — DEEP DELIBERATIVE PATH (LLM) ──────────────────

export interface S2Result {
  answer: string;
  plan: PlanStep[];
  reasoning: string;
  uncertainty: number;
  ms: number;
  modelUsed: string;
}

function heuristicPlan(goal: string): PlanStep[] {
  const steps: PlanStep[] = [
    { index: 1, action: 'perceive', detail: 'Assemble WorldState: repository, symbols, errors, tests', owner: 'explorer', requiresApproval: false },
    { index: 2, action: 'analyze intent', detail: `Decompose goal: "${goal.slice(0, 80)}"`, owner: 'planner', requiresApproval: false },
    { index: 3, action: 'design solution', detail: 'Select strategy respecting domain boundaries and invariants', owner: 'architect', requiresApproval: true },
    { index: 4, action: 'implement', detail: 'Apply changes inside sandbox overlay only (FS-001)', owner: 'coder', requiresApproval: false },
    { index: 5, action: 'verify', detail: 'Independent verifier: tests + lint + security + policy', owner: 'tester', requiresApproval: false },
    { index: 6, action: 'commit with evidence', detail: 'Seal evidence bundle, close task', owner: 'verifier', requiresApproval: false },
  ];
  return steps;
}

// System 2 uses the LLM when available; falls back to structured heuristic planning
// (INV-210: never guess silently — fallback is explicitly labeled as heuristic).
export async function system2(goal: string, worldState: WorldState): Promise<S2Result> {
  const t0 = Date.now();
  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are YAHRIA's System-2 deliberative reasoner inside an autonomous software intelligence OS.
Rules you MUST obey:
- You are governed: policy DENY overrides any plan step (INV-120).
- Model output is not fact (INV-080): every plan must end with an independent verification step.
- Never guess missing specifications; mark them as REQUIRES_SPECIFICATION (INV-210).
- Sandbox writes only; host is read-only (FS-001).
- All file writes land in workspace overlay.
Available agents: explorer, architect, planner, coder, debugger, tester, reviewer, security, verifier.
Respond with STRICT JSON only: {"analysis": string, "steps": [{"action": string, "detail": string, "owner": one of the agents, "requiresApproval": boolean}], "residual_uncertainty": number between 0 and 1, "answer": string}`,
        },
        {
          role: 'user',
          content: `GOAL: ${goal}
WORLD_STATE: ${JSON.stringify(worldState)}`,
        },
      ],
      thinking: { type: 'enabled' },
    });
    const raw = completion.choices[0]?.message?.content ?? '';
    let parsed: { analysis?: string; steps?: { action: string; detail: string; owner: string; requiresApproval?: boolean }[]; residual_uncertainty?: number; answer?: string } | null = null;
    try {
      const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = null;
    }
    if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const agents = ['explorer', 'architect', 'planner', 'coder', 'debugger', 'tester', 'reviewer', 'security', 'verifier'];
      const plan: PlanStep[] = parsed.steps.slice(0, 12).map((s, i) => ({
        index: i + 1,
        action: String(s.action).slice(0, 80),
        detail: String(s.detail).slice(0, 300),
        owner: (agents.includes(s.owner) ? s.owner : 'planner') as PlanStep['owner'],
        requiresApproval: Boolean(s.requiresApproval),
      }));
      if (!plan.some((p) => p.owner === 'verifier' || /verif|test/i.test(p.action))) {
        plan.push({ index: plan.length + 1, action: 'verify', detail: 'Independent verification appended (INV-080: model output is not fact)', owner: 'verifier', requiresApproval: false });
      }
      return {
        answer: parsed.answer ?? `[S2:LLM] Deliberative plan produced (${plan.length} steps).`,
        plan,
        reasoning: parsed.analysis ?? raw.slice(0, 600),
        uncertainty: typeof parsed.residual_uncertainty === 'number' ? Math.max(0, Math.min(1, parsed.residual_uncertainty)) : 0.25,
        ms: Date.now() - t0,
        modelUsed: 'YAHRIA-S2-LLM',
      };
    }
    // LLM responded but unparsable → explicit heuristic fallback
    return {
      answer: '[S2:FALLBACK] LLM response unparsable → structured heuristic plan (explicitly non-verified).',
      plan: heuristicPlan(goal),
      reasoning: raw.slice(0, 400),
      uncertainty: 0.55,
      ms: Date.now() - t0,
      modelUsed: 'HEURISTIC_FALLBACK',
    };
  } catch {
    // SDK unavailable → explicit heuristic fallback with raised uncertainty
    return {
      answer: '[S2:FALLBACK] Deep model unavailable → structured heuristic plan (explicitly non-verified).',
      plan: heuristicPlan(goal),
      reasoning: 'LLM path unavailable in this environment; heuristic decomposition used and flagged UNVERIFIED (INV-081).',
      uncertainty: 0.6,
      ms: Date.now() - t0,
      modelUsed: 'HEURISTIC_FALLBACK',
    };
  }
}

// ── HR-6. DUAL-PROCESS AGREEMENT (used in CASCADE mode) ────────────

export function agreementCheck(s1: S1Result, s2: S2Result): { agree: boolean; note: string } {
  if (s1.template === 'NONE') return { agree: false, note: 'S1 had no template — escalation justified' };
  const sameOwnerSet = s1.plan.every((p1) => s2.plan.some((p2) => p2.owner === p1.owner));
  if (sameOwnerSet) return { agree: true, note: 'S1 and S2 plans cover the same canonical responsibilities' };
  return { agree: false, note: 'S1 and S2 diverge on responsibilities → System 2 result retained, divergence recorded' };
}

export function uncertaintyLevel(u: number): 'VERIFIED' | 'PROBABLE' | 'UNCERTAIN' | 'UNKNOWN' {
  if (u <= 0.15) return 'VERIFIED';
  if (u <= 0.4) return 'PROBABLE';
  if (u <= 0.7) return 'UNCERTAIN';
  return 'UNKNOWN';
}
