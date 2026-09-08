#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — PRÉPARATION EVO-000031 (gouvernée, INV-227)
// AGENT propose → HUMAN décide (formulaire inline du panneau Auto-évolution).
//   bun run scripts/prepare-evo31.mjs
// Fondée sur REPRODUCTION VIVANTE des workspaces it.10 (session du jour) :
//   RUN-000035 : import main → ImportError verify_hmac absent de security.py
//   RUN-000041 : 3 pytest FAIL = 3 appels vers contrats invisibles
//     · test_initiate_payment 500 — get_gateway(name) vs réel (name, config)
//     · test_webhook_handler 500 — verify_webhook_signature(...) vs réel verify_hmac(...)
//     · test_webhook_handler_invalid_signature 500 — idem
// Mécanisme (run-repair-loop.ts buildSiblingContracts L363-396) :
//   maxSiblings=3 + co-cibles d'abord → les co-cibles (2-3) consomment TOUS
//   les slots ; les imports internes réels arrivent DERNIERS et sont
//   structurellement exclus ; budget 2400 car. souvent épuisé avant eux.
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

const RATIONALE = `PTA-002 itération 10 (budget par porte + contrat pydantic v2, EVO-000030 PROMOTED) a prouvé les 3 AC mécaniques en live : budget par porte respecté (cycles 1 puis 2 [BOOT+BEHAVIORAL] observés, jamais >2/run), zéro réparation INFRA, 100 % des cycles scellés (AC3/AC4 PASS) — mais 0/3 SEALED (AC1 FAIL) sous fabric dégradée, première passe 20,5 % non comparable (bruit). La décision HUMAN demandée aujourd\u2019hui (re-mesure it.10\u2019 vs EVO-000031) a été TRANCHÉE par reproduction vivante sur les workspaces réels : les causes restantes sont des appels vers des contrats INVISIBLES au cycle de réparation, prouvées fichier par fichier — (A) RUN-000035 : après réparation, « import main » lève ImportError: cannot import name 'verify_hmac' from 'security' — pesapal.py RÉPARÉ importe un symbole que security.py (NON cible du cycle, exports réels : create_token, verify_webhook_signature, _base64url_encode) ne définit pas ; (B) RUN-000041 : les 3 échecs pytest sont TROIS appels hallucinés depuis main.py réparé — get_gateway(name) au lieu de get_gateway(name, config) (fabrique gateways/__init__.py NON cible) et security.verify_webhook_signature(...) alors que le workspace définit verify_hmac(...) — soit exactement la classe « contrat inter-fichiers » de l\u2019it.8, mais côté DÉPENDANCES EXISTANTES. Le mécanisme est localisé dans le code signé : buildSiblingContracts (EVO-000029, run-repair-loop.ts L363-396) ordonne « co-cibles d\u2019abord » puis imports internes, avec maxSiblings=3 et 2400 car. — or un cycle cible 2-3 fichiers co-réparés qui consomment TOUS les slots et épuisent le budget : les dépendances stables (gateways/__init__.py, security.py) sont structurellement exclues. INVERSION DE PRIORITÉ : les co-cibles sont mutables (régénérées dans le MÊME cycle), les dépendances existantes sont la vérité FIXE — ce sont elles qui doivent entrer en premier. Une re-mesure it.10\u2019 seule ne teste AUCUNE hypothèse nouvelle : it.9 a déjà été mesurée sur fabric SAINE (0 INFRA, 0 rejeu, 84,6 % première passe) et restait 0/3 avec ces mêmes signatures. EVO-000031 propose le levier unique minimal : fermeture d\u2019imports dans le contexte de réparation (imports réels de la cible d\u2019abord, co-cibles ensuite, bornes relevées 5 frères / 3600 car.), tout le reste du protocole signé inchangé. Conformément à INV-227, l\u2019AGENT propose et n\u2019implémente qu\u2019après PROMOTED.`;

const EXPERIMENT = {
  title: 'Fermeture des dépendances dans le contexte de réparation — conversion des échecs « contrat invisible » en SEALED, mesurée it.11',
  protocol: [
    "1. ARMEMENT — isDependencyClosureActive() : pattern golden-exemplar (requête Prisma evolutionProposal, TTL 5s, catch→false) ; active la fermeture UNIQUEMENT si EVO-000031 est PROMOTED (registre = interrupteur, INV-227 ; resetBudgetPerGate-style cache reset pour drills).",
    "2. ORDRE INVERSÉ — buildSiblingContracts : (a) modules internes RÉELLEMENT importés par le contenu courant de la cible (resolvePythonImports, déjà appelé L381, dédupliqué) en PREMIER — contrats stables lus À JOUR en DB ; (b) co-cibles du cycle ENSUITE ; (c) fichiers absents/vides jamais inventés (INV-210, inchangé).",
    "3. BORNES RELEVÉES — maxSiblings 3→5, maxChars 2400→3600 (les deux sous le même break budget<=200) ; extractPythonContracts inchangé (signatures top-level STRICTES, EVO-000029) ; le SIBLING CONTRACTS point (L505-507) garde son texte, seule la liste change.",
    "4. PÉRIMÈTRE INTACT — ≤3 fichiers/cycle, 1 tentative/fichier, budget par porte EVO-000030, classification INV-210, verdict 2000 car., ciblage notes chirurgicales EVO-000029, re-porte par orchestrateur, ZIP rafraîchi, failRun historique complet : AUCUN autre changement.",
    "5. HORS PÉRIMÈTRE EXPLICITE — pas d\u2019exécution d\u2019import-smoke dans la boucle (subprocess Python : non signé ici) ; pas de re-mesure it.10\u2019 dédiée (it.11 fournira la comparaison fabric saine si l\u2019état le permet, comparabilité AC2 documentée comme en it.10).",
    "6. Tests unitaires T11 (pta-repair-loop-test.ts) : fixtures RÉELLES — (a) réparer un main.py qui importe gateways DOIT présenter la signature get_gateway(name, config) de gateways/__init__.py ; (b) réparer un pesapal.py qui importe security DOIT présenter les exports réels de security.py (create_token/verify_webhook_signature) ; (c) ordre imports-d\u2019abord même quand les co-cibles rempliraient les slots ; (d) bornes 5/3600 ; (e) drills armement promotion-safe (état EXACT restauré).",
    "7. Non-régression : tsc src propre, réparation 51/51, few-shot 19/19, porte v3 14/14.",
    "8. MESURE PTA-002 itération 11 : 3 runs sur le brief canonique Hub Mobile Money — SEALED cycle 0 / ≤1 / ≤2 comptés SÉPARÉMENT, INFRA exclu/rejoué (INV-210), preuve scellée ; état fabric documenté en tête de mesure.",
  ],
  acceptance: [
    "Au moins 1 run sur 3 SEALED sous triple porte (baselines : it.7 0/3 à 97,4 % ; it.9 0/3 à 84,6 % fabric saine ; it.10 0/3 à 20,5 % fabric dégradée non comparable).",
    "Taux de première passe ≥ 60 % sur fabric saine — la fermeture ne dégrade PAS la première passe (sur fabric dégradée, comparabilité déclarée non valide, comme en it.10).",
    "Zéro réparation INFRA (INV-210), zéro run à plus de 2 cycles (budget par porte EVO-000030 respecté).",
    "Chaque cycle engagé scellé en preuve avec cibles + réparés + persistants ; les dépendances injectées visibles dans le payload du cycle.",
    "Zéro régression : tsc propre, réparation 51/51, few-shot 19/19, porte v3 14/14 ; rollback drill : EVO-000031 ROLLED_BACK resta l\u2019ordre co-cibles-d\u2019abord et les bornes 3/2400 sans redéploiement.",
  ],
  evidencePrefix: 'EV-POLICY',
};

const ROLLBACK_PLAN = "Rollback : EVO-000031 → ROLLED_BACK rend la fermeture inerte sans redéploiement (isDependencyClosureActive() = false — registre = interrupteur, INV-227) : buildSiblingContracts restaurée à l\u2019ordre et aux bornes signés EVO-000029 (co-cibles d\u2019abord, 3 frères, 2400 car.) ; aucune migration de données ; les preuves déjà scellées restent dans la chaîne ; it.11 reste valide comme mesure de l\u2019état EVO-000030.";

// ── 1. CREATE ──
const created = await post({
  action: 'create',
  title: 'Fermeture des dépendances dans le contexte de réparation : imports réels de la cible avant les co-cibles (5 frères / 3600 car.) — les 3 échecs restants it.9/it.10 sont des appels vers des contrats invisibles (prouvés par reproduction sur workspaces)',
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
  reason: "Proposition fondée sur reproduction vivante des workspaces it.10 : RUN-000035 ImportError verify_hmac (security.py non cible) ; RUN-000041 3 pytest FAIL = 3 appels hallucinés (get_gateway 1 arg, verify_webhook_signature vs verify_hmac) ; mécanisme localisé buildSiblingContracts L363-396 (co-cibles consomment tous les slots). Décision HUMAN demandée : re-mesure vs EVO-000031 — tranchée EVO-000031 car it.9 déjà mesurée sur fabric saine 0/3.",
});
console.log('SUBMIT →', submitted.evidenceUid ?? JSON.stringify(submitted).slice(0, 120));

// ── 3. REVIEW (experiment + rollbackPlan attachés) ──
const reviewed = await post({
  action: 'review', proposalUid: uid, actor: ACTOR,
  reason: "Revue AGENT : levier unique minimal (ordre + bornes dans buildSiblingContracts), 8 étapes bornées, périmètre signé intact (≤3 fichiers, 1 tentative, budget par porte, INV-210), hors-périmètre explicite (pas d'import-smoke subprocess, pas de re-mesure dédiée), critères mesurables avec baselines it.7/9/10.",
  experiment: EXPERIMENT,
  rollbackPlan: ROLLBACK_PLAN,
});
console.log('REVIEW →', reviewed.evidenceUid ?? JSON.stringify(reviewed).slice(0, 120));
console.log(`\nEVO-000031 (${uid}) prête — état attendu : UNDER_REVIEW. Décision HUMAINE via le formulaire inline du panneau Auto-évolution (INV-227).`);
