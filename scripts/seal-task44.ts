// ═══════════════════════════════════════════════════════════════════
// YAHRIA — TASK 44 : scellé des verdicts it.13 (commande HUMAN
// « repair-verdicts-it13 ») — lecture honnête de l'agrégat auto-scellé
// EV-ARTIFACT-001134 par le harnais + dossier fabric it.13 + canarie
// live au moment du scellement.
//
// Constats scellés ici :
//  (1) EV-ARTIFACT-001134 (auto-finalize harnais 02:44:24Z) porte DEUX
//      défauts d'agrégat : titre « itération 12 » (hardcode hérité du
//      harnais it.12 — le contenu est correct : TRACE-PTA002-IT13,
//      EVO-000033, RUN-000061/64/67) et « AC3 PASS, AC4 PASS » VRAIS
//      PAR VACUITÉ sur 0 slot comptable (0/0) → lecture honnête :
//      AC3/AC4 NON ÉVALUABLES.
//  (2) Dossier fabric it.13 : saturation FOURNISSEUR TOTALE et
//      PERSISTANTE (chaque vrai appel réseau en 429 pendant 3 h 17 +
//      canarie encore 429 au scellement) — classe différente des
//      rafales it.10/11/12 ; FB prouvé mécaniquement (117 waits),
//      GC/XR/BF3 NON EXERCÉS (0 fichier généré).
//  (3) Fixes harnais (classe fidélité mesure BF-EV1/S1, outillage) :
//      canarie réseau au pré-vol, garde finalize 0 slot comptable,
//      titre it.13.
// ═══════════════════════════════════════════════════════════════════
import { captureAndPersist } from '../src/lib/yahria/evidence-store.ts';
import { pingProvider } from '../src/lib/yahria/llm-fabric';
import { PrismaClient } from '@prisma/client';

const TRACE = 'TRACE-TASK44-VERDICTS-IT13';
const db = new PrismaClient();

// ── Canarie live AVANT scellement (preuve à horodatage chaîné) ──────
let canaryProof: string;
try {
  const c = await pingProvider('zai', 25000);
  const ok = c.attempts.some((a) => a.ok);
  canaryProof = ok
    ? `OK en ${c.ms} ms — fournisseur rétabli (relance de mesure possible)`
    : `ÉCHEC en ${c.ms} ms — détails : ${c.attempts.map((a) => `${a.provider}:${String(a.error ?? 'échec').slice(0, 120)}`).join(' | ')}`;
} catch (e) {
  canaryProof = `ÉCHEC (exception) : ${(e as Error).message.slice(0, 200)}`;
}

// ── Cumul dossier fabric (base RUN-000030 = début it.10) ────────────
const totalSince = await db.generationRun.count({ where: { runUid: { gte: 'RUN-000030' } } });
const infraSince = await db.generationRun.count({
  where: { runUid: { gte: 'RUN-000030' }, error: { contains: 'INFRA' } },
});

const results: string[] = [];

// ── Preuve 1 : verdict honnête it.13 + correction de l'agrégat ──────
const r1 = await captureAndPersist({
  category: 'FORENSIC', criticality: 'HIGH', actorType: 'AGENT', actorId: 'super-z-task44',
  claim: 'Verdict honnête it.13 (lecture corrective de EV-ARTIFACT-001134, auto-scellé par le harnais 02:44:24Z — contenu correct : TRACE-PTA002-IT13, EVO-000033, verdicts RUN-000061/64/67) : 0/3 SEALED — 0 slot COMPTABLE (3 slots INFRA-EXCLU après 3 tentatives chacun : RUN-000059/60/61, RUN-000062/63/64, RUN-000065/66/67 — 9 runs INFRA consécutifs) ; AC1 FAIL (0 SEALED) ; AC2 NON COMPARABLE (0 % première passe, fournisseur refusant TOUT appel — 5ᵉ fenêtre dégradée après it.10/11/12, la PREMIÈRE TOTALE) ; « AC3 PASS, AC4 PASS » portés par le scellé sont VRAIS PAR VACUITÉ (0 violation comptée sur 0 run) → lecture gouvernée : AC3/AC4 NON ÉVALUABLES ; DÉFAUTS D\'AGRÉGAT documentés (classe fidélité mesure BF-EV1/S1) : (a) titre du scellé « itération 12 » — hardcode hérité du harnais it.12, (b) garde finalize absente sur 0 slot comptable — le harnais it.10/11 ne refusait que les slots SANS VERDICT ; FIXES harnais appliqués (outillage, INV-210 intact, aucun comportement signé de production modifié) : canarie réseau réelle au pré-vol (pingProvider zai — le disjoncteur rapporte CLOSED après simple expiration de cooldown alors que le fournisseur 429 encore, leçon RUN-000059 : pré-vol PASS 23:27Z suivi de 9 runs INFRA), finalize REFUSÉ si 0 slot comptable, titre it.13',
  payload: {
    sourceEvidence: 'EV-ARTIFACT-001134',
    verdictFiles: ['scripts/repair-verdicts-it13.jsonl', 'scripts/repair-measure-result-it13.json'],
    honestReading: { ac1: 'FAIL (0/3 SEALED)', ac2: 'NON COMPARABLE (fabric morte 3 h 17)', ac3: 'NON ÉVALUABLE (0 compté — vacuité)', ac4: 'NON ÉVALUABLE (0 compté — vacuité)' },
    aggregateDefects: ['titre scellé « itération 12 » au lieu de 13 (payload correct)', 'AC3/AC4 PASS vacuons sur countedSlots=0'],
    harnessFixes: ['pré-vol : canarie pingProvider zai (refus si 429 réel)', 'finalize : refus si 0 slot comptable', 'titre it.13'],
    fbProof: '117 waits EV-OPERATIONS (000881..001129), 117/117 closed:true, 1 attente/fichier ≤90 s, INV-210 intact',
    leversNotExercised: 'GC1/GC2/XR/BF3 jamais exercés en live — 0/13 fichier généré sur les 9 runs (rien à mesurer hors FB)',
  },
  traceId: TRACE,
});
results.push(r1.uid);

// ── Preuve 2 : dossier fabric it.13 + canarie live + cumul ──────────
const r2 = await captureAndPersist({
  category: 'METRIC', criticality: 'HIGH', actorType: 'AGENT', actorId: 'super-z-task44',
  claim: `Dossier fabric it.13 — saturation FOURNISSEUR TOTALE et PERSISTANTE, classe différente des rafales it.10/11/12 : fenêtre 23:27:51Z→02:44:14Z (3 h 17), 9 runs consécutifs (RUN-000059..067) TOUS INFRA, 0/13 fichier généré (première passe 0 % sur CHAQUE run — vs 20-84 % en it.10/11/12) ; charge FB diluée comme prévu : 117 waits (1/fichier, 60-90 s, 117/117 « refermé » à l'échéance) → ~1-2 VRAIS appels réseau/fichier (~1,2/min sur la fenêtre vs ~19/min it.12) — le levier D est PROUVÉ MÉCANIQUEMENT et INV-210 intact, MAIS chaque vrai appel réseau a reçu 429 pendant TOUTE la fenêtre : le disjoncteur 90 s ne peut pas absorber une saturation de QUOTA (échéance cooldown ≠ fournisseur rétabli) ; CANARIE AU SCELLEMENT : ${canaryProof} ; CUMUL depuis RUN-000030 : ${infraSince}/${totalSince} runs INFRA (${Math.round((infraSince / totalSince) * 100)} %) — 4 itérations consécutives confondues par la fabric, it.9 (84,6 %) reste l'unique baseline saine ; les leviers GC1/GC2/XR/BF3 d'EVO-000033 restent SANS MESURE LIVE (0 fichier co-généré à comparer) — la décision d'environnement (quota/clé fournisseur/second fournisseur réel) est HUMAN (INV-227)`,
  payload: {
    window: { start: '2026-09-08T23:27:51Z', end: '2026-09-09T02:44:14Z', duration: '3 h 17' },
    runs: 'RUN-000059..067 (9/9 INFRA, 3 slots × 3 tentatives, slots verdictés RUN-000061/64/67)',
    firstPass: '0/13 fichier VÉRIFIÉ sur chaque run — première saturation TOTALE (it.10 : 20,5 %, it.11 : 25,6 %, it.12 : 0 % avec quelques fichiers)',
    fb: { waits: 117, closedTrue: 117, perFile: '1 attente ≤90 s (60 s 1ᵉʳ fichier, 90 s suivants)', realCallsPerFile: '~1-2 (429 systématique)', dilution: '~19 → ~1,2 appels réels/min' },
    canaryAtSeal: canaryProof,
    cumulative: { sinceRun: 'RUN-000030', infra: infraSince, total: totalSince, degradedIterations: ['it.10', 'it.11', 'it.12', 'it.13'], healthyBaseline: 'it.9 (84,6 %)' },
    diagnosis: 'saturation quota fournisseur (429 soutenu ≥ 3 h 17 + encore actif au scellement) — hors portée du backoff kernel ; disjoncteur CLOSED trompeur (cooldown échu ≠ rétabli)',
    humanDecisionOptions: [
      'vérifier le quota/plan du compte zai (domaine HUMAN)',
      'configurer un second fournisseur RÉEL (deepseek/openai/openrouter — chaîne LF-6 prête, clé requise)',
      're-mesurer it.13 plus tard — le pré-vol canarisé refusera de brûler une fenêtre morte',
    ],
  },
  traceId: TRACE,
});
results.push(r2.uid);

await db.$disconnect();
console.log('PREUVES SCELLÉES :', results.join(', '));
console.log('CANARIE AU SCELLEMENT :', canaryProof);
