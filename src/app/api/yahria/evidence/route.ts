import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { captureEvidence } from '@/lib/yahria/evidence-engine';
import { EVIDENCE_LIFECYCLE } from '@/lib/yahria/evidence-engine';

// Mirror of evidence-engine hashing structure (INV-110 integrity recomputation)
function hashRecord(x: { category: string; claim: string; actor: string; payload: string | null; prevHash: string | null }): string {
  return createHash('sha256').update(JSON.stringify({ category: x.category, claim: x.claim, actor: x.actor, payload: x.payload, prevHash: x.prevHash })).digest('hex');
}

export async function GET() {
  try {
    await ensureBootstrapped();
    const evidence = await db.evidence.findMany({ orderBy: { createdAt: 'desc' }, take: 60 });
    return NextResponse.json({ ok: true, evidence, lifecycle: EVIDENCE_LIFECYCLE });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureBootstrapped();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'capture');

    if (action === 'capture') {
      const claim = String(body.claim ?? '');
      const category = String(body.category ?? 'AUDIT');
      const criticality = String(body.criticality ?? 'STANDARD');
      if (!claim) return NextResponse.json({ ok: false, error: 'claim required — an evidence without a claim is nothing (CLAIM ≠ EVIDENCE).' }, { status: 400 });
      const rec = captureEvidence({
        category: category as never,
        criticality: criticality as never,
        actorType: (body.actorType ?? 'HUMAN') as never,
        actorId: String(body.actorId ?? 'human-operator'),
        claim,
        payload: body.payload,
      });
      const created = await db.evidence.create({
        data: {
          evidenceUid: rec.evidenceUid, category: rec.category, criticality: rec.criticality,
          state: rec.state, actorType: rec.actorType, actorId: rec.actorId, claim: rec.claim,
          payload: rec.payload, contentHash: rec.contentHash, prevHash: rec.prevHash,
        },
      });
      return NextResponse.json({ ok: true, evidence: created });
    }

    if (action === 'verify' || action === 'seal') {
      const id = String(body.id ?? '');
      const record = await db.evidence.findUnique({ where: { id } });
      if (!record) return NextResponse.json({ ok: false, error: 'evidence not found' }, { status: 404 });

      if (['EXPIRED', 'DISPOSED', 'INVALID', 'CORRUPTED'].includes(record.state)) {
        return NextResponse.json({ ok: false, error: `Preuve en état terminal ${record.state} — action refusée.` }, { status: 422 });
      }

      // Integrity = recompute SHA-256 over canonical fields (INV-110)
      const recomputed = hashRecord({
        category: record.category, claim: record.claim,
        actor: `${record.actorType}:${record.actorId}`,
        payload: record.payload, prevHash: record.prevHash,
      });
      if (recomputed !== record.contentHash) {
        const corrupted = await db.evidence.update({ where: { id }, data: { state: 'CORRUPTED' } });
        return NextResponse.json({ ok: true, evidence: corrupted, verdict: { ok: false, reason: 'INTEGRITY FAILURE : hash recomputé différent — preuve CORRUPTED (INV-110)' } });
      }

      // verify: HASHED → VERIFIED ; seal: VERIFIED → SEALED (sceller vérifie puis scelle)
      const newState = action === 'seal' ? 'SEALED' : record.state === 'SEALED' ? 'SEALED' : 'VERIFIED';
      const updated = await db.evidence.update({
        where: { id },
        data: {
          state: newState,
          sealedAt: action === 'seal' ? new Date() : record.sealedAt,
        },
      });
      await db.systemEvent.create({
        data: {
          level: 'INFO', source: '11', kind: 'EVIDENCE',
          message: `${record.evidenceUid}: intégrité vérifiée → ${newState}`,
          correlationId: record.evidenceUid,
        },
      });
      return NextResponse.json({
        ok: true, evidence: updated,
        verdict: { ok: true, reason: `Intégrité vérifiée (hash SHA-256 conforme) → état ${newState}${action === 'seal' ? ' — immutabilité engagée (INV-033)' : ''}` },
      });
    }

    return NextResponse.json({ ok: false, error: `Unknown action '${action}'. Canonical actions: capture | verify | seal.` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
