// ═══════════════════════════════════════════════════════════════
// YAHRIA API — Tool Registry Engine (Domain 09, R12)
//
//   GET  /api/yahria/tools          — registre complet + matrice d'autorisation
//                                     (chaque outil re-évalué contre la policy)
//   POST /api/yahria/tools
//     { action: 'register'  , toolId, name, version, description, riskClass, contract, ownerDomain? }
//     { action: 'discover'  , query?, riskClass? }
//     { action: 'invoke'    , toolId, input?, callerType?, callerId?, traceId? }
//     { action: 'authorize' , toolId, allow, reason }
//
// Constitutional behaviour:
//   - invoke on unknown tool      → REQUIRE_APPROVAL (POL-006, unregistered.*)
//   - invoke on READ_ONLY tool    → ALLOW  (POL-011) + evidence
//   - invoke on SIDE_EFFECT tool  → DENY   (POL-012) until governed authorize
//   - contract violation          → VALIDATION_FAILED, zero execution (S1 strict)
//   - every decision persisted (PolicyDecision) + realtime event (Domain 11)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import {
  invokeTool, registerTool, setToolAuthorization, authorizeInvoke, validateToolContract,
} from '@/lib/yahria/tool-registry';
import type { ToolContract, ToolRiskClass } from '@/lib/yahria/tool-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped(); // idempotent — seeds POL-011/012 + built-in tools on first hit
    const [tools, invocations] = await Promise.all([
      db.registeredTool.findMany({ orderBy: { toolId: 'asc' } }),
      db.toolInvocation.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);
    // Authorization matrix — re-evaluated live for every tool (INV-062)
    const matrix = await Promise.all(tools.map(async (t) => {
      const { auth } = await authorizeInvoke(t.toolId, 'SYSTEM', 'yahria-registry-view');
      return { toolId: t.toolId, effect: auth.effect, matchedRule: auth.matchedRule, reason: auth.reason, resource: auth.resourceRequested };
    }));
    return NextResponse.json({
      ok: true,
      registry: tools.map((t) => ({ ...t, contract: JSON.parse(t.contract) })),
      authorization: matrix,
      invocations,
      counts: { tools: tools.length, executable: tools.filter((t) => t.executable).length, invocations: await db.toolInvocation.count() },
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
    switch (action) {
      case 'register': {
        const contract = body.contract;
        const cc = validateToolContract(contract);
        if (!cc.ok) return NextResponse.json({ ok: false, errors: cc.errors }, { status: 422 });
        const res = await registerTool({
          toolId: String(body.toolId ?? ''), name: String(body.name ?? ''), version: String(body.version ?? ''),
          description: String(body.description ?? ''), riskClass: (body.riskClass ?? 'SIDE_EFFECT') as ToolRiskClass,
          contract: contract as ToolContract, ownerDomain: body.ownerDomain ? String(body.ownerDomain) : undefined,
        });
        return NextResponse.json({ ...res }, { status: res.ok ? 200 : 422 });
      }

      case 'discover': {
        const query = body.query ? String(body.query).toLowerCase() : null;
        const risk = body.riskClass ? String(body.riskClass) : null;
        const all = await db.registeredTool.findMany({ where: { active: true }, orderBy: { toolId: 'asc' } });
        const filtered = all.filter((t) =>
          (!query || t.toolId.includes(query) || t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)) &&
          (!risk || t.riskClass === risk));
        return NextResponse.json({ ok: true, matched: filtered.length, tools: filtered.map((t) => ({ toolId: t.toolId, name: t.name, version: t.version, riskClass: t.riskClass, executable: t.executable, description: t.description })) });
      }

      case 'invoke': {
        const toolId = String(body.toolId ?? '');
        if (!toolId) return NextResponse.json({ ok: false, error: 'toolId requis' }, { status: 422 });
        const outcome = await invokeTool({
          toolId,
          input: body.input ?? {},
          callerType: (['HUMAN', 'AGENT', 'SYSTEM'].includes(String(body.callerType)) ? body.callerType : 'HUMAN') as 'HUMAN' | 'AGENT' | 'SYSTEM',
          callerId: String(body.callerId ?? 'yahria-operator'),
          traceId: body.traceId ? String(body.traceId) : undefined,
        });
        return NextResponse.json({ ok: true, outcome }); // a policy DENY is a valid governed decision, not an HTTP error
      }

      case 'authorize': {
        const toolId = String(body.toolId ?? '');
        const allow = body.allow === true;
        const reason = String(body.reason ?? 'décision gouvernée opérateur');
        const res = await setToolAuthorization(toolId, allow, reason);
        return NextResponse.json({ ...res }, { status: res.ok ? 200 : 422 });
      }

      default:
        return NextResponse.json({ ok: false, error: `action inconnue : ${action} — vocabulaire : register | discover | invoke | authorize` }, { status: 422 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
