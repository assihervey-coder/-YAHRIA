// ═══════════════════════════════════════════════════════════════
// YAHRIA API — OPERATIONS (Domain 22, R14 / KRN-037)
//
//   GET /api/yahria/ops   — santé mesurée (liveness + readiness + SLO 24h)
//   INV-233 : les sondes interrogent les dépendances réelles.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { opsReport } from '@/lib/yahria/ops';
import { evaluateAndDispatchAlerts } from '@/lib/yahria/alerting';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const report = await opsReport();
    // Propagation gouvernée vers le canal externe (D.22, INV-236) :
    // uniquement si le canal est configuré ET qu'une sonde est rouge —
    // l'anti-tempête (dédup 10 min) rend l'appel sûr même à haute fréquence.
    let alerting: { triggered: boolean; evaluated: number } | undefined;
    if (process.env.YAHRIA_ALERT_WEBHOOK_URL && !report.readiness.ok) {
      const r = await evaluateAndDispatchAlerts({ report, actorId: 'ops-probe' });
      alerting = { triggered: true, evaluated: r.evaluated };
    }
    return NextResponse.json({ ok: true, report, ...(alerting ? { alerting } : {}) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
