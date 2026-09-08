#!/usr/bin/env bash
# EVO-000026 — Porte v3 : complétude de génération avant livraison.
# Usage: bash pta-evo26-propose.sh create|submit|review|status
set -euo pipefail
API="http://localhost:3000/api/yahria/evolution"
ACTOR_AGENT='{"type":"AGENT","id":"super-z"}'

case "${1:-}" in
  create)
    curl -s -X POST "$API" -H 'Content-Type: application/json' -d @- <<'JSON' | python3 -m json.tool
{
  "action": "create",
  "title": "Porte v3 : complétude de génération avant livraison — aucun livrable partiel ne quitte GENERATING",
  "kind": "WORKFLOW",
  "riskClass": "MEDIUM",
  "proposedBy": { "type": "AGENT", "id": "super-z" },
  "rationale": "PTA-002 itération 5 (RUN-000026) a mesuré un trou structurel : le fabric LLM s'est ouvert en cours de génération (zai:circuit OPEN, cooldown 90s), 11 fichiers sur 14 ont échoué après 3 tentatives chacun contre un circuit ouvert, et le pipeline a POURSUIVI avec un livrable partiel (3 fichiers vérifiés) jusqu'à la porte de boot — rejeté seulement indirectement par DÉCOUVERTE (main.py vide), avec un diagnostic imprécis qui masquait la cause réelle. Dans studio-pipeline.ts, la boucle GENERATING marque les fichiers FAILED puis continue : seule generated===0 fait échouer le run. Un livrable partiel peut donc atteindre les portes v1/v2, gaspiller du temps de boot/pytest et produire des diagnostics trompeurs. Les portes existantes sont aveugles à cette classe : v1 (EVO-000016) voit import/boot, v2 (EVO-000025) voit le comportement — aucune ne voit la complétude. Fermer ce trou AVANT l'injection few-shot (exemplaire doré RUN-000023-corrige, prochain levier candidat) préserve aussi la mesure honnête du taux de première passe : un effondrement INFRA (fabric OPEN) doit être classé comme tel et non compté comme un échec d'apprentissage du générateur (INV-210 : mesure honnête)."
}
JSON
    ;;
  submit)
    curl -s -X POST "$API" -H 'Content-Type: application/json' -d @- <<'JSON' | python3 -m json.tool
{
  "action": "submit",
  "proposalUid": "EVO-000026",
  "actor": { "type": "AGENT", "id": "super-z" },
  "reason": "Proposition fondée sur preuve scellée RUN-000026 : 9 fichiers vides ayant traversé la boucle GENERATING jusqu'à la porte de boot. Porte v3 = détection de complétude + rattrapage borné + classification INFRA/MODÈLE.",
  "experiment": {
    "title": "Preuve de la porte v3 — livrable partiel refusé à VERIFYING, livrable sain sans friction",
    "protocol": [
      "1. Implémenter completeness-gate.ts (YAHRIA-STD-005) sur le modèle de boot-gate.ts : isCompletenessGateActive() armé si EVO-000026 PROMOTED.",
      "2. Intégrer dans studio-pipeline.ts entre la fin de GENERATING et l'entrée en VERIFYING : (a) inventaire des fichiers FAILED (path → note) ; (b) rattrapage borné : 1 passe de régénération pour les fichiers échoués, avec attente du cooldown si note contient circuit OPEN ; (c) si échec persistant → failRun avec message PORTE V3 : X/N fichiers échoués — inventaire path:note — classification INFRA (fabric/circuit) ou MODÈLE.",
      "3. Test unitaire : pipeline simulant 3 fichiers vérifiés + 2 échoués → la porte doit failRun AVANT toute écriture workspace / porte de boot, avec inventaire exact et classification correcte.",
      "4. Test de non-régression : run sain (tous fichiers vérifiés) → la porte ne modifie rien, le run progresse vers les portes v1/v2 inchangées.",
      "5. Test décisif PTA-002 itération 6 (RUN-000027) : reproduction conditions RUN-000026 — si fabric OPEN se reproduit, le run doit échouer à la porte v3 avec classification INFRA et ne jamais atteindre la porte de boot."
    ],
    "acceptance": [
      "Aucun run comportant un fichier FAILED persistant ne dépasse la frontière GENERATING→VERIFYING quand la porte est armée.",
      "Le message d'échec contient l'inventaire path:note et la classification INFRA|MODÈLE.",
      "Un run sain passe la porte sans altération (zéro friction mesurée).",
      "Rollback vérifié : porte désactivée → comportement legacy restauré."
    ],
    "evidencePrefix": "EV-POLICY"
  },
  "rollbackPlan": "Flag isCompletenessGateActive() calqué sur boot-gate (EVO-000016) : armé uniquement si EVO-000026 PROMOTED. Rollback en 1 action API (rollback) — le pipeline redevient legacy (seul critère generated===0), sans migration DB ni changement de schéma ; les runs déjà scellés et leurs preuves restent intacts ; aucune donnée workspace n'est supprimée."
}
JSON
    ;;
  review)
    curl -s -X POST "$API" -H 'Content-Type: application/json' -d @- <<'JSON' | python3 -m json.tool
{
  "action": "review",
  "proposalUid": "EVO-000026",
  "actor": { "type": "AGENT", "id": "super-z" },
  "reason": "Revue AGENT : protocole complet (5 étapes), acceptance mesurable (4 critères), rollback borné. Frontière mesurée à RUN-000026 fermée par conception avant le levier few-shot."
}
JSON
    ;;
  status)
    curl -s "$API" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for p in d.get('proposals',[]):
    if p.get('proposalUid')=='EVO-000026':
        print(json.dumps(p,indent=2,ensure_ascii=False))
        break
else:
    print('EVO-000026 introuvable')
"
    ;;
  *)
    echo "usage: $0 create|submit|review|status"; exit 1 ;;
esac
