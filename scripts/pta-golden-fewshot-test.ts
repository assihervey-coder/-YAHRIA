#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — TESTS FEW-SHOT EXEMPLAIRE DORÉ (EVO-000027) — PTA-002 it.7
// Tests unitaires de golden-exemplar.ts + armement réel + rollback drill.
//   bun run scripts/pta-golden-fewshot-test.ts
// Chaque assertion est un fait mesuré — aucun résultat simulé (INV-227).
// ═══════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import {
  isGoldenFewShotActive,
  goldenSystemAddendum,
  loadGoldenExemplars,
  rankGoldenExemplars,
  resetGoldenFewShotCache,
  ADDENDUM_BUDGET_CHARS,
  GOLDEN_FEWSHOT_EVO_UID,
} from '../src/lib/yahria/golden-exemplar';
import { verifyGeneratedContent } from '../src/lib/yahria/studio';

const db = new PrismaClient();
let passed = 0, failed = 0;

function check(id: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${id}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.log(`  ✗ ${id}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nPTA-002 · Few-shot exemplaire doré (EVO-000027) — tests unitaires\n');

// ── GF-T1. ARMEMENT GOUVERNÉ — le registre EST l'interrupteur ──────
check('T1.1 isGoldenFewShotActive() === true (EVO-000027 PROMOTED en DB réelle)',
  (await isGoldenFewShotActive()) === true);
const addendumMain = await goldenSystemAddendum('PYTHON', 'main.py', 'Point d\'entrée FastAPI du hub');
check('T1.2 addendum non vide quand armé', addendumMain.length > 0, `${addendumMain.length} chars`);

// ── GF-T2. LECTURE EXEMPLAIRE — complet et propre (INV-080) ────────
const files = loadGoldenExemplars(true);
check('T2.1 exemplaires chargés ≥ 10 (11 candidats fixés)', files.length >= 10, `${files.length} fichiers`);
check('T2.2 tous ≥ 25 chars (plancher INV-080)', files.every((f) => f.content.trim().length >= 25));
const PLACEHOLDER_RE = [/\bTODO\b/i, /\bFIXME\b/i, /\bPLACEHOLDER\b/i, /<placeholder[^>]*>/i];
check('T2.3 aucun placeholder dans les exemplaires (INV-080)',
  files.every((f) => PLACEHOLDER_RE.every((re) => !re.test(f.content))));
check('T2.4 gateways/ et tests/ présents (structure FastAPI idiomatique)',
  files.some((f) => f.path === 'gateways/base.py') && files.some((f) => f.path === 'tests/test_api.py'));

// ── GF-T3. SÉLECTION PAR RÔLE (pure, déterministe) ─────────────────
const r1 = rankGoldenExemplars('main.py', 'Point d\'entrée', files);
check('T3.1 entry main.py → main.py', r1[0]?.path === 'main.py', r1.map((x) => x.path).join(','));
const r2 = rankGoldenExemplars('gateways/orangepay.py', 'implémentation passerelle paiement', files);
check('T3.2 gateways/* → plus grand d\'abord (pesapal 4569 > notchpay 3893 > base 1862)',
  r2[0]?.path === 'gateways/pesapal.py' && r2[1]?.path === 'gateways/notchpay.py', r2.map((x) => x.path).join(','));
const r3 = rankGoldenExemplars('tests/test_api.py', 'pytest couvrant les routes', files);
check('T3.3 tests/test_api.py → tests/test_api.py', r3[0]?.path === 'tests/test_api.py');
const r4 = rankGoldenExemplars('utils/helpers.py', 'fonctions utilitaires', files);
check('T3.4 chemin hors rôle → défaut main.py (vue d\'ensemble)', r4[0]?.path === 'main.py');
const r5 = rankGoldenExemplars('config.py', 'configuration du service', files);
check('T3.5 config.py → config.py (nom de base exact)', r5[0]?.path === 'config.py');

// ── GF-T4. ADDENDUM — budget, contrat, frontière honnête ───────────
const CANONICAL_TREE = [
  'main.py', 'config.py', 'models.py', 'schemas.py', 'security.py',
  'gateways/base.py', 'gateways/notchpay.py', 'gateways/pesapal.py',
  'webhooks.py', 'tests/test_api.py', 'requirements.txt',
];
let allWithinBudget = true, allContract = true, allUntreated = true, allCleanS1 = true;
const injectedReport: string[] = [];
for (const p of CANONICAL_TREE) {
  const a = await goldenSystemAddendum('PYTHON', p, 'génération exemplaire — contrôle systématique');
  if (a.length > ADDENDUM_BUDGET_CHARS) { allWithinBudget = false; console.log(`    ⚠ ${p} : ${a.length} > ${ADDENDUM_BUDGET_CHARS}`); }
  if (!a.includes('GOLDEN CONTRACT') || !a.includes('app = FastAPI(')) allContract = false;
  if (a.includes('REFERENCE EXEMPLAR')) {
    // le contenu injecté doit être le fichier ENTIER (jamais tronqué, INV-080)
    const m = a.match(/REFERENCE EXEMPLAR — (\S+) \(complete/);
    const chosenRel = m?.[1] ?? '';
    const chosen = files.find((f) => f.path === chosenRel);
    if (!chosen || !a.endsWith(chosen.content)) { allUntreated = false; console.log(`    ⚠ ${p} : exemplaire ${chosenRel} non intégral`); }
    else {
      injectedReport.push(`${p}←${chosenRel}`);
      // l'exemplaire injecté passe la vérification S1 indépendante (INV-080)
      const verdict = verifyGeneratedContent(chosen.content, chosen.path);
      if (!verdict.ok) allCleanS1 = false;
    }
  }
}
check('T4.1 budget addendum ≤ 6000 chars sur TOUT l\'arbre canonique', allWithinBudget);
check('T4.2 contrat doré présent partout (boot `app = FastAPI(` inclus)', allContract);
check('T4.3 exemplaire injecté JAMAIS tronqué (endsWith du fichier entier, INV-080)', allUntreated);
check('T4.4 exemplaires injectés passent la vérification S1 indépendante', allCleanS1, injectedReport.slice(0, 4).join(' ; ') + (injectedReport.length > 4 ? ` … (${injectedReport.length} au total)` : ''));
check('T4.5 tests/test_api.py (5062 chars) dépasse le budget → contrat SEUL, jamais tronqué',
  !(await goldenSystemAddendum('PYTHON', 'tests/test_api.py', 'pytest couvrant les routes')).includes('REFERENCE EXEMPLAR'));
const addendumNode = await goldenSystemAddendum('NODE', 'server.js', 'serveur HTTP Express');
check('T4.6 stack non-PYTHON : contrat générique SEUL — zéro exemplaire cross-langage (INV-215)',
  addendumNode.includes('GOLDEN CONTRACT') && !addendumNode.includes('REFERENCE EXEMPLAR') && !addendumNode.includes('app = FastAPI('));

// ── GF-T5. ROLLBACK DRILL — ROLLED_BACK rend l'addendum inerte ─────
// (critère d'acceptation #4 : retour legacy SANS redéploiement)
let rollbackOk = false, restoredOk = false;
try {
  await db.evolutionProposal.update({ where: { proposalUid: GOLDEN_FEWSHOT_EVO_UID }, data: { state: 'ROLLED_BACK' } });
  resetGoldenFewShotCache();
  const inert = await goldenSystemAddendum('PYTHON', 'main.py', 'rollback drill');
  rollbackOk = inert === '' && (await isGoldenFewShotActive()) === false;
} finally {
  await db.evolutionProposal.update({ where: { proposalUid: GOLDEN_FEWSHOT_EVO_UID }, data: { state: 'PROMOTED' } });
  resetGoldenFewShotCache();
  restoredOk = (await isGoldenFewShotActive()) === true && (await goldenSystemAddendum('PYTHON', 'main.py', 'rollback drill')).length > 0;
}
check('T5.1 EVO-000027 → ROLLED_BACK : addendum inerte, legacy restauré sans redéploiement', rollbackOk);
check('T5.2 état PROMOTED restauré après le drill (registre intact)', restoredOk);

console.log(`\n═ Résultat : ${passed} PASS / ${failed} FAIL ═\n`);
await db.$disconnect();
process.exit(failed > 0 ? 1 : 0);
