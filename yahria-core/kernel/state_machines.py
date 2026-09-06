# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — Universal State Transition Contract
# Doc ID: YAHRIA-KRN-001-PY | Source: STATE_TRANSITION_MANIFEST.md
# Port of: src/lib/yahria/state-machines.ts (YAHRIA-KRN-001)
# Every transition is guarded, explicit, and audited.
# Illegal transitions raise IllegalTransitionError (HTTP 422 parity).
# ═══════════════════════════════════════════════════════════════

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class TransitionRule:
    from_: str                # TS field "from"
    to: str
    guard: str                # human-readable guard description
    authority: str            # 'SYSTEM' | 'AGENT' | 'POLICY' | 'HUMAN'

    def to_dict(self) -> dict:
        # JSON shape mirrors the TS object (key "from", not "from_")
        return {"from": self.from_, "to": self.to, "guard": self.guard, "authority": self.authority}


@dataclass(frozen=True)
class StateMachine:
    name: str
    domain: str
    states: List[str]
    initial: str
    terminal: List[str]
    transitions: List[TransitionRule] = field(default_factory=list)


TASK_MACHINE = StateMachine(
    name="TASK",
    domain="07",
    initial="PENDING",
    terminal=["COMPLETED", "CANCELLED"],
    states=["PENDING", "READY", "RUNNING", "BLOCKED", "FAILED", "CANCELLED", "COMPLETED"],
    transitions=[
        TransitionRule("PENDING", "READY", "all mandatory dependencies PROMOTED or VERIFIED", "SYSTEM"),
        TransitionRule("PENDING", "BLOCKED", "missing specification or unresolved dependency", "SYSTEM"),
        TransitionRule("READY", "RUNNING", "agent assigned AND policy evaluation != DENY", "AGENT"),
        TransitionRule("RUNNING", "COMPLETED", "tests pass AND evidence sealed", "SYSTEM"),
        TransitionRule("RUNNING", "FAILED", "test failure or execution failure (F012/F013)", "SYSTEM"),
        TransitionRule("RUNNING", "BLOCKED", "ambiguity detected → STOP protocol (never guess)", "AGENT"),
        TransitionRule("BLOCKED", "READY", "blocking condition resolved with evidence", "HUMAN"),
        TransitionRule("FAILED", "READY", "recovery strategy applied AND verified", "SYSTEM"),
        TransitionRule("PENDING", "CANCELLED", "human override (INV-200)", "HUMAN"),
        TransitionRule("READY", "CANCELLED", "human override (INV-200)", "HUMAN"),
        TransitionRule("BLOCKED", "CANCELLED", "human override (INV-200)", "HUMAN"),
    ],
)

AGENT_MACHINE = StateMachine(
    name="AGENT",
    domain="05",
    initial="IDLE",
    terminal=["COMPLETED", "TERMINATED"],
    states=["IDLE", "STARTED", "PERCEIVING", "REASONING", "ACTING", "VERIFYING", "COMPLETED", "FAILED", "BLOCKED", "TERMINATED"],
    transitions=[
        TransitionRule("IDLE", "STARTED", "run created with attributable identity (INV-070)", "SYSTEM"),
        TransitionRule("STARTED", "PERCEIVING", "world state assembly", "SYSTEM"),
        TransitionRule("PERCEIVING", "REASONING", "world state captured as evidence", "SYSTEM"),
        TransitionRule("REASONING", "ACTING", "plan produced AND capability check passed (INV-071)", "AGENT"),
        TransitionRule("REASONING", "BLOCKED", "policy DENY or capability boundary", "POLICY"),
        TransitionRule("ACTING", "VERIFYING", "action produced artifact", "SYSTEM"),
        TransitionRule("VERIFYING", "COMPLETED", "verifier verdict PASS (independent from generator)", "AGENT"),
        TransitionRule("VERIFYING", "FAILED", "verifier verdict FAIL → reflection required", "AGENT"),
        TransitionRule("BLOCKED", "IDLE", "reported to authority, awaiting decision", "HUMAN"),
    ],
)

EXECUTION_MACHINE = StateMachine(
    name="EXECUTION",
    domain="08",
    initial="QUEUED",
    terminal=["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"],
    states=["QUEUED", "POLICY_CHECK", "PROVISIONING", "RUNNING", "VERIFYING", "SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"],
    transitions=[
        TransitionRule("QUEUED", "POLICY_CHECK", "execution context explicit (INV-040)", "SYSTEM"),
        TransitionRule("POLICY_CHECK", "PROVISIONING", "policy ALLOW or REQUIRE_APPROVAL approved", "POLICY"),
        TransitionRule("POLICY_CHECK", "FAILED", "policy DENY (INV-120: policy overrides all)", "POLICY"),
        TransitionRule("PROVISIONING", "RUNNING", "sandbox provisioned with resource bounds (INV-042)", "SYSTEM"),
        TransitionRule("RUNNING", "VERIFYING", "exit captured; exit code alone is NOT success (INV-044)", "SYSTEM"),
        TransitionRule("RUNNING", "TIMED_OUT", "timeout exceeded → controlled termination (INV-043)", "SYSTEM"),
        TransitionRule("VERIFYING", "SUCCEEDED", "verification evidence sealed", "SYSTEM"),
        TransitionRule("VERIFYING", "FAILED", "verification failed → failure event emitted", "SYSTEM"),
    ],
)

EVIDENCE_MACHINE = StateMachine(
    name="EVIDENCE",
    domain="11",
    initial="DECLARED",
    terminal=["SEALED", "DISPOSED"],
    states=["DECLARED", "CAPTURED", "NORMALIZED", "HASHED", "LINKED", "VERIFIED", "SEALED", "RETAINED", "ARCHIVED", "EXPIRED", "DISPOSED", "INVALID", "CORRUPTED"],
    transitions=[
        TransitionRule("DECLARED", "CAPTURED", "payload captured with actor + timestamp", "SYSTEM"),
        TransitionRule("CAPTURED", "NORMALIZED", "schema-conformant normalization", "SYSTEM"),
        TransitionRule("NORMALIZED", "HASHED", "SHA-256 content addressing applied", "SYSTEM"),
        TransitionRule("HASHED", "LINKED", "lineage linked to execution/task (INV-111)", "SYSTEM"),
        TransitionRule("LINKED", "VERIFIED", "integrity check recomputed and equal", "SYSTEM"),
        TransitionRule("VERIFIED", "SEALED", "immutability commitment (INV-033)", "POLICY"),
    ],
)

FAILURE_MACHINE = StateMachine(
    name="FAILURE",
    domain="08/22",
    initial="DETECTED",
    terminal=["RECOVERED", "UNRECOVERABLE", "ABORTED", "QUARANTINED"],
    states=["DETECTED", "CLASSIFYING", "CLASSIFIED", "CONTAINING", "CONTAINED", "ANALYZING", "RECOVERY_SELECTED", "RECOVERING", "VERIFYING", "RECOVERED", "UNRECOVERABLE", "ESCALATED", "ABORTED", "QUARANTINED"],
    transitions=[
        TransitionRule("DETECTED", "CLASSIFYING", "failure event structured (taxonomy F001-F025)", "SYSTEM"),
        TransitionRule("CLASSIFYING", "CLASSIFIED", "type + severity + impact assigned", "SYSTEM"),
        TransitionRule("CLASSIFIED", "CONTAINING", "containment-first principle", "SYSTEM"),
        TransitionRule("CONTAINING", "CONTAINED", "blast radius bounded", "SYSTEM"),
        TransitionRule("CONTAINING", "ESCALATED", "containment failed → human authority", "HUMAN"),
        TransitionRule("CONTAINED", "ANALYZING", "root cause analysis started", "SYSTEM"),
        TransitionRule("ANALYZING", "RECOVERY_SELECTED", "strategy selected (retry/rollback/compensation/replan/switch)", "SYSTEM"),
        TransitionRule("RECOVERY_SELECTED", "RECOVERING", "idempotency verified before retry", "SYSTEM"),
        TransitionRule("RECOVERING", "VERIFYING", "recovery action executed", "SYSTEM"),
        TransitionRule("VERIFYING", "RECOVERED", "state consistent AND evidence preserved (INV-211)", "SYSTEM"),
        TransitionRule("VERIFYING", "UNRECOVERABLE", "recovery failed after max attempts", "SYSTEM"),
    ],
)

ACCEPTANCE_MACHINE = StateMachine(
    name="ACCEPTANCE",
    domain="20",
    initial="DRAFT",
    terminal=["ACCEPTED", "REJECTED"],
    states=["DRAFT", "PENDING", "RUNNING", "PASSED", "FAILED", "WAIVED", "ACCEPTED", "REJECTED"],
    transitions=[
        TransitionRule("DRAFT", "PENDING", "acceptance criteria explicit", "SYSTEM"),
        TransitionRule("PENDING", "RUNNING", "test environment ready", "SYSTEM"),
        TransitionRule("RUNNING", "PASSED", "all critical assertions verified with evidence", "SYSTEM"),
        TransitionRule("RUNNING", "FAILED", "any critical assertion failed", "SYSTEM"),
        TransitionRule("PASSED", "ACCEPTED", "evidence bundle complete (INV-102)", "POLICY"),
        TransitionRule("FAILED", "REJECTED", "claim without evidence cannot be accepted", "POLICY"),
    ],
)

ALL_MACHINES: List[StateMachine] = [
    TASK_MACHINE, AGENT_MACHINE, EXECUTION_MACHINE, EVIDENCE_MACHINE,
    FAILURE_MACHINE, ACCEPTANCE_MACHINE,
]


class IllegalTransitionError(Exception):
    """Raised by assert_transition on undeclared transitions.

    status_code == 422 mirrors the TS/HTTP contract: an illegal state
    transition is a semantic (unprocessable) error, never a 500.
    """

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason
        self.status_code = 422


def can_transition(machine: StateMachine, from_state: str, to_state: str) -> dict:
    """Mirror of TS canTransition(): {ok, rule?, reason?}."""
    for t in machine.transitions:
        if t.from_ == from_state and t.to == to_state:
            return {"ok": True, "rule": t.to_dict()}
    return {
        "ok": False,
        "reason": f"Transition {from_state} → {to_state} is not declared in {machine.name} machine. Silent transitions are prohibited.",
    }


def assert_transition(machine: StateMachine, from_state: str, to_state: str) -> dict:
    """Mirror of TS assertTransition(): returns the rule or throws."""
    res = can_transition(machine, from_state, to_state)
    if not res.get("ok"):
        raise IllegalTransitionError(res["reason"])
    return res["rule"]


def machine_by_name(name: str) -> Optional[StateMachine]:
    for m in ALL_MACHINES:
        if m.name == name:
            return m
    return None
