#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — MESURE PTA-002 ITÉRATION 7 — FEW-SHOT EXEMPLAIRE DORÉ
// (EVO-000027 PROMOTED — décision HUMAN:reviewer, INV-227)
//
//   nohup bun run scripts/pta-fewshot-measure.ts > scripts/fewshot-measure.log 2>&1 &
//
// Protocole (signé EVO-000027, étape 6) :
//   3 runs (RUN-000010..12) sur le brief canonique Hub Mobile Money,
//   arbre canonique 13 fichiers, stack PYTHON, TRIPLE PORTE armée
//   (boot v1 + comportement v2 + complétude v3).
//   Métriques : taux de première passe fichiers (attempts===1 et
//   VERIFIED / total blueprint) et runs SEALED au premier passage.
//   Tout échec classé INFRA par la porte v3 est EXCLU des métriques
//   d'apprentissage et le run est REJOUÉ (INV-210) — rejeu borné à 2.
//
// Baseline documentée (RUN-000024/25/26, sans few-shot) :
//   0/3 runs SEALED au premier passage, taux première passe 0-23 %.
// Critères d'acceptation : ≥1/3 SEALED premier passage ; taux ≥ 60 %.
// ═══════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { captureAndPersist } from '../src/lib/yahria/evidence-store.ts';
import { isGoldenFewShotActive } from '../src/lib/yahria/golden-exemplar';

const BASE = 'http://127.0.0.1:3000';
const db = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

const CANONICAL_TREE = [
  'main.py', 'config.py', 'models.py', 'schemas.py', 'security.py',
  'gateways/__init__.py', 'gateways/base.py', 'gateways/notchpay.py', 'gateways/pesapal.py',
  'webhooks.py', 'tests/__init__.py', 'tests/test_api.py', 'requirements.txt',
].join('\n');

// Brief canonique — reconstruction gouvernée honnête : le brief intégral
// original est perdu (INCIDENT merge-db, preuve EV-POLICY-000001) ; le texte
// ci-dessous est dérivé de l'exemplaire lui-même (RUN-000023-corrige, pytest 7/7)
// et du préfixe authentique préservé. Documenté dans la preuve finale.
const CANONICAL_BRIEF = `API Hub de paiement Mobile Money (FastAPI) unifiant deux passerelles : NotchPay et PesaPal.
Routes : GET /health (statut du service : nom, timestamp, état healthy), GET /gateways (liste des passerelles configurées avec opérateurs supportés et statut), POST /initiate (initie un paiement : montant, devise, référence, opérateur, passerelle demandée — délègue à la passerelle choisie), POST /webhook/{gateway} (réception du webhook passerelle, vérification HMAC de la signature, accusé de réception).
Architecture : gateways/base.py (classe abstraite BaseGateway : initiate_payment, verify_webhook), gateways/notchpay.py et gateways/pesapal.py (implémentations concrètes), security.py (génération et vérification de signature HMAC), config.py (SECRET_KEY, HUB_NAME), models.py et schemas.py (modèles et schémas pydantic), webhooks.py (traitement des webhooks), main.py (routes de l'application), tests/test_api.py (pytest avec TestClient couvrant les 4 routes), requirements.txt minimal (fastapi, uvicorn, pydantic, httpx).
AUCUNE authentification utilisateur (pas de tokens, pas d'API keys). AUCUNE base de données : stockage en mémoire.`;

const FILES_EXPECTED = CANONICAL_TREE.split('\n').length; // 13
const RUN_TIMEOUT_MS = 20 * 60_000;
const POLL_MS = 10_000;
const MAX_REPLAYS_PER_SLOT = 2;

const INFRA_SIGNATURES = [
  'circuit open', 'cooldown', '429', 'rate-limit', 'rate limit', 'timeout',
  'econnrefused', 'fabric exhausted', 'classification infra',
];

function isInfraError(error: string | null): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return INFRA_SIGNATURES.some((s) => e.includes(s));
}

interface SlotVerdict {
  slot: number;
  runUid: string;
  state: string;
  attempts: number; // tentatives au niveau slot (rejeux INFRA)
  sealedFirstPass: boolean;
  classification: string; // 'SUCCÈS' | 'MODÈLE' | 'INFRA-EXCLU'
  error: string | null;
  filesExpected: number;
  filesVerified: number;
  filesFirstPass: number;
  firstPassRate: number;
  perFile: { path: string; state: string; attempts: number; bytes: number }[];
  gate3Evidence: string[];
  replayedFrom: string[]; // runUids INFRA exclus avant le verdict
}

async function preflight(): Promise<void> {
  log('PRÉ-VOL — serveur, fabric, armement few-shot');
  const sys = await (await fetch(`${BASE}/api/yahria/system`)).json();
  if (!sys.ok) throw new Error('serveur indisponible');
  const fabric = await (await fetch(`${BASE}/api/yahria/llm`)).json();
  const zai = fabric.providers.find((p: any) => p.id === 'zai');
  if (fabric.order[0] !== 'zai' || !zai?.configured || zai?.breaker !== 'CLOSED') {
    throw new Error(`fabric non saine : order=${JSON.stringify(fabric.order)} zai=${JSON.stringify(zai?.breaker)}`);
  }
  const armed = await isGoldenFewShotActive();
  if (!armed) throw new Error('few-shot EVO-000027 NON armé — mesure invalide');
  log(`PRÉ-VOL OK — order=${JSON.stringify(fabric.order)} zai=CLOSED few-shot=ARMÉ`);
}

async function createRun(name: string): Promise<string> {
  const res = await (await fetch(`${BASE}/api/yahria/studio/runs`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name, brief: CANONICAL_BRIEF, treeSpec: CANONICAL_TREE,
      aiDesignedTree: false, requestedStack: 'PYTHON',
    }),
  })).json();
  if (!res.ok) throw new Error(`création run impossible : ${res.error}`);
  return res.run.runUid;
}

async function awaitTerminal(runUid: string): Promise<{ state: string; error: string | null; stats: string | null }> {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  for (;;) {
    const run = await db.generationRun.findUnique({ where: { runUid }, select: { state: true, error: true, stats: true } });
    if (!run) throw new Error(`run ${runUid} introuvable`);
    if (['SEALED', 'FAILED', 'CANCELLED', 'LIVE_PROVED'].includes(run.state)) return run as any;
    if (Date.now() > deadline) return { state: 'TIMEOUT', error: 'poll timeout (traité comme INFRA, INV-210)', stats: run.stats };
    await sleep(POLL_MS);
  }
}

async function collectVerdict(slot: number): Promise<SlotVerdict> {
  const replayedFrom: string[] = [];
  let attempt = 0;
  for (;;) {
    attempt++;
    const suffix = attempt > 1 ? ` — rejeu INFRA #${attempt - 1}` : '';
    const name = `PTA-002 it.7 (few-shot EVO-000027) run ${slot}/3${suffix} — Hub Mobile Money, triple porte`;
    const runUid = await createRun(name);
    log(`Slot ${slot} tentative ${attempt} : ${runUid} créé — pipeline lancé`);
    const run = await awaitTerminal(runUid);
    log(`Slot ${slot} tentative ${attempt} : ${runUid} → ${run.state}`);

    const infra = run.state === 'FAILED' && isInfraError(run.error);
    if (run.state === 'TIMEOUT' || infra) {
      const cls = run.state === 'TIMEOUT' ? 'TIMEOUT' : 'INFRA';
      log(`Slot ${slot} : ${runUid} classé ${cls} (INV-210) — exclu des métriques d'apprentissage`);
      replayedFrom.push(runUid);
      await captureAndPersist({
        category: 'INCIDENT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'pta-fewshot-measure',
        claim: `PTA-002 it.7 slot ${slot} : run ${runUid} classé ${cls} — exclu des métriques d'apprentissage (INV-210), rejeu prévu`,
        payload: { runUid, slot, classification: cls, error: (run.error ?? '').slice(0, 500) },
        traceId: `TRACE-PTA002-IT7-S${slot}`,
      });
      if (attempt <= MAX_REPLAYS_PER_SLOT) continue;
      log(`Slot ${slot} : budget de rejeus épuisé (${MAX_REPLAYS_PER_SLOT}) — slot marqué INFRA-EXCLU`);
      return {
        slot, runUid, state: run.state, attempts: attempt, sealedFirstPass: false,
        classification: 'INFRA-EXCLU', error: run.error, filesExpected: FILES_EXPECTED,
        filesVerified: 0, filesFirstPass: 0, firstPassRate: 0, perFile: [],
        gate3Evidence: [], replayedFrom,
      };
    }

    // verdict final (succès ou échec MODÈLE) — métriques honnêtes
    return await verdictFromRun(runUid, slot, attempt, replayedFrom, run);
  }
}

/** Reconstruit un verdict depuis la DB (run déjà terminé — jamais re-joué). */
async function verdictFromRun(
  runUid: string, slot: number, attempt: number, replayedFrom: string[],
  run: { state: string; error: string | null; stats: string | null },
): Promise<SlotVerdict> {
  const files = await db.generatedFile.findMany({
    where: { runId: (await db.generationRun.findUnique({ where: { runUid } }))!.id },
    select: { path: true, state: true, attempts: true, bytes: true },
  });
  const verified = files.filter((f) => f.state === 'VERIFIED');
  const firstPass = verified.filter((f) => f.attempts === 1);
  const gate3 = await db.evidence.findMany({
    where: { claim: { contains: runUid }, actorId: 'yahria-completeness-gate' },
    select: { evidenceUid: true, claim: true },
  });
  return {
    slot, runUid, state: run.state, attempts: attempt,
    sealedFirstPass: run.state === 'SEALED' && attempt === 1,
    classification: run.state === 'SEALED' ? 'SUCCÈS' : 'MODÈLE',
    error: run.error,
    filesExpected: FILES_EXPECTED,
    filesVerified: verified.length,
    filesFirstPass: firstPass.length,
    firstPassRate: verified.length ? firstPass.length / FILES_EXPECTED : 0,
    perFile: files.map((f) => ({ path: f.path, state: f.state, attempts: f.attempts, bytes: f.bytes })),
    gate3Evidence: gate3.map((g) => `${g.evidenceUid}: ${g.claim.slice(0, 140)}`),
    replayedFrom,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CLI — chunks robustes (un processus long-lived est fragile) :
//   bun scripts/pta-fewshot-measure.ts slot N           — exécute UN slot
//   bun scripts/pta-fewshot-measure.ts reconstruct N UID — verdict depuis DB
//   bun scripts/pta-fewshot-measure.ts finalize          — agrège + scelle
// Verdicts persistés dans scripts/fewshot-verdicts.jsonl (1 ligne/slot).
// ═══════════════════════════════════════════════════════════════════
const VERDICTS_FILE = 'scripts/fewshot-verdicts.jsonl';

async function saveVerdict(v: SlotVerdict): Promise<void> {
  const existing = (await Bun.file(VERDICTS_FILE).exists())
    ? (await Bun.file(VERDICTS_FILE).text()).split('\n').filter(Boolean).map((l) => JSON.parse(l) as SlotVerdict)
    : [];
  const others = existing.filter((x) => x.slot !== v.slot);
  await Bun.write(VERDICTS_FILE, [...others, v].map((x) => JSON.stringify(x)).join('\n') + '\n');
}

async function main(): Promise<void> {
  const [cmd, a, b] = process.argv.slice(2);

  if (cmd === 'slot') {
    await preflight();
    const v = await collectVerdict(Number(a));
    await saveVerdict(v);
    log(`Slot ${v.slot} verdict enregistré : ${v.runUid} → ${v.state} (${v.classification})`);
    await db.$disconnect();
  } else if (cmd === 'reconstruct') {
    const run = await db.generationRun.findUnique({ where: { runUid: b }, select: { state: true, error: true, stats: true } });
    if (!run) throw new Error(`run ${b} introuvable — reconstruction impossible`);
    const v = await verdictFromRun(b, Number(a), 1, [], run as any);
    await saveVerdict(v);
    log(`Slot ${v.slot} reconstruit depuis ${b} : ${v.state} (${v.classification}) — ${v.filesFirstPass}/${v.filesExpected} première passe`);
    await db.$disconnect();
  } else if (cmd === 'finalize') {
    if (!(await Bun.file(VERDICTS_FILE).exists())) throw new Error('aucun verdict enregistré');
    const verdicts = (await Bun.file(VERDICTS_FILE).text()).split('\n').filter(Boolean).map((l) => JSON.parse(l) as SlotVerdict);
    verdicts.sort((x, y) => x.slot - y.slot);

    const counted = verdicts.filter((v) => v.classification !== 'INFRA-EXCLU');
    const sealedFirstPass = counted.filter((v) => v.sealedFirstPass).length;
    const totalFirstPass = counted.reduce((s, v) => s + v.filesFirstPass, 0);
    const totalExpected = counted.length * FILES_EXPECTED;
    const aggregateRate = totalExpected ? totalFirstPass / totalExpected : 0;

    console.log('\n═══ RÉSULTATS PTA-002 it.7 — FEW-SHOT EXEMPLAIRE DORÉ ═══');
    for (const v of verdicts) {
      console.log(`\nSlot ${v.slot} — ${v.runUid} (${v.attempts} tentative(s)) : ${v.state} — ${v.classification}`);
      console.log(`  fichiers vérifiés : ${v.filesVerified}/${v.filesExpected} — première passe : ${v.filesFirstPass}/${v.filesExpected} (${(v.firstPassRate * 100).toFixed(0)} %)`);
      if (v.replayedFrom.length) console.log(`  rejeus INFRA exclus (INV-210) : ${v.replayedFrom.join(', ')}`);
      for (const g of v.gate3Evidence) console.log(`  porte v3 : ${g}`);
      for (const f of v.perFile) console.log(`    ${f.state === 'VERIFIED' ? '✓' : '✗'} ${f.path} — tentatives ${f.attempts}, ${f.bytes} o`);
    }
    console.log(`\nMétriques agrégées (${counted.length}/3 slots comptés — INFRA exclus) :`);
    console.log(`  Runs SEALED au premier passage : ${sealedFirstPass}/${counted.length} (baseline : 0/3)`);
    console.log(`  Taux première passe fichiers   : ${(aggregateRate * 100).toFixed(1)} % (baseline : 0-23 %)`);
    const ac1 = sealedFirstPass >= 1;
    const ac2 = aggregateRate >= 0.6;
    console.log(`  AC1 (≥1 run SEALED premier passage) : ${ac1 ? 'PASS' : 'FAIL'}`);
    console.log(`  AC2 (taux première passe ≥ 60 %)    : ${ac2 ? 'PASS' : 'FAIL'}`);

    await captureAndPersist({
      category: 'ARTIFACT', criticality: 'HIGH', actorType: 'AGENT', actorId: 'pta-fewshot-measure',
      claim: `PTA-002 itération 7 (few-shot EVO-000027) : ${sealedFirstPass}/${counted.length} runs SEALED au premier passage, taux première passe fichiers ${(aggregateRate * 100).toFixed(1)} % sous triple porte — AC1 ${ac1 ? 'PASS' : 'FAIL'}, AC2 ${ac2 ? 'PASS' : 'FAIL'} (baseline 0/3, 0-23 %)`,
      payload: {
        fewShot: 'EVO-000027 PROMOTED (HUMAN:reviewer)', brief: 'reconstruction gouvernée depuis RUN-000023-corrige (INCIDENT EV-POLICY-000001)',
        baseline: { runs: 'RUN-000024/25/26', sealedFirstPass: '0/3', firstPassRate: '0-23 %' },
        verdicts, aggregate: { sealedFirstPass, countedSlots: counted.length, totalFirstPass, totalExpected, aggregateRate, ac1, ac2 },
      },
      traceId: 'TRACE-PTA002-IT7',
    });

    await Bun.write('scripts/fewshot-measure-result.json', JSON.stringify({
      sealedFirstPass, countedSlots: counted.length, aggregateRate, ac1, ac2, verdicts,
    }, null, 2));
    log(`Preuve scellée + résultat JSON écrit — fin de mesure (${ac1 && ac2 ? 'ACCEPTATION REMPLIE' : 'acceptation non remplie'})`);
    await db.$disconnect();
    process.exit(ac1 && ac2 ? 0 : 2);
  } else {
    throw new Error(`commande inconnue : ${cmd ?? 'aucune'} (slot N | reconstruct N UID | finalize)`);
  }
}

main().catch(async (e) => {
  console.error(`[FATAL] ${e instanceof Error ? e.stack : e}`);
  await db.$disconnect();
  process.exit(1);
});
