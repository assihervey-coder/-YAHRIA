// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — AGENT ↔ TOOL REGISTRY BRIDGE (Domain 05 × 09)
// Doc ID: YAHRIA-KRN-027 | R13
//
// Canonical agents (agent-os.ts) stop being descriptive: they now
// INVOKE REAL TOOLS through the governed registry (tool-registry.ts).
//
// Two independent gates, in strict order (INV-216):
//   GATE A — capability (INV-071): the tool must map to a capability
//            declared by the agent. A capability denial never reaches
//            the policy plane and never executes.
//   GATE B — policy (INV-062): invokeTool re-evaluates the LIVE policy
//            on every call (REGISTERED ≠ AUTHORIZED), persists the
//            decision, seals evidence.
//
// Every mission runs under a unique traceId propagated to every tool
// invocation, policy decision, evidence record and agent run
// (INV-217 — no orphan action).
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { CANONICAL_AGENTS, getAgent, checkCapability, type AgentDef } from './agent-os';
import { invokeTool, BUILT_IN_TOOLS, type InvokeOutcome } from './tool-registry';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

// ── AT-1. TOOL → CAPABILITY MAP (single source of truth for grants) ──

/**
 * Each executable tool maps to EXACTLY ONE canonical capability.
 * An agent is granted a tool iff this capability is in agent.capabilities
 * (INV-071) — grants are DERIVED, never hand-listed, so the matrix cannot
 * drift from the constitution.
 */
export const TOOL_CAPABILITY_MAP: Record<string, string> = {
  'system.domains.list': 'genome.query',        // constitution knowledge
  'constitution.invariants.list': 'invariant.check',
  'studio.runs.list': 'repo.read',              // delivery history
  'sandbox.toolchains.detect': 'genome.query',  // environment knowledge
  'evidence.recent.list': 'evidence.query',
  'policy.decisions.recent': 'policy.evaluate',
  'sandbox.cli.run': 'execution.run',           // SIDE_EFFECT — tester only
};

/** Derived grant matrix: agent key → toolIds its capabilities unlock. */
export function agentGrantsFor(agentKey: string): string[] {
  const agent = CANONICAL_AGENTS.find((a) => a.key === agentKey);
  if (!agent) return [];
  return Object.entries(TOOL_CAPABILITY_MAP)
    .filter(([, capability]) => agent.capabilities.includes(capability))
    .map(([toolId]) => toolId)
    .sort();
}

/** Full matrix for UI/API — includes unmapped tools (honest visibility). */
export function grantMatrix(): {
  agent: string; tool: string; capability: string | null; granted: boolean;
}[] {
  const rows: { agent: string; tool: string; capability: string | null; granted: boolean }[] = [];
  for (const a of CANONICAL_AGENTS) {
    for (const t of BUILT_IN_TOOLS) {
      const capability = TOOL_CAPABILITY_MAP[t.toolId] ?? null;
      rows.push({
        agent: a.key, tool: t.toolId, capability,
        granted: capability !== null && a.capabilities.includes(capability),
      });
    }
  }
  return rows;
}

// ── AT-2. SINGLE AGENT TOOL CALL (capability gate → policy gate) ────

export interface AgentToolStep {
  toolId: string;
  gate: 'CAPABILITY' | 'POLICY' | 'CONTRACT' | 'EXECUTION' | 'UNKNOWN_TOOL';
  capability: string | null;
  verdict: InvokeOutcome['verdict'] | 'CAPABILITY_DENIED';
  ok: boolean;
  authEffect: string | null;
  authRule: string | null;
  ms: number;
  detail: string;
  invocationId: string | null;
  evidenceUid: string | null;
  result: unknown | null;
}

/**
 * Invoke one tool AS a canonical agent. Capability gate FIRST (INV-216),
 * then the full governed registry pipeline (INV-062, contract, bounded exec).
 */
export async function invokeToolAsAgent(params: {
  agentKey: string; toolId: string; input?: Record<string, unknown>; traceId: string;
}): Promise<AgentToolStep> {
  const { agentKey, toolId, input = {}, traceId } = params;
  const agent: AgentDef | undefined = getAgent(agentKey);
  if (!agent) {
    return {
      toolId, gate: 'UNKNOWN_TOOL', capability: null, verdict: 'DENIED', ok: false,
      authEffect: null, authRule: null, ms: 0,
      detail: `Agent « ${agentKey} » inconnu — seuls les agents canoniques existent (INV-001). Aucune invention.`,
      invocationId: null, evidenceUid: null, result: null,
    };
  }
  const capability = TOOL_CAPABILITY_MAP[toolId] ?? null;

  // GATE A — capability (INV-071), BEFORE the policy plane (INV-216)
  if (capability === null) {
    return {
      toolId, gate: 'CAPABILITY', capability: null, verdict: 'CAPABILITY_DENIED', ok: false,
      authEffect: null, authRule: null, ms: 0,
      detail: `Aucune capacité canonique ne correspond à ${toolId} — aucun agent ne peut l'invoquer via la passerelle (surface réduite, pas de contournement).`,
      invocationId: null, evidenceUid: null, result: null,
    };
  }
  const cap = checkCapability(agent, capability);
  if (!cap.ok) {
    return {
      toolId, gate: 'CAPABILITY', capability, verdict: 'CAPABILITY_DENIED', ok: false,
      authEffect: null, authRule: null, ms: 0,
      detail: cap.reason, invocationId: null, evidenceUid: null, result: null,
    };
  }

  // GATE B — governed registry (INV-062: policy re-evaluated per call)
  const outcome = await invokeTool({
    toolId, input, callerType: 'AGENT', callerId: agent.key, traceId,
  });
  return {
    toolId,
    gate: outcome.authorized === false ? 'POLICY'
      : outcome.verdict === 'VALIDATION_FAILED' ? 'CONTRACT' : 'EXECUTION',
    capability,
    verdict: outcome.verdict,
    ok: outcome.ok && outcome.verdict === 'INVOKED',
    authEffect: outcome.auth.effect,
    authRule: outcome.auth.matchedRule,
    ms: outcome.ms,
    detail: outcome.ok
      ? `exécuté en ${outcome.ms} ms — auth ${outcome.auth.effect} (${outcome.auth.matchedRule ?? 'default-deny'})`
      : (outcome.error ?? outcome.validationErrors.join(' ; ') ?? outcome.auth.reason),
    invocationId: outcome.invocationId,
    evidenceUid: outcome.evidenceUid,
    result: outcome.result,
  };
}

// ── AT-3. MISSION RUNNER (governed multi-tool agent run) ────────────

export interface MissionRequest {
  agentKey: string;
  mission: string;
  toolCalls: { toolId: string; input?: Record<string, unknown> }[];
}

export interface MissionResult {
  ok: boolean;
  traceId: string;
  runId: string | null;
  agent: string;
  mission: string;
  verdict: 'COMPLETED' | 'PARTIAL' | 'BLOCKED' | 'FAILED' | 'REJECTED';
  steps: AgentToolStep[];
  summary: string;
  ms: number;
}

/**
 * Run a governed agent mission: one traceId, N real tool invocations,
 * one persisted AgentRun, evidence at every step. Honest verdicts:
 * BLOCKED (policy denials), FAILED (capability walls / no success),
 * PARTIAL (some tools succeeded), COMPLETED (all succeeded).
 */
export async function runAgentMission(req: MissionRequest): Promise<MissionResult> {
  const t0 = Date.now();
  const traceId = `TR-M-${randomUUID().slice(0, 12)}`;
  const agent = getAgent(req.agentKey);
  if (!agent) {
    return {
      ok: false, traceId, runId: null, agent: req.agentKey, mission: req.mission,
      verdict: 'REJECTED', steps: [],
      summary: `Agent « ${req.agentKey} » inconnu (INV-001) — mission refusée, rien n'a été exécuté.`,
      ms: Date.now() - t0,
    };
  }
  if (!req.mission || req.mission.trim().length < 3) {
    return {
      ok: false, traceId, runId: null, agent: agent.key, mission: req.mission,
      verdict: 'REJECTED', steps: [],
      summary: 'Mission vide — un objectif explicite est requis (aucune action sans intention).',
      ms: Date.now() - t0,
    };
  }

  // Ensure DB agent row (bootstrap seeds them; defensive here)
  let dbAgent = await db.agent.findUnique({ where: { key: agent.key } });
  if (!dbAgent) {
    dbAgent = await db.agent.create({
      data: {
        key: agent.key, name: agent.name, role: agent.role,
        capabilities: JSON.stringify(agent.capabilities), autonomy: agent.autonomy, status: 'IDLE',
      },
    });
  }

  const run = await db.agentRun.create({
    data: {
      agentId: dbAgent.id, state: 'STARTED',
      input: JSON.stringify({ mission: req.mission.slice(0, 500), toolCalls: req.toolCalls }),
      traceId,
    },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.AGENT_MISSION_STARTED, source: '05', severity: 'INFO',
    message: `Mission ${agent.key} démarrée — ${req.toolCalls.length} outil(s), trace ${traceId}`,
    payload: { traceId, runId: run.id, agent: agent.key },
  });
  await db.agent.update({ where: { id: dbAgent.id }, data: { status: 'RUNNING' } });

  const steps: AgentToolStep[] = [];
  for (const call of req.toolCalls) {
    const step = await invokeToolAsAgent({
      agentKey: agent.key, toolId: String(call.toolId ?? ''),
      input: call.input ?? {}, traceId,
    });
    steps.push(step);
  }

  const succeeded = steps.filter((s) => s.ok).length;
  const capabilityWalls = steps.filter((s) => s.verdict === 'CAPABILITY_DENIED').length;
  const policyBlocks = steps.filter((s) => s.verdict === 'DENIED' || s.verdict === 'REQUIRE_APPROVAL').length;
  let verdict: MissionResult['verdict'];
  if (steps.length === 0) verdict = 'FAILED';
  else if (succeeded === steps.length) verdict = 'COMPLETED';
  else if (capabilityWalls === steps.length) verdict = 'FAILED';
  else if (policyBlocks + capabilityWalls === steps.length) verdict = 'BLOCKED';
  else if (succeeded > 0) verdict = 'PARTIAL';
  else verdict = 'FAILED';

  const runState = verdict === 'COMPLETED' ? 'COMPLETED'
    : verdict === 'BLOCKED' ? 'BLOCKED' : 'FAILED';
  await db.agentRun.update({
    where: { id: run.id },
    data: {
      state: runState,
      output: JSON.stringify({ verdict, steps: steps.map((s) => ({ toolId: s.toolId, verdict: s.verdict, ok: s.ok, ms: s.ms })) }),
      finishedAt: new Date(),
    },
  });
  await db.agent.update({ where: { id: dbAgent.id }, data: { status: 'IDLE' } });

  const summary = verdict === 'COMPLETED'
    ? `Mission ${agent.key} COMPLÈTE : ${succeeded}/${steps.length} outil(s) réellement exécuté(s) sous trace ${traceId}.`
    : verdict === 'BLOCKED'
      ? `Mission ${agent.key} BLOQUÉE par la gouvernance : ${policyBlocks} refus de politique, ${capabilityWalls} mur de capacité — aucun contournement (INV-062/071).`
      : `Mission ${agent.key} en échec : ${succeeded}/${steps.length} réussi(s) — échec honnête conservé comme preuve (INV-210/211).`;

  await captureAndPersist({
    category: 'AGENT', criticality: verdict === 'COMPLETED' ? 'STANDARD' : 'HIGH',
    actorType: 'AGENT', actorId: agent.key,
    claim: `Mission agent ${agent.key} — verdict ${verdict} (${succeeded}/${steps.length} outils)`,
    payload: { traceId, runId: run.id, mission: req.mission.slice(0, 300), verdict, steps: steps.map((s) => ({ toolId: s.toolId, gate: s.gate, verdict: s.verdict, ok: s.ok })) },
    traceId,
  });

  emitYahriaEvent({
    type: verdict === 'COMPLETED' || verdict === 'PARTIAL'
      ? REALTIME_EVENT_TYPES.AGENT_MISSION_COMPLETED
      : REALTIME_EVENT_TYPES.AGENT_MISSION_FAILED,
    source: '05', severity: verdict === 'COMPLETED' ? 'SUCCESS' : 'WARN',
    message: `Mission ${agent.key} ${verdict} — ${succeeded}/${steps.length} outil(s) · trace ${traceId}`,
    payload: { traceId, runId: run.id, verdict, succeeded, total: steps.length },
  });

  return {
    ok: verdict === 'COMPLETED' || verdict === 'PARTIAL',
    traceId, runId: run.id, agent: agent.key, mission: req.mission,
    verdict, steps, summary, ms: Date.now() - t0,
  };
}

export const AGENT_TOOL_BRIDGE_ID = 'YAHRIA-KRN-027';
