// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Canonical types & vocabulary
// Doc ID: YAHRIA-KRN-000 | Authority: CONSTITUTIONAL
// ═══════════════════════════════════════════════════════════════

export type TaskState =
  | 'PENDING' | 'READY' | 'RUNNING' | 'BLOCKED'
  | 'FAILED' | 'CANCELLED' | 'COMPLETED';

export type AgentState =
  | 'IDLE' | 'STARTED' | 'PERCEIVING' | 'REASONING' | 'ACTING'
  | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'TERMINATED';

export type ExecutionState =
  | 'QUEUED' | 'POLICY_CHECK' | 'PROVISIONING' | 'RUNNING' | 'VERIFYING'
  | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';

export type EvidenceState =
  | 'DECLARED' | 'CAPTURED' | 'NORMALIZED' | 'HASHED' | 'LINKED'
  | 'VERIFIED' | 'SEALED' | 'RETAINED' | 'ARCHIVED' | 'EXPIRED'
  | 'DISPOSED' | 'INVALID' | 'CORRUPTED';

export type FailureState =
  | 'DETECTED' | 'CLASSIFYING' | 'CLASSIFIED' | 'CONTAINING' | 'CONTAINED'
  | 'ANALYZING' | 'RECOVERY_SELECTED' | 'RECOVERING' | 'VERIFYING'
  | 'RECOVERED' | 'UNRECOVERABLE' | 'ESCALATED' | 'ABORTED' | 'QUARANTINED';

export type PolicyEffect = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

export type ReasoningPath = 'SYSTEM_1' | 'SYSTEM_2' | 'CASCADE' | 'BLOCKED';

export type UncertaintyLevel = 'VERIFIED' | 'PROBABLE' | 'UNCERTAIN' | 'UNKNOWN' | 'FALSE';

export type AgentKey =
  | 'explorer' | 'architect' | 'planner' | 'coder' | 'debugger'
  | 'tester' | 'reviewer' | 'security' | 'verifier';

export interface PolicyRequest {
  actorType: 'HUMAN' | 'AGENT' | 'SYSTEM' | 'TOOL' | 'MODEL';
  actorId: string;
  action: string;          // e.g. "filesystem.write", "network.egress", "evolution.promote"
  resource: string;        // e.g. "host.secrets", "workspace.overlay"
  context?: Record<string, unknown>;
}

export interface PolicyEvaluation {
  effect: PolicyEffect;
  matchedRule: string | null;
  reason: string;
  precedence: string;      // canonical precedence chain trace
}

export interface WorldState {
  goal: string;
  repository: { languages: string[]; files: number; dirty: boolean };
  symbols: number;
  activeErrors: string[];
  testResults: { passed: number; failed: number };
  dependencies: string[];
  timestamp: string;
}

export interface PlanStep {
  index: number;
  action: string;
  detail: string;
  owner: AgentKey;
  requiresApproval: boolean;
}

export interface ReasoningSignals {
  length: number;
  hasMultiStep: boolean;   // "then", "and then", "after that", numbered steps
  hasAmbiguity: boolean;   // "maybe", "somehow", "or something"
  hasCreationVerb: boolean; // build, create, implement, design
  hasQueryVerb: boolean;   // show, list, what, status, explain
  hasRiskTerms: boolean;   // deploy, production, delete, secret, policy
  keywordMatches: string[];
}

export interface RouterDecision {
  path: ReasoningPath;
  complexity: number;      // 0..1
  uncertainty: number;     // 0..1 (INV-081)
  signals: ReasoningSignals;
  escalationReason: string | null;
  rationale: string;
}

export interface StepResult {
  step: string;            // PERCEPTION | ROUTING | PLANNING | ACTING | VERIFYING | REFLECTION | COMMIT
  detail: string;
  ms: number;
  data?: Record<string, unknown>;
}

export interface CognitiveLoopResult {
  traceId: string;
  route: RouterDecision;
  worldState: WorldState;
  plan: PlanStep[];
  steps: StepResult[];
  verdict: 'PASS' | 'FAIL' | 'REJECTED' | 'PENDING';
  reflection: string | null;
  finalAnswer: string;
  evidenceUids: string[];
  durationMs: number;
}
