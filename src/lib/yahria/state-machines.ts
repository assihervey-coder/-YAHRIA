// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Universal State Transition Contract
// Doc ID: YAHRIA-KRN-001 | Source: STATE_TRANSITION_MANIFEST.md
// Every transition is guarded, explicit, and audited.
// ═══════════════════════════════════════════════════════════════

export interface TransitionRule {
  from: string;
  to: string;
  guard: string;           // human-readable guard description
  authority: 'SYSTEM' | 'AGENT' | 'POLICY' | 'HUMAN';
}

export interface StateMachine {
  name: string;
  domain: string;
  states: string[];
  initial: string;
  terminal: string[];
  transitions: TransitionRule[];
}

export const TASK_MACHINE: StateMachine = {
  name: 'TASK',
  domain: '07',
  initial: 'PENDING',
  terminal: ['COMPLETED', 'CANCELLED'],
  states: ['PENDING', 'READY', 'RUNNING', 'BLOCKED', 'FAILED', 'CANCELLED', 'COMPLETED'],
  transitions: [
    { from: 'PENDING', to: 'READY', guard: 'all mandatory dependencies PROMOTED or VERIFIED', authority: 'SYSTEM' },
    { from: 'PENDING', to: 'BLOCKED', guard: 'missing specification or unresolved dependency', authority: 'SYSTEM' },
    { from: 'READY', to: 'RUNNING', guard: 'agent assigned AND policy evaluation != DENY', authority: 'AGENT' },
    { from: 'RUNNING', to: 'COMPLETED', guard: 'tests pass AND evidence sealed', authority: 'SYSTEM' },
    { from: 'RUNNING', to: 'FAILED', guard: 'test failure or execution failure (F012/F013)', authority: 'SYSTEM' },
    { from: 'RUNNING', to: 'BLOCKED', guard: 'ambiguity detected → STOP protocol (never guess)', authority: 'AGENT' },
    { from: 'BLOCKED', to: 'READY', guard: 'blocking condition resolved with evidence', authority: 'HUMAN' },
    { from: 'FAILED', to: 'READY', guard: 'recovery strategy applied AND verified', authority: 'SYSTEM' },
    { from: 'PENDING', to: 'CANCELLED', guard: 'human override (INV-200)', authority: 'HUMAN' },
    { from: 'READY', to: 'CANCELLED', guard: 'human override (INV-200)', authority: 'HUMAN' },
    { from: 'BLOCKED', to: 'CANCELLED', guard: 'human override (INV-200)', authority: 'HUMAN' },
  ],
};

export const AGENT_MACHINE: StateMachine = {
  name: 'AGENT',
  domain: '05',
  initial: 'IDLE',
  terminal: ['COMPLETED', 'TERMINATED'],
  states: ['IDLE', 'STARTED', 'PERCEIVING', 'REASONING', 'ACTING', 'VERIFYING', 'COMPLETED', 'FAILED', 'BLOCKED', 'TERMINATED'],
  transitions: [
    { from: 'IDLE', to: 'STARTED', guard: 'run created with attributable identity (INV-070)', authority: 'SYSTEM' },
    { from: 'STARTED', to: 'PERCEIVING', guard: 'world state assembly', authority: 'SYSTEM' },
    { from: 'PERCEIVING', to: 'REASONING', guard: 'world state captured as evidence', authority: 'SYSTEM' },
    { from: 'REASONING', to: 'ACTING', guard: 'plan produced AND capability check passed (INV-071)', authority: 'AGENT' },
    { from: 'REASONING', to: 'BLOCKED', guard: 'policy DENY or capability boundary', authority: 'POLICY' },
    { from: 'ACTING', to: 'VERIFYING', guard: 'action produced artifact', authority: 'SYSTEM' },
    { from: 'VERIFYING', to: 'COMPLETED', guard: 'verifier verdict PASS (independent from generator)', authority: 'AGENT' },
    { from: 'VERIFYING', to: 'FAILED', guard: 'verifier verdict FAIL → reflection required', authority: 'AGENT' },
    { from: 'BLOCKED', to: 'IDLE', guard: 'reported to authority, awaiting decision', authority: 'HUMAN' },
  ],
};

export const EXECUTION_MACHINE: StateMachine = {
  name: 'EXECUTION',
  domain: '08',
  initial: 'QUEUED',
  terminal: ['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
  states: ['QUEUED', 'POLICY_CHECK', 'PROVISIONING', 'RUNNING', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
  transitions: [
    { from: 'QUEUED', to: 'POLICY_CHECK', guard: 'execution context explicit (INV-040)', authority: 'SYSTEM' },
    { from: 'POLICY_CHECK', to: 'PROVISIONING', guard: 'policy ALLOW or REQUIRE_APPROVAL approved', authority: 'POLICY' },
    { from: 'POLICY_CHECK', to: 'FAILED', guard: 'policy DENY (INV-120: policy overrides all)', authority: 'POLICY' },
    { from: 'PROVISIONING', to: 'RUNNING', guard: 'sandbox provisioned with resource bounds (INV-042)', authority: 'SYSTEM' },
    { from: 'RUNNING', to: 'VERIFYING', guard: 'exit captured; exit code alone is NOT success (INV-044)', authority: 'SYSTEM' },
    { from: 'RUNNING', to: 'TIMED_OUT', guard: 'timeout exceeded → controlled termination (INV-043)', authority: 'SYSTEM' },
    { from: 'VERIFYING', to: 'SUCCEEDED', guard: 'verification evidence sealed', authority: 'SYSTEM' },
    { from: 'VERIFYING', to: 'FAILED', guard: 'verification failed → failure event emitted', authority: 'SYSTEM' },
  ],
};

export const EVIDENCE_MACHINE: StateMachine = {
  name: 'EVIDENCE',
  domain: '11',
  initial: 'DECLARED',
  terminal: ['SEALED', 'DISPOSED'],
  states: ['DECLARED', 'CAPTURED', 'NORMALIZED', 'HASHED', 'LINKED', 'VERIFIED', 'SEALED', 'RETAINED', 'ARCHIVED', 'EXPIRED', 'DISPOSED', 'INVALID', 'CORRUPTED'],
  transitions: [
    { from: 'DECLARED', to: 'CAPTURED', guard: 'payload captured with actor + timestamp', authority: 'SYSTEM' },
    { from: 'CAPTURED', to: 'NORMALIZED', guard: 'schema-conformant normalization', authority: 'SYSTEM' },
    { from: 'NORMALIZED', to: 'HASHED', guard: 'SHA-256 content addressing applied', authority: 'SYSTEM' },
    { from: 'HASHED', to: 'LINKED', guard: 'lineage linked to execution/task (INV-111)', authority: 'SYSTEM' },
    { from: 'LINKED', to: 'VERIFIED', guard: 'integrity check recomputed and equal', authority: 'SYSTEM' },
    { from: 'VERIFIED', to: 'SEALED', guard: 'immutability commitment (INV-033)', authority: 'POLICY' },
  ],
};

export const FAILURE_MACHINE: StateMachine = {
  name: 'FAILURE',
  domain: '08/22',
  initial: 'DETECTED',
  terminal: ['RECOVERED', 'UNRECOVERABLE', 'ABORTED', 'QUARANTINED'],
  states: ['DETECTED', 'CLASSIFYING', 'CLASSIFIED', 'CONTAINING', 'CONTAINED', 'ANALYZING', 'RECOVERY_SELECTED', 'RECOVERING', 'VERIFYING', 'RECOVERED', 'UNRECOVERABLE', 'ESCALATED', 'ABORTED', 'QUARANTINED'],
  transitions: [
    { from: 'DETECTED', to: 'CLASSIFYING', guard: 'failure event structured (taxonomy F001-F025)', authority: 'SYSTEM' },
    { from: 'CLASSIFYING', to: 'CLASSIFIED', guard: 'type + severity + impact assigned', authority: 'SYSTEM' },
    { from: 'CLASSIFIED', to: 'CONTAINING', guard: 'containment-first principle', authority: 'SYSTEM' },
    { from: 'CONTAINING', to: 'CONTAINED', guard: 'blast radius bounded', authority: 'SYSTEM' },
    { from: 'CONTAINING', to: 'ESCALATED', guard: 'containment failed → human authority', authority: 'HUMAN' },
    { from: 'CONTAINED', to: 'ANALYZING', guard: 'root cause analysis started', authority: 'SYSTEM' },
    { from: 'ANALYZING', to: 'RECOVERY_SELECTED', guard: 'strategy selected (retry/rollback/compensation/replan/switch)', authority: 'SYSTEM' },
    { from: 'RECOVERY_SELECTED', to: 'RECOVERING', guard: 'idempotency verified before retry', authority: 'SYSTEM' },
    { from: 'RECOVERING', to: 'VERIFYING', guard: 'recovery action executed', authority: 'SYSTEM' },
    { from: 'VERIFYING', to: 'RECOVERED', guard: 'state consistent AND evidence preserved (INV-211)', authority: 'SYSTEM' },
    { from: 'VERIFYING', to: 'UNRECOVERABLE', guard: 'recovery failed after max attempts', authority: 'SYSTEM' },
  ],
};

export const ACCEPTANCE_MACHINE: StateMachine = {
  name: 'ACCEPTANCE',
  domain: '20',
  initial: 'DRAFT',
  terminal: ['ACCEPTED', 'REJECTED'],
  states: ['DRAFT', 'PENDING', 'RUNNING', 'PASSED', 'FAILED', 'WAIVED', 'ACCEPTED', 'REJECTED'],
  transitions: [
    { from: 'DRAFT', to: 'PENDING', guard: 'acceptance criteria explicit', authority: 'SYSTEM' },
    { from: 'PENDING', to: 'RUNNING', guard: 'test environment ready', authority: 'SYSTEM' },
    { from: 'RUNNING', to: 'PASSED', guard: 'all critical assertions verified with evidence', authority: 'SYSTEM' },
    { from: 'RUNNING', to: 'FAILED', guard: 'any critical assertion failed', authority: 'SYSTEM' },
    { from: 'PASSED', to: 'ACCEPTED', guard: 'evidence bundle complete (INV-102)', authority: 'POLICY' },
    { from: 'FAILED', to: 'REJECTED', guard: 'claim without evidence cannot be accepted', authority: 'POLICY' },
  ],
};

export const ALL_MACHINES: StateMachine[] = [
  TASK_MACHINE, AGENT_MACHINE, EXECUTION_MACHINE, EVIDENCE_MACHINE,
  FAILURE_MACHINE, ACCEPTANCE_MACHINE,
];

export function canTransition(machine: StateMachine, from: string, to: string): { ok: boolean; rule?: TransitionRule; reason?: string } {
  const rule = machine.transitions.find((t) => t.from === from && t.to === to);
  if (!rule) {
    return { ok: false, reason: `Transition ${from} → ${to} is not declared in ${machine.name} machine. Silent transitions are prohibited.` };
  }
  return { ok: true, rule };
}

export function assertTransition(machine: StateMachine, from: string, to: string): TransitionRule {
  const res = canTransition(machine, from, to);
  if (!res.ok || !res.rule) throw new Error(res.reason);
  return res.rule;
}
