// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Evidence persistence bridge
// Capture (in-memory chain) + durable storage (INV-110/111).
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { captureEvidence, setSeqStart, type EvidenceCapture, type EvidenceRecord } from './evidence-engine';

let seqSynced = false;

async function syncSeq(): Promise<void> {
  if (seqSynced) return;
  try {
    const count = await db.evidence.count();
    setSeqStart(count);
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
  const rec = captureEvidence(input);
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
}
