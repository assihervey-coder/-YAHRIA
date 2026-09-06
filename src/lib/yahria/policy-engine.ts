// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Policy Control Plane (Domain 12)
// Doc ID: YAHRIA-KRN-004 | Invariants: INV-120, INV-121, INV-122, INV-123, INV-133
// Precedence: POLICY DENY > MODEL > AGENT > TOOL > LOCAL CONVENIENCE
// ═══════════════════════════════════════════════════════════════

import type { PolicyRequest, PolicyEvaluation, PolicyEffect } from './types';

export interface PolicyRuleDef {
  ruleId: string;
  name: string;
  effect: PolicyEffect;
  scope: string;           // TOOL | EXECUTION | FILESYSTEM | NETWORK | EVOLUTION | MODEL
  action: string;          // exact action or wildcard "fs.*"
  resource: string;        // exact resource or wildcard "*"
  priority: number;        // lower = evaluated first
  reason: string;
  version: string;
}

// Seed canonical policy set — DENY BY DEFAULT (INV-052, INV-133)
export const SEED_POLICY_RULES: PolicyRuleDef[] = [
  { ruleId: 'POL-001', name: 'Host secrets are never readable', effect: 'DENY', scope: 'FILESYSTEM', action: 'filesystem.read', resource: 'host.secrets', priority: 1, reason: 'INV-053: sandboxed execution MUST NOT access credentials or production secrets', version: '1.0.0' },
  { ruleId: 'POL-002', name: 'Host workspace never mounted RW', effect: 'DENY', scope: 'FILESYSTEM', action: 'filesystem.write', resource: 'host.workspace', priority: 1, reason: 'FS-001: host workspace never mounted RW into agent container', version: '1.0.0' },
  { ruleId: 'POL-003', name: 'No direct network egress from sandbox', effect: 'DENY', scope: 'NETWORK', action: 'network.egress', resource: '*', priority: 2, reason: 'INV-051: network isolation explicit; egress requires explicit policy', version: '1.0.0' },
  { ruleId: 'POL-004', name: 'Self-evolution cannot promote directly', effect: 'DENY', scope: 'EVOLUTION', action: 'evolution.promote', resource: 'production', priority: 1, reason: 'INV-160/161/162: D.8 governed by D.6.11 — experiment, benchmark, approve first', version: '1.0.0' },
  { ruleId: 'POL-005', name: 'Constitutional amendment is human-only', effect: 'DENY', scope: 'EVOLUTION', action: 'constitution.amend', resource: '*', priority: 1, reason: 'Global invariants evolve only through constitutional amendment', version: '1.0.0' },
  { ruleId: 'POL-006', name: 'Tool execution requires registration + authorization', effect: 'REQUIRE_APPROVAL', scope: 'TOOL', action: 'tool.execute', resource: 'unregistered.*', priority: 3, reason: 'INV-062: REGISTERED ≠ AUTHORIZED', version: '1.0.0' },
  { ruleId: 'POL-007', name: 'Sandboxed file writes allowed in overlay only', effect: 'ALLOW', scope: 'FILESYSTEM', action: 'filesystem.write', resource: 'workspace.overlay', priority: 10, reason: 'OverlayFS upper layer is the isolated RW surface', version: '1.0.0' },
  { ruleId: 'POL-008', name: 'Read-only inspection of workspace allowed', effect: 'ALLOW', scope: 'FILESYSTEM', action: 'filesystem.read', resource: 'workspace.snapshot', priority: 10, reason: 'Lower layer is read-only (FS-002)', version: '1.0.0' },
  { ruleId: 'POL-009', name: 'Bounded executions allowed in sandbox', effect: 'ALLOW', scope: 'EXECUTION', action: 'execution.run', resource: 'sandbox.*', priority: 10, reason: 'INV-042: resource bounded executions inside approved boundaries', version: '1.0.0' },
  { ruleId: 'POL-010', name: 'Model inference allowed with logging', effect: 'ALLOW', scope: 'MODEL', action: 'model.inference', resource: 'router.*', priority: 10, reason: 'INV-080: output is not fact; verdict requires verification', version: '1.0.0' },
];

// Final fallback — DENY BY DEFAULT
export const DEFAULT_EFFECT: PolicyEffect = 'DENY';
export const DEFAULT_REASON = 'INV-052/INV-133: no explicit policy matched → DEFAULT DENY. Security failure is not success.';

export function evaluatePolicy(request: PolicyRequest, rules: PolicyRuleDef[]): PolicyEvaluation {
  const sorted = [...rules].filter((r) => r.active !== false).sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    const actionMatch = rule.action.endsWith('*')
      ? request.action.startsWith(rule.action.slice(0, -1))
      : rule.action === request.action;
    const resourceMatch = rule.resource === '*' || rule.resource === request.resource ||
      (rule.resource.endsWith('.*') && request.resource.startsWith(rule.resource.slice(0, -1)));
    if (actionMatch && resourceMatch) {
      return {
        effect: rule.effect,
        matchedRule: rule.ruleId,
        reason: rule.reason,
        precedence: `POLICY ${rule.effect} > MODEL > AGENT > TOOL > LOCAL (rule ${rule.ruleId} v${rule.version}, priority ${rule.priority})`,
      };
    }
  }
  return {
    effect: DEFAULT_EFFECT,
    matchedRule: null,
    reason: DEFAULT_REASON,
    precedence: 'POLICY DENY (default) > MODEL > AGENT > TOOL > LOCAL',
  };
}
