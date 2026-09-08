// ═══════════════════════════════════════════════════════════════
// YAHRIA API — Policy Console (Domain 12, R13 / KRN-029)
//
//   GET  /api/yahria/policy-console                 — règles + décisions récentes
//   POST /api/yahria/policy-console
//     { action: 'create',   name, effect, scope, action, resource, priority, actorType?, actorId?, reason }
//     { action: 'toggle',   ruleId, active, reason }
//     { action: 'simulate', actorType, actorId, action, resource }
//     { action: 'impact',   draft: { name, effect, scope, action, resource, priority, actorType?, actorId?, reason } }
//
// Constitutional behaviour:
//   - constitutional seed rules are LOCKED (INV-219) — toggle refused
//   - simulation/impact persist NOTHING (INV-220)
//   - every mutation carries a reason and is sealed as POLICY evidence
//   - validation failures → 422 with explicit errors
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import {
  policyConsoleState, createGovernedRule, toggleRule, simulatePolicy, impactAnalysis,
  type GovernedRuleInput,
} from '@/lib/yahria/policy-console';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const state = await policyConsoleState();
    return NextResponse.json(state);
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
        const res = await createGovernedRule({
          name: String(body.name ?? ''),
          effect: String(body.effect ?? ''),
          scope: String(body.scope ?? ''),
          action: String(body.ruleAction ?? ''),
          resource: String(body.resource ?? ''),
          priority: Number(body.priority ?? NaN),
          actorType: body.actorType ? String(body.actorType) : undefined,
          actorId: body.actorId ? String(body.actorId) : undefined,
          reason: String(body.reason ?? ''),
        });
        return NextResponse.json(res, { status: res.ok ? 200 : 422 });
      }
      case 'toggle': {
        const res = await toggleRule(String(body.ruleId ?? ''), body.active === true, String(body.reason ?? ''));
        return NextResponse.json(res, { status: res.ok ? 200 : 422 });
      }
      case 'simulate': {
        const actorType = String(body.actorType ?? '');
        if (!['HUMAN', 'AGENT', 'SYSTEM'].includes(actorType)) {
          return NextResponse.json({ ok: false, error: 'actorType : HUMAN | AGENT | SYSTEM' }, { status: 422 });
        }
        const sim = await simulatePolicy({
          actorType: actorType as 'HUMAN' | 'AGENT' | 'SYSTEM',
          actorId: String(body.actorId ?? ''),
          action: String(body.ruleAction ?? ''),
          resource: String(body.resource ?? ''),
        });
        return NextResponse.json(sim);
      }
      case 'impact': {
        const draft = (body.draft ?? {}) as Record<string, unknown>;
        const res = await impactAnalysis({
          name: String(draft.name ?? ''),
          effect: String(draft.effect ?? ''),
          scope: String(draft.scope ?? ''),
          action: String(draft.ruleAction ?? draft.action ?? ''),
          resource: String(draft.resource ?? ''),
          priority: Number(draft.priority ?? NaN),
          actorType: draft.actorType ? String(draft.actorType) : undefined,
          actorId: draft.actorId ? String(draft.actorId) : undefined,
          reason: String(draft.reason ?? ''),
        });
        return NextResponse.json(res, { status: res.ok ? 200 : 422 });
      }
      default:
        return NextResponse.json({ ok: false, error: `action inconnue : ${action} — vocabulaire : create | toggle | simulate | impact` }, { status: 422 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
