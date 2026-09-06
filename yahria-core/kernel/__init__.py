# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — public surface
# Doc ID: YAHRIA-KRN-PY | R7.1: portage du noyau constitutionnel
# ═══════════════════════════════════════════════════════════════

from kernel import domains, evidence_engine, hybrid_reasoning, invariants, policy_engine, state_machines  # noqa: F401
from kernel.canonical_json import js_fixed, js_stringify  # noqa: F401
from kernel.domains import DOMAINS, FORBIDDEN_DEPENDENCIES, GOVERNANCE_PLANES  # noqa: F401
from kernel.evidence_engine import (  # noqa: F401
    EvidenceCapture,
    EvidenceRecord,
    check_minimum_contract,
    capture_evidence,
    hash_payload,
    verify_evidence,
)
from kernel.hybrid_reasoning import (  # noqa: F401
    ROUTE_THRESHOLDS,
    agreement_check,
    extract_signals,
    route,
    score_complexity,
    score_uncertainty,
    system1,
    uncertainty_level,
)
from kernel.invariants import INVARIANTS, INVARIANT_FAMILIES  # noqa: F401
from kernel.policy_engine import (  # noqa: F401
    DEFAULT_EFFECT,
    DEFAULT_REASON,
    SEED_POLICY_RULES,
    evaluate_policy,
)
from kernel.state_machines import (  # noqa: F401
    ALL_MACHINES,
    IllegalTransitionError,
    assert_transition,
    can_transition,
)

__version__ = "2.3.0-r7.1"
