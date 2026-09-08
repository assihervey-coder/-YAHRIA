// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — EXECUTION OBSERVABILITY (Domain 11)
// Doc ID: YAHRIA-KRN-028 | R13
//
// The event foundation already exists (realtime bus, SystemEvent,
// Evidence hash-chain, ToolInvocation, AgentRun, Execution,
// PolicyDecision). This module turns those scattered records into
// REPLAYABLE TRACES and FORENSICS:
//
//   listTraces        — union of traceIds across all governed tables
//   assembleTimeline  — one traceId → one ordered, sourced timeline
//   replayTrace       — READ-ONLY reconstruction (INV-218): timeline +
//                       evidence-integrity re-verification + contract
//                       re-validation of every recorded tool input
//                       against the CURRENT registry contract (drift
//                       detection). Never re-executes side effects.
//   verifyChainSlice  — hash-chain tamper scan over a trace's evidence
//   contractDriftReport — registry-wide contract drift over history
//
// Invariants: INV-110 (integrity), INV-112 (replay), INV-217
// (trace continuity), INV-218 (replay is read-only).
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { hashPayload } from './evidence-engine';
import { validateToolInput, type ToolContract } from './tool-registry';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

// ── OB-1. TRACE INDEX ───────────────────────────────────────────────

export interface TraceRow {
  traceId: string;
  sources: string[];                 // which governed tables carry it
  counts: { evidence: number; invocations: number; agentRuns: number; executions: number; policyDecisions: number };
  firstAt: string | null;
  lastAt: string | null;
}

const SCAN = 400; // recent rows scanned per table for trace discovery

export async function listTraces(limit = 20): Promise<TraceRow[]> {
  const [ev, inv, runs, execs, decisions] = await Promise.all([
    db.evidence.findMany({ where: { traceId: { not: null } }, orderBy: { createdAt: 'desc' }, take: SCAN, select: { traceId: true, createdAt: true } }),
    db.toolInvocation.findMany({ where: { traceId: { not: null } }, orderBy: { createdAt: 'desc' }, take: SCAN, select: { traceId: true, createdAt: true } }),
    db.agentRun.findMany({ where: { traceId: { not: null } }, orderBy: { startedAt: 'desc' }, take: SCAN, select: { traceId: true, startedAt: true } }),
    db.execution.findMany({ where: { traceId: { not: null } }, orderBy: { createdAt: 'desc' }, take: SCAN, select: { traceId: true, createdAt: true } }),
    db.policyDecision.findMany({ orderBy: { createdAt: 'desc' }, take: SCAN, select: { request: true, createdAt: true } }),
  ]);
  const map = new Map<string, TraceRow>();
  const touch = (traceId: string, source: string, ts: string) => {
    let row = map.get(traceId);
    if (!row) {
      row = { traceId, sources: [], counts: { evidence: 0, invocations: 0, agentRuns: 0, executions: 0, policyDecisions: 0 }, firstAt: ts, lastAt: ts };
      map.set(traceId, row);
    }
    if (!row.sources.includes(source)) row.sources.push(source);
    if (ts < row.firstAt!) row.firstAt = ts;
    if (ts > row.lastAt!) row.lastAt = ts;
    return row;
  };
  for (const r of ev) { if (r.traceId) touch(r.traceId, 'evidence', r.createdAt.toISOString()).counts.evidence++; }
  for (const r of inv) { if (r.traceId) touch(r.traceId, 'toolInvocations', r.createdAt.toISOString()).counts.invocations++; }
  for (const r of runs) { if (r.traceId) touch(r.traceId, 'agentRuns', r.startedAt.toISOString()).counts.agentRuns++; }
  for (const r of execs) { if (r.traceId) touch(r.traceId, 'executions', r.createdAt.toISOString()).counts.executions++; }
  for (const d of decisions) {
    try {
      const req = JSON.parse(d.request) as { trace?: string | null };
      if (req.trace) touch(req.trace, 'policyDecisions', d.createdAt.toISOString()).counts.policyDecisions++;
    } catch { /* malformed request JSON — skipped honestly */ }
  }
  return [...map.values()]
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
    .slice(0, limit);
}

// ── OB-2. TIMELINE ASSEMBLY ─────────────────────────────────────────

export interface TimelineEntry {
  ts: string;
  kind: 'EVIDENCE' | 'TOOL_INVOCATION' | 'AGENT_RUN' | 'EXECUTION' | 'POLICY_DECISION' | 'SYSTEM_EVENT';
  ref: string;              // uid / id
  actor: string;
  summary: string;
  severity: string;
  detail: Record<string, unknown>;
}

export interface ChainCheck {
  evidenceUid: string;
  ok: boolean;
  reason: string;
}

export interface TraceTimeline {
  ok: boolean;
  traceId: string;
  found: boolean;
  entries: TimelineEntry[];
  forensics: {
    total: number;
    byKind: Record<string, number>;
    denies: number;
    failures: number;
    window: { from: string | null; to: string | null };
  };
  chain: { checked: number; intact: number; tampered: ChainCheck[] };
}

export async function assembleTimeline(traceId: string): Promise<TraceTimeline> {
  const [evidence, invocations, runs, executions, systemEvents, decisions] = await Promise.all([
    db.evidence.findMany({ where: { traceId }, orderBy: { createdAt: 'asc' } }),
    db.toolInvocation.findMany({ where: { traceId }, orderBy: { createdAt: 'asc' } }),
    db.agentRun.findMany({ where: { traceId }, orderBy: { startedAt: 'asc' } }),
    db.execution.findMany({ where: { traceId }, orderBy: { createdAt: 'asc' } }),
    db.systemEvent.findMany({ where: { correlationId: traceId }, orderBy: { createdAt: 'asc' } }),
    db.policyDecision.findMany({ where: { request: { contains: traceId } }, orderBy: { createdAt: 'asc' } }),
  ]);

  const entries: TimelineEntry[] = [];
  for (const e of evidence) {
    entries.push({
      ts: e.createdAt.toISOString(), kind: 'EVIDENCE', ref: e.evidenceUid,
      actor: `${e.actorType}:${e.actorId}`, summary: e.claim, severity: e.criticality,
      detail: { category: e.category, state: e.state, contentHash: e.contentHash, prevHash: e.prevHash },
    });
  }
  for (const i of invocations) {
    entries.push({
      ts: i.createdAt.toISOString(), kind: 'TOOL_INVOCATION', ref: i.id,
      actor: `${i.callerType}:${i.callerId}`,
      summary: `${i.toolId}@${i.toolVersion} → ${i.ok ? 'OK' : 'ÉCHEC'} (${i.ms} ms) — auth ${i.authEffect} via ${i.authRule ?? 'default-deny'}`,
      severity: i.ok ? 'INFO' : 'WARN',
      detail: { toolId: i.toolId, toolVersion: i.toolVersion, input: safeJson(i.input), result: i.result ? safeJson(i.result) : null, error: i.error },
    });
  }
  for (const r of runs) {
    entries.push({
      ts: r.startedAt.toISOString(), kind: 'AGENT_RUN', ref: r.id,
      actor: `AGENT_RUN:${r.agentId}`, summary: `AgentRun ${r.state}`, severity: r.state === 'COMPLETED' ? 'INFO' : 'WARN',
      detail: { state: r.state, input: r.input ? safeJson(r.input) : null, output: r.output ? safeJson(r.output) : null, finishedAt: r.finishedAt?.toISOString() ?? null },
    });
  }
  for (const x of executions) {
    entries.push({
      ts: x.createdAt.toISOString(), kind: 'EXECUTION', ref: x.id,
      actor: `EXECUTION:${x.sandboxProfile}`, summary: `Execution ${x.state} (exit ${x.exitCode ?? '—'}, ${x.durationMs} ms)`,
      severity: x.state === 'SUCCEEDED' ? 'INFO' : 'WARN',
      detail: { state: x.state, exitCode: x.exitCode, sandboxProfile: x.sandboxProfile, attempts: x.attempts },
    });
  }
  for (const s of systemEvents) {
    entries.push({
      ts: s.createdAt.toISOString(), kind: 'SYSTEM_EVENT', ref: s.id,
      actor: `SYSTEM:${s.source}`, summary: s.message, severity: s.level,
      detail: { kind: s.kind, payload: s.payload ? safeJson(s.payload) : null },
    });
  }
  for (const d of decisions) {
    let req: Record<string, unknown> = {};
    try { req = JSON.parse(d.request) as Record<string, unknown>; } catch { /* keep empty */ }
    entries.push({
      ts: d.createdAt.toISOString(), kind: 'POLICY_DECISION', ref: d.id,
      actor: `${String(req.actorType ?? '?')}:${String(req.actorId ?? '?')}`,
      summary: `${d.effect} via ${d.ruleId ?? 'default-deny'} — ${d.reason}`,
      severity: d.effect === 'ALLOW' ? 'INFO' : 'WARN',
      detail: { ruleId: d.ruleId, effect: d.effect, decidedBy: d.decidedBy, resource: req.resource ?? null },
    });
  }
  entries.sort((a, b) => a.ts.localeCompare(b.ts));

  // Forensics summary
  const byKind: Record<string, number> = {};
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  const denies = decisions.filter((d) => d.effect === 'DENY').length
    + invocations.filter((i) => i.authEffect === 'DENY').length;
  const failures = invocations.filter((i) => !i.ok).length
    + executions.filter((x) => ['FAILED', 'TIMED_OUT'].includes(x.state)).length
    + runs.filter((r) => ['FAILED', 'BLOCKED'].includes(r.state)).length;

  // Evidence integrity — recompute content hashes (forensics, INV-110)
  const chain: ChainCheck[] = evidence.map((e) => {
    const recomputed = hashPayload({
      category: e.category, claim: e.claim,
      actor: `${e.actorType}:${e.actorId}`,
      payload: e.payload, prevHash: e.prevHash,
    });
    return recomputed === e.contentHash
      ? { evidenceUid: e.evidenceUid, ok: true, reason: 'empreinte intègre (INV-110)' }
      : { evidenceUid: e.evidenceUid, ok: false, reason: 'EMPREINTE MODIFIÉE — preuve potentiellement altérée (INV-110)' };
  });

  const found = entries.length > 0;
  return {
    ok: true, traceId, found, entries,
    forensics: {
      total: entries.length, byKind, denies, failures,
      window: { from: entries[0]?.ts ?? null, to: entries[entries.length - 1]?.ts ?? null },
    },
    chain: { checked: chain.length, intact: chain.filter((c) => c.ok).length, tampered: chain.filter((c) => !c.ok) },
  };
}

// ── OB-3. REPLAY (READ-ONLY — INV-218) ──────────────────────────────

export interface ReplayToolCheck {
  invocationId: string;
  toolId: string;
  recordedVerdict: string;
  contractStillValid: boolean;
  contractErrors: string[];
}

export interface ReplayResult {
  ok: boolean;
  traceId: string;
  replayedAt: string;
  entries: number;
  chainIntact: boolean;
  toolChecks: ReplayToolCheck[];
  driftCount: number;
  note: string;
}

/**
 * Reconstruct the trace WITHOUT executing anything: recorded facts only,
 * plus two deterministic re-verifications — evidence hash recomputation
 * and S1 contract re-validation of recorded tool inputs against the
 * CURRENT registry contracts (drift detection).
 */
export async function replayTrace(traceId: string): Promise<ReplayResult> {
  const timeline = await assembleTimeline(traceId);
  const toolChecks: ReplayToolCheck[] = [];
  const invocations = await db.toolInvocation.findMany({ where: { traceId }, orderBy: { createdAt: 'asc' } });
  for (const inv of invocations) {
    const row = await db.registeredTool.findUnique({ where: { toolId: inv.toolId } });
    if (!row) {
      toolChecks.push({ invocationId: inv.id, toolId: inv.toolId, recordedVerdict: inv.ok ? 'INVOKED' : 'FAILED', contractStillValid: false, contractErrors: ['outil absent du registre actuel — drift structurel'] });
      continue;
    }
    let contract: ToolContract;
    try { contract = JSON.parse(row.contract) as ToolContract; } catch {
      toolChecks.push({ invocationId: inv.id, toolId: inv.toolId, recordedVerdict: inv.ok ? 'INVOKED' : 'FAILED', contractStillValid: false, contractErrors: ['contrat illisible'] });
      continue;
    }
    let input: unknown = {};
    try { input = JSON.parse(inv.input); } catch { input = {}; }
    const v = validateToolInput(contract, input);
    toolChecks.push({
      invocationId: inv.id, toolId: inv.toolId,
      recordedVerdict: inv.authEffect === 'DENY' ? 'DENIED' : inv.ok ? 'INVOKED' : 'FAILED',
      contractStillValid: v.ok, contractErrors: v.errors,
    });
  }
  const driftCount = toolChecks.filter((c) => !c.contractStillValid).length;
  const result: ReplayResult = {
    ok: true, traceId, replayedAt: new Date().toISOString(),
    entries: timeline.entries.length,
    chainIntact: timeline.chain.tampered.length === 0,
    toolChecks, driftCount,
    note: 'Replay LECTURE SEULE (INV-218) — reconstruction des faits enregistrés, aucune ré-exécution d’effet de bord, aucune mutation.',
  };
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.TRACE_REPLAYED, source: '11', severity: 'INFO',
    message: `Trace ${traceId} rejouée en lecture seule — ${timeline.entries.length} entrées, ${driftCount} drift contrat`,
    payload: { traceId, entries: timeline.entries.length, driftCount },
  });
  return result;
}

// ── OB-4. REGISTRY-WIDE CONTRACT DRIFT REPORT ───────────────────────

export interface DriftRow {
  toolId: string;
  invocations: number;
  drifted: number;
  sampleErrors: string[];
}

export async function contractDriftReport(toolId?: string): Promise<{ ok: boolean; rows: DriftRow[]; scanned: number; drifted: number }> {
  const tools = await db.registeredTool.findMany(toolId ? { where: { toolId } } : undefined);
  const rows: DriftRow[] = [];
  let scanned = 0, drifted = 0;
  for (const t of tools) {
    let contract: ToolContract;
    try { contract = JSON.parse(t.contract) as ToolContract; } catch { continue; }
    const invs = await db.toolInvocation.findMany({
      // Drift = an invocation that EXECUTED OK back then but would now be
      // refused by the current contract. Records refused at the gate
      // (ok=false, VALIDATION_FAILED) are proof the gate worked — not drift.
      where: { toolId: t.toolId, authEffect: 'ALLOW', ok: true },
      orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, input: true },
    });
    let toolDrift = 0;
    const sampleErrors: string[] = [];
    for (const inv of invs) {
      scanned++;
      let input: unknown = {};
      try { input = JSON.parse(inv.input); } catch { input = {}; }
      const v = validateToolInput(contract, input);
      if (!v.ok) {
        toolDrift++; drifted++;
        if (sampleErrors.length < 2) sampleErrors.push(v.errors[0] ?? 'contrat violé');
      }
    }
    rows.push({ toolId: t.toolId, invocations: invs.length, drifted: toolDrift, sampleErrors });
  }
  rows.sort((a, b) => b.drifted - a.drifted || b.invocations - a.invocations);
  return { ok: true, rows, scanned, drifted };
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

export const OBSERVABILITY_ID = 'YAHRIA-KRN-028';
