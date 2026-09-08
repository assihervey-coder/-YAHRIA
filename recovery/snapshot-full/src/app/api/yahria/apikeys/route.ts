// ═══════════════════════════════════════════════════════════════
// YAHRIA API — API KEYS (Domain 17, R14 / KRN-034)
//
//   GET  /api/yahria/apikeys            — clés (masked, INV-229)
//   POST { name, scopes?, rateLimitPerMin? } — émission (plaintext retourné UNE fois)
//   PUT  { id, reason }                 — révocation gouvernée
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { issueApiKey, revokeApiKey } from '@/lib/yahria/api-gateway';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureBootstrapped();
    const keys = await db.apiKey.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({
      ok: true,
      keys: keys.map((k) => ({
        id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes.split(','),
        rateLimitPerMin: k.rateLimitPerMin, revoked: !!k.revokedAt,
        revokedAt: k.revokedAt?.toISOString() ?? null,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
      note: 'Le plaintext n\'est jamais stocké ni relisible (INV-229) — seule l\'émission le retourne une fois.',
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
    const res = await issueApiKey({
      name: String(body.name ?? ''),
      scopes: Array.isArray(body.scopes) ? (body.scopes as string[]) : undefined,
      rateLimitPerMin: typeof body.rateLimitPerMin === 'number' ? body.rateLimitPerMin : undefined,
      actorId: body.actorId ? String(body.actorId) : undefined,
    });
    return NextResponse.json(res, { status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'corps JSON invalide' }, { status: 422 }); }
  try {
    await ensureBootstrapped();
    const res = await revokeApiKey({ id: String(body.id ?? ''), reason: String(body.reason ?? '') });
    return NextResponse.json(res, { status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
