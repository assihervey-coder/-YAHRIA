import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';

// GET /api/yahria/studio/runs/[id]/download — télécharge le ZIP de livraison (SEALED uniquement)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const run = await db.generationRun.findUnique({ where: { id } });
    if (!run) return NextResponse.json({ ok: false, error: 'run introuvable' }, { status: 404 });
    if (run.state !== 'SEALED' || !run.zipPath) {
      return NextResponse.json({ ok: false, error: `livraison indisponible : run en état ${run.state} (SEALED requis)` }, { status: 409 });
    }
    const zip = await readFile(run.zipPath);
    return new Response(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="yahria-${run.runUid}.zip"`,
        'Content-Length': String(zip.byteLength),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
