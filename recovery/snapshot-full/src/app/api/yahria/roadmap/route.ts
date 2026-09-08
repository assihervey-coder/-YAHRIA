// ═══════════════════════════════════════════════════════════════
// YAHRIA API — ROADMAP (Domain 23, R14 / KRN-038)
//
//   GET /api/yahria/roadmap — priorisation dérivée du ledger (INV-234)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { computeRoadmap } from '@/lib/yahria/roadmap';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const roadmap = await computeRoadmap();
    return NextResponse.json({ ok: true, roadmap });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
