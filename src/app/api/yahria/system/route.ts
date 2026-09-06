import { NextResponse } from 'next/server';
import { bootstrap } from '@/lib/yahria/bootstrap';
import { db } from '@/lib/db';
import { ALL_MACHINES } from '@/lib/yahria/state-machines';
import { DOMAINS, GOVERNANCE_PLANES } from '@/lib/yahria/domains';
import { BOOTSTRAP_SEQUENCE } from '@/lib/yahria/agent-os';

export async function GET() {
  try {
    const boot = await bootstrap();
    const [agents, tasks, executions, evidence, failures, traces, memories, policyDecisions] = await Promise.all([
      db.agent.findMany({ include: { runs: { orderBy: { startedAt: 'desc' }, take: 3 } } }),
      db.task.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      db.execution.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      db.evidence.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      db.failureEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      db.cognitiveTrace.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      db.memoryRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      db.policyDecision.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    const domains = await db.domain.findMany({ orderBy: { phase: 'asc' } });
    const policies = await db.policyRule.findMany({ orderBy: { priority: 'asc' } });

    return NextResponse.json({
      ok: true,
      boot,
      machines: ALL_MACHINES,
      domains: domains.length ? domains : DOMAINS,
      governance: GOVERNANCE_PLANES,
      bootstrapSequence: BOOTSTRAP_SEQUENCE,
      agents, tasks, executions, evidence, failures, traces, memories,
      policyDecisions, policies,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
