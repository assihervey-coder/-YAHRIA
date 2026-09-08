import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/yahria/studio/runs/[id] — détail d'un run + fichiers (polling UI)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const run = await db.generationRun.findUnique({
      where: { id },
      include: { files: { orderBy: { order: 'asc' } }, liveChecks: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!run) return NextResponse.json({ ok: false, error: 'run introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true, run });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
