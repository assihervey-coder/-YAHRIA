#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — TESTS BOUCLE DE RÉPARATION CIBLÉE (EVO-000028 + EVO-000029
// + EVO-000030 + EVO-000031 + EVO-000032) — PTA-002 it.12 · Tests unitaires de
// run-repair-loop.ts : armement réel, ciblage PUR (détails de portes RÉELS
// it.7 + détails FIDÈLES EVO-000029), contrats inter-fichiers (RC3),
// résolution d'imports, classification INV-210, budget PAR PORTE + contrat
// pydantic v2 + contrat comportemental (EVO-000030), FERMETURE DES
// DÉPENDANCES (EVO-000031 : imports réels d'abord, bornes 5/3600, fixtures
// réelles RUN-000035/41), CONTRATS DE REGISTRE + FIDÉLITÉ BOOT (EVO-000032 :
// clés dict top-level, ciblage frames STRICT, stderr tête+queue — fixtures
// réelles RUN-000042/44), drills d'armement sous registre temporairement
// PROMOTED / ROLLED_BACK (promotion-safe).
//   bun run scripts/pta-repair-loop-test.ts
// PROMOTION-SAFE : l'état réel du registre est PRÉSERVÉ à l'identique
// (les drills manipulent l'état puis le restaurent EXACTEMENT — la
// décision humaine n'est jamais écrasée, INV-227).
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import {
  isRunRepairActive,
  resetRunRepairCache,
  isDependencyClosureActive,
  resetDependencyClosureCache,
  isRegistryContractsActive,
  resetRegistryContractsCache,
  REGISTRY_CONTRACTS_EVO_UID,
  runRepairCycle,
  mapGateNotesToTargets,
  resolvePythonImports,
  extractPythonContracts,
  buildSiblingContracts,
  RUN_REPAIR_EVO_UID,
  DEPENDENCY_CLOSURE_EVO_UID,
  REPAIR_MAX_FILES,
} from '../src/lib/yahria/run-repair-loop';
import {
  isBootFidelityActive,
  resetBootFidelityCache,
  formatBootStderr,
  BOOT_STDERR_HEAD_CHARS,
  BOOT_STDERR_TAIL_CHARS,
} from '../src/lib/yahria/boot-gate';
import { pytestFailureDetail } from '../src/lib/yahria/behavioral-gate';
import { classifyFailure } from '../src/lib/yahria/completeness-gate';
import { captureAndPersist } from '../src/lib/yahria/evidence-store';

const db = new PrismaClient();
let passed = 0, failed = 0;

function check(id: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${id}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.log(`  ✗ ${id}${detail ? ` — ${detail}` : ''}`); }
}

// arbre réaliste du brief canonique Hub Mobile Money (13 fichiers, it.7)
const TREE = [
  'main.py', 'config.py', 'models.py', 'schemas.py',
  'gateways/base.py', 'gateways/notchpay.py', 'gateways/pesapal.py',
  'routes/payments.py', 'routes/webhooks.py', 'services/ledger.py',
  'tests/__init__.py', 'tests/test_api.py', 'requirements.txt',
];
// arbre RÉEL des runs it.10 (13 fichiers générés) — TREE + les modules
// racine réels que l'approximation T3/T7 ne porte pas (security.py,
// webhooks.py racine, gateways/__init__.py) — requis pour les fixtures T11
const TREE31 = [...TREE, 'security.py', 'webhooks.py', 'gateways/__init__.py'];
// arbre RÉEL it.11/it.12 dans l'ORDRE du CANONICAL_TREE de mesure — requis
// pour reproduire le poison it.11 EXACT (gateways/__init__.py précède
// tests/__init__.py : la frame stdlib importlib/__init__.py:90 y était
// résolue via son basename — preuve EV-ARTIFACT RUN-000044)
const TREE32 = [
  'main.py', 'config.py', 'models.py', 'schemas.py', 'security.py',
  'gateways/__init__.py', 'gateways/base.py', 'gateways/notchpay.py', 'gateways/pesapal.py',
  'webhooks.py', 'tests/__init__.py', 'tests/test_api.py', 'requirements.txt',
];

console.log('\nPTA-002 · Boucle de réparation ciblée (EVO-000028 + EVO-000029 + EVO-000030 + EVO-000031 + EVO-000032) — tests unitaires\n');

// ── RR-T1. ARMEMENT GOUVERNÉ — le registre EST l'interrupteur ──────
const stateBefore = await db.evolutionProposal.findUnique({ where: { proposalUid: RUN_REPAIR_EVO_UID } });
const promotedReal = stateBefore?.state === 'PROMOTED';
check(`T1.1 isRunRepairActive() reflète le registre RÉEL (EVO-000028 ${stateBefore?.state} en DB)`,
  (await isRunRepairActive()) === promotedReal);
let inertOk: boolean; let inertDetail: string;
if (promotedReal) {
  inertOk = true; inertDetail = 'registre PROMOTED réel — drill inertie non exécuté (preuve non polluée)';
} else {
  const inert = await runRepairCycle({
    runId: 'drill', runUid: 'DRILL-EVO28-INERTE', gateKind: 'BOOT',
    failStages: [{ stage: 'SYNTAXE', detail: '1 fichier(s) en erreur de syntaxe : main.py — File "main.py", line 40' }],
    brief: 'x', stack: 'PYTHON', blueprint: [],
    treePaths: TREE.map((p) => ({ path: p, role: 'module' })), workspaceDir: '/tmp/never-evo28',
  });
  inertOk = inert.attempted === false && (inert.skippedReason ?? '').includes('non PROMOTED');
  inertDetail = inert.skippedReason ?? '';
}
check('T1.2 runRepairCycle cohérent avec le registre (inerte si non PROMOTED)', inertOk, inertDetail);

// ── RR-T2. CIBLAGE PUR — détails de portes RÉELS de l'itération 7 ──
// RUN-000010 — syntaxe
const t21 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'SYNTAXE', detail: '1 fichier(s) en erreur de syntaxe : main.py — File "main.py", line 40' }],
  treePaths: TREE,
});
check('T2.1 SYNTAXE (RUN-000010) → main.py exactement', t21.length === 1 && t21[0].path === 'main.py', t21.map((t) => t.path).join(','));

// cap ≤3 et ordre de citation
const t22 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'SYNTAXE', detail: '5 fichier(s) en erreur de syntaxe : a.py, b.py, c.py, d.py, e.py — SyntaxError' }],
  treePaths: ['a.py', 'b.py', 'c.py', 'd.py', 'e.py'],
});
check(`T2.2 SYNTAXE multi-fichiers → cap ${REPAIR_MAX_FILES}, ordre de citation respecté`,
  t22.length === REPAIR_MAX_FILES && t22.map((t) => t.path).join(',') === 'a.py,b.py,c.py', t22.map((t) => t.path).join(','));

// jamais de chemin hors arbre (INV-120)
const t23 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'SYNTAXE', detail: '2 fichier(s) en erreur de syntaxe : ghost.py, main.py — SyntaxError' }],
  treePaths: TREE,
});
check('T2.3 chemin hors arbre ignoré (jamais inventé, INV-120)', t23.length === 1 && t23[0].path === 'main.py', t23.map((t) => t.path).join(','));

// RUN-000011 — pytest : priorité handlers/imports directs, puis le test
const t24 = mapGateNotesToTargets({
  gateKind: 'BEHAVIORAL',
  failStages: [{ stage: 'PYTEST', detail: 'pytest exit 1 — 2 failed, 2 passed in 0.35s — FAILED tests/test_api.py::test_initiate_payment - assert 500 == 201 | FAILED tests/test_api.py::test_webhook_handler - assert 500 != 200' }],
  treePaths: TREE,
  importsByFile: { 'tests/test_api.py': ['routes/payments.py', 'routes/webhooks.py'] },
});
check('T2.4 PYTEST (RUN-000011) → handlers priorisés puis fichier de test',
  t24.map((t) => t.path).join(',') === 'routes/payments.py,routes/webhooks.py,tests/test_api.py', t24.map((t) => t.path).join(','));

// RUN-000012 — boot sans réponse : racine + imports racine
const t25 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'BOOT', detail: 'uvicorn main:app sans réponse HTTP en 30.0s — connexion refusée' }],
  treePaths: TREE,
  importsByFile: { 'main.py': ['config.py', 'gateways/base.py'] },
});
check('T2.5 BOOT sans réponse (RUN-000012) → main.py puis imports racine',
  t25.map((t) => t.path).join(',') === 'main.py,config.py,gateways/base.py', t25.map((t) => t.path).join(','));

// ModuleNotFoundError explicite → module interne résoluble
const t26 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'BOOT', detail: "uvicorn main:app sans réponse HTTP en 30.0s — ModuleNotFoundError: No module named 'gateways.pesapal'" }],
  treePaths: TREE,
});
check('T2.6 ModuleNotFoundError « gateways.pesapal » → gateways/pesapal.py résolu',
  t26.some((t) => t.path === 'gateways/pesapal.py'), t26.map((t) => t.path).join(','));

// STRUCTURE — îlots non importables
const t27 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'STRUCTURE', detail: '1 îlot(s) non importable(s) : 2services/x.py (chemin de package invalide : « 2services » — non importable)' }],
  treePaths: ['main.py', '2services/x.py'],
});
check('T2.7 STRUCTURE îlot → fichier cité exactement', t27.length === 1 && t27[0].path === '2services/x.py', t27.map((t) => t.path).join(','));

// DÉCOUVERTE boot / comportementale
const t28 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'DÉCOUVERTE', detail: 'aucun module racine avec instance FastAPI( ou create_app(' }],
  treePaths: TREE,
});
check('T2.8 DÉCOUVERTE boot → entrée canonique main.py', t28.length >= 1 && t28[0].path === 'main.py', t28.map((t) => t.path).join(','));
const t29a = mapGateNotesToTargets({
  gateKind: 'BEHAVIORAL',
  failStages: [{ stage: 'DÉCOUVERTE', detail: 'aucun test découvert (tests/ ou test_*.py) — livrable non vérifiable comportementalement' }],
  treePaths: TREE,
});
check('T2.9 DÉCOUVERTE comportementale → fichier de test PLANIFIÉ', t29a.length === 1 && t29a[0].path === 'tests/test_api.py', t29a.map((t) => t.path).join(','));
const t29b = mapGateNotesToTargets({
  gateKind: 'BEHAVIORAL',
  failStages: [{ stage: 'DÉCOUVERTE', detail: 'aucun test découvert (tests/ ou test_*.py) — livrable non vérifiable comportementalement' }],
  treePaths: ['main.py', 'config.py'],
});
check('T2.10 aucun test planifié → 0 cible (échec legacy honnête)', t29b.length === 0);

// ── RR-T3. RÉSOLUTION DES IMPORTS PYTHON (pure) ────────────────────
const t31 = resolvePythonImports(
  'from gateways.base import BaseGateway\nfrom config import SETTINGS\nimport main\nfrom fastapi import FastAPI\nimport requests',
  TREE,
);
check('T3.1 imports internes résolus, stdlib/paquets ignorés',
  t31.includes('gateways/base.py') && t31.includes('config.py') && t31.includes('main.py')
  && !t31.includes('fastapi') && !t31.includes('requests'), t31.join(','));
const t32 = resolvePythonImports('import os, sys\nfrom routes.payments import router as payments_router', TREE);
check('T3.2 « import x, y » multiple + alias « as » gérés',
  t32.length === 1 && t32[0] === 'routes/payments.py', t32.join(','));

// ── RR-T4. CLASSIFICATION INV-210 — notes riches ≠ signature INFRA ──
check('T4.1 pytest exit 1 → MODÈLE (réparable)', classifyFailure(['pytest exit 1 — 2 failed, 2 passed in 0.35s']) === 'MODÈLE');
check('T4.2 boot sans réponse HTTP → MODÈLE (réparable — signature it.7 RUN-000012)',
  classifyFailure(['uvicorn main:app sans réponse HTTP en 30.0s — connexion refusée']) === 'MODÈLE');
check('T4.3 circuit OPEN / cooldown → INFRA (jamais réparé)', classifyFailure(['zai:circuit OPEN, cooldown 90s']) === 'INFRA');
check('T4.4 détail FIDÈLE EVO-000029 (traceback ImportError + lignes E pytest) → MODÈLE',
  classifyFailure([
    "uvicorn main:app sans réponse HTTP en 30.0s — Traceback (most recent call last):\n  File \"main.py\", line 3, in <module>\nImportError: cannot import name 'PaymentInitiate' from 'models'",
    'pytest exit 1 — test_initiate_payment: E assert 500 == 201 | tests/test_api.py:12: AssertionError',
  ]) === 'MODÈLE');

// ── RR-T5. CIBLAGE EVO-000029 — détails FIDÈLES RC1/RC2 ────────────
// RUN-000013 avec stderr RÉEL désormais capté dès le spawn (RC1)
const t51 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{
    stage: 'BOOT',
    detail: "uvicorn main:app sans réponse HTTP en 30.0s — Traceback (most recent call last):\n  File \"/home/z/my-project/db/workspaces/RUN-000013/main.py\", line 3, in <module>\n    from models import PaymentInitiate\nImportError: cannot import name 'PaymentInitiate' from 'models' (/home/z/my-project/db/workspaces/RUN-000013/models.py)",
  }],
  treePaths: TREE,
});
check('T5.1 BOOT + traceback réel (RUN-000013) → main.py puis models.py (contrat rompu ciblé)',
  t51.map((t) => t.path).join(',') === 'main.py,models.py', t51.map((t) => t.path).join(','));
check('T5.2 frames stdlib/uvicorn hors arbre jamais ciblées (INV-120)',
  t51.every((t) => TREE.includes(t.path)));

// détail PYTEST fidèle RC2 avec localisation (sans résumé FAILED)
const t53 = mapGateNotesToTargets({
  gateKind: 'BEHAVIORAL',
  failStages: [{
    stage: 'PYTEST',
    detail: 'pytest exit 1 — 1 failed, 2 passed in 0.42s — test_initiate_payment: E assert 500 == 201 | E + where 500 = <Response [500 Internal Server Error]> | tests/test_api.py:12: AssertionError',
  }],
  treePaths: TREE,
  importsByFile: { 'tests/test_api.py': ['routes/payments.py'] },
});
check('T5.3 PYTEST détail fidèle → handler priorisé puis test (localisation .py:ligne résolue)',
  t53.map((t) => t.path).join(',') === 'routes/payments.py,tests/test_api.py', t53.map((t) => t.path).join(','));

// ── RR-T6. DÉTAIL PYTEST DE FIDÉLITÉ (pytestFailureDetail, RC2) ────
const pytestOut = [
  '_________ test_initiate_payment _________',
  'client = <starlette.testclient.TestClient object at 0x7f>',
  '',
  '    def test_initiate_payment():',
  '        response = client.post("/payments", json={"order_id": "A1"})',
  '>       assert response.status_code == 201',
  "E       assert 500 == 201",
  "E        +  where 500 = <Response [500 Internal Server Error]>",
  '',
  'tests/test_api.py:12: AssertionError',
  '_________ test_webhook_handler _________',
  '>       assert response.status_code == 200',
  'E       assert 500 == 200',
  'tests/test_api.py:30: AssertionError',
  '========================= 2 failed, 2 passed in 0.42s =========================',
].join('\n');
const t61 = pytestFailureDetail(pytestOut, '');
check('T6.1 noms de tests + lignes E + code fautif extraits',
  t61.includes('test_initiate_payment') && t61.includes('assert 500 == 201') && t61.includes('test_webhook_handler'), t61.slice(0, 160));
check('T6.2 localisations fichier:ligne présentes (ciblage possible)',
  t61.includes('tests/test_api.py:12') && t61.includes('tests/test_api.py:30'));
check('T6.3 bruit (fixtures, source def, séparateur) EXCLU',
  !t61.includes('client = <starlette') && !t61.includes('def test_initiate_payment') && !t61.includes('====='));

// ── RR-T7. CONTRATS INTER-FICHIERS (EVO-000029 RC3, fonctions pures) ─
const modelsPy = [
  'from pydantic import BaseModel',
  'class PaymentInitiate(BaseModel):',
  '    order_id: str',
  'class PaymentResponse(BaseModel):',
  '    status: str = "pending"',
  'MAX_AMOUNT = 1000000',
  'def helper(x):',
  '    return x',
].join('\n');
const t71 = extractPythonContracts(modelsPy);
check('T7.1 contrats extraits : class/def/constante, membres indentés et imports exclus',
  t71.length === 4 && t71[0] === 'class PaymentInitiate(BaseModel):' && t71.includes('MAX_AMOUNT = 1000000')
  && !t71.some((l) => l.includes('order_id:')) && !t71.some((l) => l.includes('pydantic')), t71.join(' · '));

const t72 = extractPythonContracts('# commentaire\nclass A:\n    def method(self): ...\n\n\nclass B: ...');
check('T7.2 commentaires et lignes vides ignorés', t72.length === 2 && t72[0] === 'class A:' && t72[1] === 'class B: ...');

const fakeDb = new Map<string, string>([
  ['models.py', modelsPy],
  ['routes/payments.py', 'from fastapi import APIRouter\nfrom models import PaymentInitiate\ndef create_payment(p: PaymentInitiate):\n    return {"ok": True}\n'],
]);
const t73 = await buildSiblingContracts(
  'main.py', 'from models import PaymentInitiate\nfrom routes.payments import create_payment\napp = FastAPI()',
  ['main.py', 'models.py'], TREE,
  async (p) => fakeDb.get(p) ?? null,
);
check('T7.3 frères = co-cibles + imports internes, cible exclue, ordre co-cible d\u2019abord',
  t73.map((s) => s.path).join(',') === 'models.py,routes/payments.py', t73.map((s) => s.path).join(','));
check('T7.4 contrats contiennent le symbole précis attendu (PaymentInitiate)',
  t73[0].lines.some((l) => l.startsWith('class PaymentInitiate(BaseModel):')));

const t74 = await buildSiblingContracts('main.py', null, ['models.py', 'x.py'], TREE, async () => null);
check('T7.5 sans contenu courant → co-cibles seuls ; frères absents → 0 contrat inventé (INV-210)',
  t74.length === 0);

const t75 = await buildSiblingContracts(
  'main.py', 'from models import PaymentInitiate', ['main.py', 'models.py'], TREE,
  async (p) => (p === 'models.py' ? 'x = 1\ny = 2\n' : null), // aucun contrat top-level utile
);
check('T7.6 frère sans contrat utile → sauté, ne consomme pas de slot', t75.length === 0);

const bigContract = Array.from({ length: 30 }, (_, i) => `class C${i}(BaseModel): ...`).join('\n');
const t76 = await buildSiblingContracts(
  'main.py', 'from models import PaymentInitiate', ['main.py', 'models.py'], TREE,
  async (p) => (p === 'models.py' ? bigContract : null),
  { maxSiblings: 3, maxChars: 400 },
);
check('T7.7 budget chars respecté (contrat plafonné)',
  t76.length === 1 && t76[0].lines.join('\n').length <= 400, `${t76[0]?.lines.join('\n').length ?? 0} car.`);

// ── RR-T8. DRILL ARMEMENT RÉEL — état EXACT préservé (promotion-safe) ──
// (le registre est l'interrupteur : la boucle doit s'armer SANS redéploiement
//  et retrouver son état EXACT à la restauration — décision humaine intacte,
//  PROMOTED inclus, INV-227)
let drillArmed = false, drillInfra = false, drillNoTarget = false, restoredOk = false;
try {
  await db.evolutionProposal.update({ where: { proposalUid: RUN_REPAIR_EVO_UID }, data: { state: 'PROMOTED' } });
  resetRunRepairCache();
  drillArmed = (await isRunRepairActive()) === true;

  // sous armement : échec INFRA → boucle sautée, JAMAIS réparée (INV-210)
  const rInfra = await runRepairCycle({
    runId: 'drill', runUid: 'DRILL-EVO28-INFRA', gateKind: 'BOOT',
    failStages: [{ stage: 'ERREUR', detail: 'zai:circuit OPEN, cooldown 90s' }],
    brief: 'x', stack: 'PYTHON', blueprint: [],
    treePaths: TREE.map((p) => ({ path: p, role: 'module' })), workspaceDir: '/tmp/never-evo28',
  });
  drillInfra = rInfra.attempted === false && rInfra.classification === 'INFRA'
    && (rInfra.skippedReason ?? '').includes('INV-210');

  // sous armement : MODÈLE sans aucune cible identifiable → échec legacy conservé
  const rNoTarget = await runRepairCycle({
    runId: 'drill', runUid: 'DRILL-EVO28-NO-TARGET', gateKind: 'BEHAVIORAL',
    failStages: [{ stage: 'ERREUR', detail: 'échec inexpliqué sans aucun fichier cité' }],
    brief: 'x', stack: 'PYTHON', blueprint: [],
    treePaths: TREE.map((p) => ({ path: p, role: 'module' })), workspaceDir: '/tmp/never-evo28',
  });
  drillNoTarget = rNoTarget.attempted === false && rNoTarget.classification === 'MODÈLE'
    && (rNoTarget.skippedReason ?? '').includes('aucune cible');
} finally {
  // PROMOTION-SAFE : l'état PRÉ-DRILL est restauré à l'identique (pas de
  // SCHEDULED en dur — la décision humaine PROMOTED n'est jamais écrasée)
  await db.evolutionProposal.update({
    where: { proposalUid: RUN_REPAIR_EVO_UID },
    data: { state: stateBefore?.state ?? 'SCHEDULED' },
  });
  resetRunRepairCache();
  const back = await db.evolutionProposal.findUnique({ where: { proposalUid: RUN_REPAIR_EVO_UID } });
  restoredOk = back?.state === stateBefore?.state;
}
check('T8.1 EVO-000028 → PROMOTED : boucle armée sans redéploiement', drillArmed);
check('T8.2 sous armement, INFRA sautée (classification scellée, INV-210)', drillInfra);
check('T8.3 sous armement, MODÈLE sans cible → échec legacy conservé (jamais aveugle)', drillNoTarget);
check(`T8.4 état EXACT restauré après le drill (${stateBefore?.state} — décision humaine intacte, INV-227)`, restoredOk);

// ── RR-T9. S1 ANTI-PROMPT-BLEED (mesure it.9, RUN-000027/29) ────────
const { verifyGeneratedContent } = await import('../src/lib/yahria/studio');
const t91 = verifyGeneratedContent('--- security.py ---\nimport hashlib\nfrom config import SECRET_KEY\n\ndef h(x):\n    return x\n', 'security.py');
check('T9.1 bleed « --- file.py --- » en tête → REJETÉ avec note explicite',
  t91.ok === false && (t91.note ?? '').includes('prompt-bleed'), t91.note.slice(0, 90));
const t92 = verifyGeneratedContent('import hashlib\nimport hmac\nfrom config import SECRET_KEY\n\nSEC = "abc"\n\ndef sign(p):\n    return hmac.new(SEC.encode(), p.encode(), hashlib.sha256).hexdigest()\n', 'security.py');
check('T9.2 source légitime identique hors bleed → acceptée',
  t92.ok === true, t92.note);

// ── RR-T10. EVO-000030 — BUDGET PAR PORTE + CONTRAT PYDANTIC V2 ─────
// (protocole signé : budget repairUsedBoot/repairUsedBehavioral ≤1 cycle
//  chacun, ≤2 cycles/run ; STACK_HINTS enrichi SEULEMENT si PROMOTED ;
//  ROLLED_BACK → budget legacy 1 cycle/run SANS redéploiement)
const rb = await import('../src/lib/yahria/repair-budget');
const state30Before = await db.evolutionProposal.findUnique({ where: { proposalUid: rb.REPAIR_BUDGET_EVO_UID } });
const promoted30Real = state30Before?.state === 'PROMOTED';
check(`T10.1 isBudgetPerGateActive() reflète le registre RÉEL (EVO-000030 ${state30Before?.state} en DB)`,
  (await rb.isBudgetPerGateActive()) === promoted30Real);

// budget PAR PORTE : boot réparé PUIS comportemental réparable dans le MÊME run
const bpg = rb.newRepairBudget(true);
check('T10.2 budget PAR PORTE : cycle BOOT disponible au départ', rb.repairBudgetAvailable(bpg, 'BOOT'));
rb.consumeRepairBudget(bpg, 'BOOT');
check('T10.3 cycle BOOT consommé → 2e cycle BOOT bloqué (≤1 cycle/porte)', !rb.repairBudgetAvailable(bpg, 'BOOT'));
check('T10.4 boot réparé PUIS comportemental réparable dans le MÊME run (cascade it.9 RUN-000027 corrigée)',
  rb.repairBudgetAvailable(bpg, 'BEHAVIORAL'));
rb.consumeRepairBudget(bpg, 'BEHAVIORAL');
check('T10.5 run total borné : 2 cycles consommés → plus AUCUN budget (≤2 cycles/run)',
  !rb.repairBudgetAvailable(bpg, 'BOOT') && !rb.repairBudgetAvailable(bpg, 'BEHAVIORAL') && rb.repairCyclesUsed(bpg) === 2);

// budget LEGACY (EVO-000028) : 1 cycle/run TOTAL — le mode restauré par un ROLLED_BACK
const legacy = rb.newRepairBudget(false);
rb.consumeRepairBudget(legacy, 'BOOT');
check('T10.6 budget LEGACY : 1 cycle/run total — BOOT consommé → comportemental bloqué AUSSI',
  !rb.repairBudgetAvailable(legacy, 'BEHAVIORAL') && rb.repairCyclesUsed(legacy) === 1);

// contrat pydantic v2 — STACK_HINTS enrichi SEULEMENT si PROMOTED (protocole point 3)
const pvOn = rb.pydanticV2StackAddendum(true, 'PYTHON');
check('T10.7 STACK_HINTS PYTHON si PROMOTED : model_validate + from_attributes + model_dump présents (API v1 proscrites)',
  pvOn.includes('model_validate') && pvOn.includes('from_attributes') && pvOn.includes('model_dump')
  && pvOn.includes('NEVER Model.from_orm') && pvOn.includes('NEVER .dict()'), pvOn.slice(0, 110));
check('T10.8 inerte si non PROMOTED → addendum VIDE (prompt système inchangé, AUCUN autre changement)',
  rb.pydanticV2StackAddendum(false, 'PYTHON') === '');
check('T10.9 hors PYTHON → aucun addendum (STACK_HINTS des autres stacks intacts)',
  rb.pydanticV2StackAddendum(true, 'NODE') === '' && rb.pydanticV2StackAddendum(true, 'NEXTJS') === '');

// contrat comportemental — ligne few-shot (protocole point 4)
const bcOn = rb.behavioralContractExtra(true, 'PYTHON');
check('T10.10 contrat few-shot : le pytest EST le contrat comportemental (payloads + status codes exacts)',
  bcOn.includes('BEHAVIORAL contract') && bcOn.includes('payloads') && bcOn.includes('status codes'), bcOn.slice(0, 100));
check('T10.11 contrat comportemental inerte si non PROMOTED ou hors PYTHON',
  rb.behavioralContractExtra(false, 'PYTHON') === '' && rb.behavioralContractExtra(true, 'NODE') === '');

// drill promotion-safe EVO-000030 : ROLLED_BACK → budget legacy restauré SANS redéploiement
let drill30Off = false, drill30BackOn = false, restored30 = false;
try {
  await db.evolutionProposal.update({ where: { proposalUid: rb.REPAIR_BUDGET_EVO_UID }, data: { state: 'ROLLED_BACK' } });
  rb.resetBudgetPerGateCache();
  drill30Off = (await rb.isBudgetPerGateActive()) === false;
  await db.evolutionProposal.update({ where: { proposalUid: rb.REPAIR_BUDGET_EVO_UID }, data: { state: 'PROMOTED' } });
  rb.resetBudgetPerGateCache();
  drill30BackOn = (await rb.isBudgetPerGateActive()) === true;
} finally {
  // PROMOTION-SAFE : l'état PRÉ-DRILL est restauré à l'identique (INV-227)
  await db.evolutionProposal.update({
    where: { proposalUid: rb.REPAIR_BUDGET_EVO_UID },
    data: { state: state30Before?.state ?? 'UNDER_REVIEW' },
  });
  rb.resetBudgetPerGateCache();
  const back30 = await db.evolutionProposal.findUnique({ where: { proposalUid: rb.REPAIR_BUDGET_EVO_UID } });
  restored30 = back30?.state === state30Before?.state;
}
check('T10.12 drill ROLLED_BACK : budget PAR PORTE désarmé sans redéploiement (legacy 1 cycle/run restauré)', drill30Off);
check('T10.13 drill re-PROMOTED : budget PAR PORTE ré-armé sans redéploiement', drill30BackOn);
check(`T10.14 état EXACT restauré après le drill (${state30Before?.state} — décision humaine intacte, INV-227)`, restored30);

// ── RR-T11. EVO-000031 — FERMETURE DES DÉPENDANCES (fixtures réelles it.10) ──
// (protocole signé : DC1 — imports réels de la cible AVANT les co-cibles ;
//  DC2 — bornes 5 frères / 3600 car. ; ROLLED_BACK → ordre/bornes EVO-000029
//  EXACTS. Fixtures tirées des workspaces réels RUN-000035 / RUN-000041)
const state31Before = await db.evolutionProposal.findUnique({ where: { proposalUid: DEPENDENCY_CLOSURE_EVO_UID } });
const promoted31Real = state31Before?.state === 'PROMOTED';
check(`T11.1 isDependencyClosureActive() reflète le registre RÉEL (EVO-000031 ${state31Before?.state} en DB)`,
  (await isDependencyClosureActive()) === promoted31Real);

// FIXTURE RUN-000035 (workspace réel) : security.py exports réels, main.py réduit fidèle
const securityPy035 = [
  'import hmac', 'import hashlib', 'import base64',
  'def create_token(payload: Dict[str, Any]) -> str:', '    return "tok"',
  'def verify_webhook_signature(raw_body: bytes, signature: str, SECRET_KEY: str = None) -> bool:', '    return True',
  'def _base64url_encode(data: bytes) -> str:', '    return ""',
].join('\n');
const gatewaysInit041 = [
  'from .base import BaseGateway', 'from .notchpay import NotchPayGateway', 'from .pesapal import PesaPal',
  'def get_gateway(gateway_name: str, config: dict) -> BaseGateway:', '    return None',
].join('\n');
const pesapalPy035 = [
  'from fastapi import HTTPException, status',
  'from .base import BaseGateway',
  'from security import verify_hmac',
  'from models import PaymentStatus',
  'from schemas import PaymentInitiationRequest',
].join('\n');
const mainPy035 = [
  'from fastapi import FastAPI', 'import gateways', 'import security', 'from config import HUB_NAME',
  'def health():', '    return {"status": "healthy"}',
  'def list_gateways():', '    return gateways.get_gateway("notchpay", {})',
  'def initiate(payload):', '    gw = gateways.get_gateway("notchpay", {})', '    return gw.initiate_payment()',
].join('\n');
const db035 = new Map<string, string>([
  ['gateways/base.py', 'class BaseGateway:\n    def initiate_payment(self):\n        raise NotImplementedError\n'],
  ['security.py', securityPy035],
  ['models.py', 'class PaymentStatus(BaseModel):\n    pending: str\n'],
  ['schemas.py', 'class PaymentInitiationRequest(BaseModel):\n    amount: float\n'],
  ['main.py', mainPy035],
  ['gateways/__init__.py', gatewaysInit041],
  ['config.py', 'HUB_NAME = "hub"\n'],
]);
const reader035 = async (p: string) => db035.get(p) ?? null;

// DC1 — réparer pesapal.py (co-cibles [main.py, gateways/__init__.py] comme l'it.10 slot 1)
const t112 = await buildSiblingContracts(
  'gateways/pesapal.py', pesapalPy035, ['main.py', 'gateways/__init__.py'], TREE31, reader035,
  { depsFirst: true, maxSiblings: 5, maxChars: 3600 },
);
const sec112 = t112.find((s) => s.path === 'security.py');
check('T11.2 (RUN-000035 réel) depsFirst : security.py ENTRE avec ses exports réels (verify_webhook_signature) — verify_hmac halluciné impossible',
  !!sec112 && sec112.lines.some((l) => l.startsWith('def verify_webhook_signature(')), t112.map((s) => s.path).join(','));
check('T11.3 (DC1+BF-DC1) dépendances importées d\u2019abord (from .base résolu → gateways/base.py en tête) et co-cible non importée en dernier',
  t112[0]?.path === 'gateways/base.py' && t112[t112.length - 1].path === 'main.py', t112.map((s) => s.path).join(','));

// ROLLBACK — ordre signé EVO-000029 (défaut 3/2400) : le défaut it.10 est REPRODUIT
const t112old = await buildSiblingContracts(
  'gateways/pesapal.py', pesapalPy035, ['main.py', 'gateways/__init__.py'], TREE31, reader035,
);
check('T11.4 ordre signé EVO-000029 (défaut) : security.py EXCLU (3 slots consommés par co-cibles/config) — défaut it.10 reproduit',
  !t112old.some((s) => s.path === 'security.py'), t112old.map((s) => s.path).join(','));

// FIXTURE RUN-000041 (workspace réel) : réparer main.py doit voir la fabrique à 2 args
const mainPy041 = [
  'from fastapi import FastAPI', 'import gateways', 'import security',
  'from config import HUB_NAME', 'from models import PaymentRequest',
].join('\n');
const db041 = new Map<string, string>([
  ['config.py', 'HUB_NAME = "hub"\ndef get_gateway_configs():\n    return {}\n'],
  ['models.py', 'class PaymentRequest(BaseModel):\n    order_id: str\n'],
  ['gateways/__init__.py', gatewaysInit041],
  ['security.py', securityPy035],
]);
const t113 = await buildSiblingContracts(
  'main.py', mainPy041, ['config.py', 'models.py'], TREE31,
  async (p) => db041.get(p) ?? null,
  { depsFirst: true, maxSiblings: 5, maxChars: 3600 },
);
check('T11.5 (RUN-000041 réel) réparer main.py : le contrat de gateways/__init__.py avec get_gateway(gateway_name: str, config: dict) EST injecté (2 args — get_gateway(name) halluciné impossible)',
  t113.find((s) => s.path === 'gateways/__init__.py')?.lines.some((l) => l.startsWith('def get_gateway(gateway_name: str, config: dict)')) === true, t113.map((s) => s.path).join(','));

// DC2 — bornes : 6 dépendances résolues → EXACTEMENT 5 contrats (le 6e sort)
const mainPy6 = 'from models import X\nfrom schemas import Y\nfrom security import Z\nimport gateways\nimport webhooks\nimport config\n';
const db6 = new Map<string, string>([
  ['models.py', 'class M(BaseModel):\n    a: str\n'],
  ['schemas.py', 'class S(BaseModel):\n    b: str\n'],
  ['security.py', 'def tok() -> str:\n    return ""\n'],
  ['gateways/__init__.py', 'def get_gateway(n: str, c: dict):\n    return None\n'],
  ['config.py', 'HUB_NAME = "hub"\n'],
  ['routes/webhooks.py', 'def ack(sig: str) -> bool:\n    return True\n'],
]);
const t114 = await buildSiblingContracts(
  'main.py', mainPy6, ['main.py'], TREE31,
  async (p) => db6.get(p) ?? null,
  { depsFirst: true, maxSiblings: 5, maxChars: 3600 },
);
check('T11.6 (DC2) 6 dépendances résolues → EXACTEMENT 5 frères (borne maxSiblings=5, config.py sort en dernier)',
  t114.length === 5 && !t114.some((s) => s.path === 'config.py'), t114.map((s) => s.path).join(','));

// DC2 — budget 3600 car. : contrats longs (14 lignes max/extraction) × 3 dépendances > 3600 → TRONQUÉS
const longDef = (n: number) => `def f${n}(${'a'.repeat(80)}: str) -> str:`;
const longFile = Array.from({ length: 14 }, (_, i) => longDef(i)).join('\n'); // 14 lignes ≈ 1430 car.
const t115 = await buildSiblingContracts(
  'main.py', 'from models import X\nfrom schemas import Y\nfrom security import Z', ['main.py'], TREE31,
  async () => longFile,
  { depsFirst: true, maxSiblings: 5, maxChars: 3600 },
);
const totalChars = t115.reduce((n, s) => n + s.lines.join('\n').length, 0);
check('T11.7 (DC2) budget 3600 car. respecté ET réellement testé (troncature active : total > 3000)',
  totalChars <= 3600 && totalChars > 3000, `${totalChars} car. / ${t115.length} frères`);

// drill promotion-safe EVO-000031 : ROLLED_BACK → ordre/bornes EVO-000029 restaurés SANS redéploiement
let drill31Off = false, drill31BackOn = false, restored31 = false;
try {
  await db.evolutionProposal.update({ where: { proposalUid: DEPENDENCY_CLOSURE_EVO_UID }, data: { state: 'ROLLED_BACK' } });
  resetDependencyClosureCache();
  drill31Off = (await isDependencyClosureActive()) === false;
  await db.evolutionProposal.update({ where: { proposalUid: DEPENDENCY_CLOSURE_EVO_UID }, data: { state: 'PROMOTED' } });
  resetDependencyClosureCache();
  drill31BackOn = (await isDependencyClosureActive()) === true;
} finally {
  // PROMOTION-SAFE : l'état PRÉ-DRILL est restauré à l'identique (INV-227)
  await db.evolutionProposal.update({
    where: { proposalUid: DEPENDENCY_CLOSURE_EVO_UID },
    data: { state: state31Before?.state ?? 'UNDER_REVIEW' },
  });
  resetDependencyClosureCache();
  const back31 = await db.evolutionProposal.findUnique({ where: { proposalUid: DEPENDENCY_CLOSURE_EVO_UID } });
  restored31 = back31?.state === state31Before?.state;
}
check('T11.8 drill ROLLED_BACK : fermeture DÉSARMÉE sans redéploiement (ordre/bornes EVO-000029 restaurés)', drill31Off);
check('T11.9 drill re-PROMOTED : fermeture RÉ-ARMÉE sans redéploiement', drill31BackOn);
check(`T11.10 état EXACT restauré après le drill (${state31Before?.state} — décision humaine intacte, INV-227)`, restored31);

// ── RR-T12. EVO-000032 — CONTRATS DE REGISTRE + FIDÉLITÉ BOOT ──────
// (protocole signé : REG — corps indenté des dict/list top-level visibles,
//  ≤8 lignes / 110 car. ; BF-1 — frames boot en match STRICT contre l'arbre ;
//  BF-2 — stderr tête 800 + queue 1200. Fixtures RÉELLES : fabrique
//  RUN-000042 (clé « notch » vs « notchpay ») et traceback boot RUN-000044
//  REPRODUIT VIVANT depuis le workspace (scripts/fixtures/).
//  ROLLED_BACK → extraction STRICTE + tail seul + ciblage basename EVO-000029)
const state32Before = await db.evolutionProposal.findUnique({ where: { proposalUid: REGISTRY_CONTRACTS_EVO_UID } });
const promoted32Real = state32Before?.state === 'PROMOTED';
check(`T12.1 isRegistryContractsActive() reflète le registre RÉEL (EVO-000032 ${state32Before?.state} en DB)`,
  (await isRegistryContractsActive()) === promoted32Real);
check(`T12.1b isBootFidelityActive() reflète le MÊME registre (EVO-000032 ${state32Before?.state} en DB)`,
  (await isBootFidelityActive()) === promoted32Real);

// (a) REG — fabrique multi-ligne RÉELLE (cause RUN-000042 : le contrat de
// test envoie « notchpay » alors que la fabrique n'expose que « notch » —
// les clés indentées étaient INVISIBLES à l'extraction STRICTE)
const gatewaysInitRegistry = [
  'from .base import BaseGateway',
  'GATEWAYS = {',
  '    "notch": NotchPayGateway,',
  '    "notchpay": NotchPayGateway,',
  '    "pesapal": PesaPalGateway,',
  '}',
  'def get_gateway(gateway_name: str, config: dict) -> BaseGateway:',
  '    return GATEWAYS[gateway_name](config)',
].join('\n');
const t121 = extractPythonContracts(gatewaysInitRegistry, { registry: true });
check('T12.2 (a) GATEWAYS = { multi-ligne → clés de fabrique extraites (« notchpay » visible)',
  t121.includes('"notchpay": NotchPayGateway,') && t121.includes('"notch": NotchPayGateway,') && t121.includes('"pesapal": PesaPalGateway,'), t121.join(' · '));
const t121old = extractPythonContracts(gatewaysInitRegistry);
check('T12.3 (b) défaut SANS EVO-000032 → extraction STRICTE inchangée (clés ABSENTES — rollback)',
  !t121old.some((l) => l.includes('notchpay"')) && t121old.some((l) => l.startsWith('GATEWAYS = {')), t121old.join(' · '));

// bornes signées : ≤8 lignes de continuation, 110 car./ligne
const twelveKeys = Array.from({ length: 12 }, (_, i) => `    "k${i}": G${i},`).join('\n');
const bigRegistry = `GATEWAYS = {\n${twelveKeys}\n}`;
const t122 = extractPythonContracts(bigRegistry, { registry: true });
check('T12.4 (REG) 12 clés de continuation → EXACTEMENT 8 capturées (borne signée)',
  t122.length === 9 && t122.some((l) => l.includes('"k7"')) && !t122.some((l) => l.includes('"k8"')), `${t122.length} lignes`);
const longVal = `    "long": NotchPayGateway(config=${'x'.repeat(150)}),`;
const t123 = extractPythonContracts(`GATEWAYS = {\n${longVal}\n}`, { registry: true });
check('T12.5 (REG) ligne de registre > 110 car. → tronquée à 110',
  t123.some((l) => l.startsWith('"long":') && l.length === 110), `${t123.find((l) => l.startsWith('"long":'))?.length} car.`);
const t124 = extractPythonContracts('ROUTES: {\n    "payments": handle_payments,\n}\nITEMS = [\n    "alpha",\n    "beta",\n]', { registry: true });
check('T12.6 (REG) ouvertures « : { » et « = [ » capturées avec leur corps',
  t124.includes('"payments": handle_payments,') && t124.includes('"alpha",'), t124.join(' · '));

// REG end-to-end — réparer main.py voit les clés de fabrique (fixture RUN-000042)
const mainPy042 = 'import gateways\nfrom fastapi import FastAPI\napp = FastAPI()\ndef initiate(payload):\n    gw = gateways.get_gateway("notchpay", {})\n    return gw.initiate_payment()\n';
const db042 = new Map<string, string>([['gateways/__init__.py', gatewaysInitRegistry]]);
const t125 = await buildSiblingContracts(
  'main.py', mainPy042, ['main.py'], TREE31,
  async (p) => db042.get(p) ?? null,
  { depsFirst: true, maxSiblings: 5, maxChars: 3600, registry: true },
);
check('T12.7 (RUN-000042 réel) réparer main.py : le contrat de gateways/__init__.py contient la CLÉ « notchpay » (l’écart fabrique/test devient visible)',
  t125.find((s) => s.path === 'gateways/__init__.py')?.lines.some((l) => l.includes('"notchpay": NotchPayGateway')) === true, t125.map((s) => s.path).join(','));

// (c) BF-1 — traceback boot RÉEL RUN-000044 (reproduit vivant depuis le
// workspace : frames site-packages/uvicorn + importlib stdlib + frames
// workspace main.py:7 → gateways/__init__.py:3 → pesapal.py:10 →
// ImportError: attempted relative import beyond top-level package)
const realBootStderr = readFileSync('scripts/fixtures/boot-stderr-run000044.txt', 'utf8');
const wsDir44 = '/home/z/my-project/db/workspaces/RUN-000044';
const t126 = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'BOOT', detail: `uvicorn main:app sans réponse HTTP en 30s — ${realBootStderr}` }],
  treePaths: TREE32,
  bootFidelity: true,
  workspaceDir: wsDir44,
});
check('T12.8 (c) traceback RÉEL RUN-000044 + BF-1 → pesapal.py:10 CIBLÉ (frame workspace, finie l’angle mort)',
  t126.some((t) => t.path === 'gateways/pesapal.py'), t126.map((t) => t.path).join(','));
check('T12.9 (c) BF-1 → AUCUN poison stdlib : la cible gateways/__init__.py vient de la frame WORKSPACE :3, jamais de importlib/__init__.py:90',
  t126.find((t) => t.path === 'gateways/__init__.py')?.reason.includes('gateways/__init__.py:3') === true
  && t126.every((t) => !t.reason.includes(':90')), t126.map((t) => `${t.path} — ${t.reason.slice(0, 60)}`).join(' | '));
check('T12.10 (c) BF-1 → site-packages/uvicorn/main.py ne matche JAMAIS main.py (cible racine UNIQUEMENT via bootEntryCandidates)',
  t126[0]?.path === 'main.py' && t126.filter((t) => t.path === 'main.py').length === 1, t126.map((t) => t.path).join(','));

// ROLLBACK — défaut signé EVO-000029 REPRODUIT : importlib/__init__.py:90
// (stdlib) résolu À TORT vers gateways/__init__.py via le basename (le défaut
// it.11 EV-ARTIFACT : un slot gaspillé pendant que la vraie frame mourait hors note)
const t126old = mapGateNotesToTargets({
  gateKind: 'BOOT',
  failStages: [{ stage: 'BOOT', detail: `uvicorn main:app sans réponse HTTP en 30s — ${realBootStderr}` }],
  treePaths: TREE32,
});
check('T12.11 défaut sans EVO-000032 → le poison it.11 est REPRODUIT (gateways/__init__.py cité depuis __init__.py:90 stdlib)',
  t126old.find((t) => t.path === 'gateways/__init__.py')?.reason.includes('__init__.py:90') === true,
  t126old.map((t) => `${t.path} — ${t.reason.slice(0, 60)}`).join(' | '));

// (d) BF-2 — stderr tête+queue sur le traceback RÉEL 3754 car.
const t127 = formatBootStderr(realBootStderr);
check('T12.12 (d) stderr RÉEL RUN-000044 → la note contient l’ouverture (Traceback) ET l’ImportError finale ET les frames workspace pesapal.py:10',
  t127.includes('Traceback (most recent call last):')
  && t127.includes('ImportError: attempted relative import beyond top-level package')
  && t127.includes('gateways/pesapal.py", line 10'));
check('T12.13 (d) note bornée : ≤ tête 800 + queue 1200 + marqueur',
  t127.length <= BOOT_STDERR_HEAD_CHARS + BOOT_STDERR_TAIL_CHARS + 120, `${t127.length} car.`);

// BF-2 — stderr LONG (chaîne d’import première passe plus longue, cas réel
// it.11 où le tail seul perdait le début) : les frames d’ouverture survivent
// en TÊTE, l’ImportError finale en QUEUE
const wsIdx = realBootStderr.indexOf(`File "${wsDir44}/main.py"`);
// stderr long = réel + un bloc intermédiaire REALISTE (frames site-packages
// supplémentaires d'une chaîne d'import première passe plus longue — le cas
// it.11 où la fenêtre tail seule perdait le début du traceback)
const longBootStderr = realBootStderr.slice(0, wsIdx) + realBootStderr.slice(1200, 2400) + realBootStderr.slice(wsIdx);
const t128 = formatBootStderr(longBootStderr);
check('T12.14 (d) stderr LONG → tête (Traceback…) + marqueur d’omission + queue (ImportError finale) présents',
  t128.includes('Traceback (most recent call last):')
  && t128.includes('ImportError: attempted relative import beyond top-level package')
  && t128.includes('caractères de traceback intermédiaires omis'), `${t128.length} car. / stderr ${longBootStderr.length} car.`);
const t129 = formatBootStderr(realBootStderr.slice(0, 1500));
check('T12.15 stderr < somme des fenêtres → intégral (identité)', t129 === realBootStderr.slice(0, 1500).trim());

// drills promotion-safe EVO-000032 : ROLLED_BACK → extraction STRICTE + tail
// seul restaurés SANS redéploiement ; re-PROMOTED → ré-armés
let drill32OffReg = false, drill32OnReg = false, drill32OffBf = false, drill32OnBf = false, restored32 = false;
try {
  await db.evolutionProposal.update({ where: { proposalUid: REGISTRY_CONTRACTS_EVO_UID }, data: { state: 'ROLLED_BACK' } });
  resetRegistryContractsCache();
  resetBootFidelityCache();
  drill32OffReg = (await isRegistryContractsActive()) === false;
  drill32OffBf = (await isBootFidelityActive()) === false;
  await db.evolutionProposal.update({ where: { proposalUid: REGISTRY_CONTRACTS_EVO_UID }, data: { state: 'PROMOTED' } });
  resetRegistryContractsCache();
  resetBootFidelityCache();
  drill32OnReg = (await isRegistryContractsActive()) === true;
  drill32OnBf = (await isBootFidelityActive()) === true;
} finally {
  // PROMOTION-SAFE : l'état PRÉ-DRILL est restauré à l'identique (INV-227)
  await db.evolutionProposal.update({
    where: { proposalUid: REGISTRY_CONTRACTS_EVO_UID },
    data: { state: state32Before?.state ?? 'UNDER_REVIEW' },
  });
  resetRegistryContractsCache();
  resetBootFidelityCache();
  const back32 = await db.evolutionProposal.findUnique({ where: { proposalUid: REGISTRY_CONTRACTS_EVO_UID } });
  restored32 = back32?.state === state32Before?.state;
}
check('T12.16 drill ROLLED_BACK : registres + fidélité DÉSARMÉS sans redéploiement (STRICT + tail seul EVO-000029)', drill32OffReg && drill32OffBf);
check('T12.17 drill re-PROMOTED : registres + fidélité RÉ-ARMÉS sans redéploiement', drill32OnReg && drill32OnBf);
check(`T12.18 état EXACT restauré après le drill (${state32Before?.state} — décision humaine intacte, INV-227)`, restored32);

await captureAndPersist({
  category: 'POLICY', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: 'pta-repair-loop-test',
  claim: `Drill armement EVO-000028+000029+000030+000031+000032 : boucle armée, budget par porte + pydantic v2 + fermeture des dépendances + contrats de registre + fidélité boot vérifiés, états ${stateBefore?.state}/${state30Before?.state}/${state31Before?.state}/${state32Before?.state} restaurés à l'identique (${passed} PASS / ${failed} FAIL) — décisions humaines intactes (INV-227)`,
  payload: { proposalUid: RUN_REPAIR_EVO_UID, proposal30Uid: 'EVO-000030', proposal31Uid: 'EVO-000031', proposal32Uid: 'EVO-000032', statePreserved: stateBefore?.state, state30Preserved: state30Before?.state, state31Preserved: state31Before?.state, state32Preserved: state32Before?.state, passed, failed, drillArmed, drillInfra, drillNoTarget, restoredOk, drill30Off, drill30BackOn, restored30, drill31Off, drill31BackOn, restored31, drill32OffReg, drill32OnReg, drill32OffBf, drill32OnBf, restored32 },
});

console.log(`\n═ Résultat : ${passed} PASS / ${failed} FAIL ═\n`);
await db.$disconnect();
process.exit(failed > 0 ? 1 : 0);
