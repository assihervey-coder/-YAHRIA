YAHRIA — HYBRID REASONING SPECIFICATION
Le document qui manquait : la spécification canonique du raisonnement hybride,
promesse du nom du produit (« Your Autonomous Hybrid Reasoning Intelligence Assistant for Code »),
jamais définie dans le blueprint original. Ce document comble ce vide et est rédigé
selon les conventions constitutionnelles de YAHRIA.

Product: YAHRIA
System Type: Autonomous AI Development & Software Intelligence Operating System
Document ID: YAHRIA-ROOT-COGNITIVE-001
Status: CANONICAL
Authority: DOMAIN 06 SPECIFICATION (Cognitive Core)
Version: 1.0.0
Classification: ARCHITECTURAL SOURCE OF TRUTH
Modification Policy: Explicit versioned amendment only
Dependencies: GLOBAL_INVARIANTS.md, 00_AUTONOMOUS_CODING_CONTRACT.md, DOMAIN 06, DOMAIN 12

═══════════════════════════════════════════════════════════════════

1. PURPOSE

This specification defines the Hybrid Reasoning Architecture (HRA) of YAHRIA.
It is the canonical definition of how YAHRIA reasons: how every goal is routed
between fast deterministic cognition and deep deliberative cognition, how
uncertainty is represented, escalated, and governed, and how reasoning output
is converted into verified, evidence-backed decisions.

The Hybrid Reasoning Engine (HRE) is a subdomain of the Cognitive Core (Domain 06).
It MUST be treated as the single canonical owner of reasoning routing.
No agent, tool, or model may perform un-routed reasoning on a goal.

1.1 WHY "HYBRID"

A single reasoning strategy is architecturally invalid for an autonomous
development operating system:

    • Pure LLM reasoning (System-2-only): slow, expensive, non-deterministic,
      and prone to hallucinated certainty — violates INV-080 and INV-081.
    • Pure deterministic reasoning (System-1-only): fast and auditable but
      brittle; cannot handle novel, ambiguous, or compositional goals.

YAHRIA therefore implements a dual-process architecture, analoguous to human
cognition (fast/automatic vs slow/deliberative), with an explicit governed
boundary between the two processes and a mandatory escalation path.

    HYBRID = DETERMINISTIC CERTAINTY
           + DELIBERATIVE DEPTH
           + GOVERNED ESCALATION BETWEEN THEM

2. DEFINITIONS

    System 1 (S1) — Fast Path
        Deterministic, rule-based, template-driven cognition.
        Zero LLM invocation. Fully auditable. Latency budget: < 50 ms.

    System 2 (S2) — Deep Path
        Deliberative, model-assisted, multi-step reasoning.
        LLM invocation permitted under policy. Latency budget: bounded by
        Resource Controller (INV-042).

    Cascade — Governed Escalation
        S1 attempts first; if residual uncertainty exceeds the escalation
        threshold, the goal is escalated to S2 with full context transfer.

    Router — The Hybrid Decision Function
        Pure function: request signals → {path, complexity, uncertainty}.
        The Router is deterministic and MUST NOT call any LLM.

    Uncertainty — INV-081 Representation
        A scalar 0..1 mapped to the canonical levels:
            VERIFIED  (≤ 0.15)
            PROBABLE  (≤ 0.40)
            UNCERTAIN (≤ 0.70)
            UNKNOWN   (> 0.70)
        UNKNOWN MUST NOT be silently represented as certain (INV-081).

3. CANONICAL ARCHITECTURE

                        GOAL (user or task graph)
                              │
                              ▼
                   ┌─────────────────────┐
                   │ SIGNAL EXTRACTION    │  ← lexical, syntactic, semantic signals
                   └──────────┬──────────┘
                              ▼
                   ┌─────────────────────┐
                   │ UNCERTAINTY &        │  ← complexity ∈ [0,1], uncertainty ∈ [0,1]
                   │ COMPLEXITY SCORING   │
                   └──────────┬──────────┘
                              ▼
                   ┌─────────────────────┐
                   │     HYBRID ROUTER    │  ← pure, deterministic, no LLM
                   └───┬───────┬───────┬─┘
                       │       │       │
             simple+certain   │        complex or risky
                       │      │       │
                       ▼      │       ▼
              ┌────────────┐  │  ┌────────────┐
              │ SYSTEM 1   │  │  │ SYSTEM 2   │
              │ rules      │  │  │ LLM +      │
              │ templates  │  │  │ deliberation│
              │ < 50ms     │  │  │ bounded     │
              └─────┬──────┘  │  └─────┬──────┘
                    │         │        │
                    │   CASCADE (moderate) │
                    │         ▼            │
                    │   S1 attempt → residual uncertainty > θ_e ?
                    │         │ yes            │ no
                    │         ▼                │
                    │   escalate to S2         │
                    │         │                │
                    ▼         ▼                ▼
              ┌──────────────────────────────────┐
              │ DUAL-PROCESS AGREEMENT CHECK     │  ← S1 vs S2 divergence recorded
              └───────────────┬──────────────────┘
                              ▼
              ┌──────────────────────────────────┐
              │ GOVERNED VERDICT PIPELINE        │
              │ POLICY → VERIFY → EVIDENCE →     │
              │ TRUST LEVEL (INV-080)            │
              └──────────────────────────────────┘

4. THE ROUTER (normative)

4.1 SIGNAL SET

    S1S  multi-step signals        "then", "after that", numbered steps, "ensuite"
    SAG  ambiguity signals         "maybe", "somehow", "peut-être"
    SCR  creation signals          build, implement, design, generate, refactor
    SQY  query signals             show, list, explain, status, where
    SRK  risk signals              deploy, production, delete, secret, payment
    SST  structure signals         length, keyword density

4.2 COMPLEXITY FUNCTION (normative formula, V1.0.0)

    complexity = clamp01(
        0.00 + min(len/400, 0.25)
        + 0.30·[multi-step]
        + 0.25·[creation]
        − 0.15·[query]
        + 0.15·[ambiguity]
        + 0.10·[risk]
        + min(0.02·|keyword matches|, 0.10)
    )

4.3 UNCERTAINTY FUNCTION (normative formula, V1.0.0)

    uncertainty = clamp01(
        0.08                                    (base entropy)
        + 0.35·[ambiguity]
        + 0.20·[len < 25]                       (underspecification)
        + 0.10·[risk]
        + 0.05·[multi-step ∧ ¬creation]
    )

4.4 ROUTING RULES (evaluated in order; first match wins)

    R1  RISK ESCALATION
        IF risk ∧ (complexity > 0.30 ∨ uncertainty > 0.25)
        THEN S2. High-stakes requests are never handled by reflexes.

    R2  FAST PATH
        IF complexity ≤ θ_c (0.45) ∧ uncertainty ≤ θ_u (0.30)
        THEN S1.

    R3  CASCADE
        IF complexity < θ_E (0.65) ∧ uncertainty < θ_e + 0.25 (θ_e = 0.45)
        THEN CASCADE (S1 first, escalate on residual uncertainty).

    R4  DEEP PATH
        ELSE → S2.

    The thresholds θ_c, θ_u, θ_e, θ_E are constitutional parameters.
    Changing them requires a versioned amendment of this document (INV-180).

5. SYSTEM 1 — FAST PATH (normative)

5.1 CONTRACT
    S1 MUST be: deterministic; LLM-free; template-driven; latency < 50 ms;
    fully evidence-capturable; and NEVER applied to risk-classified goals (R1).

5.2 TEMPLATE REGISTRY
    S1 operates on a versioned template registry. V1.0.0 canonical templates:

    T-01 SYSTEM_STATUS_REPORT        status/health queries
    T-02 CANONICAL_ENTITY_LISTING    list/show + canonical entity
    T-03 CONCEPT_EXPLANATION         explain + constitution concept

    Templates produce: answer + plan steps + residual uncertainty.
    Residual uncertainty after S1 = max(0.05, base_uncertainty × 0.6).

5.3 NO-TEMPLATE RULE
    If no template matches: S1 returns NO_TEMPLATE with uncertainty = 1.0.
    The system MUST NOT guess (INV-210). CASCADE routes will escalate.

6. SYSTEM 2 — DEEP PATH (normative)

6.1 CONTRACT
    S2 is the deliberative reasoner. It MUST:
        • operate through the Model Router (FAST/REASONING/CODE selection);
        • receive the full WorldState (perception contract, Domain 06.1);
        • emit a structured plan: steps + owners + approval flags;
        • emit residual_uncertainty ∈ [0,1] honestly (INV-081);
        • always include a verification step owned by an agent independent
          of the generating path (INV-080: generator ≠ verifier);
        • mark missing specifications as REQUIRES_SPECIFICATION — never
          invent architecture (STRICT NON-INVENTION RULE).

6.2 FALLBACK HIERARCHY (explicitly labeled, never silent)
    S2-LLM → (unavailable/unparsable) → S2-HEURISTIC-FALLBACK
    The fallback MUST raise residual uncertainty to ≥ 0.55 and MUST record
    the degradation as evidence (category MODEL, criticality HIGH).

6.3 GOVERNED INFERENCE
    Inference itself is policy-gated: action=model.inference on resource=router.*.
    A policy DENY blocks the loop entirely (INV-120, INV-073). YAHRIA refuses
    to reason its way around governance.

7. CASCADE — GOVERNED ESCALATION (normative)

    C1  S1 attempt with base uncertainty.
    C2  IF residual uncertainty ≤ θ_e (0.45) → S1 result retained.
    C3  ELSE → escalate to S2 with full context transfer:
            {goal, signals, complexity, uncertainty, S1 template, S1 plan,
             S1 residual uncertainty, WorldState}
    C4  DUAL-PROCESS AGREEMENT CHECK:
            same canonical responsibility coverage → AGREE (recorded)
            divergent coverage → DIVERGE (S2 retained, divergence recorded
            as structured learning signal, INV-152)
    C5  Every escalation is captured as evidence (category REPLAY or MODEL).

8. VERDICT PIPELINE (normative — INV-080)

    No reasoning output — from S1 OR S2 — is a fact by itself.

        REASONING OUTPUT
              ↓
        POLICY EVALUATION          (a DENY rejects the loop)
              ↓
        INDEPENDENT VERIFICATION   (generator ≠ verifier)
              ↓
        EVIDENCE CAPTURE + SEAL    (category TEST, criticality CRITICAL)
              ↓
        TRUST LEVEL = f(verdict, uncertainty)
            PASS  ∧ uncertainty ≤ 0.15  → VERIFIED
            PASS  ∧ uncertainty ≤ 0.40  → PROBABLE
            PASS  ∧ uncertainty > 0.40  → UNCERTAIN (usable, flagged)
            FAIL                        → FALSE (→ reflection, no commit)

9. REFLECTION CONTRACT (on FAIL)

    YAHRIA does not regenerate blindly. The Reflection Engine MUST produce:
        1. what happened (expected vs actual);
        2. root-cause hypothesis with supporting evidence;
        3. assumption audit (was the previous reasoning assumption wrong?);
        4. the smallest safe correction;
    before any replanning. Retry is governed (INV-092: max 3, backoff).

10. MEMORY INTEGRATION (D.7 — MEMORY ≠ POLICY)

    Successful loops write episodic memory with:
        content, confidence = 1 − uncertainty, validation level (INV-140),
        source = cognitive-loop:{path}.
    Memory may PROPOSE template additions to the S1 registry (D.8 proposal)
    but MAY NOT self-modify the registry: promotion requires D.6.11
    (experiment → benchmark → policy → approve → canary).

11. STATE MACHINE (canonical)

    IDLE
      ↓ goal received
    SIGNAL_EXTRACTION
      ↓
    SCORING
      ↓
    ROUTED {S1 | S2 | CASCADE | BLOCKED}
      ↓                    ↓
    PLANNING_S1        PLANNING_S2
      ↓ cascade?         ↓
    ESCALATION_CHECK ───┘
      ↓
    AGREEMENT_CHECK (cascade only)
      ↓
    POLICY_EVALUATION → (DENY) → BLOCKED
      ↓ (allow)
    VERIFICATION
      ↓            ↓
    PASS         FAIL
      ↓            ↓
    COMMIT     REFLECTION
      ↓            ↓
    MEMORY      REPLAN (governed)
    (terminal: COMMITTED | BLOCKED | REPLANNED)

12. DATA MODEL (canonical fields)

    ReasoningRoute:  trace_id, request, signals{}, chosen_path,
                     escalation_reason, s1_verdict, s2_verdict, agreement,
                     final_answer, latency_s1_ms, latency_s2_ms
    CognitiveTrace:  goal, route, complexity, uncertainty, world_state,
                     plan[], verdict, reflection, evidence_ids[], duration_ms

    Every critical field is evidence-backed (INV-111) and correlated
    (trace_id, INV-101).

13. INVARIANT MAPPING (per GLOBAL_INVARIANTS §26)

    INV-080  Model output is not fact        → §8 verdict pipeline
    INV-081  Uncertainty representable       → §2, §4.3, §8 trust levels
    INV-082  Decisions preserve context      → §12 data model
    INV-120  Policy precedence               → §6.3, §8 policy gate
    INV-210  Fail safely / never guess       → §5.3, §6.2 fallback labeling
    INV-150  Learning requires evidence      → §10 memory promotion gate
    INV-161  Separation proposal/approval    → §10 D.8/D.6.11 split
    INV-071  Capability boundaries           → plan step owners + approvals
    INV-092  Retry governed                  → §9 reflection & replan

14. ACCEPTANCE CRITERIA (per ACCEPTANCE_TEST_MANIFEST)

    A-HR-01  Router is pure: same input → same output (determinism test).
    A-HR-02  Risk vocabulary always yields S2 (R1 test).
    A-HR-03  S1 latency < 50 ms on canonical templates (performance test).
    A-HR-04  No-template S1 returns uncertainty 1.0, never a guess (INV-210).
    A-HR-05  Cascade escalation triggers exactly at θ_e breach (boundary test).
    A-HR-06  S2 plans always contain an independent verification step (INV-080).
    A-HR-07  Fallback path raises uncertainty ≥ 0.55 and emits evidence.
    A-HR-08  Every loop produces ≥ 1 evidence record; FAIL produces reflection.
    A-HR-09  Policy DENY blocks reasoning output from becoming action.
    A-HR-10  Trust levels map exactly per §8 (boundary values tested).

15. EVIDENCE REQUIREMENTS (per EVIDENCE_MANIFEST)

    Every cognitive loop SHALL produce, at minimum:
        EV-AGENT-{seq}    WorldState capture
        EV-MODEL-{seq}    plan production (path labeled)
        EV-EXECUTION-{seq} governed execution result
        EV-TEST-{seq}     independent verdict
    plus EV-POLICY-{seq} on any denial and EV-AUDIT-{seq} on reflection.

16. FINAL RULES

    THE ROUTER NEVER CALLS A MODEL.
    SYSTEM 1 NEVER HANDLES RISK.
    SYSTEM 2 NEVER SKIPS VERIFICATION.
    UNCERTAINTY IS ALWAYS A NUMBER, NEVER A FEELING.
    A DENIED LOOP PRODUCES NO ACTION — ONLY EVIDENCE.
    WHEN IN DOUBT, ESCALATE; WHEN ESCALATED, VERIFY; WHEN VERIFIED, SEAL.

END OF HYBRID REASONING SPECIFICATION
Status: CANONICAL — V1.0.0
Reference implementation: src/lib/yahria/hybrid-reasoning.ts (this system)
