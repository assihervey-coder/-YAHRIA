// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Execution Fabric + Sandbox (Domains 08/10)
// Doc ID: YAHRIA-KRN-008 | Invariants: INV-040..044, INV-050..053, FS-001..003
// Path: TASK → EXECUTION FABRIC → POLICY → TOOL AUTH → SANDBOX → EXECUTION → OBSERVABILITY → EVIDENCE
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';

export type SandboxProfile = 'STANDARD' | 'RESTRICTED' | 'PARANOID';

export interface ResourceLimits {
  cpu: number;        // cores
  memoryMb: number;
  diskMb: number;
  pids: number;
  timeoutMs: number;
}

export const SANDBOX_PROFILES: Record<SandboxProfile, { limits: ResourceLimits; network: string; fs: string; description: string }> = {
  STANDARD: {
    limits: { cpu: 2, memoryMb: 1024, diskMb: 512, pids: 128, timeoutMs: 60_000 },
    network: 'EGRESS DENY (default) — no external calls',
    fs: 'overlay: host snapshot LOWER(ro) + upper RW — host workspace NEVER mounted RW (FS-001)',
    description: 'Standard isolation for normal coding tasks',
  },
  RESTRICTED: {
    limits: { cpu: 1, memoryMb: 512, diskMb: 256, pids: 64, timeoutMs: 30_000 },
    network: 'EGRESS DENY + DNS DENY',
    fs: 'overlay read-mostly: writes limited to /workspace/overlay only',
    description: 'Hardened profile for agent-generated code',
  },
  PARANOID: {
    limits: { cpu: 1, memoryMb: 256, diskMb: 128, pids: 32, timeoutMs: 15_000 },
    network: 'NO NETWORK NAMESPACE ACCESS',
    fs: 'tmpfs-only overlay, no host mount at all',
    description: 'Maximum isolation for untrusted or first-run code',
  },
};

export interface ExecutionTrace {
  executionId: string;
  traceId: string;
  transitions: { from: string; to: string; guard: string; at: string }[];
  sandbox: { profile: SandboxProfile; limits: ResourceLimits; network: string; fs: string };
  policyDecision: { effect: string; matchedRule: string | null; reason: string };
  exitCode: number | null;
  stdout: string;
  durationMs: number;
  finalState: string;
  timeoutSimulated: boolean;
}

export function newTraceIds(): { executionId: string; traceId: string } {
  return { executionId: `EX-${randomUUID().slice(0, 8)}`, traceId: `TR-${randomUUID().slice(0, 12)}` };
}

// Simulated deterministic execution against the sandbox contract.
// In the full blueprint, D.4 Sandbox Engine provisions real containers (Podman/Docker)
// with OverlayFS; here the contract and state machine are exercised faithfully.
export async function runExecution(opts: {
  command: string;
  profile: SandboxProfile;
  policyDecision: { effect: string; matchedRule: string | null; reason: string };
  simulateFailure?: boolean;
  simulateTimeout?: boolean;
}): Promise<ExecutionTrace> {
  const { executionId, traceId } = newTraceIds();
  const profileDef = SANDBOX_PROFILES[opts.profile];
  const transitions: ExecutionTrace['transitions'] = [];
  const t0 = Date.now();
  const push = (from: string, to: string, guard: string) =>
    transitions.push({ from, to, guard, at: new Date().toISOString() });

  push('QUEUED', 'POLICY_CHECK', 'execution context explicit (INV-040)');

  let finalState = 'SUCCEEDED';
  let exitCode: number | null = 0;
  let stdout = '';
  let timeoutSimulated = false;

  if (opts.policyDecision.effect === 'DENY') {
    push('POLICY_CHECK', 'FAILED', `policy DENY — ${opts.policyDecision.matchedRule ?? 'default deny'} (INV-120)`);
    finalState = 'FAILED';
    exitCode = 126;
    stdout = `Policy denial: ${opts.policyDecision.reason}\nNo execution path may silently bypass mandatory controls.`;
  } else {
    push('POLICY_CHECK', 'PROVISIONING', opts.policyDecision.matchedRule
      ? `policy ${opts.policyDecision.effect} via ${opts.policyDecision.matchedRule}`
      : 'policy ALLOW (explicit rule)');
    push('PROVISIONING', 'RUNNING', `sandbox provisioned: ${opts.profile} — ${profileDef.fs} | ${profileDef.network} (INV-042/050)`);

    // simulated work
    await new Promise((r) => setTimeout(r, 120));

    if (opts.simulateTimeout) {
      push('RUNNING', 'TIMED_OUT', `timeout ${profileDef.limits.timeoutMs}ms exceeded → controlled termination, partial evidence preserved (INV-043)`);
      finalState = 'TIMED_OUT';
      exitCode = 124;
      stdout = `Execution exceeded resource timeout (${profileDef.limits.timeoutMs}ms). Controlled SIGTERM. Partial artifacts captured.`;
      timeoutSimulated = true;
    } else if (opts.simulateFailure) {
      push('RUNNING', 'VERIFYING', 'exit captured — exit code alone is NOT success (INV-044)');
      push('VERIFYING', 'FAILED', 'verification failed: test assertion F013 → failure event emitted');
      finalState = 'FAILED';
      exitCode = 1;
      stdout = `Command failed during verification: ${opts.command}\nUNKNOWN ≠ SUCCESS — failure represented explicitly.`;
    } else {
      push('RUNNING', 'VERIFYING', 'exit captured — verification started');
      push('VERIFYING', 'SUCCEEDED', 'verification evidence sealed (INV-102)');
      finalState = 'SUCCEEDED';
      exitCode = 0;
      stdout = `Executed in sandbox [${opts.profile}]: ${opts.command}\nOverlay diff captured → patch validator → APPLY.\nOrphan reaper: no orphan overlays.\nEvidence sealed with SHA-256 content addressing.`;
    }
  }

  return {
    executionId, traceId, transitions,
    sandbox: {
      profile: opts.profile,
      limits: profileDef.limits,
      network: profileDef.network,
      fs: profileDef.fs,
    },
    policyDecision: opts.policyDecision,
    exitCode, stdout,
    durationMs: Date.now() - t0,
    finalState,
    timeoutSimulated,
  };
}

// ── Failure & Recovery (FAILURE_AND_RECOVERY_MANIFEST) ─────────────

export const FAILURE_TAXONOMY: { code: string; name: string; defaultSeverity: string; defaultStrategy: string }[] = [
  { code: 'F001', name: 'VALIDATION_FAILURE', defaultSeverity: 'WARNING', defaultStrategy: 'REPLAN' },
  { code: 'F002', name: 'AUTHORIZATION_FAILURE', defaultSeverity: 'HIGH', defaultStrategy: 'ESCALATE' },
  { code: 'F003', name: 'POLICY_FAILURE', defaultSeverity: 'HIGH', defaultStrategy: 'ESCALATE' },
  { code: 'F004', name: 'SECURITY_FAILURE', defaultSeverity: 'CRITICAL', defaultStrategy: 'QUARANTINE' },
  { code: 'F005', name: 'SANDBOX_FAILURE', defaultSeverity: 'CRITICAL', defaultStrategy: 'QUARANTINE' },
  { code: 'F006', name: 'FILESYSTEM_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'ROLLBACK' },
  { code: 'F007', name: 'NETWORK_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'RETRY_BACKOFF' },
  { code: 'F008', name: 'RESOURCE_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'RESTART' },
  { code: 'F009', name: 'TOOL_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'TOOL_SWITCH' },
  { code: 'F010', name: 'AGENT_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'REPLAN' },
  { code: 'F011', name: 'MODEL_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'MODEL_SWITCH' },
  { code: 'F012', name: 'EXECUTION_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'RETRY_BACKOFF' },
  { code: 'F013', name: 'TEST_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'REPLAN' },
  { code: 'F014', name: 'BUILD_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'REPLAN' },
  { code: 'F015', name: 'VERIFICATION_FAILURE', defaultSeverity: 'HIGH', defaultStrategy: 'REPLAN' },
  { code: 'F016', name: 'EVIDENCE_FAILURE', defaultSeverity: 'HIGH', defaultStrategy: 'REINITIALIZE' },
  { code: 'F017', name: 'DATA_INTEGRITY_FAILURE', defaultSeverity: 'CRITICAL', defaultStrategy: 'ROLLBACK' },
  { code: 'F018', name: 'STATE_MACHINE_FAILURE', defaultSeverity: 'HIGH', defaultStrategy: 'REINITIALIZE' },
  { code: 'F019', name: 'DEPENDENCY_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'REPLAN' },
  { code: 'F020', name: 'CONCURRENCY_FAILURE', defaultSeverity: 'ERROR', defaultStrategy: 'RETRY_BACKOFF' },
  { code: 'F021', name: 'STORAGE_FAILURE', defaultSeverity: 'CRITICAL', defaultStrategy: 'RESTART' },
  { code: 'F022', name: 'INFRASTRUCTURE_FAILURE', defaultSeverity: 'HIGH', defaultStrategy: 'RESTART' },
  { code: 'F023', name: 'EXTERNAL_SERVICE_FAILURE', defaultSeverity: 'WARNING', defaultStrategy: 'RETRY_BACKOFF' },
  { code: 'F024', name: 'HUMAN_INTERVENTION', defaultSeverity: 'INFO', defaultStrategy: 'ESCALATE' },
  { code: 'F025', name: 'UNKNOWN_FAILURE', defaultSeverity: 'HIGH', defaultStrategy: 'QUARANTINE' },
];

// Exponential backoff with retry cap (INV-092: retry is governed)
export function backoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
}
export const MAX_ATTEMPTS = 3;
