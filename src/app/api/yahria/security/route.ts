// ═══════════════════════════════════════════════════════════════
// YAHRIA API — SECURITY AUDIT (Domain 19, R14 / KRN-035)
//
//   GET  /api/yahria/security           — dernier instantané d'audit
//   POST { }                            — exécute l'audit maintenant (scellé, INV-231)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { runSecurityAudit } from '@/lib/yahria/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const last = await db.opsSnapshot.findFirst({ where: { kind: 'SECURITY_AUDIT' }, orderBy: { createdAt: 'desc' } });
    if (!last) return NextResponse.json({ ok: true, audit: null, note: 'aucun audit exécuté — lancez POST pour un constat réel (aucun statut inventé, INV-044)' });
    return NextResponse.json({
      ok: true,
      audit: { ...JSON.parse(last.summary || '{}'), snapshotId: last.id, ok: last.ok, createdAt: last.createdAt.toISOString() },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    await ensureBootstrapped();
    const audit = await runSecurityAudit();
    return NextResponse.json({ ok: true, audit });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
