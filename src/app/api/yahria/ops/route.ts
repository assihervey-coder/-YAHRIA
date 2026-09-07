// ═══════════════════════════════════════════════════════════════
// YAHRIA API — OPERATIONS (Domain 22, R14 / KRN-037)
//
//   GET /api/yahria/ops   — santé mesurée (liveness + readiness + SLO 24h)
//   INV-233 : les sondes interrogent les dépendances réelles.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { opsReport } from '@/lib/yahria/ops';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const report = await opsReport();
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
