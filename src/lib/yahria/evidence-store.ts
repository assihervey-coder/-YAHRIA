// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Evidence persistence bridge
// Capture (in-memory chain) + durable storage (INV-110/111).
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { captureEvidence, setSeqStart, advanceSeq, type EvidenceCapture, type EvidenceRecord } from './evidence-engine';

let seqSynced = false;

async function syncSeq(force = false): Promise<void> {
  if (seqSynced && !force) return;
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
        // A concurrent writer (e.g. the server pipeline sealing its own evidence
        // while a measurement harness runs) may have advanced the durable
        // sequence by MANY rows since our last sync — +1 steps cannot close a
        // large gap within 5 attempts (it.12 slot 3 FATAL 19:38Z). Re-syncing
        // from the durable MAX UID closes the whole gap in one step; setSeqStart
        // only raises, so this is idempotent. advanceSeq(1) stays as a fallback
        // for the DB-unreachable branch (INV-210: catch up, do not guess).
        advanceSeq(1);
        await syncSeq(true);
        continue;
      }
      throw e;
    }
  }
  throw new Error('captureAndPersist : épuisement des tentatives anti-collision UID (INV-210)');
}
