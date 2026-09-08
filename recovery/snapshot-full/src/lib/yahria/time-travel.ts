// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Deterministic Time-Travel Replay (Domain 11.9)
// Doc ID: YAHRIA-KRN-019 | R8 Supremacy Pack
//
// "Time-travel debugging for AI agents": every cognitive run can be
// RECORDED as a hash-chained timeline (input/output per step), then
// REPLAYED bit-for-bit. The replayer recomputes each step's output
// from the recorded input and compares canonical hashes:
//   • match            → the run is reproducible (INV-191 evidence)
//   • firstDivergence  → the exact step where behavior drifted
//   • driftedFields    → which top-level output fields changed
//
// This is the substrate for regression protection (INV-172),
// replay where possible (INV-112), and forensic audits (D.11.11).
//
// Constitutional anchors:
//   INV-112 — replay where possible
//   INV-172 — validated capability must not silently regress
//   INV-191 — deterministic control
// ═══════════════════════════════════════════════════════════════

import { sha256Canonical } from './canonical';
import { emitYahriaEvent } from './realtime';

export interface TimelineStepInput { name: string; input: Record<string, unknown>; output: Record<string, unknown> }
export interface TimelineStep {
  index: number;
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  outputHash: string;
  prevHash: string | null;
  stepHash: string;
}
export interface Timeline {
  runUid: string;
  steps: TimelineStep[];
  timelineHash: string;   // chain anchor — sha256 over the chained step hashes
  recordedAt: string;
}

export interface DriftedField { field: string; expected: unknown; actual: unknown }
export interface ReplayReport {
  runUid: string;
  replayed: number;
  match: boolean;
  firstDivergence: number | null;   // 1-based step index, null if identical
  driftedSteps: { index: number; name: string; fields: DriftedField[] }[];
  recomputedTimelineHash: string;
  recordedTimelineHash: string;
  driftScore: number;               // divergedSteps / total
  verdict: 'REPRODUCIBLE' | 'DRIFTED' | 'CHAIN_BROKEN';
}

// ── TT-1. RECORDING (hash-chained timeline) ────────────────────────

export function recordTimeline(runUid: string, steps: TimelineStepInput[], opts?: { now?: string }): Timeline {
  let prev: string | null = null;
  const built: TimelineStep[] = steps.map((s, i) => {
    const outputHash = sha256Canonical(s.output);
    const stepHash = sha256Canonical({ index: i + 1, name: s.name, input: s.input, outputHash, prevHash: prev });
    const step: TimelineStep = {
      index: i + 1, name: s.name, input: s.input, output: s.output,
      outputHash, prevHash: prev, stepHash,
    };
    prev = stepHash;
    return step;
  });
  const timeline: Timeline = {
    runUid,
    steps: built,
    timelineHash: sha256Canonical(built.map((s) => s.stepHash)),
    recordedAt: opts?.now ?? new Date().toISOString(),
  };
  emitYahriaEvent({
    type: 'supremacy.timeline.recorded',
    source: '11',
    severity: 'INFO',
    message: `Chronologie ${runUid} enregistrée — ${built.length} pas, ancre ${timeline.timelineHash.slice(0, 16)}…`,
    payload: { runUid, timelineHash: timeline.timelineHash },
  });
  return timeline;
}

// ── TT-2. REPLAY + DRIFT LOCALIZATION ──────────────────────────────

/**
 * Replay a recorded timeline through a REPLAYER — a deterministic
 * function (name, input) → output. The replayer must NOT read the
 * recorded output; it recomputes it. Chain integrity is verified
 * first (any record tampering is reported as CHAIN_BROKEN).
 */
export function replayTimeline(
  timeline: Timeline,
  replayer: (name: string, input: Record<string, unknown>) => Record<string, unknown>,
): ReplayReport {
  // Chain integrity — detect tampered records before replaying.
  // Two locks per step: (a) the chained stepHash, and (b) the stored
  // output MUST still hash to its recorded outputHash — otherwise an
  // attacker could rewrite `output` without touching the chain.
  let prev: string | null = null;
  for (const s of timeline.steps) {
    const outputLock = sha256Canonical(s.output);
    if (outputLock !== s.outputHash) {
      emitYahriaEvent({
        type: 'supremacy.replay.blocked',
        source: '11', severity: 'CRITICAL',
        message: `Rejeu ${timeline.runUid} bloqué — contenu du pas ${s.index} réécrit (hash ≠ ancre scellée)`,
        payload: { runUid: timeline.runUid, step: s.index },
      });
      return {
        runUid: timeline.runUid, replayed: 0, match: false,
        firstDivergence: s.index,
        driftedSteps: [{ index: s.index, name: s.name, fields: [{ field: 'outputHash', expected: s.outputHash.slice(0, 16) + '…', actual: outputLock.slice(0, 16) + '…' }] }],
        recomputedTimelineHash: '', recordedTimelineHash: timeline.timelineHash,
        driftScore: 1, verdict: 'CHAIN_BROKEN',
      };
    }
    const expected = sha256Canonical({ index: s.index, name: s.name, input: s.input, outputHash: s.outputHash, prevHash: prev });
    if (expected !== s.stepHash) {
      emitYahriaEvent({
        type: 'supremacy.replay.blocked',
        source: '11', severity: 'CRITICAL',
        message: `Rejeu ${timeline.runUid} bloqué — chaîne rompue au pas ${s.index} (INV-112)`,
        payload: { runUid: timeline.runUid, step: s.index },
      });
      return {
        runUid: timeline.runUid, replayed: 0, match: false,
        firstDivergence: s.index,
        driftedSteps: [{ index: s.index, name: s.name, fields: [{ field: 'stepHash', expected, actual: s.stepHash }] }],
        recomputedTimelineHash: '', recordedTimelineHash: timeline.timelineHash,
        driftScore: 1, verdict: 'CHAIN_BROKEN',
      };
    }
    prev = s.stepHash;
  }

  const driftedSteps: ReplayReport['driftedSteps'] = [];
  const recomputedHashes: string[] = [];
  for (const s of timeline.steps) {
    const actual = replayer(s.name, s.input);
    const actualHash = sha256Canonical(actual);
    recomputedHashes.push(s.stepHash); // step hash stays (record layer), drift tracked separately
    if (actualHash !== s.outputHash) {
      driftedSteps.push({
        index: s.index, name: s.name,
        fields: diffFields(s.output, actual),
      });
    }
  }
  const first = driftedSteps[0] ?? null;
  const driftScore = timeline.steps.length === 0 ? 0 : Number((driftedSteps.length / timeline.steps.length).toFixed(4));
  const verdict: ReplayReport['verdict'] = driftedSteps.length === 0 ? 'REPRODUCIBLE' : 'DRIFTED';
  emitYahriaEvent({
    type: 'supremacy.replay.completed',
    source: '11',
    severity: verdict === 'REPRODUCIBLE' ? 'SUCCESS' : 'CRITICAL',
    message: verdict === 'REPRODUCIBLE'
      ? `Rejeu ${timeline.runUid}: REPRODUCTIBLE bit-à-bit (${timeline.steps.length} pas)`
      : `DÉRIVE DÉTECTÉE ${timeline.runUid}: première divergence au pas ${first?.index} (${first?.name})`,
    payload: { runUid: timeline.runUid, verdict, driftScore, firstDivergence: first?.index ?? null },
  });
  return {
    runUid: timeline.runUid,
    replayed: timeline.steps.length,
    match: driftedSteps.length === 0,
    firstDivergence: first?.index ?? null,
    driftedSteps,
    recomputedTimelineHash: sha256Canonical(recomputedHashes),
    recordedTimelineHash: timeline.timelineHash,
    driftScore,
    verdict,
  };
}

/** Top-level field-level diff between recorded and replayed outputs. */
function diffFields(expected: Record<string, unknown>, actual: Record<string, unknown>): DriftedField[] {
  const keys = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)])).sort();
  const fields: DriftedField[] = [];
  for (const k of keys) {
    if (sha256Canonical(expected[k]) !== sha256Canonical(actual[k])) {
      fields.push({
        field: k,
        expected: deepPreview(expected[k]),
        actual: deepPreview(actual[k]),
      });
    }
  }
  return fields.length > 0 ? fields : [{ field: '(whole output)', expected: deepPreview(expected), actual: deepPreview(actual) }];
}

function deepPreview(v: unknown): unknown {
  const s = JSON.stringify(v);
  if (s === undefined) return String(v);
  return s.length <= 120 ? v : s.slice(0, 117) + '…';
}

// ── TT-3. BISECT HELPERS (forensics) ───────────────────────────────

/**
 * Re-run ONLY steps 1..n against the replayer — used to bisect the
 * exact commit boundary where a capability regressed (INV-172).
 */
export function bisectReplay(
  timeline: Timeline,
  replayer: (name: string, input: Record<string, unknown>) => Record<string, unknown>,
): { goodUntil: number; badFrom: number | null } {
  let goodUntil = 0;
  for (const s of timeline.steps) {
    const actual = replayer(s.name, s.input);
    if (sha256Canonical(actual) === s.outputHash) goodUntil = s.index;
    else return { goodUntil, badFrom: s.index };
  }
  return { goodUntil, badFrom: null };
}
