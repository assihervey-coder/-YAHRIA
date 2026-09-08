#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — PRÉPARATION EVO-000032 (gouvernée, INV-227)
// AGENT propose → HUMAN décide (formulaire inline du panneau Auto-évolution).
//   bun run scripts/prepare-evo32.mjs
// Fondée sur REPRODUCTION VIVANTE des workspaces it.11 :
//   RUN-000042 : 500 /initiate — fabrique enregistre « notch », le test
//     envoie « notchpay » (ValueError: Unsupported gateway) — les clés du
//     dict GATEWAYS = { multi-ligne sont INVISIBLES à extractPythonContracts
//     (top-level STRICT : seules les lignes non indentées sont extraites)
//   RUN-000044 : boot — pesapal.py:10 « from ..security import
//     verify_hmac_signature » JAMAIS ciblé : (a) stderr TAIL 1200 garde la
//     FIN du traceback (frames stdlib importlib + frozen) et perd le DÉBUT
//     (frames workspace) ; (b) le parseur matche importlib/__init__.py:90
//     comme gateways/__init__.py (EV-ARTIFACT-000594) — slot gaspillé
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

const RATIONALE = `PTA-002 itération 11 (fermeture des dépendances EVO-000031 PROMOTED) a été mesurée honnêtement : 0/3 SEALED (AC1 FAIL), 25,6 % première passe sous fabric en rafales (4 rejeus INFRA — AC2 non comparable, leçon it.10), AC3/AC4 PASS. L'ACQUIS est prouvé en live : la classe d'hallucination it.9/it.10 est EMPÊCHÉE — le main.py réparé de RUN-000042 appelle get_gateway(payment_request.gateway, gateway_config) (2 args corrects, RUN-000041 réparé) et security.verify_hmac (vrai symbole du workspace, RUN-000035 réparé) ; le slot le plus sain atteint 2 failed/2 passed (jamais aussi proche : it.9/it.10 étaient 3 failed). Les causes restantes ont été PROUVÉES par reproduction vivante sur les workspaces : (1) RUN-000042 — 500 sur /initiate : la fabrique (non-cible, première passe) enregistre la clé « notch » alors que le contrat comportemental (pytest) envoie « notchpay » — ValueError: Unsupported gateway: notchpay. La clé réelle était INVISIBLE au contexte de génération ET de réparation : extractPythonContracts est top-level STRICT, un littéral multi-ligne GATEWAYS = { ... } n'extrait que la ligne d'ouverture — les clés indentées (« notch » : NotchPayGateway) ne sortent JAMAIS ; (2) RUN-000044 — boot : pesapal.py:10 « from ..security import verify_hmac_signature » (première passe) n'a jamais été ciblé par le cycle de réparation pour deux défauts de fidélité : (a) la capture stderr de la porte de boot garde la QUEUE (1200 car.) du traceback — or les frames WORKSPACE sont au DÉBUT, la note ne contient que les frames stdlib (importlib/__init__.py:90 + frozen importlib, preuve : payload EV-INCIDENT-000597, zéro frame workspace) ; (b) le parseur de frames matche les chemins HORS workspace — « importlib/__init__.py » a été ciblé comme gateways/__init__.py (EV-ARTIFACT-000594 « traceback boot — __init__.py:90 ») : un slot de réparation GASPILLÉ, la vraie frame (pesapal.py:10) hors budget ≤3. EVO-000032 propose deux leviers de fidélité, dans la continuité directe de EVO-000029 (RC1/RC2) : (A) CONTRATS DE REGISTRE — extractPythonContracts capture les littéraux dict/list top-level (lignes indentées de continuation jusqu'à la fermeture, borné ≤8 lignes) : la clé réelle « notchpay » devient visible pour le générateur et la réparation — le pytest EST le contrat, la fabrique doit l'aligner ; (B) FIDÉLITÉ BOOT TOTALE — stderr capté en TÊTE+QUEUE (les frames workspace d'abord) ET exclusion des frames hors arbre (chemins interpréteur/stdlib/frozen/site-packages) dans le ciblage : le budget ≤3 n'est plus gaspillé. Tout le reste du protocole signé est inchangé (≤3 fichiers, 1 tentative/fichier, budget par porte EVO-000030, fermeture EVO-000031, INV-210). Conformément à INV-227, l'AGENT propose et n'implémente qu'après PROMOTED.`;

const EXPERIMENT = {
  title: 'Contrats de registre (clés dict top-level visibles) + fidélité boot totale (tête+queue, frames hors arbre exclues) — convertir les quasi-réussites 2/4 en SEALED, mesuré it.12',
  protocol: [
    "1. ARMEMENT — isRegistryContractsActive() + isBootFidelityActive() : pattern golden-exemplar (TTL 5s, catch→false), actifs UNIQUEMENT si EVO-000032 est PROMOTED (registre = interrupteur, INV-227 ; resets de cache pour drills promotion-safe).",
    "2. CONTRATS DE REGISTRE — extractPythonContracts(content, opts) : quand EVO-000032 PROMOTED, une ligne top-level se terminant par '{' ou '[' (ou ': {') capture les lignes indentées de continuation JUSQU'À la fermeture, borné ≤8 lignes / 110 car./ligne — les clés de fabrique (« notch » : NotchPayGateway) entrent dans le contrat ; défaut sans opts = comportement signé EXACT (rollback).",
    "3. FIDÉLITÉ BOOT — boot-gate.ts : stderr conservé en TÊTE (premiers 800 car. — frames workspace) + QUEUE (1200 car. — ImportError finale) au lieu de tail seul ; frames du traceback extraites en EXCLUANT tout chemin hors arbre (match strict contre treePaths : « importlib/__init__.py » stdlib n'est plus confondu avec gateways/__init__.py).",
    "4. CIBLAGE — mapGateNotesToTargets : les frames boot ne matchent que des chemins de l'arbre planifié (suffixe exact depuis le workspace, jamais un chemin interpréteur /home/z/.local/... ou <frozen ...) — le budget ≤3 va aux vraies frames.",
    "5. PÉRIMÈTRE INTACT — ≤3 fichiers/cycle, 1 tentative/fichier, budget par porte (EVO-000030), fermeture des dépendances (EVO-000031), classification INV-210, verdict 2000 car., re-porte orchestrateur, ZIP rafraîchi : AUCUN autre changement.",
    "6. Tests unitaires T12 : (a) GATEWAYS = { multi-ligne → clés extraites ; (b) défaut sans EVO-000032 → extraction STRICTE inchangée (rollback) ; (c) traceback boot réel it.11 (RUN-000044) → pesapal.py ciblé, importlib/__init__.py JAMAIS ; (d) stderr tête+queue → frame workspace présente dans la note ; (e) drills promotion-safe état EXACT restauré.",
    "7. Non-régression : tsc src propre, réparation 61/61, few-shot 19/19, porte v3 14/14.",
    "8. MESURE PTA-002 itération 12 : 3 runs sur le brief canonique — SEALED cycle 0/≤1/≤2 comptés SÉPARÉMENT, INFRA exclu/rejoué (INV-210), preuve scellée ; état fabric documenté en tête de mesure (comparabilité AC2 déclarée seulement sur fabric saine).",
  ],
  acceptance: [
    "Au moins 1 run sur 3 SEALED sous triple porte (baselines : it.7 0/3 à 97,4 % ; it.9 0/3 à 84,6 % saine ; it.10 0/3 à 20,5 % dégradée ; it.11 0/3 à 25,6 % dégradée — meilleur slot 2 failed/2 passed).",
    "Taux de première passe ≥ 60 % sur fabric saine (comparabilité it.9 ; sur fabric dégradée, comparabilité déclarée non valide — leçon it.10/it.11).",
    "Zéro réparation INFRA (INV-210), zéro run à plus de 2 cycles (budget par porte EVO-000030 respecté).",
    "Chaque cycle engagé scellé en preuve ; les cibles boot ne contiennent AUCUN chemin hors arbre ; les notes boot contiennent les frames workspace.",
    "Zéro régression : tsc propre, réparation 61/61, few-shot 19/19, porte v3 14/14 ; rollback drill : EVO-000032 ROLLED_BACK resta l'extraction STRICTE et le tail seul, sans redéploiement.",
  ],
  evidencePrefix: 'EV-POLICY',
};

const ROLLBACK_PLAN = "Rollback : EVO-000032 → ROLLED_BACK rend les deux leviers inertes sans redéploiement (isRegistryContractsActive() et isBootFidelityActive() = false — registre = interrupteur, INV-227) : extractPythonContracts restaurée à l'extraction STRICTE signée, stderr boot restauré au tail 1200 seul, ciblage restauré au matching actuel ; aucune migration de données ; les preuves déjà scellées restent dans la chaîne ; it.12 reste valide comme mesure de l'état EVO-000031.";

// ── 1. CREATE ──
const created = await post({
  action: 'create',
  title: 'Contrats de registre (clés dict top-level visibles à génération et réparation) + fidélité boot totale (stderr tête+queue, frames hors arbre exclues du ciblage) — les 2 causes restantes de l\u2019it.11 (clé « notch » vs « notchpay », pesapal.py:10 jamais ciblé), prouvées par reproduction',
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
  reason: "Proposition fondée sur reproduction vivante it.11 : RUN-000042 (clé fabrique « notch » invisible — extractPythonContracts multi-ligne aveugle ; ValueError Unsupported gateway) ; RUN-000044 (pesapal.py:10 jamais ciblé — stderr tail perd les frames workspace + frames stdlib matchées hors arbre, slot gaspillé EV-ARTIFACT-000594). Acquisition EVO-000031 prouvée : hallucinations 2-args/symbole EMPÊCHÉES.",
});
console.log('SUBMIT →', submitted.evidenceUid ?? JSON.stringify(submitted).slice(0, 120));

// ── 3. REVIEW (experiment + rollbackPlan attachés) ──
const reviewed = await post({
  action: 'review', proposalUid: uid, actor: ACTOR,
  reason: "Revue AGENT : 2 leviers de fidélité purs et bornés (≤8 lignes de continuation ; tête 800 + queue 1200 ; matching d'arbre strict), périmètre signé intact (≤3 fichiers, 1 tentative, budget par porte, fermeture, INV-210), critères mesurables avec baselines it.7→it.11.",
  experiment: EXPERIMENT,
  rollbackPlan: ROLLBACK_PLAN,
});
console.log('REVIEW →', reviewed.evidenceUid ?? JSON.stringify(reviewed).slice(0, 120));
console.log(`\nEVO-000032 (${uid}) prête — état attendu : UNDER_REVIEW. Décision HUMAINE via le formulaire inline du panneau Auto-évolution (INV-227).`);
