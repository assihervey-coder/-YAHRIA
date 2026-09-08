#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — PRÉPARATION EVO-000028 (gouvernée, INV-227)
// AGENT propose → HUMAN décide (formulaire inline du panneau Auto-évolution).
//   bun run scripts/prepare-evo28.mjs
// ═══════════════════════════════════════════════════════════════════

const BASE = 'http://127.0.0.1:3000';
const ACTOR = { type: 'AGENT', id: 'super-z' };

async function post(body) {
  const res = await (await fetch(`${BASE}/api/yahria/evolution`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })).json();
  if (!res.ok) { console.error('ÉCHEC', body.action, JSON.stringify(res)); process.exit(1); }
  return res;
}

const RATIONALE = `PTA-002 itération 7 (few-shot EVO-000027 PROMOTED) a mesuré : taux de première passe fichiers 97,4 % (38/39) mais 0/3 runs SEALED au premier passage. Les échecs sont CONCENTRÉS et COMPORTEMENTAUX : RUN-000010 — 1 erreur de syntaxe Python (main.py:40, « from_ gw » tronqué) avec 13/13 fichiers vérifiés du premier coup ; RUN-000011 — porte de boot PASS puis pytest réel 2/4 (test_initiate_payment : 500≠201, test_webhook_handler : 500≠200) avec 12/13 première passe ; RUN-000012 — 13/13 première passe puis uvicorn sans réponse HTTP en 30s. Les trois portes produisent désormais des notes CHIRURGICALES (fichier:ligne, nom exact du test pytest, sortie d'assertion) mais le pipeline ne les exploite PAS : au premier verdict FAIL, le run meurt et le générateur ne voit JAMAIS le retour d'information. Le manque n'est plus la qualité des fichiers ni l'absence d'exemplaire : c'est l'ABSENCE DE BOUCLE DE RÉPARATION entre le verdict des portes et le générateur. Fait décisif : l'exemplaire doré lui-même (RUN-000023-corrige) a requis une correction — pytest 7/7 APRÈS réparation. Montrer au générateur son erreur précise est exactement le mécanisme qui a produit l'étalon ; l'institutionnaliser est le prochain levier naturel de taux de SEALED, avec une honnêteté préservée par construction : classification INV-210 intouchable (INFRA jamais réparé), budget borné (1 cycle, ≤3 fichiers, 1 tentative chacun), compteur d'attempts honnête (une réparation n'est PAS une première passe), chaque étape scellée en preuve.`;

const EXPERIMENT = {
  title: 'Boucle de réparation ciblée avant échec définitif — taux de SEALED mesuré sous triple porte',
  protocol: [
    "1. Créer run-repair-loop.ts (YAHRIA-STD-007) : isRunRepairActive() armé UNIQUEMENT si EVO-000028 est PROMOTED dans le registre d'évolution (registre = interrupteur, INV-227 ; registre indisponible → boucle inerte, jamais active par accident).",
    "2. DÉCLENCHEUR : uniquement sur porte v1 (boot) ou v2 (comportementale) FAIL avec classification MODÈLE. Un échec INFRA n'est JAMAIS réparé — il reste exclu/rejoué au niveau mesure (INV-210). Une seule boucle par run (bornée) : si déjà réparé, échec définitif immédiat avec historique.",
    "3. DIAGNOSTIC→CIBLAGE (fonction PURE, testée) : mapper chaque note de porte à ses fichiers responsables — erreur de syntaxe fichier:ligne → ce fichier ; pytest FAILED test → fichier de test + modules du chemin d'exécution (priorité handlers/imports directs) ; « uvicorn sans réponse » → main.py + imports racine. Budget : ≤ 3 fichiers par cycle, 1 tentative de régénération par fichier.",
    "4. RÉPARATION : régénérer chaque fichier cible via generateFileContent avec un prompt correctif contenant le verdict EXACT de la porte (note intégrale + sortie pytest) ; le contrat few-shot EVO-000027 reste armé. Chaque fichier réparé re-passe la vérification S1 indépendante (INV-080) ; attempts est incrémenté honnêtement (une réparation n'est PAS comptée comme première passe).",
    "5. RE-VÉRIFICATION : ré-exécuter la porte qui a échoué (boot puis comportementale puis complétude). PASS → le run continue vers SEALED ; FAIL → failRun avec l'HISTORIQUE COMPLET (verdict initial + réparation + verdict final). Chaque étape scellée en preuve (category ARTIFACT si réparation réussie, INCIDENT sinon).",
    "6. Intégration studio-pipeline.ts : aux points d'échec boot/comportemental — si armé ET MODÈLE ET pas encore réparé → boucle de réparation ; AUCUN autre changement (portes, retries, few-shot, complétude intacts).",
    "7. Tests unitaires : ciblage pur (syntaxe→fichier exact, pytest→test+handlers, uvicorn→racine), budget ≤3 fichiers, bypass INFRA, armé/inerte (rollback drill réel), INV-080 sur fichiers réparés, preuve par étape.",
    "8. Non-régression : tsc propre, tests few-shot 19/19, porte v3 14/14, comportement des portes inchangé quand la boucle est inerte.",
    "9. Mesure PTA-002 itération 8 : 3 runs (RUN-000013..15) sur le brief canonique Hub Mobile Money sous TRIPLE porte — métriques : runs SEALED cycle 0 et cycle ≤1 comptés SÉPARÉMENT, taux de première passe fichiers maintenu, chaque réparation scellée. Tout échec INFRA exclu des métriques et rejoué (INV-210).",
  ],
  acceptance: [
    "Au moins 1 run sur 3 SEALED sous triple porte avec cycle de réparation ≤ 1, chaque réparation scellée en preuve (baseline it.7 : 0/3).",
    "Taux de première passe fichiers ≥ 60 % maintenu (baseline it.7 : 97,4 %) — la réparation ne dégrade PAS la qualité première passe.",
    "Zéro réparation INFRA : tout échec classé INFRA est exclu des métriques et rejoué, jamais réparé (INV-210).",
    "Rollback vérifié : EVO-000028 → ROLLED_BACK rend la boucle inerte et l'échec immédiat legacy est restauré sans redéploiement.",
    "Zéro régression : tsc propre, tests few-shot 19/19, porte v3 14/14.",
  ],
  evidencePrefix: 'EV-POLICY',
};

const ROLLBACK_PLAN = "Rollback : EVO-000028 → ROLLED_BACK rend la boucle de réparation immédiatement inerte (isRunRepairActive() = false, registre = interrupteur) — les runs échouent au premier verdict de porte comme en it.7, sans redéploiement ; aucune migration de données ; les preuves de réparation déjà scellées restent dans la chaîne.";

// ── 1. CREATE ──
const created = await post({
  action: 'create',
  title: 'Boucle de réparation ciblée au niveau run : les notes chirurgicales des portes nourrissent une régénération bornée (1 cycle, ≤3 fichiers) — convertir les quasi-réussites en runs SEALED',
  kind: 'WORKFLOW',
  riskClass: 'MEDIUM',
  rationale: RATIONALE,
  proposedBy: ACTOR,
});
console.log('CREATE →', created.proposalUid, created.evidenceUid ?? '');
const uid = created.proposalUid;

// ── 2. SUBMIT ──
const submitted = await post({
  action: 'submit', proposalUid: uid, actor: ACTOR,
  reason: "Proposition fondée sur la mesure PTA-002 it.7 (97,4 % première passe fichiers, 0/3 SEALED, échecs concentrés comportementaux) — le retour d'information des portes existe mais n'atteint jamais le générateur.",
});
console.log('SUBMIT →', submitted.evidenceUid ?? JSON.stringify(submitted).slice(0, 120));

// ── 3. REVIEW (experiment + rollbackPlan attachés) ──
const reviewed = await post({
  action: 'review', proposalUid: uid, actor: ACTOR,
  reason: "Revue AGENT : protocole 9 étapes borné (1 cycle, ≤3 fichiers, 1 tentative chacun), classification INV-210 intouchable, attempts honnête, critères d'acceptation mesurables avec baselines documentées.",
  experiment: EXPERIMENT,
  rollbackPlan: ROLLBACK_PLAN,
});
console.log('REVIEW →', reviewed.evidenceUid ?? JSON.stringify(reviewed).slice(0, 120));
console.log(`\nEVO-000028 (${uid}) prête — état attendu : UNDER_REVIEW. Décision HUMaine via le formulaire inline du panneau Auto-évolution.`);
