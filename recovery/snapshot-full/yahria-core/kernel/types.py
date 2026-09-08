# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — Canonical types & vocabulary
# Doc ID: YAHRIA-KRN-000-PY | Authority: CONSTITUTIONAL
# Port of: src/lib/yahria/types.ts (YAHRIA-KRN-000)
# Convention R7.1: field names keep TS camelCase (mêmes noms),
# module functions use snake_case (usage Python).
# ═══════════════════════════════════════════════════════════════

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class TaskState(str, Enum):
    PENDING = "PENDING"
    READY = "READY"
    RUNNING = "RUNNING"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class AgentState(str, Enum):
    IDLE = "IDLE"
    STARTED = "STARTED"
    PERCEIVING = "PERCEIVING"
    REASONING = "REASONING"
    ACTING = "ACTING"
    VERIFYING = "VERIFYING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"
    TERMINATED = "TERMINATED"


class ExecutionState(str, Enum):
    QUEUED = "QUEUED"
    POLICY_CHECK = "POLICY_CHECK"
    PROVISIONING = "PROVISIONING"
    RUNNING = "RUNNING"
    VERIFYING = "VERIFYING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    TIMED_OUT = "TIMED_OUT"


class EvidenceState(str, Enum):
    DECLARED = "DECLARED"
    CAPTURED = "CAPTURED"
    NORMALIZED = "NORMALIZED"
    HASHED = "HASHED"
    LINKED = "LINKED"
    VERIFIED = "VERIFIED"
    SEALED = "SEALED"
    RETAINED = "RETAINED"
    ARCHIVED = "ARCHIVED"
    EXPIRED = "EXPIRED"
    DISPOSED = "DISPOSED"
    INVALID = "INVALID"
    CORRUPTED = "CORRUPTED"


class FailureState(str, Enum):
    DETECTED = "DETECTED"
    CLASSIFYING = "CLASSIFYING"
    CLASSIFIED = "CLASSIFIED"
    CONTAINING = "CONTAINING"
    CONTAINED = "CONTAINED"
    ANALYZING = "ANALYZING"
    RECOVERY_SELECTED = "RECOVERY_SELECTED"
    RECOVERING = "RECOVERING"
    VERIFYING = "VERIFYING"
    RECOVERED = "RECOVERED"
    UNRECOVERABLE = "UNRECOVERABLE"
    ESCALATED = "ESCALATED"
    ABORTED = "ABORTED"
    QUARANTINED = "QUARANTINED"


class PolicyEffect(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"


class ReasoningPath(str, Enum):
    SYSTEM_1 = "SYSTEM_1"
    SYSTEM_2 = "SYSTEM_2"
    CASCADE = "CASCADE"
    BLOCKED = "BLOCKED"


class UncertaintyLevel(str, Enum):
    VERIFIED = "VERIFIED"
    PROBABLE = "PROBABLE"
    UNCERTAIN = "UNCERTAIN"
    UNKNOWN = "UNKNOWN"
    FALSE = "FALSE"


class AgentKey(str, Enum):
    EXPLORER = "explorer"
    ARCHITECT = "architect"
    PLANNER = "planner"
    CODER = "coder"
    DEBUGGER = "debugger"
    TESTER = "tester"
    REVIEWER = "reviewer"
    SECURITY = "security"
    VERIFIER = "verifier"


AGENT_KEYS = [k.value for k in AgentKey]


@dataclass
class PolicyRequest:
    actorType: str            # 'HUMAN' | 'AGENT' | 'SYSTEM' | 'TOOL' | 'MODEL'
    actorId: str
    action: str               # e.g. "filesystem.write", "network.egress", "evolution.promote"
    resource: str             # e.g. "host.secrets", "workspace.overlay"
    context: Optional[Dict[str, Any]] = None


@dataclass
class PolicyEvaluation:
    effect: str               # PolicyEffect value
    matchedRule: Optional[str]
    reason: str
    precedence: str           # canonical precedence chain trace


@dataclass
class RepositoryState:
    languages: List[str]
    files: int
    dirty: bool


@dataclass
class WorldState:
    goal: str
    repository: RepositoryState
    symbols: int
    activeErrors: List[str]
    testResults: Dict[str, int]   # {"passed": int, "failed": int}
    dependencies: List[str]
    timestamp: str


@dataclass
class PlanStep:
    index: int
    action: str
    detail: str
    owner: str                # AgentKey value
    requiresApproval: bool


@dataclass
class ReasoningSignals:
    length: int
    hasMultiStep: bool        # "then", "and then", "after that", numbered steps
    hasAmbiguity: bool        # "maybe", "somehow", "or something"
    hasCreationVerb: bool     # build, create, implement, design
    hasQueryVerb: bool        # show, list, what, status, explain
    hasRiskTerms: bool        # deploy, production, delete, secret, policy
    keywordMatches: List[str] = field(default_factory=list)


@dataclass
class RouterDecision:
    path: str                 # ReasoningPath value
    complexity: float         # 0..1
    uncertainty: float        # 0..1 (INV-081)
    signals: ReasoningSignals
    escalationReason: Optional[str]
    rationale: str


@dataclass
class StepResult:
    step: str                 # PERCEPTION | ROUTING | PLANNING | ACTING | VERIFYING | REFLECTION | COMMIT
    detail: str
    ms: int
    data: Optional[Dict[str, Any]] = None


@dataclass
class CognitiveLoopResult:
    traceId: str
    route: RouterDecision
    worldState: WorldState
    plan: List[PlanStep]
    steps: List[StepResult]
    verdict: str              # 'PASS' | 'FAIL' | 'REJECTED' | 'PENDING'
    reflection: Optional[str]
    finalAnswer: str
    evidenceUids: List[str]
    durationMs: int
