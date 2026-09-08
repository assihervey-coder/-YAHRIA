#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — MESURE PTA-002 ITÉRATION 8 — BOUCLE DE RÉPARATION CIBLÉE
// (EVO-000028 PROMOTED — décision HUMAN:reviewer, INV-227)
//
//   bun scripts/pta-repair-measure.ts slot N        — exécute UN slot
//   bun scripts/pta-repair-measure.ts reconstruct N UID — verdict DB
//   bun scripts/pta-repair-measure.ts finalize      — agrège + scelle
//
// Protocole (signé EVO-000028) : 3 runs (RUN-000013..15 attendus) sur le
// MÊME brief canonique Hub Mobile Money que it.7 (comparaison honnête),
// arbre canonique 13 fichiers, PYTHON, TRIPLE PORTE armée
// (boot v1 EVO-000016 + comportement v2 EVO-000025 + complétude v3
// EVO-000026) + few-shot EVO-000027 + boucle de réparation EVO-000028
// (1 cycle/run, ≤3 fichiers, 1 tentative/fichier, INFRA jamais réparé).
//
// Baseline documentée (it.7, RUN-000010/11/12, few-shot seul) :
//   0/3 runs SEALED, taux première passe 97,4 %, zéro INFRA.
//   RUN-000010 — syntaxe main.py:40 ; RUN-000011 — pytest 2/4 ;
//   RUN-000012 — uvicorn sans réponse 30s.
// Critères it.8 :
//   AC1 : ≥ 1/3 runs SEALED (cycle 0 ou cycle ≤1 — comptés SÉPARÉMENT,
//         la réparation doit être SCELLÉE en preuve ARTIFACT)
//   AC2 : taux première passe ≥ 60 % maintenu (non-régression few-shot ;
//         un fichier réparé n'est JAMAIS compté première passe)
//   AC3 : zéro réparation d'échec INFRA (INV-210)
//   AC4 : chaque cycle de réparation engagé est scellé (bilan preuve)
// ═══════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { captureAndPersist } from '../src/lib/yahria/evidence-store.ts';
import { isGoldenFewShotActive } from '../src/lib/yahria/golden-exemplar';
import { isRunRepairActive } from '../src/lib/yahria/run-repair-loop';

const BASE = 'http://127.0.0.1:3000';
const db = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

const CANONICAL_TREE = [
  'main.py', 'config.py', 'models.py', 'schemas.py', 'security.py',
  'gateways/__init__.py', 'gateways/base.py', 'gateways/notchpay.py', 'gateways/pesapal.py',
  'webhooks.py', 'tests/__init__.py', 'tests/test_api.py', 'requirements.txt',
].join('\n');

// Brief canonique identique à it.7 (reconstruction gouvernée documentée,
// INCIDENT EV-POLICY-000001) — comparaison it.7 ↔ it.8 toutes choses égales.
const CANONICAL_BRIEF = `API Hub de paiement Mobile Money (FastAPI) unifiant deux passerelles : NotchPay et PesaPal.
Routes : GET /health (statut du service : nom, timestamp, état healthy), GET /gateways (liste des passerelles configurées avec opérateurs supportés et statut), POST /initiate (initie un paiement : montant, devise, référence, opérateur, passerelle demandée — délègue à la passerelle choisie), POST /webhook/{gateway} (réception du webhook passerelle, vérification HMAC de la signature, accusé de réception).
Architecture : gateways/base.py (classe abstraite BaseGateway : initiate_payment, verify_webhook), gateways/notchpay.py et gateways/pesapal.py (implémentations concrètes), security.py (génération et vérification de signature HMAC), config.py (SECRET_KEY, HUB_NAME), models.py et schemas.py (modèles et schémas pydantic), webhooks.py (traitement des webhooks), main.py (routes de l'application), tests/test_api.py (pytest avec TestClient couvrant les 4 routes), requirements.txt minimal (fastapi, uvicorn, pydantic, httpx).
AUCUNE authentification utilisateur (pas de tokens, pas d'API keys). AUCUNE base de données : stockage en mémoire.`;

const FILES_EXPECTED = CANONICAL_TREE.split('\n').length; // 13
const RUN_TIMEOUT_MS = 25 * 60_000; // réparation bornée incluse (it.7 : 20 min)
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
  sealedFirstPass: boolean; // SEALED sans aucune boucle de réparation (cycle 0)
  sealedWithRepair: boolean; // SEALED après ≤1 cycle de réparation scellé
  classification: string; // 'SUCCÈS-CYCLE0' | 'SUCCÈS-CYCLE≤1' | 'MODÈLE' | 'INFRA-EXCLU'
  error: string | null;
  repairEngaged: boolean;
  repairKind: string | null; // 'BOOT' | 'BEHAVIORAL' | null
  repairTargets: string[];
  repairRepaired: string[];
  repairStillBroken: string[];
  repairEvidence: string[]; // preuves scellées actorId=yahria-repair-loop
  filesExpected: number;
  filesVerified: number;
  filesFirstPass: number; // attempts===1 && VERIFIED — une réparation n'est JAMAIS première passe
  firstPassRate: number;
  perFile: { path: string; state: string; attempts: number; bytes: number; repaired: boolean }[];
  gate3Evidence: string[];
  gates: Record<string, unknown> | null; // bootGate/behavioralGate du stats scellé
  replayedFrom: string[];
}

async function preflight(): Promise<void> {
  log('PRÉ-VOL — serveur, fabric, armement few-shot EVO-000027 + réparation EVO-000028');
  const sys = await (await fetch(`${BASE}/api/yahria/system`)).json();
  if (!sys.ok) throw new Error('serveur indisponible');
  const fabric = await (await fetch(`${BASE}/api/yahria/llm`)).json();
  const zai = fabric.providers.find((p: any) => p.id === 'zai');
  if (fabric.order[0] !== 'zai' || !zai?.configured || zai?.breaker !== 'CLOSED') {
    throw new Error(`fabric non saine : order=${JSON.stringify(fabric.order)} zai=${JSON.stringify(zai?.breaker)}`);
  }
  const fewShot = await isGoldenFewShotActive();
  if (!fewShot) throw new Error('few-shot EVO-000027 NON armé — mesure invalide');
  const repair = await isRunRepairActive();
  if (!repair) throw new Error('boucle EVO-000028 NON armée — mesure invalide (registre doit être PROMOTED)');
  log(`PRÉ-VOL OK — order=${JSON.stringify(fabric.order)} zai=CLOSED few-shot=ARMÉ réparation=ARMÉE`);
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

function parseStats(stats: string | null): Record<string, unknown> | null {
  if (!stats) return null;
  try { return JSON.parse(stats) as Record<string, unknown>; } catch { return null; }
}

async function verdictFromRun(
  runUid: string, slot: number, attempt: number, replayedFrom: string[],
  run: { state: string; error: string | null; stats: string | null },
): Promise<SlotVerdict> {
  const runRow = await db.generationRun.findUnique({ where: { runUid } });
  if (!runRow) throw new Error(`run ${runUid} introuvable — reconstruction impossible`);
  const files = await db.generatedFile.findMany({
    where: { runId: runRow.id },
    select: { path: true, state: true, attempts: true, bytes: true, note: true },
  });
  const verified = files.filter((f) => f.state === 'VERIFIED');
  const firstPass = verified.filter((f) => f.attempts === 1);

  // Preuves de la boucle de réparation (actorId yahria-repair-loop ; le runUid
  // vit dans le claim du BILAN et dans le payload des preuves par fichier).
  const repairEv = await db.evidence.findMany({
    where: {
      actorId: 'yahria-repair-loop',
      OR: [{ claim: { contains: runUid } }, { payload: { contains: runUid } }],
    },
    orderBy: { createdAt: 'asc' },
    select: { evidenceUid: true, claim: true, payload: true },
  });
  const engaged = repairEv.filter((e) =>
    /^Boucle de réparation EVO-000028 \((BOOT|BEHAVIORAL)\)/.test(e.claim) ||
    /^Fichier réparé par la boucle EVO-000028/.test(e.claim) ||
    /^Réparation EVO-000028 échouée/.test(e.claim));
  const repairEngaged = engaged.length > 0;
  const bilan = repairEv.find((e) => /^Boucle de réparation EVO-000028 \((BOOT|BEHAVIORAL)\)/.test(e.claim));
  let repairKind: string | null = null;
  let repairTargets: string[] = [];
  let repairRepaired: string[] = [];
  let repairStillBroken: string[] = [];
  if (bilan) {
    const m = /^Boucle de réparation EVO-000028 \((BOOT|BEHAVIORAL)\)/.exec(bilan.claim);
    repairKind = m ? m[1] : null;
    try {
      const p = JSON.parse(bilan.payload) as { targets?: { path: string }[]; repaired?: string[]; stillBroken?: { path: string }[] };
      repairTargets = (p.targets ?? []).map((t) => t.path);
      repairRepaired = p.repaired ?? [];
      repairStillBroken = (p.stillBroken ?? []).map((s) => s.path);
    } catch { /* payload illisible : les preuves par fichier restent la source */ }
  }
  // Complément : réparations visibles dans les notes de fichiers (source DB)
  const repairedByNote = files
    .filter((f) => (f.note ?? '').includes('réparation EVO-000028') && !(f.note ?? '').includes('échouée'))
    .map((f) => f.path);
  for (const p of repairedByNote) if (!repairRepaired.includes(p)) repairRepaired.push(p);

  const gates = parseStats(run.stats);
  const classification = run.state === 'SEALED'
    ? (repairEngaged ? 'SUCCÈS-CYCLE≤1' : 'SUCCÈS-CYCLE0')
    : 'MODÈLE';

  return {
    slot, runUid, state: run.state, attempts: attempt,
    sealedFirstPass: run.state === 'SEALED' && !repairEngaged,
    sealedWithRepair: run.state === 'SEALED' && repairEngaged,
    classification,
    error: run.error,
    repairEngaged, repairKind, repairTargets, repairRepaired, repairStillBroken,
    repairEvidence: repairEv.map((e) => `${e.evidenceUid}: ${e.claim.slice(0, 160)}`),
    filesExpected: FILES_EXPECTED,
    filesVerified: verified.length,
    filesFirstPass: firstPass.length,
    firstPassRate: verified.length ? firstPass.length / FILES_EXPECTED : 0,
    perFile: files.map((f) => ({
      path: f.path, state: f.state, attempts: f.attempts, bytes: f.bytes,
      repaired: (f.note ?? '').includes('réparation EVO-000028'),
    })),
    gate3Evidence: (await db.evidence.findMany({
      where: { claim: { contains: runUid }, actorId: 'yahria-completeness-gate' },
      select: { evidenceUid: true, claim: true },
    })).map((g) => `${g.evidenceUid}: ${g.claim.slice(0, 140)}`),
    gates,
    replayedFrom,
  };
}

async function collectVerdict(slot: number): Promise<SlotVerdict> {
  const replayedFrom: string[] = [];
  let attempt = 0;
  for (;;) {
    attempt++;
    const suffix = attempt > 1 ? ` — rejeu INFRA #${attempt - 1}` : '';
    const name = `PTA-002 it.8 (réparation EVO-000028) run ${slot}/3${suffix} — Hub Mobile Money, triple porte + boucle bornée`;
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
        category: 'INCIDENT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'pta-repair-measure',
        claim: `PTA-002 it.8 slot ${slot} : run ${runUid} classé ${cls} — exclu des métriques d'apprentissage (INV-210), rejeu prévu`,
        payload: { runUid, slot, classification: cls, error: (run.error ?? '').slice(0, 500) },
        traceId: `TRACE-PTA002-IT8-S${slot}`,
      });
      if (attempt <= MAX_REPLAYS_PER_SLOT) continue;
      log(`Slot ${slot} : budget de rejeus épuisé (${MAX_REPLAYS_PER_SLOT}) — slot marqué INFRA-EXCLU`);
      return {
        slot, runUid, state: run.state, attempts: attempt, sealedFirstPass: false,
        sealedWithRepair: false, classification: 'INFRA-EXCLU', error: run.error,
        repairEngaged: false, repairKind: null, repairTargets: [], repairRepaired: [],
        repairStillBroken: [], repairEvidence: [], filesExpected: FILES_EXPECTED,
        filesVerified: 0, filesFirstPass: 0, firstPassRate: 0, perFile: [],
        gate3Evidence: [], gates: null, replayedFrom,
      };
    }

    return await verdictFromRun(runUid, slot, attempt, replayedFrom, run);
  }
}

const VERDICTS_FILE = 'scripts/repair-verdicts.jsonl';

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
    log(`Slot ${v.slot} reconstruit depuis ${b} : ${v.state} (${v.classification}) — ${v.filesFirstPass}/${v.filesExpected} première passe${v.repairEngaged ? ` — réparation ${v.repairKind} : ${v.repairRepaired.length} réparé(s)` : ''}`);
    await db.$disconnect();
  } else if (cmd === 'finalize') {
    if (!(await Bun.file(VERDICTS_FILE).exists())) throw new Error('aucun verdict enregistré');
    const verdicts = (await Bun.file(VERDICTS_FILE).text()).split('\n').filter(Boolean).map((l) => JSON.parse(l) as SlotVerdict);
    verdicts.sort((x, y) => x.slot - y.slot);

    const counted = verdicts.filter((v) => v.classification !== 'INFRA-EXCLU');
    const sealedCycle0 = counted.filter((v) => v.sealedFirstPass).length;
    const sealedRepair = counted.filter((v) => v.sealedWithRepair).length;
    const sealedTotal = sealedCycle0 + sealedRepair;
    const repairsEngaged = counted.filter((v) => v.repairEngaged).length;
    const totalFirstPass = counted.reduce((s, v) => s + v.filesFirstPass, 0);
    const totalExpected = counted.length * FILES_EXPECTED;
    const aggregateRate = totalExpected ? totalFirstPass / totalExpected : 0;
    // AC3 — zéro réparation d'échec INFRA : aucun slot INFRA-EXCLU ne porte
    // une preuve de réparation engagée (la boucle doit sauter, jamais réparer).
    const infraSlots = verdicts.filter((v) => v.classification === 'INFRA-EXCLU');
    const infraRepairViolations = infraSlots.filter((v) => v.repairEngaged).length;
    // AC4 — chaque cycle engagé est scellé (bilan preuve présent)
    const engagedWithoutBilan = counted.filter((v) =>
      v.repairEngaged && !v.repairEvidence.some((e) => /EV-[A-Z]+-\d+: Boucle de réparation EVO-000028 \((BOOT|BEHAVIORAL)\)/.test(e))).length;

    console.log('\n═══ RÉSULTATS PTA-002 it.8 — BOUCLE DE RÉPARATION EVO-000028 ═══');
    for (const v of verdicts) {
      console.log(`\nSlot ${v.slot} — ${v.runUid} (${v.attempts} tentative(s)) : ${v.state} — ${v.classification}`);
      console.log(`  fichiers vérifiés : ${v.filesVerified}/${v.filesExpected} — première passe : ${v.filesFirstPass}/${v.filesExpected} (${(v.firstPassRate * 100).toFixed(0)} %)`);
      if (v.repairEngaged) {
        console.log(`  boucle EVO-000028 : ENGAGÉE (${v.repairKind ?? '?'}) — cibles : ${v.repairTargets.join(', ') || '—'}`);
        console.log(`    réparés : ${v.repairRepaired.join(', ') || '—'} | persistants : ${v.repairStillBroken.join(', ') || '—'}`);
      } else {
        console.log('  boucle EVO-000028 : non engagée');
      }
      if (v.replayedFrom.length) console.log(`  rejeus INFRA exclus (INV-210) : ${v.replayedFrom.join(', ')}`);
      if (v.error) console.log(`  erreur : ${v.error.slice(0, 220)}`);
      for (const g of v.gate3Evidence) console.log(`  porte v3 : ${g}`);
      for (const g of v.repairEvidence) console.log(`  réparation : ${g}`);
      for (const f of v.perFile) console.log(`    ${f.state === 'VERIFIED' ? '✓' : '✗'} ${f.path} — tentatives ${f.attempts}, ${f.bytes} o${f.repaired ? ' — RÉPARÉ' : ''}`);
    }
    console.log(`\nMétriques agrégées (${counted.length}/3 slots comptés — INFRA exclus) :`);
    console.log(`  Runs SEALED total          : ${sealedTotal}/${counted.length} (baseline it.7 : 0/3)`);
    console.log(`    — SEALED cycle 0 (sans réparation)   : ${sealedCycle0}`);
    console.log(`    — SEALED cycle ≤1 (réparation scellée): ${sealedRepair}`);
    console.log(`  Boucles de réparation engagées : ${repairsEngaged}`);
    console.log(`  Taux première passe fichiers   : ${(aggregateRate * 100).toFixed(1)} % (it.7 : 97,4 % — réparation ≠ première passe)`);
    const ac1 = sealedTotal >= 1;
    const ac2 = aggregateRate >= 0.6;
    const ac3 = infraRepairViolations === 0;
    const ac4 = engagedWithoutBilan === 0;
    console.log(`  AC1 (≥1 run SEALED, réparation ≤1 cycle scellée) : ${ac1 ? 'PASS' : 'FAIL'}`);
    console.log(`  AC2 (taux première passe ≥ 60 %)                 : ${ac2 ? 'PASS' : 'FAIL'}`);
    console.log(`  AC3 (zéro réparation INFRA — INV-210)            : ${ac3 ? 'PASS' : 'FAIL'}`);
    console.log(`  AC4 (tout cycle engagé scellé en preuve)         : ${ac4 ? 'PASS' : 'FAIL'}`);

    await captureAndPersist({
      category: 'ARTIFACT', criticality: 'HIGH', actorType: 'AGENT', actorId: 'pta-repair-measure',
      claim: `PTA-002 itération 8 (boucle de réparation EVO-000028, few-shot EVO-000027 actif) : ${sealedTotal}/${counted.length} runs SEALED (cycle 0 : ${sealedCycle0}, cycle ≤1 scellé : ${sealedRepair}), ${repairsEngaged} boucle(s) engagée(s), taux première passe ${(aggregateRate * 100).toFixed(1)} % sous triple porte — AC1 ${ac1 ? 'PASS' : 'FAIL'}, AC2 ${ac2 ? 'PASS' : 'FAIL'}, AC3 ${ac3 ? 'PASS' : 'FAIL'}, AC4 ${ac4 ? 'PASS' : 'FAIL'} (baseline it.7 : 0/3 SEALED, 97,4 %)`,
      payload: {
        repairLoop: 'EVO-000028 PROMOTED (HUMAN:reviewer)', fewShot: 'EVO-000027 PROMOTED (HUMAN:reviewer)',
        baseline: { runs: 'RUN-000010/11/12 (it.7)', sealedFirstPass: '0/3', firstPassRate: '97,4 %' },
        verdicts, aggregate: { sealedTotal, sealedCycle0, sealedRepair, repairsEngaged, countedSlots: counted.length, totalFirstPass, totalExpected, aggregateRate, infraRepairViolations, engagedWithoutBilan, ac1, ac2, ac3, ac4 },
      },
      traceId: 'TRACE-PTA002-IT8',
    });

    await Bun.write('scripts/repair-measure-result.json', JSON.stringify({
      sealedTotal, sealedCycle0, sealedRepair, repairsEngaged, countedSlots: counted.length,
      aggregateRate, ac1, ac2, ac3, ac4, verdicts,
    }, null, 2));
    log(`Preuve scellée + résultat JSON écrit — fin de mesure (${ac1 && ac2 && ac3 && ac4 ? 'ACCEPTATION REMPLIE' : 'acceptation partielle'})`);
    await db.$disconnect();
    process.exit(ac1 && ac2 && ac3 && ac4 ? 0 : 2);
  } else {
    throw new Error(`commande inconnue : ${cmd ?? 'aucune'} (slot N | reconstruct N UID | finalize)`);
  }
}

main().catch(async (e) => {
  console.error(`[FATAL] ${e instanceof Error ? e.stack : e}`);
  await db.$disconnect();
  process.exit(1);
});
