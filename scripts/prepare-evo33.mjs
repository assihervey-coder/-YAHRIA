#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — PRÉPARATION EVO-000033 (gouvernée, INV-227)
// AGENT propose → HUMAN décide (formulaire inline du panneau Auto-évolution).
//   bun run scripts/prepare-evo33.mjs
// Fondée sur REPRODUCTION VIVANTE des workspaces it.12 + dossier fabric :
//   RUN-000051 : pytest 5 failed — tests attendent « name » et postent
//     /webhook/<G> ; main.py renvoie « service » et définit /webhooks/{g}
//     → divergence de contrat INTER-CO-GÉNÉRÉS ; réparations BEHAVIORAL
//     jamais invoquées (zai:circuit OPEN — EV-INCIDENT-000730/734/735)
//   RUN-000052 : pesapal.py:7 « class PesaPal » vs __init__.py « from
//     .pesapal import PesaPalGateway » — latent dès la première passe,
//     exposé par la réparation, jamais ciblé ; scellé payload de porte
//     tronqué à 600 car. (boot-gate.ts:321) — frames workspace perdues
//   MÉCANISME : dependsOn VID pour 13/13 fichiers (blueprints RUN-000051/
//     000052) → contexte frère studio-pipeline.ts:226-230 INERT et tri
//     topologique studio.ts:472-484 DÉGÉNÉRÉ (rang de rôle seul) →
//     __init__.py (importeur) généré 1ᵉʳ, pesapal.py 6ᵉ, tests 12ᵉ —
//     aucun fichier ne voit jamais ses frères
//   FABRIC : 19/29 runs INFRA (65 %) depuis it.10 ; 55-57 tentatives de
//     génération par run en ~3 min (~19 appels LLM/min) → limitation zai
//     → circuit OPEN (cooldown 90s) → tentatives à sec en cascade
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

const RATIONALE = `PTA-002 itération 12 (contrats de registre + fidélité boot EVO-000032 PROMOTED) a été mesurée honnêtement : 0/2 SEALED comptés (slot 3 INFRA-EXCLU après 6 runs INFRA cumulés — AC1 FAIL), 0 % première passe sous fabric en rafales (AC2 non comparable — 3ᵉ itération consécutive), AC3/AC4 PASS. Les acquisitions EVO-000031/032 restent debout (fermeture des dépendances, clés de registre, fidélité boot) mais DEUX NOUVELLES causes ont été PROUVÉES par reproduction vivante des workspaces (preuves EV-FORENSIC-000861/000862, EV-METRIC-000863) : (1) DIVERGENCE DE CONTRAT ENTRE CO-GÉNÉRÉS — RUN-000051 : tests/test_api.py attend la clé « name » et poste /webhook/NotchPay (singulier) tandis que main.py renvoie « service » et définit /webhooks/{gateway} (pluriel) → 404 ; RUN-000052 : gateways/pesapal.py:7 définit « class PesaPal » tandis que gateways/__init__.py importe « PesaPalGateway » → ImportError au boot, latent dès la première passe, jamais ciblé par la réparation. MÉCANISME RACINE PROUVÉ : les blueprints réels des deux runs déclarent dependsOn VIDE pour les 13/13 fichiers → l'injection du contenu des dépendances (studio-pipeline.ts:226-230) est INERTE et l'ordonnancement topologique (studio.ts:472-484) DÉGÉNÈRE en rang de rôle — gateways/__init__.py (l'importeur) est généré EN PREMIER, pesapal.py en 6ᵉ, tests/test_api.py en 12ᵉ : chaque fichier est généré depuis le brief seul, aucun ne voit jamais les contrats de ses frères. Le contrat est invisible AUX DEUX SENS aussi en réparation : main.py n'importe pas tests/test_api.py (la fermeture EVO-000031 est inapplicable au sens test→impl) et extractPythonContracts capture les SIGNATURES des tests sans leurs ASSERTIONS (routes appelées, clés attendues) ; réparer pesapal.py ne voit pas son DÉPENDANT inverse gateways/__init__.py. (2) SCELLÉ INFIDÈLE — la porte de boot scelle chaque detail de stage tronqué à 600 caractères (boot-gate.ts:321) : la note BF-2 live (tête 800 + queue 1200, ~2000 car., consommée en intégralité par le ciblage via l'objet live studio-pipeline.ts:349) est scellée réduit à sa TÊTE site-packages (uvicorn/click) — les frames workspace (main.py:6 → __init__.py:3) sont perdues du TRACÉ scellé : le post-mortem (celui-ci même) doit reconstruire depuis les workspaces. (3) CONFOUNDEUR FABRIC QUANTIFIÉ — 19/29 runs (65 %) classés INFRA depuis it.10 ; charge mesurée : 57 tentatives de génération pour 13 fichiers (RUN-000051), 55 (RUN-000052) en fenêtres ~3 min soit ~19 appels LLM/minute soutenus : le pacing inter-fichiers existant (700 ms, studio-pipeline.ts:218) ne couvre pas la cascade — quand le circuit s'ouvre (cooldown 90 s), les tentatives suivantes partent À SEC et échouent instantanément, ce qui accélère la rafale (cercle vicieux) ; en slot 1 les réparations BEHAVIORAL n'ont JAMAIS invoqué le LLM (EV-INCIDENT-000730/734/735 « LLM fabric exhausted — zai:circuit OPEN ») : l'effet EVO-000031/032 y est NON EXERCÉ. EVO-000033 propose QUATRE leviers de fidélité, dans la continuité directe de EVO-000029/31/32 : (A) CONTRATS CROISÉS EN GÉNÉRATION — (A1) registre incrémental par run : chaque fichier VÉRIFIÉ alimente un registre de contrats (signatures classes/defs, clés de registre EVO-000032, routes des décorateurs @app.*/@router.*, littéraux de retour des handlers bornés ≤8 lignes) injecté dans les prompts suivants (borné 3600 car.) ; (A2) arêtes dependsOn DÉRIVÉES de façon déterministe quand le planificateur n'en émet pas (règles conservatives : pkg/__init__.py→frères du package ; entry→modules top-level et packages de l'arbre ; tests/*→entry et modules top-level) alimentant l'ordonnancement topologique EXISTANT — gateways/__init__.py est généré APRÈS pesapal.py et voit « class PesaPal » ; tests voient les routes et clés réelles de main.py. (B) RÉPARATION CROISÉE — buildSiblingContracts ajoute aux contrats : les DÉPENDANTS INVERSES de la cible (fichiers qui l'importent, calculés depuis les imports réels des fichiers VERIFIED) et les ASSERTIONS des tests (routes client.get/post, clés « x » in data) — bornes inchangées (5 frères/3600 car. EVO-000031). (C) SCELLÉ FIDÈLE — cap des details scellés 600 → 2400 car., format tête 1200 + marqueur + queue 1200 au-delà : les preuves de porte contiennent les frames workspace. (D) BACKOFF FABRIC — dans la boucle de tentatives par fichier (studio.ts generateFileContent), si la note contient « fabric exhausted »/« circuit OPEN », UNE attente bornée (≤90 s, une fois par fichier) avant la tentative suivante au lieu d'enchaîner à sec ; pacing 700 ms conservé ; INV-210 INTACT (le backoff réduit la cascade, ne re-classe rien : un échec fabric reste INFRA, jamais réparé). Tout le reste du protocole signé est inchangé (≤3 fichiers/cycle, 1 tentative/fichier, budget par porte EVO-000030, fermeture EVO-000031, registres EVO-000032, classification INV-210, portes, ZIP). Conformément à INV-227, l'AGENT propose et n'implémente qu'après PROMOTED.`;

const EXPERIMENT = {
  title: 'Contrats croisés inter-co-générés (registre génération + arêtes dérivées ; dépendants inverses + assertions de test en réparation) + scellé fidèle 2400 + backoff fabric — convertir les divergences prouvées it.12 en SEALED, mesuré it.13',
  protocol: [
    "1. ARMEMENT — quatre interrupteurs indépendants, pattern golden-exemplar (TTL 5s, catch→false, resets pour drills) : isCrossContractsActive() (A — génération), isReverseDependentsActive() (B — réparation), isSealedFidelityActive() (C — scellé), isFabricBackoffActive() (D — tentatives) ; actifs UNIQUEMENT si EVO-000033 est PROMOTED (INV-227).",
    "2. GC1 REGISTRE INCRÉMENTAL (A1) — registre de contrats par run : après chaque fichier VÉRIFIÉ, extractPythonContracts(content, {registry:true, routes:true, returns:true}) — ajoute aux acquis EVO-000032 : routes des décorateurs (@app.get/post(« /chemin »), @router.*) et littéraux de retour des handlers (return { ... }, ≤8 lignes/110 car. comme REGISTRY_MAX_CONTINUATION) ; le registre cumulé (JSON compact, borné 3600 car., plus-adjacent d'abord : même package, puis imports/imports inverses, puis reste) est injecté dans le prompt des fichiers suivants ; défaut sans EVO-000033 = prompt inchangé EXACT (rollback).",
    "3. GC2 ARÊTES DÉRIVÉES (A2) — quand un entry du blueprint a dependsOn vide : dérivation DÉTERMINISTE conservative — pkg/__init__.py → chaque frère *.py du même package ; entry (main.py/app.py) → modules top-level + packages déclarés de l'arbre ; tests/* → entry + modules top-level ; les arêtes alimentent l'ordonnancement topologique EXISTANT (studio.ts:472-484, cycles brisés par rang de rôle) — AUCUN autre changement d'ordre ; défaut sans EVO-000033 = dependsOn vide signé.",
    "4. XR RÉPARATION CROISÉE (B) — buildSiblingContracts : (a) DÉPENDANTS INVERSES de la cible (fichiers VERIFIED qui l'importent — calculés par extension de importsByFile à tous les fichiers non-test) placés APRÈS les imports réels (EVO-000031) et AVANT les co-cibles ; (b) opts.testAssertions : extractPythonContracts capture les routes appelées (client.get/post(« ... »)) et les clés assertées (assert « x » in data) d'un fichier test — le contrat test↔implémentation devient visible aux deux sens ; bornes inchangées (5 frères/3600 car.) ; défaut sans EVO-000033 = ordre signé EVO-000031 EXACT.",
    "5. BF3 SCELLÉ FIDÈLE (C) — boot-gate.ts:321 : cap des details de stages scellés 600 → 2400 car. ; au-delà : tête 1200 + marqueur d'omission + queue 1200 (même format BF-2) — les preuves EV-ARTIFACT/EV-INCIDENT de porte contiennent les frames workspace ; la note LIVE consommée par le ciblage est INCHANGÉE (elle est déjà complète) ; défaut sans EVO-000033 = slice(0,600) signé.",
    "6. FB BACKOFF FABRIC (D) — studio.ts generateFileContent, boucle for maxAttempts : si la note de la tentative précédente matche /fabric exhausted|circuit OPEN/i → UNE attente de 90 s MAXIMUM (une seule fois par fichier, log scellé) avant la tentative suivante ; le pacing inter-fichiers 700 ms (studio-pipeline.ts:218) est CONSERVÉ ; classification INV-210 INTACTE (le backoff ne re-classe rien — un échec fabric reste INFRA, jamais réparé, rejeté au rejeu) ; défaut sans EVO-000033 = enchaînement à sec signé.",
    "7. PÉRIMÈTRE INTACT — ≤3 fichiers/cycle, 1 tentative/fichier, budget par porte (EVO-000030), fermeture des dépendances (EVO-000031), registres + fidélité boot (EVO-000032), few-shot (EVO-000027), portes boot/comportementale/complétude, verdict 2000 car., ZIP rafraîchi : AUCUN autre changement.",
    "8. Tests T13 (fixtures réelles RUN-000051/000052) : (a) ledger — pesapal.py vérifié avant __init__.py → « class PesaPal » visible au prompt de __init__.py ; (b) arêtes dérivées — __init__→frères, entry→modules, tests→entry : l'ordre topologique place pesapal.py AVANT gateways/__init__.py ; (c) tests voient /webhooks/{gateway} et les clés réelles de main.py au registre ; (d) XR — réparer pesapal.py voit gateways/__init__.py (dépendant inverse) ; réparer main.py voit les assertions de tests/test_api.py (routes « /webhook/NotchPay », clé « name ») ; (e) BF3 — la note BOOT scellée contient la queue (frames workspace main.py:6 → __init__.py:3) ; (f) FB — note « circuit OPEN » → attente simulée (horloge mockée) puis tentative, UNE seule ; (g) défauts sans EVO-000033 — les QUATRE comportements signés restaurés EXACT ; (h) drills promotion-safe ROLLED_BACK/re-PROMOTED, états EXACTS.",
    "9. Non-régression : tsc src propre, réparation 80/80 + T13, few-shot 19/19, porte v3 14/14.",
    "10. MESURE PTA-002 itération 13 : 3 runs sur le brief canonique (Hub Mobile Money), backoff armé — SEALED cycle 0/≤1/≤2 comptés SÉPARÉMENT, INFRA exclu/rejoué (INV-210), pré-vol à onze gates, état fabric documenté en tête ; AC2 comparable seulement si fabric saine (avec FB, première mesure depuis it.9 où la fabric est sous contrôle).",
  ],
  acceptance: [
    "Au moins 1 run sur 3 SEALED sous triple porte (baselines : it.7 0/3 à 97,4 % ; it.9 0/3 à 84,6 % saine ; it.10 0/3 à 20,5 % ; it.11 0/3 à 25,6 % ; it.12 0/2 à 0 % — toutes fabric dégradée sauf it.7/it.9).",
    "Taux de première passe ≥ 60 % sur fabric saine ; zéro divergence INTER-CO-GÉNÉRÉS résiduelle de la classe prouvée (nom de classe importé absent, route singulier/pluriel, clé de réponse) dans les runs restés en échec — toute récurrence doit être explicable par une cause NOUVELLE, pas la même.",
    "Zéro réparation INFRA (INV-210), zéro run à plus de 2 cycles (budget par porte EVO-000030), classification inchangée par le backoff.",
    "Toute preuve de porte scellée contient les frames workspace quand le traceback en a (BF3 vérifié sur les evidences it.13) ; le registre de génération est borné (≤3600 car.) et l'ordre topologique dérivé vérifié par test.",
    "Zéro régression : tsc propre, réparation 80/80+T13, few-shot 19/19, porte v3 14/14 ; rollback drill : EVO-000033 ROLLED_BACK resta les QUATRE comportements signés (prompt sans registre, dependsOn vide, ordre EVO-000031 en réparation, scellé 600, enchaînement à sec) sans redéploiement.",
  ],
  evidencePrefix: 'EV-POLICY',
};

const ROLLBACK_PLAN = "Rollback : EVO-000033 → ROLLED_BACK rend les quatre leviers inertes sans redéploiement (isCrossContractsActive/isReverseDependentsActive/isSealedFidelityActive/isFabricBackoffActive = false) : prompts de génération restaurés au format signé (sans registre), dependsOn restaurés vides et ordre au rang de rôle seul, buildSiblingContracts restauré à l'ordre signé EVO-000031 (imports réels puis co-cibles), scellé de porte restauré à slice(0,600), boucle de tentatives restaurée à l'enchaînement à sec ; aucune migration de données ; les preuves scellées restent dans la chaîne ; it.12 reste valide comme mesure de l'état EVO-000032.";

// ── 1. CREATE ──
const created = await post({
  action: 'create',
  title: 'Contrats croisés inter-co-générés (registre de génération + arêtes dérivées ; dépendants inverses + assertions de test en réparation) + scellé fidèle + backoff fabric — les causes restantes de l\u2019it.12 (PesaPal vs PesaPalGateway ; « name » vs « service », /webhook vs /webhooks ; 65 % de runs INFRA), prouvées par reproduction',
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
  reason: "Proposition fondée sur reproduction vivante it.12 (EV-FORENSIC-000861/000862, EV-METRIC-000863) : RUN-000051 (divergence test↔impl — « name »/« service », /webhook vs /webhooks, réparations jamais invoquées circuit OPEN) ; RUN-000052 (class PesaPal vs import PesaPalGateway — latent, exposé par la réparation ; scellé tronqué 600 car.) ; mécanisme racine : dependsOn vide 13/13 → contexte frère inerte + ordre anti-topologique ; fabric : 19/29 runs INFRA, ~19 appels LLM/min en cascade.",
});
console.log('SUBMIT →', submitted.evidenceUid ?? JSON.stringify(submitted).slice(0, 120));

// ── 3. REVIEW (experiment + rollbackPlan attachés) ──
const reviewed = await post({
  action: 'review', proposalUid: uid, actor: ACTOR,
  reason: "Revue AGENT : quatre leviers de fidélité purs, bornés et indépendants (registre ≤3600 car. ; arêtes conservatives déterministes ; bornes 5/3600 inchangées en réparation ; scellé 2400 tête+queue ; backoff unique ≤90 s sans toucher INV-210), périmètre signé intact (≤3 fichiers, 1 tentative, budget par porte, fermeture, registres, fidélité boot), critères mesurables avec baselines it.7→it.12 et fixtures réelles RUN-000051/052.",
  experiment: EXPERIMENT,
  rollbackPlan: ROLLBACK_PLAN,
});
console.log('REVIEW →', reviewed.evidenceUid ?? JSON.stringify(reviewed).slice(0, 120));
console.log(`\nEVO-000033 (${uid}) prête — état attendu : UNDER_REVIEW. Décision HUMAINE via le formulaire inline du panneau Auto-évolution (INV-227, rollback ≥15 car.).`);
