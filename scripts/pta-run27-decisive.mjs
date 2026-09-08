#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — TEST DÉCISIF RUN-000027 — PORTE DE COMPLÉTUDE (EVO-000026)
// Reproduction HONNÊTE des conditions RUN-000026 par injection de faute
// contrôlée (chaos engineering) : bascule runtime de la fabric vers un
// fournisseur RÉELLEMENT injoignable (ollama localhost:11434 — aucun
// serveur). Les échecs, le circuit breaker et les notes « circuit OPEN »
// sont de VRAIS événements d'infrastructure — rien n'est simulé (INV-227).
//
//   bun run scripts/pta-run27-decisive.mjs
//
// Critères d'acceptation EVO-000026 testés :
//   A1. Aucun livrable partiel ne quitte GENERATING → run FAILED
//   A2. Classification INFRA (panne fabric) — PAS un échec MODÈLE (INV-210)
//   A3. Remédiation bornée (1 tour, cooldown fabric respecté)
//   A4. Chaque décision de la porte est scellée en preuve
// ═══════════════════════════════════════════════════════════════════

const BASE = 'http://127.0.0.1:3000';
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failedCount = 0;
function check(id, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${id}${detail ? ` — ${detail}` : ''}`); }
  else { failedCount++; console.log(`  ✗ ${id}${detail ? ` — ${detail}` : ''}`); }
}

async function flipOrder(order) {
  const res = await fetch(`${BASE}/api/yahria/llm`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'order', order }),
  });
  return res.json();
}

let runUid = null;
let orderRestored = false;

try {
  // ── 0. état fabric — injection de faute attendue active (order ollama, réellement injoignable) ──
  const health = await (await fetch(`${BASE}/api/yahria/llm`)).json();
  check('0.1 injection active : order runtime = [ollama] (faute contrôlée, ECONNREFUSED réel)',
    JSON.stringify(health.order) === JSON.stringify(['ollama']), JSON.stringify(health.order));

  // ── 1. création du run — arborescence conçue par l'IA, PYTHON ─────
  const created = await (await fetch(`${BASE}/api/yahria/studio/runs`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'RUN-000027 — test décisif porte complétude',
      brief: 'Minimal FastAPI inventory service: main.py (FastAPI app with 4 routes: list, get, create, delete items in-memory), models.py (pydantic Item model), storage.py (in-memory dict store with lock), tests/test_api.py (pytest covering the 4 routes). Requirements.txt with fastapi, uvicorn, pydantic. 6 files maximum.',
      aiDesignedTree: true,
      requestedStack: 'PYTHON',
    }),
  })).json();
  if (!created.ok) throw new Error(`création run impossible : ${created.error}`);
  runUid = created.run.runUid;
  console.log(`\nRUN créé : ${runUid} (state ${created.run.state})\n`);

  // ── 2. injection au seuil GENERATING (fabric saine pour tree/blueprint) ──
  let injected = false;
  const tInject0 = Date.now();
  while (Date.now() - tInject0 < 240_000 && !injected) {
    await sleep(400);
    const runs = await (await fetch(`${BASE}/api/yahria/studio/runs`)).json();
    const me = runs.runs?.find((r) => r.runUid === runUid);
    if (!me) continue;
    if (me.state === 'GENERATING') {
      const flip = await flipOrder(['ollama']); // FAUTE CONTRÔLÉE : endpoint réellement injoignable
      injected = flip.ok === true;
      console.log(`⚡ Injection GENERATING+${((Date.now() - tInject0) / 1000).toFixed(1)}s : order→['ollama'] (ECONNREFUSED réel) — flip.ok=${flip.ok}`);
    } else if (['SEALED', 'FAILED', 'CANCELLED'].includes(me.state)) {
      break; // terminé trop vite (avant injection) — les assertions le détecteront
    }
  }
  check('1.1 injection de faute appliquée au seuil GENERATING', injected);

  // ── 3. attente de l'état terminal (borne : 7 min) ─────────────────
  let terminal = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 420_000) {
    await sleep(2_000);
    const runs = await (await fetch(`${BASE}/api/yahria/studio/runs`)).json();
    const me = runs.runs?.find((r) => r.runUid === runUid);
    if (me && ['SEALED', 'FAILED', 'CANCELLED'].includes(me.state)) { terminal = me; break; }
  }
  check('2.1 run atteint un état terminal < 7 min', Boolean(terminal), terminal?.state ?? 'TIMEOUT');
} finally {
  // ── 4. RESTAURATION TOUJOURS — la fabric revient à zai (sain) ─────
  const back = await flipOrder(['zai']);
  orderRestored = back.ok === true;
  console.log(`\n♻️ restauration order→['zai'] : ok=${back.ok}`);
}

try {
  // ── 5. ASSERTIONS (source de vérité : DB + preuves) ───────────────
  console.log('\nAssertions du verdict :\n');
  const run = await db.generationRun.findFirst({ where: { runUid }, include: { files: true } });
  if (!run) throw new Error(`run ${runUid} introuvable`);

  // A1 — aucun livrable partiel ne quitte GENERATING
  check('A1.1 run FAILED (livrable partiel refusé)', run.state === 'FAILED', run.state);
  check('A1.2 message d\'échec = porte de complétude EVO-000026',
    /porte de complétude \(EVO-000026\)/.test(run.error ?? ''), (run.error ?? '').slice(0, 140));

  // A2 — classification honnête INFRA (INV-210)
  check('A2.1 classification INFRA dans le message', /INFRA/.test(run.error ?? ''));
  check('A2.2 PAS de fausse accusation MODÈLE seule', !/classification MODÈLE/.test(run.error ?? ''));

  // A3 — remédiation bornée visible (1 tour : notes « remédiation v3 » sur les fichiers)
  const remedied = run.files.filter((f) => /remédiation/.test(f.note ?? ''));
  check('A3.1 remédiation bornée appliquée (≥1 fichier retouché, 1 tour)', remedied.length > 0, `${remedied.length} fichier(s)`);
  const overTried = run.files.filter((f) => f.attempts > 5);
  check('A3.2 tentatives restées bornées (≤5 par fichier)', overTried.length === 0, overTried.map((f) => `${f.path}:${f.attempts}`).join(','));

  // A4 — chaque décision scellée (chaîne de preuves)
  const gateEvidence = await db.evidence.findMany({
    where: { actorId: 'yahria-completeness-gate' },
    orderBy: { createdAt: 'desc' }, take: 3,
  });
  const mine = gateEvidence.find((e) => (e.payload ?? '').includes(runUid));
  check('A4.1 preuve de la porte scellée pour ce run', Boolean(mine), mine?.evidenceUid ?? '—');
  check('A4.2 verdict FAIL — classification INFRA dans la preuve',
    /FAIL — classification INFRA/.test(mine?.claim ?? ''), mine?.claim?.slice(0, 120));
  const bootAfter = await db.evidence.findFirst({
    where: { actorId: 'yahria-boot-gate', claim: { contains: runUid } },
    orderBy: { createdAt: 'desc' },
  });
  check('A4.3 porte de boot JAMAIS atteinte (aucune preuve boot pour ce run)', !bootAfter);

  // ── résumé d'état pour le rapport ──────────────────────────────────
  const verified = run.files.filter((f) => f.state === 'VERIFIED').length;
  const failedFiles = run.files.filter((f) => f.state === 'FAILED');
  console.log(`\nÉtat fichiers : ${verified} VERIFIED / ${failedFiles.length} FAILED sur ${run.files.length}`);
  for (const f of failedFiles.slice(0, 4)) console.log(`   ✗ ${f.path} (essais ${f.attempts}) : ${(f.note ?? '').slice(0, 110)}`);

  // preuve du test décisif lui-même
  const { captureAndPersist } = await import('../src/lib/yahria/evidence-store.ts');
  await captureAndPersist({
    category: 'TEST', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'pta-run27-decisive',
    claim: `Test décisif RUN-000027 (EVO-000026) : ${passed}/${passed + failedCount} assertions PASS — injection ECONNREFUSED réelle (chaos contrôlé), porte v3 a classé INFRA et refusé le livrable partiel`,
    payload: { runUid, passed, failed: failedCount, runState: run.state, orderRestored },
  });
} catch (e) {
  failedCount++;
  console.error('Erreur assertions :', (e instanceof Error ? e.message : String(e)).slice(0, 300));
}

await db.$disconnect();
console.log(`\nRésultat final : ${passed}/${passed + failedCount} PASS${orderRestored ? ' — fabric restaurée' : ' — ⚠️ ORDER NON RESTAURÉ'}\n`);
process.exit(failedCount ? 1 : 0);
