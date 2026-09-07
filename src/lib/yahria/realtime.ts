// ═══════════════════════════════════════════════════════════════
// YAHRIA — Realtime Event Bus (Domain 11 — Execution Observability)
// Shared singleton via globalThis: both the custom WebSocket server
// (server.mjs, same Node process) and Next.js route handlers read
// and write the SAME bus instance. Domain 11 provides structured
// events; this bus is their in-process fan-out fabric.
//
// CONTRACT (mirrored in server.mjs — keep shapes identical):
//   globalThis.__yahriaRealtime = { subs: Set<(e)=>void>, recent: YahriaEvent[], seq: number }
// ═══════════════════════════════════════════════════════════════

export type YahriaSeverity = 'INFO' | 'SUCCESS' | 'WARN' | 'CRITICAL';

export interface YahriaEvent {
  id: string;        // EVT-000001
  ts: string;        // ISO 8601
  type: string;      // ex: 'cognitive.loop.completed'
  source: string;    // domaine canonique: '00','06','07','11','12'…
  severity: YahriaSeverity;
  message: string;
  payload?: Record<string, unknown>;
}

type Subscriber = (e: YahriaEvent) => void;

interface RealtimeBus {
  subs: Set<Subscriber>;
  recent: YahriaEvent[]; // ring buffer — snapshot for late subscribers
  seq: number;
}

const RING_LIMIT = 200;

const g = globalThis as unknown as { __yahriaRealtime?: RealtimeBus };

function bus(): RealtimeBus {
  if (!g.__yahriaRealtime) {
    g.__yahriaRealtime = { subs: new Set(), recent: [], seq: 0 };
  }
  return g.__yahriaRealtime;
}

/** Emit a canonical observability event (Domain 11.1 — Structured Events). */
export function emitYahriaEvent(
  input: Omit<YahriaEvent, 'id' | 'ts'> & { ts?: string },
): YahriaEvent {
  const b = bus();
  b.seq += 1;
  const event: YahriaEvent = {
    id: `EVT-${String(b.seq).padStart(6, '0')}`,
    ts: input.ts ?? new Date().toISOString(),
    type: input.type,
    source: input.source,
    severity: input.severity,
    message: input.message,
    payload: input.payload,
  };
  b.recent.push(event);
  if (b.recent.length > RING_LIMIT) {
    b.recent.splice(0, b.recent.length - RING_LIMIT);
  }
  for (const s of b.subs) {
    try { s(event); } catch { /* listener isolation — never break emitters */ }
  }
  return event;
}

/** Subscribe a listener; returns unsubscribe handle. */
export function subscribeYahria(fn: Subscriber): () => void {
  const b = bus();
  b.subs.add(fn);
  return () => { b.subs.delete(fn); };
}

/** Recent events (snapshot for late subscribers). */
export function recentYahriaEvents(limit = 100): YahriaEvent[] {
  return bus().recent.slice(-limit);
}

/** Helper — event types registry (canonical vocabulary, Domain 00.9). */
export const REALTIME_EVENT_TYPES = {
  COGNITIVE_STARTED: 'cognitive.loop.started',
  COGNITIVE_COMPLETED: 'cognitive.loop.completed',
  COGNITIVE_FAILED: 'cognitive.loop.failed',
  TASK_CREATED: 'task.created',
  TASK_TRANSITION: 'task.transition',
  TASK_TRANSITION_REJECTED: 'task.transition.rejected',
  EVIDENCE_CAPTURED: 'evidence.captured',
  EVIDENCE_VERIFIED: 'evidence.verified',
  EVIDENCE_SEALED: 'evidence.sealed',
  EVIDENCE_CORRUPTED: 'evidence.corrupted',
  POLICY_DECISION: 'policy.decision',
  WS_CLIENT_CONNECTED: 'ws.client.connected',
  WS_CLIENT_DISCONNECTED: 'ws.client.disconnected',
  // Studio autonome (Domain 03/04 — code generation pipeline)
  STUDIO_RUN_CREATED: 'studio.run.created',
  STUDIO_TREE_PARSED: 'studio.tree.parsed',
  STUDIO_BLUEPRINT_PLANNED: 'studio.blueprint.planned',
  STUDIO_FILE_GENERATED: 'studio.file.generated',
  STUDIO_FILE_FAILED: 'studio.file.failed',
  STUDIO_FILE_EDITED: 'studio.file.edited',
  STUDIO_RUN_SEALED: 'studio.run.sealed',
  STUDIO_RUN_FAILED: 'studio.run.failed',
  // Tool Registry Engine (Domain 09 — INV-062 REGISTERED ≠ AUTHORIZED)
  TOOL_REGISTERED: 'tool.registered',
  TOOL_INVOKED: 'tool.invoked',
  TOOL_DENIED: 'tool.denied',
  TOOL_AUTHORIZED: 'tool.authorized',
  // Agent↔Tool bridge (Domain 05×09 — canonical agents invoke governed tools)
  AGENT_MISSION_STARTED: 'agent.mission.started',
  AGENT_MISSION_COMPLETED: 'agent.mission.completed',
  AGENT_MISSION_FAILED: 'agent.mission.failed',
  // Observability (Domain 11 — replay/forensics, R13)
  TRACE_REPLAYED: 'trace.replayed',
  // Policy Console (Domain 12 — governed RBAC management, R13)
  POLICY_RULE_CREATED: 'policy.rule.created',
  POLICY_RULE_TOGGLED: 'policy.rule.toggled',
  POLICY_SIMULATED: 'policy.simulated',
} as const;
