// ═══════════════════════════════════════════════════════════════
// YAHRIA API — QUALITY GATES (Domain 20, R14 / KRN-036)
//
//   GET  /api/yahria/quality            — dernier run de gates
//   POST { }                            — exécute les gates mesurables maintenant
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { runQualityGates } from '@/lib/yahria/quality';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const last = await db.opsSnapshot.findFirst({ where: { kind: 'QUALITY_GATES' }, orderBy: { createdAt: 'desc' } });
    if (!last) return NextResponse.json({ ok: true, gates: null, note: 'aucun run de gates — lancez POST pour une mesure réelle' });
    return NextResponse.json({
      ok: true,
      run: { ...JSON.parse(last.summary || '{}'), snapshotId: last.id, ok: last.ok, createdAt: last.createdAt.toISOString() },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    await ensureBootstrapped();
    const run = await runQualityGates();
    return NextResponse.json({ ok: true, run });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
