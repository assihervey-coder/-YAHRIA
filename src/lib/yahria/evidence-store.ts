// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Evidence persistence bridge
// Capture (in-memory chain) + durable storage (INV-110/111).
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { captureEvidence, setSeqStart, advanceSeq, type EvidenceCapture, type EvidenceRecord } from './evidence-engine';

let seqSynced = false;

async function syncSeq(): Promise<void> {
  if (seqSynced) return;
  try {
    // Sync from the MAX UID suffix — not from count(). In-memory-only captures
    // (e.g. the legacy agent capability probe) consume sequence numbers WITHOUT
    // creating rows, so count() under-reports and restarts would collide.
    const rows = await db.evidence.findMany({
      orderBy: { createdAt: 'desc' }, take: 500, select: { evidenceUid: true },
    });
    let max = 0;
    for (const r of rows) {
      const m = /(\d+)$/.exec(r.evidenceUid);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    setSeqStart(max);
  } catch {
    // DB unreachable — keep in-memory counter (INV-210: degrade explicitly, do not guess)
  }
  seqSynced = true;
}

export async function captureAndPersist(
  input: EvidenceCapture,
  extras?: { executionId?: string; taskId?: string; traceId?: string },
): Promise<{ rec: EvidenceRecord; uid: string; id: string }> {
  await syncSeq();
  // UID collisions are retried by advancing the counter — a gap in numbering
  // is harmless; a failed capture is not (INV-210: fail safely, then proceed).
  for (let attempt = 0; attempt < 5; attempt++) {
    const rec = captureEvidence(input);
    try {
      const created = await db.evidence.create({
        data: {
          evidenceUid: rec.evidenceUid,
          category: rec.category,
          criticality: rec.criticality,
          state: rec.state,
          actorType: rec.actorType,
          actorId: rec.actorId,
          claim: rec.claim,
          payload: rec.payload,
          contentHash: rec.contentHash,
          prevHash: rec.prevHash,
          executionId: extras?.executionId ?? input.executionId ?? null,
          taskId: extras?.taskId ?? input.taskId ?? null,
          traceId: extras?.traceId ?? input.traceId ?? null,
        },
      });
      return { rec, uid: rec.evidenceUid, id: created.id };
    } catch (e) {
      if (String(e).includes('Unique constraint') && attempt < 4) {
        advanceSeq(1);
        continue;
      }
      throw e;
    }
  }
  throw new Error('captureAndPersist : épuisement des tentatives anti-collision UID (INV-210)');
}
