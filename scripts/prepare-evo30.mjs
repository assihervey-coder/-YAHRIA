#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — PRÉPARATION EVO-000030 (gouvernée, INV-227)
// AGENT propose → HUMAN décide (formulaire inline du panneau Auto-évolution).
//   bun run scripts/prepare-evo30.mjs
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

const RATIONALE = `PTA-002 itération 9 (fidélité des entrées + contrats inter-fichiers EVO-000029 PROMOTED) a livré les corrections RC1/RC2/RC3 et a été mesurée honnêtement : 0/3 SEALED (AC1 FAIL), 84,6 % première passe, 3/3 boucles engagées, AC2/AC3/AC4 PASS. Les causes réelles, REJOUÉES manuellement sur les workspaces, sont maintenant prouvées : (1) RUN-000027 — le budget « 1 cycle par run » est consommé par la PREMIÈRE porte fautive : syntaxe security.py réparée puis la re-porte boot révèle ImportError (WebhookAck absent de models.py) — le cycle est déjà épuisé, le run meurt avec un diagnostic précis mais SANS seconde chance ; (2) RUN-000028 — les réparations main.py + tests/test_api.py (avec contrats frères correctement injectés) échouent sur la CONNAISSANCE pydantic v2 : GatewaySchema.from_orm() lève PydanticUserError (API v1 morte en v2) et les contrats de payload test↔handler divergent (422≠201, 400≠200) — ni le few-shot ni les contrats frères ne portent ces pièges ; (3) RUN-000027/000029 — prompt-bleed : le générateur a imité les marqueurs de section du prompt (« --- security.py --- » en ligne 1) et la réparation l'a recopié depuis le CURRENT CONTENT — défaut DÉJÀ CORRIGÉ en dehors de cette EVO (S1 anti-prompt-bleed livré + désinfection du prompt de réparation, tests 37/37). Les deux leviers RESTANTS exigent une décision de gouvernance : le levier (1) modifie le budget SIGNÉ EVO-000028 (1 cycle/run → 1 cycle par PORTE, ≤2 cycles/run, toujours borné, attempts honnêtes inchangés) et le levier (2) enrichit le contrat de génération (pièges pydantic v2 : model_validate, model_config from_attributes, réponse dict() → model_dump ; contrats request/response explicites dans le test). Conformément à INV-227, l'AGENT ne modifie JAMAIS un budget signé sans approbation humaine : EVO-000030 propose ces deux extensions avec baselines et critères mesurables.`;

const EXPERIMENT = {
  title: 'Budget de réparation par porte + contrat pydantic v2 — taux de SEALED mesuré sous triple porte',
  protocol: [
    "1. ARMEMENT — isBudgetPerGateActive() : la extension n'est active QUE si EVO-000030 est PROMOTED (registre = interrupteur, INV-227 ; EVO-000028 reste l'ossature, EVO-000029 les fidélités).",
    "2. BUDGET PAR PORTE — studio-pipeline : repairUsed devient repairUsedBoot / repairUsedBehavioral (≤1 cycle chacun, run total ≤2 cycles au lieu de 1) ; l'ordre de passage des portes est inchangé ; chaque cycle garde le budget EVO-000028 (≤3 fichiers, 1 tentative/fichier) et la classification INV-210 intouchable.",
    "3. CONTRAT PYDANTIC V2 — STACK_HINTS PYTHON (studio.ts) enrichi UNIQUEMENT si EVO-000030 PROMOTED : model_validate(obj) au lieu de from_orm()/parse_obj() ; model_config = ConfigDict(from_attributes=True) sur les schémas lisant des ORM/objets ; model_dump() au lieu de .dict() ; exemples one-line. AUCUN autre changement du prompt système.",
    "4. CONTRATS REQUEST/RESPONSE — le contract distillé du few-shot (golden-exemplar.ts, même garde PROMOTED) gagne une ligne : « the pytest file is the BEHAVIORAL contract: read the exact payloads/status codes it sends and expects, and make handlers match them exactly ».",
    "5. HONNÊTETÉ — attempts inchangés (réparation ≠ première passe) ; chaque cycle scellé en preuve (bilan ARTIFACT/INCIDENT) ; re-portes inchangées ; failRun avec historique complet.",
    "6. Tests unitaires : budget par porte (boot réparé PUIS comportemental réparable dans le même run), inerte si EVO-000030 ROLLED_BACK, STACK_HINTS enrichi seulement si PROMOTED, drills registre promotion-safe.",
    "7. Non-régression : tsc src propre, réparation 37/37, few-shot 19/19, porte v3 14/14.",
    "8. MESURE PTA-002 itération 10 : 3 runs sur le brief canonique Hub Mobile Money sous TRIPLE porte — SEALED cycle 0 / cycle ≤1 / cycle ≤2 comptés SÉPARÉMENT, INFRA exclu/rejoué (INV-210), preuve scellée.",
  ],
  acceptance: [
    "Au moins 1 run sur 3 SEALED sous triple porte (baseline it.9 : 0/3, 84,6 % première passe ; it.7 : 0/3, 97,4 %).",
    "Taux de première passe fichiers ≥ 60 % maintenu — les extensions ne dégradent PAS la première passe.",
    "Zéro réparation INFRA (INV-210) et zéro run à plus de 2 cycles de réparation (bornage respecté).",
    "Chaque cycle engagé scellé en preuve avec cibles + réparés + persistants.",
    "Zéro régression : tsc propre, réparation 37/37, few-shot 19/19, porte v3 14/14 ; rollback drill : EVO-000030 ROLLED_BACK resta le budget 1 cycle/run sans redéploiement.",
  ],
  evidencePrefix: 'EV-POLICY',
};

const ROLLBACK_PLAN = "Rollback : EVO-000030 → ROLLED_BACK rend les deux extensions inertes sans redéploiement (isBudgetPerGateActive() = false et STACK_HINTS/contrat inchangés — registre = interrupteur, INV-227) : budget restauré à 1 cycle/run (EVO-000028 seule), prompts de génération restaurés à l'état EVO-000029 ; aucune migration de données ; les preuves déjà scellées restent dans la chaîne.";

// ── 1. CREATE ──
const created = await post({
  action: 'create',
  title: 'Budget de réparation par porte (≤2 cycles/run) + contrat pydantic v2 et payloads de test : les 2 causes réelles restantes de l\u2019it.9 (cascade de portes, connaissance v2) — mesuré sous triple porte',
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
  reason: "Proposition fondée sur la mesure PTA-002 it.9 (0/3 SEALED, 84,6 % première passe, 3 causes REJOUÉES manuellement : cascade de portes épuisant le budget 1 cycle, pièges pydantic v2 hors contrats, prompt-bleed — ce dernier déjà corrigé en bug fix S1).",
});
console.log('SUBMIT →', submitted.evidenceUid ?? JSON.stringify(submitted).slice(0, 120));

// ── 3. REVIEW (experiment + rollbackPlan attachés) ──
const reviewed = await post({
  action: 'review', proposalUid: uid, actor: ACTOR,
  reason: "Revue AGENT : 8 étapes bornées (≤2 cycles/run, INV-210 intouchable, attempts honnêtes), enrichissement de contrat PROMOTED-gated, critères d'acceptation mesurables avec baselines it.7/it.9 documentées.",
  experiment: EXPERIMENT,
  rollbackPlan: ROLLBACK_PLAN,
});
console.log('REVIEW →', reviewed.evidenceUid ?? JSON.stringify(reviewed).slice(0, 120));
console.log(`\nEVO-000030 (${uid}) prête — état attendu : UNDER_REVIEW. Décision HUMAINE via le formulaire inline du panneau Auto-évolution (INV-227).`);
