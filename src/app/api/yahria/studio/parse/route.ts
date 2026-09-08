import { NextResponse } from 'next/server';
import { parseTreeSpec } from '@/lib/yahria/studio';

// POST /api/yahria/studio/parse — S1 dry-run : valide une arborescence sans créer de run
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = String(body.treeSpec ?? '');
    if (!raw.trim()) return NextResponse.json({ ok: false, error: 'treeSpec vide' }, { status: 400 });
    const parsed = parseTreeSpec(raw);
    return NextResponse.json({ ok: true, parsed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
