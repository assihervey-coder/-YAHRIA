import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { evaluatePolicy, SEED_POLICY_RULES } from '@/lib/yahria/policy-engine';
import type { PolicyRequest } from '@/lib/yahria/types';

export async function GET() {
  try {
    await ensureBootstrapped();
    const policies = await db.policyRule.findMany({ orderBy: { priority: 'asc' } });
    const decisions = await db.policyDecision.findMany({ orderBy: { createdAt: 'desc' }, take: 40 });
    return NextResponse.json({ ok: true, policies: policies.length ? policies : [], seedRules: SEED_POLICY_RULES, decisions });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureBootstrapped();
    const body = await req.json().catch(() => ({}));
    const request: PolicyRequest = {
      actorType: (['HUMAN', 'AGENT', 'SYSTEM', 'TOOL', 'MODEL'].includes(body.actorType) ? body.actorType : 'AGENT') as PolicyRequest['actorType'],
      actorId: String(body.actorId ?? 'unknown-actor'),
      action: String(body.action ?? 'filesystem.write'),
      resource: String(body.resource ?? 'workspace.overlay'),
      context: body.context,
    };
    const evaluation = evaluatePolicy(request, SEED_POLICY_RULES);
    const decision = await db.policyDecision.create({
      data: {
        ruleId: evaluation.matchedRule,
        request: JSON.stringify(request),
        effect: evaluation.effect,
        reason: evaluation.reason,
        decidedBy: 'POLICY_ENGINE',
      },
    });
    return NextResponse.json({ ok: true, evaluation, decisionId: decision.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
