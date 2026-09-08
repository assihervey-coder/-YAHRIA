#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — MESURE PTA-002 ITÉRATION 12 — CONTRATS DE REGISTRE + FIDÉLITÉ
// BOOT (EVO-000032 PROMOTED — décision HUMAN:reviewer, INV-227) enrichit la
// boucle EVO-000028 + fidélité EVO-000029 + budget par porte/pydantic v2
// EVO-000030 + fermeture des dépendances EVO-000031 + few-shot EVO-000027
// (toutes PROMOTED).
//
//   bun scripts/pta-repair-measure-it13.ts slot N        — exécute UN slot
//   bun scripts/pta-repair-measure-it13.ts reconstruct N UID — verdict DB
//   bun scripts/pta-repair-measure-it13.ts finalize      — agrège + scelle
//
// Protocole : 3 runs sur le MÊME brief canonique Hub Mobile Money (13
// fichiers, PYTHON), TRIPLE PORTE + budget PAR PORTE (≤1 cycle/porte,
// ≤2 cycles/run) + contrat pydantic v2 + contrat comportemental +
// FERMETURE DES DÉPENDANCES (imports réels d'abord, 5 frères / 3600 car.) +
// CONTRATS DE REGISTRE (clés dict top-level visibles, ≤8 lignes/110 car.) +
// FIDÉLITÉ BOOT (stderr tête 800 + queue 1200 ; frames hors arbre exclues
// du ciblage — pesapal.py:10 ne peut plus être raté).
//
// Baselines documentées :
//   it.7 (few-shot seul)          : 0/3 SEALED, 97,4 % première passe.
//   it.8 (boucle EVO-000028)      : 0/3 SEALED, 53,8 % — 3 causes racines
//                                   EV-ARTIFACT-000212.
//   it.9 (fidélité EVO-000029)    : 0/3 SEALED, 84,6 % — causes prouvées :
//                                   budget 1 cycle/run épuisé par la 1re
//                                   porte (RUN-000027) + from_orm() v1
//                                   mort + payloads test↔handler
//                                   divergents (RUN-000028).
//   it.10 (budget/porte + v2)     : 0/3 SEALED, 20,5 % — AC3/AC4 PASS ;
//                                   fabric DÉGRADÉE — AC2 non comparable ;
//                                   appels vers contrats invisibles
//                                   (RUN-000035 verify_hmac, RUN-000041
//                                   3 appels hallucinés).
//   it.11 (fermeture dépendances) : 0/3 SEALED, 25,6 % — AC3/AC4 PASS ;
//                                   fabric en rafales — AC2 non comparable ;
//                                   EVO-000031 PROUVÉE en live (2-args +
//                                   verify_hmac corrects, meilleur slot
//                                   2 failed/2 passed) ; 2 NOUVELLES causes
//                                   prouvées : clés de registre invisibles
//                                   (« notch » vs « notchpay », RUN-000042)
//                                   + frames workspace perdues/parasitées
//                                   (pesapal.py:10, RUN-000044).
// Critères it.13 :
//   AC1 : ≥ 1/3 runs SEALED — SEALED cycle 0 / cycle ≤1 / cycle ≤2
//         comptés SÉPARÉMENT (la réparation doit être SCELLÉE en preuve)
//   AC2 : taux première passe ≥ 60 % sur fabric SAINE (comparabilité
//         it.9 ; si fabric dégradée, comparabilité déclarée non valide —
//         leçon it.10) ; un fichier réparé n'est JAMAIS compté 1re passe
//   AC3 : zéro réparation INFRA (INV-210) ET zéro run à plus de
//         2 cycles de réparation (bornage respecté)
//   AC4 : chaque cycle de réparation engagé est scellé (bilan preuve)
// ═══════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { captureAndPersist } from '../src/lib/yahria/evidence-store.ts';
import { isGoldenFewShotActive } from '../src/lib/yahria/golden-exemplar';
import { isRunRepairActive, isDependencyClosureActive, isRegistryContractsActive } from '../src/lib/yahria/run-repair-loop';
import { isBootFidelityActive } from '../src/lib/yahria/boot-gate';
import { isCrossContractsActive, isReverseDependentsActive, isSealedFidelityActive, isFabricBackoffActive } from '../src/lib/yahria/cross-contracts';
import { isBudgetPerGateActive } from '../src/lib/yahria/repair-budget';

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
// INCIDENT EV-POLICY-000001) — comparaison it.7 ↔ it.8 ↔ it.9 ↔ it.11
// toutes choses égales.
const CANONICAL_BRIEF = `API Hub de paiement Mobile Money (FastAPI) unifiant deux passerelles : NotchPay et PesaPal.
Routes : GET /health (statut du service : nom, timestamp, état healthy), GET /gateways (liste des passerelles configurées avec opérateurs supportés et statut), POST /initiate (initie un paiement : montant, devise, référence, opérateur, passerelle demandée — délègue à la passerelle choisie), POST /webhook/{gateway} (réception du webhook passerelle, vérification HMAC de la signature, accusé de réception).
Architecture : gateways/base.py (classe abstraite BaseGateway : initiate_payment, verify_webhook), gateways/notchpay.py et gateways/pesapal.py (implémentations concrètes), security.py (génération et vérification de signature HMAC), config.py (SECRET_KEY, HUB_NAME), models.py et schemas.py (modèles et schémas pydantic), webhooks.py (traitement des webhooks), main.py (routes de l'application), tests/test_api.py (pytest avec TestClient couvrant les 4 routes), requirements.txt minimal (fastapi, uvicorn, pydantic, httpx).
AUCUNE authentification utilisateur (pas de tokens, pas d'API keys). AUCUNE base de données : stockage en mémoire.`;

const FILES_EXPECTED = CANONICAL_TREE.split('\n').length; // 13
const RUN_TIMEOUT_MS = 30 * 60_000; // 2 cycles de réparation possibles (it.9 : 25 min)
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
  sealedWithRepair: boolean; // SEALED après 1 ou 2 cycles de réparation scellés
  classification: string; // 'SUCCÈS-CYCLE0' | 'SUCCÈS-CYCLE≤1' | 'SUCCÈS-CYCLE≤2' | 'MODÈLE' | 'INFRA-EXCLU'
  error: string | null;
  repairEngaged: boolean;
  repairCycles: number; // 0 | 1 | 2 — bilans scellés actorId=yahria-repair-loop
  repairCyclesStats: number | null; // cross-check stats SEALED (champ EVO-000030)
  repairBudgetMode: string | null; // 'PER-GATE (EVO-000030)' | 'LEGACY (EVO-000028)'
  repairKinds: string[]; // ['BOOT'] | ['BEHAVIORAL'] | ['BOOT','BEHAVIORAL'] | []
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
  gates: Record<string, unknown> | null; // stats scellé (inclut repairCycles EVO-000030)
  replayedFrom: string[];
}

async function preflight(): Promise<void> {
  log('PRÉ-VOL — serveur, fabric, armement few-shot EVO-000027 + boucle EVO-000028 + fidélité EVO-000029 + budget par porte EVO-000030 + fermeture EVO-000031 + registres/fidélité-boot EVO-000032 + CONTRATS CROISÉS (génération/dépendants inverses/scellé fidèle/backoff) EVO-000033');
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
  const evo29 = await db.evolutionProposal.findUnique({ where: { proposalUid: 'EVO-000029' }, select: { state: true, decidedBy: true } });
  if (evo29?.state !== 'PROMOTED') throw new Error('EVO-000029 NON PROMOTED — fidélité+contrats NON armés, mesure invalide');
  const budgetPerGate = await isBudgetPerGateActive();
  if (!budgetPerGate) throw new Error('EVO-000030 NON PROMOTED — budget par porte + pydantic v2 NON armés, mesure invalide');
  const closure = await isDependencyClosureActive();
  if (!closure) throw new Error('EVO-000031 NON PROMOTED — fermeture des dépendances NON armée, mesure invalide');
  const registry = await isRegistryContractsActive();
  if (!registry) throw new Error('EVO-000032 NON PROMOTED — contrats de registre NON armés, mesure invalide');
  const bootFidelity = await isBootFidelityActive();
  if (!bootFidelity) throw new Error('EVO-000032 NON PROMOTED — fidélité boot NON armée, mesure invalide');
  const evo33 = await db.evolutionProposal.findUnique({ where: { proposalUid: 'EVO-000033' }, select: { state: true, decidedBy: true } });
  if (evo33?.state !== 'PROMOTED') throw new Error('EVO-000033 NON PROMOTED — contrats croisés NON armés, mesure invalide');
  const cross = await isCrossContractsActive();
  const reverse = await isReverseDependentsActive();
  const sealed = await isSealedFidelityActive();
  const backoff = await isFabricBackoffActive();
  if (!cross || !reverse || !sealed || !backoff) throw new Error(`EVO-000033 armement incomplet : cross=${cross} reverse=${reverse} sealed=${sealed} backoff=${backoff} — mesure invalide`);
  log(`PRÉ-VOL OK — order=${JSON.stringify(fabric.order)} zai=CLOSED few-shot=ARMÉ boucle=ARMÉE fidélité=ARMÉE budget-par-porte+pydantic-v2=ARMÉS fermeture-dépendances=ARMÉE registres=ARMÉS fidélité-boot=ARMÉE croisés=ARMÉS dépendants-inverses=ARMÉS scellé-fidèle=ARMÉ backoff-fabric=ARMÉ (EVO-000029 ${evo29.state} par ${evo29.decidedBy}, EVO-000030/31/32/33 PROMOTED par ${evo33.decidedBy})`);
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
  // EVO-000030 — TOUS les bilans du run (≤1 par PORTE, ≤2 cycles/run) :
  // chaque bilan scellé = 1 cycle de réparation engagé.
  const bilans = repairEv.filter((e) => /^Boucle de réparation EVO-000028 \((BOOT|BEHAVIORAL)\)/.test(e.claim));
  const repairCycles = bilans.length;
  const repairKinds = bilans
    .map((e) => (/^Boucle de réparation EVO-000028 \((BOOT|BEHAVIORAL)\)/.exec(e.claim))?.[1] ?? '?')
    .filter((k, i, a) => a.indexOf(k) === i);
  const repairTargets: string[] = [];
  const repairRepaired: string[] = [];
  const repairStillBroken: string[] = [];
  for (const bilan of bilans) {
    try {
      const p = JSON.parse(bilan.payload) as { targets?: { path: string }[]; repaired?: string[]; stillBroken?: { path: string }[] };
      for (const t of (p.targets ?? []).map((t) => t.path)) if (!repairTargets.includes(t)) repairTargets.push(t);
      for (const r of (p.repaired ?? [])) if (!repairRepaired.includes(r)) repairRepaired.push(r);
      for (const s of (p.stillBroken ?? []).map((s) => s.path)) if (!repairStillBroken.includes(s)) repairStillBroken.push(s);
    } catch { /* payload illisible : les preuves par fichier restent la source */ }
  }
  // Complément : réparations visibles dans les notes de fichiers (source DB)
  const repairedByNote = files
    .filter((f) => (f.note ?? '').includes('réparation EVO-000028') && !(f.note ?? '').includes('échouée'))
    .map((f) => f.path);
  for (const p of repairedByNote) if (!repairRepaired.includes(p)) repairRepaired.push(p);

  const gates = parseStats(run.stats);
  const statsCycles = gates && typeof (gates as any).repairCycles === 'number' ? (gates as any).repairCycles as number : null;
  const statsMode = gates && typeof (gates as any).repairBudgetMode === 'string' ? (gates as any).repairBudgetMode as string : null;
  if (statsCycles !== null && statsCycles !== repairCycles) {
    log(`⚠ divergence cycles : bilans scellés=${repairCycles} vs stats=${statsCycles} (${runUid}) — les bilans font foi`);
  }
  const classification = run.state === 'SEALED'
    ? (repairCycles === 0 ? 'SUCCÈS-CYCLE0' : repairCycles === 1 ? 'SUCCÈS-CYCLE≤1' : 'SUCCÈS-CYCLE≤2')
    : 'MODÈLE';

  return {
    slot, runUid, state: run.state, attempts: attempt,
    sealedFirstPass: run.state === 'SEALED' && !repairEngaged,
    sealedWithRepair: run.state === 'SEALED' && repairEngaged,
    classification,
    error: run.error,
    repairEngaged, repairCycles, repairCyclesStats: statsCycles, repairBudgetMode: statsMode, repairKinds,
    repairTargets, repairRepaired, repairStillBroken,
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
    const name = `PTA-002 it.13 (contrats croisés + scellé fidèle + backoff fabric EVO-000033) run ${slot}/3${suffix} — Hub Mobile Money, triple porte + boucle bornée`;
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
        category: 'INCIDENT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'pta-repair-measure-it13',
        claim: `PTA-002 it.13 slot ${slot} : run ${runUid} classé ${cls} — exclu des métriques d'apprentissage (INV-210), rejeu prévu`,
        payload: { runUid, slot, classification: cls, error: (run.error ?? '').slice(0, 500) },
        traceId: `TRACE-PTA002-IT13-S${slot}`,
      });
      if (attempt <= MAX_REPLAYS_PER_SLOT) continue;
      log(`Slot ${slot} : budget de rejeus épuisé (${MAX_REPLAYS_PER_SLOT}) — slot marqué INFRA-EXCLU`);
      return {
        slot, runUid, state: run.state, attempts: attempt, sealedFirstPass: false,
        sealedWithRepair: false, classification: 'INFRA-EXCLU', error: run.error,
        repairEngaged: false, repairCycles: 0, repairCyclesStats: null, repairBudgetMode: null, repairKinds: [],
        repairTargets: [], repairRepaired: [], repairStillBroken: [], repairEvidence: [],
        filesExpected: FILES_EXPECTED, filesVerified: 0, filesFirstPass: 0, firstPassRate: 0,
        perFile: [], gate3Evidence: [], gates: null, replayedFrom,
      };
    }

    return await verdictFromRun(runUid, slot, attempt, replayedFrom, run);
  }
}

const VERDICTS_FILE = 'scripts/repair-verdicts-it13.jsonl';

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
    log(`Slot ${v.slot} reconstruit depuis ${b} : ${v.state} (${v.classification}) — ${v.filesFirstPass}/${v.filesExpected} première passe${v.repairEngaged ? ` — ${v.repairCycles} cycle(s) [${v.repairKinds.join('+')}] : ${v.repairRepaired.length} réparé(s)` : ''}`);
    await db.$disconnect();
  } else if (cmd === 'finalize') {
    if (!(await Bun.file(VERDICTS_FILE).exists())) throw new Error('aucun verdict enregistré');
    const verdicts = (await Bun.file(VERDICTS_FILE).text()).split('\n').filter(Boolean).map((l) => JSON.parse(l) as SlotVerdict);
    verdicts.sort((x, y) => x.slot - y.slot);
    // garde harnais : les 3 slots DOIVENT avoir un verdict (counted ou INFRA-EXCLU)
    // — aucun agrégat partiel scellé (leçon it.10 tentative 2 : fabric OPEN a
    // sauté des slots et finalize aurait scellé 1/3)
    const missingSlots = [1, 2, 3].filter((s) => !verdicts.some((v) => v.slot === s));
    if (missingSlots.length > 0) {
      throw new Error(`finalize refusé — slots sans verdict : ${missingSlots.join(', ')} (rejouer : slot N) — aucun agrégat partiel ne sera scellé`);
    }

    const counted = verdicts.filter((v) => v.classification !== 'INFRA-EXCLU');
    const sealedCycle0 = counted.filter((v) => v.classification === 'SUCCÈS-CYCLE0').length;
    const sealedCycle1 = counted.filter((v) => v.classification === 'SUCCÈS-CYCLE≤1').length;
    const sealedCycle2 = counted.filter((v) => v.classification === 'SUCCÈS-CYCLE≤2').length;
    const sealedTotal = sealedCycle0 + sealedCycle1 + sealedCycle2;
    const repairsEngaged = counted.filter((v) => v.repairEngaged).length;
    const totalFirstPass = counted.reduce((s, v) => s + v.filesFirstPass, 0);
    const totalExpected = counted.length * FILES_EXPECTED;
    const aggregateRate = totalExpected ? totalFirstPass / totalExpected : 0;
    // AC3 — zéro réparation INFRA + bornage ≤2 cycles/run respecté
    const infraSlots = verdicts.filter((v) => v.classification === 'INFRA-EXCLU');
    const infraRepairViolations = infraSlots.filter((v) => v.repairEngaged).length;
    const runsOverBudget = counted.filter((v) => v.repairCycles > 2).length;
    // AC4 — chaque cycle engagé est scellé (bilan preuve présent)
    const engagedWithoutBilan = counted.filter((v) =>
      v.repairEngaged && !v.repairEvidence.some((e) => /EV-[A-Z]+-\d+: Boucle de réparation EVO-000028 \((BOOT|BEHAVIORAL)\)/.test(e))).length;
    // cohérence budget : le mode scellé doit être PER-GATE (EVO-000030 armé)
    const wrongMode = counted.filter((v) => v.repairBudgetMode !== null && !v.repairBudgetMode.includes('PER-GATE')).length;

    console.log('\n═══ RÉSULTATS PTA-002 it.13 — CONTRATS CROISÉS INTER-CO-GÉNÉRÉS + SCELLÉ FIDÈLE + BACKOFF FABRIC (EVO-000033) ═══');
    for (const v of verdicts) {
      console.log(`\nSlot ${v.slot} — ${v.runUid} (${v.attempts} tentative(s)) : ${v.state} — ${v.classification}`);
      console.log(`  fichiers vérifiés : ${v.filesVerified}/${v.filesExpected} — première passe : ${v.filesFirstPass}/${v.filesExpected} (${(v.firstPassRate * 100).toFixed(0)} %)`);
      if (v.repairEngaged) {
        console.log(`  boucle EVO-000028 : ENGAGÉE ${v.repairCycles} cycle(s) [${v.repairKinds.join(' + ') || '?'}] — cibles : ${v.repairTargets.join(', ') || '—'}`);
        console.log(`    réparés : ${v.repairRepaired.join(', ') || '—'} | persistants : ${v.repairStillBroken.join(', ') || '—'}`);
        if (v.repairCyclesStats !== null && v.repairCyclesStats !== v.repairCycles) console.log(`    ⚠ stats SEALED rapporte ${v.repairCyclesStats} cycle(s) — divergence à investiguer`);
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
    console.log(`  Runs SEALED total          : ${sealedTotal}/${counted.length} (baselines it.7 : 0/3 · it.8 : 0/3 · it.9 : 0/3 · it.10 : 0/3 · it.11 : 0/3)`);
    console.log(`    — SEALED cycle 0 (sans réparation)      : ${sealedCycle0}`);
    console.log(`    — SEALED cycle ≤1 (1 réparation scellée) : ${sealedCycle1}`);
    console.log(`    — SEALED cycle ≤2 (2 réparations scellées): ${sealedCycle2}`);
    console.log(`  Runs avec boucle engagée   : ${repairsEngaged}`);
    console.log(`  Taux première passe fichiers : ${(aggregateRate * 100).toFixed(1)} % (it.7 : 97,4 % · it.8 : 53,8 % · it.9 : 84,6 % · it.11 : 25,6 % — réparation ≠ première passe)`);
    const ac1 = sealedTotal >= 1;
    const ac2 = aggregateRate >= 0.6;
    const ac3 = infraRepairViolations === 0 && runsOverBudget === 0;
    const ac4 = engagedWithoutBilan === 0;
    console.log(`  AC1 (≥1 run SEALED — cycle 0 / ≤1 / ≤2 comptés séparément, réparation scellée) : ${ac1 ? 'PASS' : 'FAIL'}`);
    console.log(`  AC2 (taux première passe ≥ 60 %)                                              : ${ac2 ? 'PASS' : 'FAIL'}`);
    console.log(`  AC3 (zéro réparation INFRA — INV-210 — et zéro run > 2 cycles)                 : ${ac3 ? 'PASS' : 'FAIL'}`);
    console.log(`  AC4 (tout cycle engagé scellé en preuve)                                      : ${ac4 ? 'PASS' : 'FAIL'}`);
    if (wrongMode > 0) console.log(`  ⚠ ${wrongMode} run(s) scellé(s) hors mode PER-GATE — budget EVO-000030 mal appliqué`);

    await captureAndPersist({
      category: 'ARTIFACT', criticality: 'HIGH', actorType: 'AGENT', actorId: 'pta-repair-measure-it13',
      claim: `PTA-002 itération 12 (contrats croisés + scellé fidèle + backoff fabric EVO-000033, contrats de registre + fidélité boot EVO-000032, fermeture des dépendances EVO-000031, budget de réparation PAR PORTE ≤2 cycles/run + contrat pydantic v2 EVO-000030, boucle EVO-000028, fidélité EVO-000029, few-shot EVO-000027 actifs) : ${sealedTotal}/${counted.length} runs SEALED (cycle 0 : ${sealedCycle0}, cycle ≤1 : ${sealedCycle1}, cycle ≤2 : ${sealedCycle2}), ${repairsEngaged} run(s) avec boucle engagée, taux première passe ${(aggregateRate * 100).toFixed(1)} % sous triple porte — AC1 ${ac1 ? 'PASS' : 'FAIL'}, AC2 ${ac2 ? 'PASS' : 'FAIL'}, AC3 ${ac3 ? 'PASS' : 'FAIL'}, AC4 ${ac4 ? 'PASS' : 'FAIL'} (baselines it.7 : 0/3, 97,4 % · it.8 : 0/3, 53,8 % · it.9 : 0/3, 84,6 % · it.10 : 0/3, 20,5 % dégradée · it.11 : 0/3, 25,6 % dégradée · it.12 : 0/2, 0 % dégradée (slot 3 INFRA-EXCLU))`,
      payload: {
        registryContracts: 'EVO-000032 PROMOTED (HUMAN:reviewer) — clés dict top-level visibles (≤8 lignes/110 car.)',
        crossContracts: 'EVO-000033 PROMOTED (HUMAN:reviewer) — registre de génération incrémental (routes+retours+registres ≤3600) + arêtes dependsOn dérivées (ordre topologique) + dépendants inverses et assertions de test en réparation + scellé de porte 2400 tête+queue + backoff fabric ≤90s (INV-210 intact)',
        bootFidelity: 'EVO-000032 PROMOTED (HUMAN:reviewer) — stderr tête 800 + queue 1200, frames hors arbre exclues du ciblage',
        dependencyClosure: 'EVO-000031 PROMOTED (HUMAN:reviewer) — imports réels d\'abord, 5 frères / 3600 car.',
        budgetPerGate: 'EVO-000030 PROMOTED (HUMAN:reviewer) — ≤1 cycle/porte, ≤2 cycles/run + pydantic v2 + contrat comportemental',
        repairLoop: 'EVO-000028 PROMOTED (HUMAN:reviewer)', fidelity: 'EVO-000029 PROMOTED (HUMAN:reviewer)', fewShot: 'EVO-000027 PROMOTED (HUMAN:reviewer)',
        baselines: {
          it7: { runs: 'RUN-000010/11/12', sealedFirstPass: '0/3', firstPassRate: '97,4 %' },
          it8: { runs: 'RUN-000013..20', sealed: '0/3', firstPassRate: '53,8 %', rootCauses: 'EV-ARTIFACT-000212' },
          it9: { runs: 'RUN-000027/28/29', sealed: '0/3', firstPassRate: '84,6 %', rootCauses: 'budget 1 cycle/run épuisé + from_orm() v1 + payloads divergents' },
          it10: { runs: 'RUN-000035/40/41', sealed: '0/3', firstPassRate: '20,5 %', rootCauses: 'contrats invisibles (fabric dégradée)' },
          it11: { runs: 'RUN-000042/44/49', sealed: '0/3', firstPassRate: '25,6 %', rootCauses: 'clés de registre invisibles (RUN-000042) + frames workspace perdues (RUN-000044)' },
        },
        verdicts, aggregate: { sealedTotal, sealedCycle0, sealedCycle1, sealedCycle2, repairsEngaged, countedSlots: counted.length, totalFirstPass, totalExpected, aggregateRate, infraRepairViolations, runsOverBudget, engagedWithoutBilan, wrongMode, ac1, ac2, ac3, ac4 },
      },
      traceId: 'TRACE-PTA002-IT13',
    });

    await Bun.write('scripts/repair-measure-result-it13.json', JSON.stringify({
      sealedTotal, sealedCycle0, sealedCycle1, sealedCycle2, repairsEngaged, countedSlots: counted.length,
      aggregateRate, ac1, ac2, ac3, ac4, wrongMode, verdicts,
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
