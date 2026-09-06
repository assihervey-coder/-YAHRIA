import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { TASK_MACHINE, assertTransition } from '@/lib/yahria/state-machines';
import { captureEvidence } from '@/lib/yahria/evidence-engine';

export async function GET() {
  try {
    await ensureBootstrapped();
    const tasks = await db.task.findMany({ orderBy: { createdAt: 'desc' }, take: 60 });
    return NextResponse.json({ ok: true, tasks, machine: TASK_MACHINE });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureBootstrapped();
    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? '').trim();
    if (!title) return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 });
    const dependsOn: string[] = Array.isArray(body.dependsOn) ? body.dependsOn.map(String) : [];
    const task = await db.task.create({
      data: {
        title, kind: String(body.kind ?? 'IMPLEMENT'), priority: Number(body.priority ?? 5),
        payload: body.payload ? JSON.stringify(body.payload) : null,
        dependsOn: JSON.stringify(dependsOn),
        state: dependsOn.length === 0 ? 'READY' : 'PENDING',
      },
    });
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureBootstrapped();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? '');
    const to = String(body.to ?? '');
    const task = await db.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ ok: false, error: 'task not found' }, { status: 404 });

    // Guarded transition — silent transitions are prohibited
    let rule;
    try {
      rule = assertTransition(TASK_MACHINE, task.state, to);
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err), machine: TASK_MACHINE.name }, { status: 422 });
    }

    // Additional dependency integrity guard (INV-091)
    if (to === 'RUNNING' && task.dependsOn && task.dependsOn !== '[]') {
      const depIds: string[] = JSON.parse(task.dependsOn);
      if (depIds.length > 0) {
        const deps = await db.task.findMany({ where: { id: { in: depIds } } });
        const notDone = deps.filter((d) => d.state !== 'COMPLETED');
        if (notDone.length > 0) {
          return NextResponse.json({
            ok: false,
            error: `INV-091 violation: task cannot run before mandatory dependencies are satisfied. Blocking: ${notDone.map((d) => d.title).join(', ')}`,
          }, { status: 422 });
        }
      }
    }

    const updated = await db.task.update({
      where: { id },
      data: {
        state: to,
        result: to === 'COMPLETED' ? (task.result ?? 'Completed with sealed evidence') : task.result,
      },
    });

    const ev = captureEvidence({
      category: 'AUDIT', criticality: 'STANDARD', actorType: rule.authority === 'HUMAN' ? 'HUMAN' : 'SYSTEM',
      actorId: 'mission-control', claim: `Task ${task.title}: ${task.state} → ${to} (guard: ${rule.guard})`,
      payload: { taskId: id, from: task.state, to, authority: rule.authority },
      taskId: id,
    });

    return NextResponse.json({ ok: true, task: updated, transition: rule, evidenceUid: ev.evidenceUid });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
