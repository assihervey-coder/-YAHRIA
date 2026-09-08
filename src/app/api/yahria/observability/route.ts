// ═══════════════════════════════════════════════════════════════
// YAHRIA API — Execution Observability (Domain 11, R13 / KRN-028)
//
//   GET  /api/yahria/observability                  — index des traces
//       ?traceId=TR-…                               — timeline + forensics + intégrité
//   POST /api/yahria/observability
//     { action: 'replay',  traceId }                — replay LECTURE SEULE (INV-218)
//     { action: 'drift',   toolId? }                — drift contrat registre ↔ historique
//
// Constitutional behaviour:
//   - replay never re-executes side effects, never mutates state (INV-218)
//   - evidence integrity recomputed from stored fields (INV-110 forensics)
//   - contract re-validation is S1 deterministic against CURRENT contracts
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { listTraces, assembleTimeline, replayTrace, contractDriftReport } from '@/lib/yahria/observability';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await ensureBootstrapped();
    const traceId = new URL(req.url).searchParams.get('traceId');
    if (!traceId) {
      const traces = await listTraces(25);
      return NextResponse.json({ ok: true, traces });
    }
    const timeline = await assembleTimeline(traceId);
    return NextResponse.json({ ok: true, timeline });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'corps JSON invalide' }, { status: 422 }); }
  const action = String(body.action ?? '');
  try {
    await ensureBootstrapped();
    switch (action) {
      case 'replay': {
        const traceId = String(body.traceId ?? '');
        if (!traceId) return NextResponse.json({ ok: false, error: 'traceId requis' }, { status: 422 });
        const replay = await replayTrace(traceId);
        return NextResponse.json({ ok: true, replay });
      }
      case 'drift': {
        const toolId = body.toolId ? String(body.toolId) : undefined;
        const report = await contractDriftReport(toolId);
        return NextResponse.json({ ok: true, report });
      }
      default:
        return NextResponse.json({ ok: false, error: `action inconnue : ${action} — vocabulaire : replay | drift` }, { status: 422 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
