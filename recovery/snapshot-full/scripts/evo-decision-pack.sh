#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PACK DE DÉCISION — propositions HIGH (EVO-000018, EVO-000019)
#
# Usage :
#   ./evo-decision-pack.sh                 → mode sec : affiche tout, n'exécute RIEN
#   ./evo-decision-pack.sh EVO-000018      → approuve + programme EVO-000018 (TLS+HSTS)
#   ./evo-decision-pack.sh EVO-000019      → approuve + programme EVO-000019 (tokens)
#   ./evo-decision-pack.sh reject EVO-000017 "votre raison"
#                                          → rejette une proposition (raison ≥ 10 car.)
#
# Gouvernance appliquée par le système :
#   INV-227 : décideur = HUMAN:reviewer (≠ proposeur AGENT:super-z)
#   INV-163 : rollbackPlan ≥ 15 caractères OBLIGATOIRE (rédigé ci-dessous)
#   INV-162 : la PROMOTION exigerait une expérimentation documentée
#             (pour ces 2 WORKFLOW : l'exécution réelle du runbook VPS
#             sur l'infrastructure cible = l'expérience, à archiver ensuite)
#   INV-228 : PROMOTED n'exécute aucune mutation de production
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
BASE="http://localhost:3000/api/yahria/evolution"
DECIDER='{"type":"HUMAN","id":"reviewer"}'

RB_18="Basculer la passerelle en HTTP seul port 80, restaurer le certificat precedent depuis l'archive letsencrypt, desactiver HSTS (max-age=0), retablir la redirection initiale ; fenetre cible inferieure a 10 minutes"
RB_19="Basculer REVOCATION_ENABLED=false pour desactiver la denylist, restaurer la verification JWT signature seule, conserver les emissions jti en log pour audit et rejeu ulterieur ; aucune session legitime n'est perdue"

post() {
  echo "→ $1"
  curl -s -m 30 -X POST "$BASE" -H 'Content-Type: application/json' -d "$2" | python3 -m json.tool --no-ensure-ascii
}

case "${1:-dry}" in
  dry)
    echo "MODE SEC — aucune exécution. Commandes prêtes :"
    echo
    echo "# Approbation EVO-000018 (TLS + HSTS, HIGH) — rollback rédigé :"
    echo "./evo-decision-pack.sh EVO-000018"
    echo
    echo "# Approbation EVO-000019 (Révocation/rotation tokens, HIGH) — rollback rédigé :"
    echo "./evo-decision-pack.sh EVO-000019"
    echo
    echo "# Rejet d'une proposition (exemple EVO-000017) :"
    echo "./evo-decision-pack.sh reject EVO-000017 \" hors de portée avant le VPS\""
    echo
    echo "Rollbacks rédigés (INV-163) :"
    echo "  EVO-000018 : $RB_18"
    echo "  EVO-000019 : $RB_19"
    echo
    echo "Rappel INV-162 : après APPROVED + SCHEDULED, la PROMOTION de ces 2 WORKFLOW"
    echo "exigera le résultat de l'expérimentation réelle (exécution runbook VPS archivée)."
    ;;
  EVO-000018)
    post "approve EVO-000018" "{
      \"action\": \"approve\", \"proposalUid\": \"EVO-000018\", \"actor\": $DECIDER,
      \"reason\": \"Terminaison TLS approuvee : bloqueur prod #5, condition d'acces VPS ; rollback archive letsencrypt teste\",
      \"rollbackPlan\": \"$RB_18\"
    }"
    post "schedule EVO-000018" "{
      \"action\": \"schedule\", \"proposalUid\": \"EVO-000018\", \"actor\": $DECIDER
    }"
    ;;
  EVO-000019)
    post "approve EVO-000019" "{
      \"action\": \"approve\", \"proposalUid\": \"EVO-000019\", \"actor\": $DECIDER,
      \"reason\": \"Revocation et rotation des tokens approuvees : bloqueur prod #4 ; denylist persistee et rotation refresh\",
      \"rollbackPlan\": \"$RB_19\"
    }"
    post "schedule EVO-000019" "{
      \"action\": \"schedule\", \"proposalUid\": \"EVO-000019\", \"actor\": $DECIDER
    }"
    ;;
  reject)
    [ $# -ge 3 ] || { echo "usage : $0 reject <proposalUid> \"raison (>= 10 caracteres)\"" >&2; exit 1; }
    post "reject $2" "{
      \"action\": \"reject\", \"proposalUid\": \"$2\", \"actor\": $DECIDER,
      \"reason\": \"$3\"
    }"
    ;;
  *)
    echo "argument inconnu : $1 (voir ./evo-decision-pack.sh sans argument)" >&2
    exit 1
    ;;
esac

# État pipeline après action
echo
echo "── Pipeline après action ──"
curl -s -m 15 "$BASE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
states={}
for p in d['proposals']:
    states[p['state']]=states.get(p['state'],0)+1
    if p['proposalUid'] in ('EVO-000018','EVO-000019'):
        print(' ', p['proposalUid'], '→', p['state'])
print(' global :', json.dumps(states, ensure_ascii=False))
"