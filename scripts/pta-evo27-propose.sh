#!/usr/bin/env bash
# EVO-000027 — Few-shot exemplaire doré : RUN-000023-corrige injecté au générateur.
# Usage: bash pta-evo27-propose.sh create|submit|review|status
set -euo pipefail
API="http://localhost:3000/api/yahria/evolution"
ACTOR_AGENT='{"type":"AGENT","id":"super-z"}'

case "${1:-}" in
  create)
    curl -s -X POST "$API" -H 'Content-Type: application/json' -d @- <<'JSON' | python3 -m json.tool
{
  "action": "create",
  "title": "Few-shot exemplaire doré : RUN-000023-corrige injecté au générateur — taux de première passe mesuré honnêtement",
  "kind": "PROMPT",
  "riskClass": "MEDIUM",
  "proposedBy": { "type": "AGENT", "id": "super-z" },
  "rationale": "PTA-002 a mesuré 0/3 runs au premier passage sous double porte (RUN-000024/25/26 : boot FAIL, pytest 9 failed, fabric circuit OPEN). Le générateur ne manque pas de règles (S1 INV-080 rejette placeholders et contenus courts) mais d'un EXEMPLAIRE POSITIF concret de la barre de qualité visée : le modèle ne voit jamais à quoi ressemble un fichier qui passe réellement les portes. RUN-000023-corrige est cet étalon : SEALED au premier passage sous porte de boot, pytest 7/7 après correction, structure FastAPI idiomatique (11 fichiers). Injecter ce few-shot au prompt système du coder agent (contrat distillé des leçons scellées RUN-000022/23/24-26 + un fichier exemplaire complet pour la stack PYTHON) est le prochain levier de taux de première passe. La mesure sera honnête par construction : la triple porte est armée (EVO-000016/25/26 PROMOTED) et la porte v3 classifie tout effondrement INFRA (circuit OPEN) hors des métriques d'apprentissage (INV-210) — un progrès ne pourra plus être masqué par une panne, un échec modèle ne pourra plus être maquillé en panne.",
  "sourceInsightNote": "Suite directe de EVO-000026 (porte v3) dont la rationale posait le few-shot comme prochain levier après fermeture du trou de complétude."
}
JSON
    ;;
  submit)
    curl -s -X POST "$API" -H 'Content-Type: application/json' -d @- <<'JSON' | python3 -m json.tool
{
  "action": "submit",
  "proposalUid": "EVO-000027",
  "actor": { "type": "AGENT", "id": "super-z" },
  "reason": "Proposition fondée sur mesures scellées : 0/3 runs premier passage (RUN-000024/25/26), exemplaire doré disponible (RUN-000023-corrige, pytest 7/7, boot PASS), triple porte armée garantissant une mesure honnête (v3 classifie INFRA hors métriques).",
  "experiment": {
    "title": "Taux de première passe avant/après few-shot, mesuré sous triple porte",
    "protocol": [
      "1. Créer golden-exemplar.ts (YAHRIA-STD-006) : isGoldenFewShotActive() armé UNIQUEMENT si EVO-000027 PROMOTED (registre = interrupteur, INV-227) ; lecture FS de upload/RUN-000023-corrige/ avec cache mémoire ; goldenSystemAddendum(stack, entry).",
      "2. Addendum prompt : pour PYTHON — contrat distillé des leçons scellées (instance nommée app = FastAPI( pour la découverte boot, imports complets vérifiés, symboles inter-fichiers verbatim, pas d'authentification sauf demande explicite du brief, requirements minimal, style pytest importable) + UN fichier exemplaire complet choisi par rôle ; pour les autres stacks — contrat distillé seul (frontière honnête : pas d'exemplaire cross-langage, INV-215).",
      "3. Intégrer dans studio.ts generateFileContent : system += addendum si armé — AUCUN autre changement (retries, S1, portes intacts).",
      "4. Test unitaire : addendum présent quand armé, absent sinon ; budget prompt borné (≤ ~6 000 chars) ; aucun placeholder dans l'exemplaire injecté (INV-080).",
      "5. Non-régression : tsc propre, tests porte v3 14/14, un run sain traverse les trois portes inchangé.",
      "6. Mesure PTA-002 itération 7 : 3 runs (RUN-000010..12) sur le brief canonique Hub Mobile Money sous TRIPLE porte — métriques : taux de première passe fichiers (attempts===1 et vérifiés / total) et nombre de runs SEALED au premier passage. Tout échec classé INFRA par la porte v3 est exclu des métriques d'apprentissage et le run est rejoué (INV-210)."
    ],
    "acceptance": [
      "Au moins 1 run sur 3 SEALED au premier passage sous triple porte (baseline documentée : 0/3 — RUN-000024/25/26).",
      "Taux de première passe fichiers ≥ 60 % sur l'ensemble des 3 runs (baseline mesurée RUN-000024-26 : 0-23 %).",
      "Zéro régression : tests unitaires 14/14, tsc propre, portes v1/v2/v3 inchangées dans leur comportement.",
      "Rollback vérifié : EVO-000027 → ROLLED_BACK rend l'addendum inerte et le comportement legacy est restauré sans redéploiement."
    ],
    "evidencePrefix": "EV-POLICY"
  },
  "rollbackPlan": "Flag isGoldenFewShotActive() armé uniquement si EVO-000027 PROMOTED (même mécanisme que les trois portes). Rollback en 1 action API (rollback → ROLLED_BACK) : l'addendum devient inerte, le prompt système redevient exactement celui d'avant — aucun changement de schéma, aucune migration, aucun fichier supprimé (l'exemplaire vit en lecture seule dans upload/), runs antérieurs et preuves intacts."
}
JSON
    ;;
  review)
    curl -s -X POST "$API" -H 'Content-Type: application/json' -d @- <<'JSON' | python3 -m json.tool
{
  "action": "review",
  "proposalUid": "EVO-000027",
  "actor": { "type": "AGENT", "id": "super-z" },
  "reason": "Revue AGENT : levier PROMPT pur (aucune logique de portes modifiée), armement gouverné par registre, protocole de mesure avec baseline documentée (0/3) et critères chiffrés (≥1/3 SEALED premier passage, ≥60% fichiers premier coup), rollback 1 action. Frontière honnête : exemplaire complet PYTHON uniquement, contrat seul pour les autres stacks."
}
JSON
    ;;
  status)
    curl -s "$API" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for p in d.get('proposals', []):
    if p.get('proposalUid') == 'EVO-000027':
        print(json.dumps(p, indent=2, ensure_ascii=False)[:1800])
"
    ;;
  *)
    echo "usage: bash $0 create|submit|review|status"; exit 1 ;;
esac
