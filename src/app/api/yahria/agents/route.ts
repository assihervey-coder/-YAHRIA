import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { CANONICAL_AGENTS, checkCapability } from '@/lib/yahria/agent-os';
import { captureEvidence } from '@/lib/yahria/evidence-engine';
import { evaluatePolicy, SEED_POLICY_RULES } from '@/lib/yahria/policy-engine';
import type { AgentKey } from '@/lib/yahria/types';

export async function GET() {
  try {
    await ensureBootstrapped();
    const agents = await db.agent.findMany({ include: { runs: { orderBy: { startedAt: 'desc' }, take: 5 } }, orderBy: { key: 'asc' } });
    return NextResponse.json({ ok: true, agents, canonical: CANONICAL_AGENTS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureBootstrapped();
    const body = await req.json().catch(() => ({}));
    const agentKey = String(body.agentKey ?? '') as AgentKey;
    const capability = String(body.capability ?? 'genome.query');
    const agent = CANONICAL_AGENTS.find((a) => a.key === agentKey);
    if (!agent) {
      return NextResponse.json({ ok: false, error: `Unknown agent '${agentKey}'. Canonical agents only — inventing agents is prohibited (INV-001).` }, { status: 400 });
    }

    // INTENT → CAPABILITY CHECK → POLICY CHECK (INV-071)
    const cap = checkCapability(agent, capability);
    const policy = evaluatePolicy(
      { actorType: 'AGENT', actorId: agent.key, action: 'tool.execute', resource: 'sandbox.tool-runtime' },
      SEED_POLICY_RULES,
    );

    let dbAgent = await db.agent.findUnique({ where: { key: agent.key } });
    if (!dbAgent) {
      dbAgent = await db.agent.create({
        data: {
          key: agent.key, name: agent.name, role: agent.role,
          capabilities: JSON.stringify(agent.capabilities), autonomy: agent.autonomy, status: 'IDLE',
        },
      });
    }

    const allowed = cap.ok && policy.effect !== 'DENY';
    const run = await db.agentRun.create({
      data: {
        agentId: dbAgent.id,
        state: allowed ? 'COMPLETED' : 'BLOCKED',
        input: JSON.stringify({ requestedCapability: capability, policy }),
        output: allowed
          ? JSON.stringify({ verdict: 'AUTHORIZED', capabilityCheck: cap, policyEffect: policy.effect, flow: 'INTENT → CAPABILITY CHECK ✓ → POLICY CHECK ✓ → EXECUTION' })
          : JSON.stringify({ verdict: 'BLOCKED', capabilityCheck: cap, policyEffect: policy.effect, reason: cap.ok ? policy.reason : cap.reason }),
        finishedAt: new Date(),
      },
    });
    await db.agent.update({ where: { id: dbAgent.id }, data: { status: allowed ? 'IDLE' : 'BLOCKED' } });

    const ev = captureEvidence({
      category: 'AGENT', criticality: 'STANDARD', actorType: 'AGENT', actorId: agent.key,
      claim: allowed ? `Agent run authorized for capability ${capability}` : `Agent run blocked (capability/policy boundary)`,
      payload: { runId: run.id, capability, policyEffect: policy.effect },
    });

    if (!allowed) {
      await db.policyDecision.create({
        data: {
          ruleId: policy.matchedRule, request: JSON.stringify({ actor: agent.key, action: 'tool.execute', capability }),
          effect: 'DENY', reason: cap.ok ? policy.reason : cap.reason, decidedBy: 'AGENT_OS_GATE',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      run: { id: run.id, state: run.state, agent: agent.key, capability },
      capabilityCheck: cap,
      policy,
      flow: allowed
        ? ['INTENT', 'CAPABILITY CHECK ✓', 'POLICY CHECK ✓', 'EXECUTION', 'EVIDENCE CAPTURED']
        : ['INTENT', cap.ok ? 'CAPABILITY CHECK ✓' : 'CAPABILITY CHECK ✗ (INV-071)', 'POLICY CHECK', 'BLOCKED'],
      evidenceUid: ev.evidenceUid,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
