// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Agent Operating System (Domain 05)
// Doc ID: YAHRIA-KRN-007 | Invariants: INV-070..073, INV-011, INV-012
// Agent flow: INTENT → CAPABILITY CHECK → POLICY CHECK → EXECUTION
// ═══════════════════════════════════════════════════════════════

import type { AgentKey } from './types';

export interface AgentDef {
  key: AgentKey;
  name: string;
  role: string;
  capabilities: string[];
  autonomy: 'GOVERNED' | 'SUPERVISED' | 'RESTRICTED';
  domain: string;
}

export const CANONICAL_AGENTS: AgentDef[] = [
  { key: 'explorer', name: 'Explorer', role: 'Perception engine — assembles WorldState from repository, symbols, errors, tests', capabilities: ['repo.read', 'genome.query', 'graph.traverse'], autonomy: 'GOVERNED', domain: '05/06' },
  { key: 'architect', name: 'Architect', role: 'Designs solutions respecting domain boundaries and invariants', capabilities: ['genome.query', 'adr.read', 'design.propose'], autonomy: 'GOVERNED', domain: '06' },
  { key: 'planner', name: 'Planner', role: 'Decomposes goals into task graphs with dependency resolution', capabilities: ['task.create', 'task.decompose', 'graph.read'], autonomy: 'GOVERNED', domain: '07' },
  { key: 'coder', name: 'Coder', role: 'Implements changes inside sandbox overlay only', capabilities: ['fs.overlay.write', 'tool.execute', 'genome.query'], autonomy: 'GOVERNED', domain: '08' },
  { key: 'debugger', name: 'Debugger', role: 'Root-cause analysis on failure events, proposes smallest safe correction', capabilities: ['evidence.query', 'execution.replay', 'fs.overlay.write'], autonomy: 'GOVERNED', domain: '08/22' },
  { key: 'tester', name: 'Tester', role: 'Runs verification suites, produces test evidence', capabilities: ['execution.run', 'evidence.capture'], autonomy: 'GOVERNED', domain: '20' },
  { key: 'reviewer', name: 'Reviewer', role: 'Independent code review against invariants and ADRs', capabilities: ['fs.read', 'genome.query', 'invariant.check'], autonomy: 'SUPERVISED', domain: '20' },
  { key: 'security', name: 'Security', role: 'Zero-trust review: secrets, boundaries, policy compliance', capabilities: ['policy.evaluate', 'fs.read', 'evidence.query'], autonomy: 'RESTRICTED', domain: '19/12' },
  { key: 'verifier', name: 'Verifier', role: 'Independent verdict — generator ≠ verifier separation', capabilities: ['evidence.capture', 'evidence.verify', 'acceptance.evaluate'], autonomy: 'RESTRICTED', domain: '11/20' },
];

export function getAgent(key: string): AgentDef | undefined {
  return CANONICAL_AGENTS.find((a) => a.key === key);
}

export function checkCapability(agent: AgentDef, requiredCapability: string): { ok: boolean; reason: string } {
  const exact = agent.capabilities.includes(requiredCapability);
  const wildcard = agent.capabilities.some((c) => c.endsWith('.*') && requiredCapability.startsWith(c.slice(0, -1)));
  if (exact || wildcard) return { ok: true, reason: `Capability '${requiredCapability}' authorized for ${agent.key} (INV-071)` };
  return { ok: false, reason: `Capability boundary violation: ${agent.key} lacks '${requiredCapability}' (INV-071). BLOCKED — not guessed.` };
}

// The universal implementation loop (ROOT CONTRACT §17) enforced per agent run
export const IMPLEMENTATION_LOOP = [
  'READ', 'UNDERSTAND', 'MAP OWNERSHIP', 'RESOLVE DEPENDENCIES', 'PLAN',
  'IMPLEMENT', 'TEST', 'VERIFY', 'REVIEW', 'CAPTURE EVIDENCE', 'UPDATE STATUS', 'COMPLETE OR STOP',
];

export const BOOTSTRAP_SEQUENCE = [
  { step: '00', doc: '00_AUTONOMOUS_CODING_CONTRACT.md' },
  { step: '01', doc: 'CANONICAL_INDEX.md' },
  { step: '02', doc: 'DEPENDENCY_GRAPH.md' },
  { step: '03', doc: 'GLOBAL_INVARIANTS.md' },
  { step: '04', doc: 'ARCHITECTURE_DECISIONS.md' },
  { step: '05', action: 'IDENTIFY current implementation phase' },
  { step: '06', action: 'RESOLVE required dependencies' },
  { step: '07', doc: 'RELEVANT DOMAIN SPECIFICATIONS' },
  { step: '08', action: 'GENERATE implementation plan' },
  { step: '09', action: 'IMPLEMENT' },
  { step: '10', action: 'TEST' },
  { step: '11', action: 'VERIFY' },
  { step: '12', action: 'CAPTURE EVIDENCE' },
  { step: '13', action: 'PROMOTE OR STOP' },
];
