#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# PTA-001 — PHASE 2 : DÉCISION HUMAINE EVO-000016
# « Prévalidation boot avant SEALED » (WORKFLOW/MEDIUM, INV-215)
#
# Usage :
#   ./pta-evo16-approve.sh            → MODE SEC : affiche tout, n'exécute RIEN
#   ./pta-evo16-approve.sh go         → approuve + programme + promeut
#   ./pta-evo16-approve.sh status     → état du registre + armement de la porte
#
# Gouvernance appliquée par le système :
#   INV-227 : décideur = HUMAN:reviewer (≠ proposeur AGENT:super-z)
#   INV-163 : rollbackPlan ≥ 15 caractères (rédigé ci-dessous)
#   INV-162 : PROMOTION = expérimentation documentée — ici le RÉTRO-TEST
#             DE CALIBRAGE réel (2 livrables, verdicts mesurés, JSON horodatés)
#   INV-228 : PROMOTED n'exécute aucune mutation de production — mais pour
#             EVO-000016, la promotion EST l'interrupteur de la porte
#             (src/lib/yahria/boot-gate.ts lit le registre à chaque run)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
BASE="http://localhost:3000/api/yahria/evolution"
DECIDER='{"type":"HUMAN","id":"reviewer"}'
UID_EVO="EVO-000016"

ROLLBACK="Retirer l'armement de la porte (boot-gate.ts ne lit plus le registre) et re-marquer EVO-000016 ROLLED_BACK ; le pipeline retrouve la vérification statique seule ; aucun run en cours n'est affecté ; les calibrages restent archivés"

EXPERIMENT='{
    "hypothesis": "Une porte de boot exécutée AVANT le scellement détecte 100% des livrables non démarrables sans faux positif sur un livrable sain — fermant la frontière honnête INV-215 (scellement statique sans boot) démontrée par RUN-000019 et RUN-000021",
    "baseline": {
      "source": "RUN-000021 original (44 îlots) — scellé quand même en l'\''état, réel",
      "diagostic_audit": "27% fichiers syntaxiquement cassés, 0 cross-import, 0% assemblable, 1 seul îlot bootable sur 33, cascade 5 échecs au boot",
      "structure_exacte": "33 fichiers-nœuds SANS extension (code Python hors module) + 11 .py sous chemins de package invalides (espaces/accents/emoji) = 44 îlots non importables"
    },
    "treatment": "Porte de boot 7 étapes (INVENTAIRE, STRUCTURE, SYNTAXE, DÉCOUVERTE, BOOT uvicorn réel sur port libre, SONDES HTTP, OPENAPI) — jumeaux TS (pipeline, armement registre) et Python (vérificateur indépendant)",
    "benchmark": {
      "methode": "rétro-test calibré sur les 2 livrables réels, verdicts mesurés et horodatés",
      "RUN-000021_original": "FAIL en 6 ms — 44 îlots non importables détectés (100% du livrable), première cause : code Python hors module",
      "RUN-000021-corrige": "PASS en 2473 ms — 7/7 étapes, boot uvicorn réel, sondes HTTP vertes, openapi décodé, ZÉRO faux positif",
      "artefacts": "scripts/pta-evidence/calibration-original.json + calibration-corrige.json"
    },
    "verification": "Calibrage CONFORME des deux côtés (rapports JSON dans les preuves) ; la porte discrimine exactement le livrable mort du livrable sain",
    "conclusion": "Adoption recommandée : la promotion arme la porte dans le pipeline Studio (lecture du registre à chaque run) ; le test décisif RUN-000022 mesurera l'\''effet de bout en bout"
  }'

post() {
  echo "→ $1"
  curl -s -m 30 -X POST "$BASE" -H 'Content-Type: application/json' -d "$2" | python3 -m json.tool --no-ensure-ascii | head -14
}

case "${1:-dry}" in
  dry)
    echo "MODE SEC — aucune exécution. Le déroulé « go » :"
    echo
    echo "  1/3 approve  $UID_EVO  (HUMAN:reviewer, rollback INV-163 rédigé)"
    echo "  2/3 schedule $UID_EVO"
    echo "  3/3 promote  $UID_EVO  (INV-162 : rétro-test de calibrage = expérimentation documentée)"
    echo
    echo "Rollback rédigé (INV-163) :"
    echo "  $ROLLBACK"
    echo
    echo "Expérimentation (INV-162) : rétro-test calibré —"
    echo "  original  : FAIL 6 ms, 44 îlots détectés (100%)"
    echo "  corrigé   : PASS 2,5 s, 7/7 étapes, 0 faux positif"
    echo
    echo "⚠ Après promote, la porte s'arme AUTOMATIQUEMENT (boot-gate.ts lit le registre)."
    echo "  Prochaine étape du protocole : ./pta-run22.sh (génération RUN-000022 + verdict)."
    ;;
  go)
    post "approve $UID_EVO" "{
      \"action\": \"approve\", \"proposalUid\": \"$UID_EVO\", \"actor\": $DECIDER,
      \"reason\": \"Test d'apprentissage PTA-001 : YAHRIA a appris à se mesurer (EVO-000020 promue), il doit apprendre à ne plus répéter RUN-000021 — prévalidation boot avant SEALED approuvée\",
      \"rollbackPlan\": \"$ROLLBACK\"
    }"
    post "schedule $UID_EVO" "{ \"action\": \"schedule\", \"proposalUid\": \"$UID_EVO\", \"actor\": $DECIDER }"
    post "promote $UID_EVO" "{
      \"action\": \"promote\", \"proposalUid\": \"$UID_EVO\", \"actor\": $DECIDER,
      \"rollbackPlan\": \"$ROLLBACK\",
      \"experiment\": $EXPERIMENT
    }"
    ;;
  status)
    curl -s -m 15 "$BASE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for p in d['proposals']:
    if p['proposalUid']=='$UID_EVO':
        print('$UID_EVO :', p['state'], '| rollback:', p['hasRollbackPlan'], '| expérience:', p['hasExperiment'])
        print('PORTE DE BOOT ARMÉE :', p['state']=='PROMOTED')
"
    ;;
  *)
    echo "argument inconnu : $1 (dry | go | status)" >&2
    exit 1
    ;;
esac
