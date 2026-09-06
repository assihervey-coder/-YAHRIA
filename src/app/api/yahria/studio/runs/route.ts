import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { startStudioRun } from '@/lib/yahria/studio-pipeline';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from '@/lib/yahria/realtime';

export async function GET() {
  try {
    await ensureBootstrapped();
    const runs = await db.generationRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true, runUid: true, name: true, brief: true, stack: true, state: true,
        aiDesignedTree: true, stats: true, error: true, traceId: true,
        createdAt: true, updatedAt: true,
        _count: { select: { files: true } },
      },
    });
    return NextResponse.json({ ok: true, runs });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureBootstrapped();
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    const brief = String(body.brief ?? '').trim();
    const treeSpec = String(body.treeSpec ?? '').trim();
    const aiDesignedTree = Boolean(body.aiDesignedTree);

    if (!name) return NextResponse.json({ ok: false, error: 'nom de mission requis' }, { status: 400 });
    if (brief.length < 10) return NextResponse.json({ ok: false, error: 'brief trop court (min. 10 caractères)' }, { status: 400 });
    if (!aiDesignedTree && !treeSpec) {
      return NextResponse.json({ ok: false, error: 'arborescence requise (ou activer « l\'IA conçoit l\'arborescence »)' }, { status: 400 });
    }

    // runUid séquentiel RUN-000001 — retry sur collision unique
    let run = null;
    for (let attempt = 0; attempt < 3 && !run; attempt++) {
      const count = await db.generationRun.count();
      const runUid = `RUN-${String(count + 1 + attempt).padStart(6, '0')}`;
      try {
        run = await db.generationRun.create({
          data: {
            runUid, name: name.slice(0, 120), brief: brief.slice(0, 4000), treeSpec: treeSpec.slice(0, 8000),
            aiDesignedTree, state: 'SUBMITTED',
            traceId: `TRACE-STUDIO-${runUid}`,
          },
        });
      } catch { /* collision runUid → retry */ }
    }
    if (!run) return NextResponse.json({ ok: false, error: 'création du run impossible (collision runUid)' }, { status: 500 });

    emitYahriaEvent({
      type: REALTIME_EVENT_TYPES.TASK_CREATED, source: '03', severity: 'INFO',
      message: `Studio : mission « ${name} » soumise (${run.runUid})`,
      payload: { runUid: run.runUid, name, aiDesigned: aiDesignedTree, kind: 'STUDIO_RUN' },
    });

    // pipeline en arrière-plan (custom server Node — la promesse survit à la réponse)
    startStudioRun(run.id);
    return NextResponse.json({ ok: true, run });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
