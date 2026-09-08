import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const tables = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('=== TABLES DB ===');
  for (const t of tables) console.log(' ', t.name);
  console.log('=== DONNÉES CLÉS (raw) ===');
  try {
    const evo = await db.$queryRawUnsafe("SELECT proposalUid, state, decidedBy FROM EvolutionProposal ORDER BY proposalUid DESC LIMIT 6");
    for (const e of evo) console.log(' EVO', e.proposalUid, e.state, e.decidedBy);
  } catch (e) { console.log(' EVO ERR:', String(e).slice(0, 120)); }
  try {
    const cnt = await db.$queryRawUnsafe("SELECT COUNT(*) as n FROM Evidence");
    console.log(' Evidence:', cnt[0].n);
    const runs = await db.$queryRawUnsafe("SELECT runUid, state FROM GenerationRun ORDER BY runUid DESC LIMIT 6");
    for (const r of runs) console.log(' RUN', r.runUid, r.state);
    const gf = await db.$queryRawUnsafe("SELECT COUNT(*) as n FROM GeneratedFile");
    console.log(' GeneratedFile:', gf[0].n);
  } catch (e) { console.log(' RUN ERR:', String(e).slice(0, 120)); }
  try {
    const mem = await db.$queryRawUnsafe("SELECT COUNT(*) as n FROM MemoryRecord");
    const ins = await db.$queryRawUnsafe("SELECT COUNT(*) as n FROM LearningInsight");
    console.log(' MemoryRecord:', mem[0].n, '| LearningInsight:', ins[0].n);
  } catch (e) { console.log(' MEM ERR:', String(e).slice(0, 120)); }
  await db.$disconnect();
}
main().catch((e) => { console.error('FATAL:', String(e).slice(0, 300)); process.exit(1); });
