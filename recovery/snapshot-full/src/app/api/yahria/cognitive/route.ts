import { NextResponse } from 'next/server';
import { runCognitiveLoop } from '@/lib/yahria/cognitive-loop';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from '@/lib/yahria/realtime';

export async function POST(req: Request) {
  try {
    await ensureBootstrapped();
    const body = await req.json().catch(() => ({}));
    const goal = typeof body.goal === 'string' && body.goal.trim().length > 0
      ? body.goal.trim()
      : null;
    if (!goal) {
      return NextResponse.json({ ok: false, error: 'Field "goal" is required (the cognitive loop refuses to guess — INV-210).' }, { status: 400 });
    }
    if (goal.length > 2000) {
      return NextResponse.json({ ok: false, error: 'Goal exceeds 2000 chars.' }, { status: 400 });
    }
    emitYahriaEvent({
      type: REALTIME_EVENT_TYPES.COGNITIVE_STARTED, source: '06', severity: 'INFO',
      message: `Boucle cognitive démarrée — « ${goal.slice(0, 80) }${goal.length > 80 ? '…' : ''} »`,
      payload: { goal },
    });
    try {
      const result = await runCognitiveLoop(goal);
      emitYahriaEvent({
        type: REALTIME_EVENT_TYPES.COGNITIVE_COMPLETED, source: '06', severity: 'SUCCESS',
        message: `Boucle cognitive terminée — chemin ${result?.route?.path ?? 'UNKNOWN'}, verdict ${result?.verdict ?? 'UNKNOWN'} (${result?.durationMs ?? '?'} ms)`,
        payload: {
          traceId: result?.traceId,
          path: result?.route?.path,
          verdict: result?.verdict,
          steps: Array.isArray(result?.steps) ? result.steps.length : undefined,
          evidenceUids: result?.evidenceUids,
          durationMs: result?.durationMs,
        },
      });
      return NextResponse.json({ ok: true, result });
    } catch (loopError) {
      emitYahriaEvent({
        type: REALTIME_EVENT_TYPES.COGNITIVE_FAILED, source: '06', severity: 'CRITICAL',
        message: `Boucle cognitive en échec — UNKNOWN ≠ SUCCESS : ${String(loopError).slice(0, 120)}`,
        payload: { goal, error: String(loopError) },
      });
      throw loopError;
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureBootstrapped();
    const traces = await db.cognitiveTrace.findMany({ orderBy: { createdAt: 'desc' }, take: 25 });
    const routes = await db.reasoningRoute.findMany({ orderBy: { createdAt: 'desc' }, take: 25 });
    return NextResponse.json({ ok: true, traces, routes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
