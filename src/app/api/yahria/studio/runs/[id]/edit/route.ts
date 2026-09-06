import { NextResponse } from 'next/server';
import { editGeneratedFile } from '@/lib/yahria/studio-pipeline';

// POST /api/yahria/studio/runs/[id]/edit — éditeur IA : régénère un fichier sur instruction
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const filePath = String(body.path ?? '').trim();
    const instruction = String(body.instruction ?? '').trim();
    if (!filePath) return NextResponse.json({ ok: false, error: 'path requis' }, { status: 400 });
    if (instruction.length < 5) return NextResponse.json({ ok: false, error: 'instruction trop courte (min. 5 caractères)' }, { status: 400 });
    const result = await editGeneratedFile(id, filePath, instruction);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
