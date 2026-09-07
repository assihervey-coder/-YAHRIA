// ═══════════════════════════════════════════════════════════════
// YAHRIA API — MISSION GRAPH (Domain 07, R14 / KRN-031)
//
//   GET  /api/yahria/missions            — liste des missions
//   GET  /api/yahria/missions?uid=MIS-…  — graphe complet + timeline
//   POST /api/yahria/missions
//     { action: 'create', goal, strategy: 'MANUAL'|'DECOMPOSED', tasks? }
//     { action: 'schedule', uid }
//     { action: 'tick', uid }            — une vague du DAG (INV-091)
//     { action: 'cancel', uid, reason }  — autorité humaine (INV-200)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { createMission, scheduleMission, tickMission, cancelMission } from '@/lib/yahria/mission-graph';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await ensureBootstrapped();
    const uid = new URL(req.url).searchParams.get('uid');
    if (!uid) {
      const missions = await db.mission.findMany({
        orderBy: { createdAt: 'desc' }, take: 30,
        include: { tasks: { orderBy: { seq: 'asc' } } },
      });
      return NextResponse.json({
        ok: true,
        missions: missions.map((m) => ({
          missionUid: m.missionUid, goal: m.goal, state: m.state, strategy: m.strategy,
          traceId: m.traceId, note: m.note, taskCount: m.tasks.length,
          tasksCompleted: m.tasks.filter((t) => t.state === 'COMPLETED').length,
          tasksFailed: m.tasks.filter((t) => t.state === 'FAILED').length,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    }
    const mission = await db.mission.findUnique({
      where: { missionUid: uid },
      include: { tasks: { orderBy: { seq: 'asc' } } },
    });
    if (!mission) return NextResponse.json({ ok: false, error: `mission introuvable : ${uid}` }, { status: 404 });
    return NextResponse.json({
      ok: true,
      mission: {
        missionUid: mission.missionUid, goal: mission.goal, state: mission.state,
        strategy: mission.strategy, traceId: mission.traceId, note: mission.note,
        tasks: mission.tasks.map((t) => ({
          id: t.id, seq: t.seq, title: t.title, agentKey: t.agentKey, toolId: t.toolId,
          state: t.state, dependsOn: JSON.parse(t.dependsOn || '[]'), retries: t.retries,
          maxRetries: t.maxRetries, error: t.error, result: t.result,
        })),
        createdAt: mission.createdAt.toISOString(),
        updatedAt: mission.updatedAt.toISOString(),
      },
    });
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
      case 'create': {
        const res = await createMission({
          goal: String(body.goal ?? ''),
          strategy: body.strategy ? String(body.strategy) : undefined,
          tasks: Array.isArray(body.tasks)
            ? (body.tasks as Record<string, unknown>[]).map((t) => ({
                title: String(t.title ?? ''), agentKey: String(t.agentKey ?? ''),
                toolId: String(t.toolId ?? ''),
                input: (t.input ?? {}) as Record<string, unknown>,
                dependsOn: Array.isArray(t.dependsOn) ? (t.dependsOn as number[]) : [],
              }))
            : undefined,
        });
        return NextResponse.json(res, { status: res.status });
      }
      case 'schedule': {
        const res = await scheduleMission(String(body.uid ?? ''));
        return NextResponse.json(res, { status: res.status });
      }
      case 'tick': {
        const res = await tickMission(String(body.uid ?? ''));
        return NextResponse.json(res, { status: res.status });
      }
      case 'cancel': {
        const res = await cancelMission(String(body.uid ?? ''), String(body.reason ?? ''));
        return NextResponse.json(res, { status: res.status });
      }
      default:
        return NextResponse.json({ ok: false, error: `action inconnue : ${action} — vocabulaire : create | schedule | tick | cancel` }, { status: 422 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
