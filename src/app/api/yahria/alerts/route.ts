// ═══════════════════════════════════════════════════════════════
// YAHRIA API — ALERTING EXTERNE (Domain 22, R15 / KRN-039)
//
//   GET  /api/yahria/alerts   — alertes archivées + état du canal
//   POST { action: 'evaluate', report?, webhookUrl?, webhookSecret? }
//        — évalue les 3 règles sur le rapport ops réel (ou injecté
//          SIMULATION, étiqueté) et livre via webhook signé HMAC.
//
// INV-236 : chaque évaluation est un fait archivé ; canal non
// configuré = NOT_CONFIGURED, jamais un abandon silencieux (INV-210).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { opsReport, type OpsReport } from '@/lib/yahria/ops';
import { evaluateAndDispatchAlerts, listAlerts, ALERT_RULES, ALERTING_MODULE_ID } from '@/lib/yahria/alerting';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const alerts = await listAlerts(30);
    return NextResponse.json({
      ok: true,
      module: ALERTING_MODULE_ID,
      channelConfigured: Boolean(process.env.YAHRIA_ALERT_WEBHOOK_URL),
      rules: ALERT_RULES,
      dedupWindowMin: 10,
      alerts,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'corps JSON invalide' }, { status: 422 }); }
  try {
    await ensureBootstrapped();
    if (body.action !== 'evaluate') {
      return NextResponse.json({ ok: false, errors: [`action inconnue : ${String(body.action)} — vocabulaire : evaluate`] }, { status: 422 });
    }
    const simulated = body.report !== undefined && body.report !== null;
    const report: OpsReport = simulated
      ? (body.report as OpsReport) // étiqueté SIMULATION end-to-end
      : await opsReport();
    const res = await evaluateAndDispatchAlerts({
      report, simulated,
      webhookUrl: typeof body.webhookUrl === 'string' ? body.webhookUrl : undefined,
      webhookSecret: typeof body.webhookSecret === 'string' ? body.webhookSecret : undefined,
      actorId: typeof body.actorId === 'string' ? body.actorId : undefined,
    });
    return NextResponse.json({ ok: true, simulated, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
