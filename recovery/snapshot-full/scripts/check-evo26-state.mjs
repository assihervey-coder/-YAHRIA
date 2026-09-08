import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const evs = await db.evidence.findMany({ orderBy: { createdAt: 'desc' }, take: 12, select: { evidenceUid: true, category: true, claim: true, createdAt: true } });
  for (const e of evs) console.log(e.evidenceUid, '|', e.createdAt.toISOString(), '|', e.category, '|', e.claim.slice(0, 110));
  console.log('---EVO-000026---');
  const evo = await db.evolutionProposal.findUnique({ where: { proposalUid: 'EVO-000026' }, select: { state: true, decidedBy: true, decisionReason: true, updatedAt: true, rollbackPlan: true } });
  console.log(JSON.stringify(evo, null, 2));
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
