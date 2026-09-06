import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { runExecution, SANDBOX_PROFILES } from '@/lib/yahria/execution-fabric';
import { evaluatePolicy, SEED_POLICY_RULES } from '@/lib/yahria/policy-engine';
import { captureAndPersist } from '@/lib/yahria/evidence-store';
import type { PolicyRequest } from '@/lib/yahria/types';

export async function GET() {
  try {
    await ensureBootstrapped();
    const executions = await db.execution.findMany({ orderBy: { createdAt: 'desc' }, take: 40 });
    return NextResponse.json({ ok: true, executions, profiles: SANDBOX_PROFILES });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureBootstrapped();
    const body = await req.json().catch(() => ({}));
    const command = String(body.command ?? 'yahria run --default');
    const profile = (['STANDARD', 'RESTRICTED', 'PARANOID'].includes(body.profile) ? body.profile : 'RESTRICTED') as 'STANDARD' | 'RESTRICTED' | 'PARANOID';
    const action = String(body.action ?? 'filesystem.write');
    const resource = String(body.resource ?? 'workspace.overlay');
    const simulateFailure = Boolean(body.simulateFailure);
    const simulateTimeout = Boolean(body.simulateTimeout);

    const policyRequest: PolicyRequest = { actorType: 'AGENT', actorId: 'coder', action, resource };
    const policy = evaluatePolicy(policyRequest, SEED_POLICY_RULES);

    const trace = await runExecution({ command, profile, policyDecision: policy, simulateFailure, simulateTimeout });

    const created = await db.execution.create({
      data: {
        taskId: typeof body.taskId === 'string' ? body.taskId : null,
        state: trace.finalState,
        sandboxProfile: profile,
        resourceLimits: JSON.stringify(trace.sandbox.limits),
        policyDecision: JSON.stringify(policy),
        exitCode: trace.exitCode,
        stdout: trace.stdout,
        durationMs: trace.durationMs,
        traceId: trace.traceId,
        attempts: 1,
      },
    });

    const ev = await captureAndPersist({
      category: 'EXECUTION', criticality: 'CRITICAL', actorType: 'SYSTEM', actorId: 'execution-fabric',
      claim: `Execution ${trace.executionId} → ${trace.finalState}`,
      payload: { transitions: trace.transitions, policy, profile },
      executionId: created.id,
    });

    if (trace.finalState === 'FAILED') {
      await db.failureEvent.create({
        data: {
          failureUid: `FAIL-${Date.now()}`,
          failureType: 'F013', severity: 'ERROR', state: 'CLASSIFIED',
          source: 'execution-fabric', message: `Execution ${trace.executionId} failed verification`,
          fingerprint: `fp:${trace.traceId}`, strategy: 'REPLAN',
          executionId: created.id,
        },
      });
    }

    await db.systemEvent.create({
      data: {
        level: trace.finalState === 'SUCCEEDED' ? 'INFO' : 'ERROR',
        source: '08', kind: 'STATE_TRANSITION',
        message: `Execution ${trace.executionId}: ${trace.transitions.map((t) => t.to).join(' → ')}`,
        correlationId: trace.traceId,
        payload: JSON.stringify({ transitions: trace.transitions }),
      },
    });

    return NextResponse.json({ ok: true, execution: created, trace, evidenceUid: ev.uid });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
