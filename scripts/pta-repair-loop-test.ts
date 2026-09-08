#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — TESTS BOUCLE DE RÉPARATION CIBLÉE (EVO-000028) — PTA-002 it.8
// Tests unitaires de run-repair-loop.ts : armement réel, ciblage PUR
// (détails de portes RÉELS de l'it.7), résolution d'imports, classification
// INV-210, drills d'armement/INFRA sous registre temporairement PROMOTED.
//   bun run scripts/pta-repair-loop-test.ts
// Chaque assertion est un fait mesuré — aucun résultat simulé (INV-227).
// ═══════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import {
  isRunRepairActive,
  resetRunRepairCache,
  runRepairCycle,
  mapGateNotesToTargets,
  resolvePythonImports,
  RUN_REPAIR_EVO_UID,
  REPAIR_MAX_FILES,
} from '../src/lib/yahria/run-repair-loop';
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

console.log('\nPTA-002 · Boucle de réparation ciblée (EVO-000028) — tests unitaires\n');

// ── RR-T1. ARMEMENT GOUVERNÉ — le registre EST l'interrupteur ──────
check('T1.1 isRunRepairActive() === false (EVO-000028 SCHEDULED en DB réelle — inerte prouvée)',
  (await isRunRepairActive()) === false);
const inert = await runRepairCycle({
  runId: 'drill', runUid: 'DRILL-EVO28-INERTE', gateKind: 'BOOT',
  failStages: [{ stage: 'SYNTAXE', detail: '1 fichier(s) en erreur de syntaxe : main.py — File "main.py", line 40' }],
  brief: 'x', stack: 'PYTHON', blueprint: [],
  treePaths: TREE.map((p) => ({ path: p, role: 'module' })), workspaceDir: '/tmp/never-evo28',
});
check('T1.2 runRepairCycle inerte : attempted === false, raison « non PROMOTED »',
  inert.attempted === false && (inert.skippedReason ?? '').includes('non PROMOTED'), inert.skippedReason ?? '');

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

// ── RR-T4. CLASSIFICATION INV-210 — mêmes signatures que la porte v3 ─
check('T4.1 pytest exit 1 → MODÈLE (réparable)', classifyFailure(['pytest exit 1 — 2 failed, 2 passed in 0.35s']) === 'MODÈLE');
check('T4.2 boot sans réponse HTTP → MODÈLE (réparable — signature it.7 RUN-000012)',
  classifyFailure(['uvicorn main:app sans réponse HTTP en 30.0s — connexion refusée']) === 'MODÈLE');
check('T4.3 circuit OPEN / cooldown → INFRA (jamais réparé)', classifyFailure(['zai:circuit OPEN, cooldown 90s']) === 'INFRA');

// ── RR-T5. DRILL ARMEMENT RÉEL — PROMOTED temporaire, puis restauration ──
// (le registre est l'interrupteur : la boucle doit s'armer SANS redéploiement
//  et retrouver son inertie à la restauration — décision humaine intacte, INV-227)
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
  await db.evolutionProposal.update({ where: { proposalUid: RUN_REPAIR_EVO_UID }, data: { state: 'SCHEDULED' } });
  resetRunRepairCache();
  const back = await db.evolutionProposal.findUnique({ where: { proposalUid: RUN_REPAIR_EVO_UID } });
  restoredOk = (await isRunRepairActive()) === false && back?.state === 'SCHEDULED';
}
check('T5.1 EVO-000028 → PROMOTED : boucle armée sans redéploiement', drillArmed);
check('T5.2 sous armement, INFRA sautée (classification scellée, INV-210)', drillInfra);
check('T5.3 sous armement, MODÈLE sans cible → échec legacy conservé (jamais aveugle)', drillNoTarget);
check('T5.4 état SCHEDULED restauré après le drill (registre intact, inertie retrouvée)', restoredOk);

await captureAndPersist({
  category: 'POLICY', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: 'pta-repair-loop-test',
  claim: `Drill armement EVO-000028 : boucle armée puis état SCHEDULED restauré (${passed} PASS / ${failed} FAIL) — décision humaine intacte (INV-227)`,
  payload: { proposalUid: RUN_REPAIR_EVO_UID, passed, failed, drillArmed, drillInfra, drillNoTarget, restoredOk },
});

console.log(`\n═ Résultat : ${passed} PASS / ${failed} FAIL ═\n`);
await db.$disconnect();
process.exit(failed > 0 ? 1 : 0);
