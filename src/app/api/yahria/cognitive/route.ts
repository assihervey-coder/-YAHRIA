import { NextResponse } from 'next/server';
import { runCognitiveLoop } from '@/lib/yahria/cognitive-loop';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';

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
    const result = await runCognitiveLoop(goal);
    return NextResponse.json({ ok: true, result });
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
