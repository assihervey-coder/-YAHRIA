// ═══════════════════════════════════════════════════════════════
// YAHRIA API — MEMORY SYSTEM (Domain 13, R14 / KRN-030)
//
//   GET    /api/yahria/memory?kind=&validation=&q=&limit=  — liste + stats
//   POST   { kind, key, content, source, validation?, confidence? }  — écriture gouvernée (INV-221)
//   PATCH  { id, evidenceRef? }                            — consolidation (WORKING/EPISODIC → SEMANTIC)
//   DELETE { id, reason }                                  — oubli gouverné (INV-222)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { writeMemory, consolidateMemory, forgetMemory, retrieveMemory, type MemoryActorType } from '@/lib/yahria/memory';

export const dynamic = 'force-dynamic';

function toActorType(raw: unknown): MemoryActorType | undefined {
  const v = String(raw ?? '').toUpperCase();
  return ['HUMAN', 'AGENT', 'SYSTEM', 'TOOL', 'MODEL'].includes(v) ? (v as MemoryActorType) : undefined;
}

export async function GET(req: Request) {
  try {
    await ensureBootstrapped();
    const sp = new URL(req.url).searchParams;
    const out = await retrieveMemory({
      kind: sp.get('kind') ?? undefined,
      validation: sp.get('validation') ?? undefined,
      q: sp.get('q') ?? undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'corps JSON invalide' }, { status: 422 }); }
  try {
    await ensureBootstrapped();
    const res = await writeMemory({
      kind: String(body.kind ?? ''), key: String(body.key ?? ''),
      content: String(body.content ?? ''), source: String(body.source ?? ''),
      validation: body.validation ? String(body.validation) : undefined,
      confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
      actorType: toActorType(body.actorType),
      actorId: body.actorId ? String(body.actorId) : undefined,
    });
    return NextResponse.json(res, { status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'corps JSON invalide' }, { status: 422 }); }
  try {
    await ensureBootstrapped();
    const res = await consolidateMemory({
      id: String(body.id ?? ''),
      evidenceRef: body.evidenceRef ? String(body.evidenceRef) : undefined,
      actorId: body.actorId ? String(body.actorId) : undefined,
    });
    return NextResponse.json(res, { status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'corps JSON invalide' }, { status: 422 }); }
  try {
    await ensureBootstrapped();
    const res = await forgetMemory({
      id: String(body.id ?? ''), reason: String(body.reason ?? ''),
      actorType: toActorType(body.actorType),
      actorId: body.actorId ? String(body.actorId) : undefined,
    });
    return NextResponse.json(res, { status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
