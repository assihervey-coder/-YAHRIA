// ═══════════════════════════════════════════════════════════════
// YAHRIA API — LIVE PROOF (R11) — POST /api/yahria/studio/runs/[id]/execute
// Runs the sandbox execution loop: install → syntax → build → launch
// → HTTP probe → self-heal (bounded) → SEALED → LIVE_PROVED.
// Guard: SEALED state required · POL-009 evaluated inside runLiveProof.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runLiveProof } from '@/lib/yahria/live-proof';

export const dynamic = 'force-dynamic';
export const maxDuration = 900; // bounded by YAHRIA_LIVE_BUDGET_MS inside

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const run = await db.generationRun.findUnique({ where: { id }, select: { id: true } });
    if (!run) return NextResponse.json({ ok: false, error: 'run introuvable' }, { status: 404 });

    const result = await runLiveProof(id);
    return NextResponse.json({ ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const checks = await db.liveCheck.findMany({
      where: { runId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, attempt: true, state: true, report: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, liveChecks: checks });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
