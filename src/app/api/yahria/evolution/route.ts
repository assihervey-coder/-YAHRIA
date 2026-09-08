// ═══════════════════════════════════════════════════════════════
// YAHRIA API — SELF-EVOLUTION (Domain 15, R14 / KRN-033)
//
//   GET  /api/yahria/evolution          — propositions + pipeline
//   POST { action: 'create', title, kind, rationale, riskClass?, proposedBy: {type,id}, sourceInsightUid? }
//   POST { action, proposalUid, actor: {type,id}, reason?, experiment?, rollbackPlan? }
//        action ∈ submit | review | approve | reject | schedule | promote | rollback
//   INV-227 : le proposant ne peut jamais approuver (refus système).
//   INV-228 : PROMOTED n'exécute aucune mutation de production.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { createProposal, decideProposal, EVOLUTION_KINDS, EVOLUTION_RISKS, type EvolutionActor } from '@/lib/yahria/evolution';

export const dynamic = 'force-dynamic';

function parseActor(raw: unknown): EvolutionActor {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { type: String(o.type ?? 'HUMAN').toUpperCase() === 'AGENT' ? 'AGENT' : 'HUMAN', id: String(o.id ?? 'humain') };
}

export async function GET() {
  try {
    await ensureBootstrapped();
    const proposals = await db.evolutionProposal.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 });
    return NextResponse.json({
      ok: true,
      kinds: EVOLUTION_KINDS,
      riskClasses: EVOLUTION_RISKS,
      pipeline: ['DRAFTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'PROMOTED', 'ROLLED_BACK'],
      proposals: proposals.map((p) => ({
        proposalUid: p.proposalUid, title: p.title, kind: p.kind, rationale: p.rationale,
        sourceInsightUid: p.sourceInsightUid, riskClass: p.riskClass, state: p.state,
        proposedBy: p.proposedBy, decidedBy: p.decidedBy, decisionReason: p.decisionReason,
        hasExperiment: !!p.experiment, hasRollbackPlan: String(p.rollbackPlan ?? '').trim().length >= 15,
        updatedAt: p.updatedAt.toISOString(),
      })),
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
        const res = await createProposal({
          title: String(body.title ?? ''), kind: String(body.kind ?? ''),
          rationale: String(body.rationale ?? ''),
          riskClass: body.riskClass ? String(body.riskClass) : undefined,
          sourceInsightUid: body.sourceInsightUid ? String(body.sourceInsightUid) : undefined,
          proposedBy: parseActor(body.proposedBy),
        });
        return NextResponse.json(res, { status: res.status });
      }
      case 'submit': case 'review': case 'approve': case 'reject':
      case 'schedule': case 'promote': case 'rollback': {
        const res = await decideProposal({
          proposalUid: String(body.proposalUid ?? ''), action,
          actor: parseActor(body.actor),
          reason: body.reason ? String(body.reason) : undefined,
          experiment: (body.experiment ?? undefined) as Record<string, unknown> | undefined,
          rollbackPlan: body.rollbackPlan ? String(body.rollbackPlan) : undefined,
        });
        return NextResponse.json(res, { status: res.status });
      }
      default:
        return NextResponse.json({ ok: false, error: `action inconnue : ${action} — vocabulaire : create | submit | review | approve | reject | schedule | promote | rollback` }, { status: 422 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
