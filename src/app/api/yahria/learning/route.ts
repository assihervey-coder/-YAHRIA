// ═══════════════════════════════════════════════════════════════
// YAHRIA API — LEARNING ENGINE (Domain 14, R14 / KRN-032)
//
//   GET  /api/yahria/learning           — insights + dernière opération
//   POST { action: 'mine' }             — mining déterministe des faits (INV-226)
//   POST { action: 'promote', insightUid } — promotion gouvernée → mémoire D.13
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { mineInsights, promoteInsightToMemory, INSIGHT_THRESHOLD } from '@/lib/yahria/learning';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const insights = await db.learningInsight.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 });
    return NextResponse.json({
      ok: true,
      threshold: INSIGHT_THRESHOLD,
      insights: insights.map((i) => ({
        insightUid: i.insightUid, kind: i.kind, subject: i.subject,
        metric: JSON.parse(i.metric || '{}'), confidence: i.confidence,
        state: i.state, recommendation: i.recommendation,
        evidenceCount: (JSON.parse(i.evidenceRefs || '[]') as string[]).length,
        updatedAt: i.updatedAt.toISOString(),
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
      case 'mine': {
        const res = await mineInsights();
        return NextResponse.json(res);
      }
      case 'promote': {
        const res = await promoteInsightToMemory({
          insightUid: String(body.insightUid ?? ''),
          actorId: body.actorId ? String(body.actorId) : undefined,
        });
        return NextResponse.json(res, { status: res.status });
      }
      default:
        return NextResponse.json({ ok: false, error: `action inconnue : ${action} — vocabulaire : mine | promote` }, { status: 422 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
