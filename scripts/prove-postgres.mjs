// ═══════════════════════════════════════════════════════════════
// YAHRIA — PREUVE R7.2 : PostgreSQL 100% fonctionnel
// Écrit un SystemEvent, le relit, compte les lignes — preuve round-trip.
// Usage : DATABASE_URL=postgresql://... node scripts/prove-postgres.mjs
// ═══════════════════════════════════════════════════════════════
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const t0 = Date.now();
try {
  const created = await db.systemEvent.create({
    data: {
      level: 'INFO',
      source: 'R7.2',
      kind: 'EVIDENCE',
      message: 'PostgreSQL live proof — round-trip SystemEvent (R7.2)',
      correlationId: 'R72-POSTGRES-PROOF',
      payload: JSON.stringify({ provider: 'postgresql', at: new Date().toISOString() }),
    },
  });
  const readBack = await db.systemEvent.findUnique({ where: { id: created.id } });
  const total = await db.systemEvent.count();
  const runs = await db.generationRun.count();
  console.log(JSON.stringify({
    ok: readBack?.id === created.id,
    createdId: created.id,
    message: readBack?.message,
    totalSystemEvents: total,
    generationRuns: runs,
    ms: Date.now() - t0,
  }, null, 2));
  if (readBack?.id !== created.id) process.exit(1);
  console.log('R72_POSTGRES_PROOF_OK');
} finally {
  await db.$disconnect();
}
