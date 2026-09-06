# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — HYBRID REASONING ENGINE (Domain 06)
# Doc ID: YAHRIA-KRN-006-PY | Spec: HYBRID_REASONING_SPECIFICATION.md
# Port of: src/lib/yahria/hybrid-reasoning.ts (YAHRIA-KRN-006)
#
# Dual-process cognitive architecture:
#   SYSTEM 1 — Fast deterministic path (rules, patterns, cached plans)
#   SYSTEM 2 — Deep deliberative path (LLM reasoning, multi-step planning)
#   CASCADE  — S1 first; escalate to S2 when uncertainty > threshold
#
# Constitutional constraints:
#   INV-080 — model output is not fact → verdict requires verification
#   INV-081 — uncertainty must be representable
#   INV-082 — decisions preserve context
#   D.6 governance — reasoning cannot bypass policy
#
# Parity notes (R7.1):
#   - JavaScript \b is ASCII-only (\w = [A-Za-z0-9_]). Python \b is
#     Unicode-aware and would match "étape" where JS does not. All
#     word boundaries are therefore emulated with lookarounds.
#   - toFixed(2) is emulated by kernel.canonical_json.js_fixed
#     (ECMA-262 tie-breaking: pick the larger n).
# ═══════════════════════════════════════════════════════════════

import re
import time
from dataclasses import dataclass
from typing import List, Optional

from kernel.canonical_json import js_fixed
from kernel.types import PlanStep, ReasoningSignals, RouterDecision, WorldState

# ── HR-1. SIGNAL EXTRACTION ────────────────────────────────────────

_W = r"[A-Za-z0-9_]"
_LB = f"(?<!{_W})"   # leading ASCII word boundary (JS \b)
_RB = f"(?!{_W})"    # trailing ASCII word boundary (JS \b)


def _c(pattern: str) -> "re.Pattern[str]":
    return re.compile(pattern, re.IGNORECASE)


MULTI_STEP_PATTERNS = [
    _c(f"{_LB}then{_RB}"),
    _c(f"{_LB}after that{_RB}"),
    _c(f"{_LB}step (\\d|one|two|three)"),
    _c(f"{_LB}(et puis|puis|ensuite|étape){_RB}"),
    re.compile(r"\d\.\s"),
]
AMBIGUITY_PATTERNS = [
    _c(f"{_LB}maybe{_RB}"),
    _c(f"{_LB}somehow{_RB}"),
    _c(f"{_LB}or something{_RB}"),
    _c(f"{_LB}peut-être{_RB}"),
    _c(f"{_LB}approximativement{_RB}"),
    _c(f"{_LB}n'importe comment{_RB}"),
]
CREATION_VERBS = [
    _c(f"{_LB}(build|create|implement|design|generate|write|refactor|migrate|add feature){_RB}"),
    _c(f"{_LB}(construis|crée|implémente|génère|conçois){_RB}"),
]
QUERY_VERBS = [
    _c(f"{_LB}(show|list|what|status|explain|summarize|where|how many){_RB}"),
    _c(f"{_LB}(montre|liste|explique|statut){_RB}"),
]
RISK_TERMS = [
    _c(f"{_LB}(deploy|production|delete|drop|secret|password|token|policy|payment|billing){_RB}"),
    _c(f"{_LB}(déploie|production|supprime|supprimer|secret){_RB}"),
]
TECH_TERMS = [
    _c(f"{_LB}(api|database|schema|migration|auth|security|sandbox|agent|task|evidence|graph){_RB}"),
]

_ALL_PATTERNS = [
    *MULTI_STEP_PATTERNS, *AMBIGUITY_PATTERNS, *CREATION_VERBS,
    *QUERY_VERBS, *RISK_TERMS, *TECH_TERMS,
]


def extract_signals(request: str) -> ReasoningSignals:
    keyword_matches: List[str] = []
    for p in _ALL_PATTERNS:
        m = p.search(request)
        if m:
            keyword_matches.append(m.group(0).lower())
    # Mirror of TS: Array.from(new Set(...)).slice(0, 10) — insertion-ordered dedupe
    deduped = list(dict.fromkeys(keyword_matches))[:10]
    return ReasoningSignals(
        length=len(request),
        hasMultiStep=any(p.search(request) for p in MULTI_STEP_PATTERNS),
        hasAmbiguity=any(p.search(request) for p in AMBIGUITY_PATTERNS),
        hasCreationVerb=any(p.search(request) for p in CREATION_VERBS),
        hasQueryVerb=any(p.search(request) for p in QUERY_VERBS),
        hasRiskTerms=any(p.search(request) for p in RISK_TERMS),
        keywordMatches=deduped,
    )


# ── HR-2. UNCERTAINTY & COMPLEXITY SCORING (INV-081) ───────────────

def score_complexity(signals: ReasoningSignals) -> float:
    c = 0.0
    c += min(signals.length / 400, 0.25)              # verbosity
    if signals.hasMultiStep:
        c += 0.30                                     # multi-step composition
    if signals.hasCreationVerb:
        c += 0.25                                     # generative work
    if signals.hasQueryVerb:
        c -= 0.15                                     # simple retrieval
    if signals.hasAmbiguity:
        c += 0.15                                     # ambiguity tax
    if signals.hasRiskTerms:
        c += 0.10                                     # risk → deliberation
    c += min(len(signals.keywordMatches) * 0.02, 0.10)
    return max(0.0, min(1.0, c))


def score_uncertainty(signals: ReasoningSignals) -> float:
    u = 0.08                                          # base entropy
    if signals.hasAmbiguity:
        u += 0.35
    if signals.hasMultiStep and not signals.hasCreationVerb:
        u += 0.05
    if signals.length < 25:
        u += 0.20                                     # underspecified request
    if signals.hasRiskTerms:
        u += 0.10                                     # high stakes → more caution
    return max(0.0, min(1.0, u))


# ── HR-3. ROUTER (the hybrid decision) ─────────────────────────────

ROUTE_THRESHOLDS = {
    "S1_MAX_COMPLEXITY": 0.45,
    "S1_MAX_UNCERTAINTY": 0.30,
    "CASCADE_UNCERTAINTY": 0.45,
    "ESCALATE_COMPLEXITY": 0.65,
}


def route(request: str) -> RouterDecision:
    signals = extract_signals(request)
    complexity = score_complexity(signals)
    uncertainty = score_uncertainty(signals)

    # Hard rule: risk terms always get deliberation regardless of score
    if signals.hasRiskTerms and (complexity > 0.3 or uncertainty > 0.25):
        return RouterDecision(
            path="SYSTEM_2", complexity=complexity, uncertainty=uncertainty, signals=signals,
            escalationReason="RISK_TERMS: high-stakes request requires deep deliberation (HR-3.R1)",
            rationale=f"complexity={js_fixed(complexity, 2)}, uncertainty={js_fixed(uncertainty, 2)} + risk vocabulary → System 2",
        )
    # Fast path: simple, certain, non-risky
    if complexity <= ROUTE_THRESHOLDS["S1_MAX_COMPLEXITY"] and uncertainty <= ROUTE_THRESHOLDS["S1_MAX_UNCERTAINTY"]:
        return RouterDecision(
            path="SYSTEM_1", complexity=complexity, uncertainty=uncertainty, signals=signals,
            escalationReason=None,
            rationale=f"simple + confident (complexity={js_fixed(complexity, 2)} ≤ 0.45, uncertainty={js_fixed(uncertainty, 2)} ≤ 0.30) → System 1 fast path",
        )
    # Cascade: attempt S1, escalate on uncertainty
    if complexity < ROUTE_THRESHOLDS["ESCALATE_COMPLEXITY"] and uncertainty < ROUTE_THRESHOLDS["CASCADE_UNCERTAINTY"] + 0.25:
        return RouterDecision(
            path="CASCADE", complexity=complexity, uncertainty=uncertainty, signals=signals,
            escalationReason=f"moderate complexity ({js_fixed(complexity, 2)}) → try S1, escalate if S1 uncertainty > {ROUTE_THRESHOLDS['CASCADE_UNCERTAINTY']}",
            rationale="CASCADE: cheap attempt first, verified escalation (HR-4)",
        )
    # Deep path
    return RouterDecision(
        path="SYSTEM_2", complexity=complexity, uncertainty=uncertainty, signals=signals,
        escalationReason=f"complexity {js_fixed(complexity, 2)} ≥ {ROUTE_THRESHOLDS['ESCALATE_COMPLEXITY']} → System 2",
        rationale="deep deliberative path (HR-3.D1)",
    )


# ── HR-4. SYSTEM 1 — DETERMINISTIC FAST PATH ───────────────────────

@dataclass
class S1Result:
    answer: str
    plan: List[PlanStep]
    uncertainty: float        # residual uncertainty after fast path
    template: str
    ms: int


def _steps_to_dicts(plan: List[PlanStep]) -> List[dict]:
    return [
        {"index": s.index, "action": s.action, "detail": s.detail,
         "owner": s.owner, "requiresApproval": s.requiresApproval}
        for s in plan
    ]


class _S1Template:
    def __init__(self, name: str, pattern: "re.Pattern[str]", make_plan):
        self.template = name
        self.match = pattern
        self.make_plan = make_plan


S1_TEMPLATES = [
    _S1Template(
        "SYSTEM_STATUS_REPORT",
        _c(f"{_LB}(status|statut|état|etat|health|santé|sante){_RB}"),
        lambda g: [
            PlanStep(1, "collect system metrics", "Gather domain statuses, agent states, execution counts", "explorer", False),
            PlanStep(2, "format report", "Compose human-readable status summary", "verifier", False),
        ],
    ),
    _S1Template(
        "CANONICAL_ENTITY_LISTING",
        _c(f"{_LB}(list|liste|show|montre){_RB}.*{_LB}(tasks?|tâches|agents?|executions?|exécutions|evidence|preuves){_RB}"),
        lambda g: [
            PlanStep(1, "resolve entity type", f'Parse requested entity from: "{g[:60]}"', "explorer", False),
            PlanStep(2, "query registry", "Fetch canonical records with states", "explorer", False),
            PlanStep(3, "render listing", "Present with state machines and criticality", "verifier", False),
        ],
    ),
    _S1Template(
        "CONCEPT_EXPLANATION",
        _c(f"{_LB}(explain|explique){_RB}"),
        lambda g: [
            PlanStep(1, "resolve concept", f'Identify concept in: "{g[:60]}"', "explorer", False),
            PlanStep(2, "retrieve canonical definition", "Look up constitution / invariants / domain specs", "architect", False),
            PlanStep(3, "compose explanation", "Answer with sources and invariants cited", "verifier", False),
        ],
    ),
]


def system1(goal: str, base_uncertainty: float) -> S1Result:
    t0 = time.monotonic()
    for t in S1_TEMPLATES:
        if t.match.search(goal):
            return S1Result(
                answer=f'[S1:{t.template}] Deterministic plan produced from canonical template for "{goal[:80]}".',
                plan=t.make_plan(goal),
                uncertainty=max(0.05, base_uncertainty * 0.6),
                template=t.template,
                ms=int((time.monotonic() - t0) * 1000),
            )
    # No template matched — S1 fails, residual uncertainty stays high → cascade escalation
    return S1Result(
        answer="[S1:NO_TEMPLATE] No deterministic template matched. Cannot answer without guessing (INV-210).",
        plan=[],
        uncertainty=1.0,
        template="NONE",
        ms=int((time.monotonic() - t0) * 1000),
    )


# ── HR-5. SYSTEM 2 — DEEP DELIBERATIVE PATH (LLM) ──────────────────

@dataclass
class S2Result:
    answer: str
    plan: List[PlanStep]
    reasoning: str
    uncertainty: float
    ms: int
    modelUsed: str


def heuristic_plan(goal: str) -> List[PlanStep]:
    return [
        PlanStep(1, "perceive", "Assemble WorldState: repository, symbols, errors, tests", "explorer", False),
        PlanStep(2, "analyze intent", f'Decompose goal: "{goal[:80]}"', "planner", False),
        PlanStep(3, "design solution", "Select strategy respecting domain boundaries and invariants", "architect", True),
        PlanStep(4, "implement", "Apply changes inside sandbox overlay only (FS-001)", "coder", False),
        PlanStep(5, "verify", "Independent verifier: tests + lint + security + policy", "tester", False),
        PlanStep(6, "commit with evidence", "Seal evidence bundle, close task", "verifier", False),
    ]


# System 2 uses the LLM when available; falls back to structured heuristic planning
# (INV-210: never guess silently — fallback is explicitly labeled as heuristic).
# The real LLM client lands in R7.5 (yahria-workers); `llm` here is an optional
# async callable with the same contract as the TS z-ai-web-dev-sdk path.
def system2(goal: str, world_state: WorldState, llm=None) -> S2Result:
    t0 = time.monotonic()
    if llm is None:
        # SDK unavailable → explicit heuristic fallback with raised uncertainty
        return S2Result(
            answer="[S2:FALLBACK] Deep model unavailable → structured heuristic plan (explicitly non-verified).",
            plan=heuristic_plan(goal),
            reasoning="LLM path unavailable in this environment; heuristic decomposition used and flagged UNVERIFIED (INV-081).",
            uncertainty=0.6,
            ms=int((time.monotonic() - t0) * 1000),
            modelUsed="HEURISTIC_FALLBACK",
        )
    raise NotImplementedError("S2 LLM client is implemented in R7.5 (yahria-workers)")


# ── HR-6. DUAL-PROCESS AGREEMENT (used in CASCADE mode) ────────────

def agreement_check(s1: S1Result, s2: S2Result) -> dict:
    if s1.template == "NONE":
        return {"agree": False, "note": "S1 had no template — escalation justified"}
    same_owner_set = all(any(p2.owner == p1.owner for p2 in s2.plan) for p1 in s1.plan)
    if same_owner_set:
        return {"agree": True, "note": "S1 and S2 plans cover the same canonical responsibilities"}
    return {"agree": False, "note": "S1 and S2 diverge on responsibilities → System 2 result retained, divergence recorded"}


def uncertainty_level(u: float) -> str:
    if u <= 0.15:
        return "VERIFIED"
    if u <= 0.4:
        return "PROBABLE"
    if u <= 0.7:
        return "UNCERTAIN"
    return "UNKNOWN"
