#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# EVO-000020 (PROMPT/LOW) — CYCLE COMPLET GOVERNÉ
#   approve → schedule → promote
# Décideur : HUMAN:reviewer (identité distincte du proposeur
# AGENT:super-z — INV-227, pattern canonique CI R14).
# INV-162 : promotion avec expérimentation documentée (réelle :
# re-décomposition miroir rétrospective de MIS-000017/RUN-000019).
# INV-228 : PROMOTED enregistre la décision, n'exécute RIEN.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
BASE="http://localhost:3000/api/yahria/evolution"
EVO_UID="EVO-000020"
DECIDER='{"type":"HUMAN","id":"reviewer"}'

post() { curl -s -m 30 -X POST "$BASE" -H 'Content-Type: application/json' -d "$1" | python3 -m json.tool --no-ensure-ascii; }

echo "── 1/3 APPROVE (INV-227 : décideur ≠ proposeur) ──"
post "{
  \"action\": \"approve\",
  \"proposalUid\": \"$EVO_UID\",
  \"actor\": $DECIDER,
  \"reason\": \"Test de cycle complet demandé par l'opérateur : proposition LOW sans dépendance, mapping 6/6 défauts réels RUN-000019 démontré en miroir\"
}"

echo "── 2/3 SCHEDULE ──"
post "{
  \"action\": \"schedule\",
  \"proposalUid\": \"$EVO_UID\",
  \"actor\": $DECIDER
}"

echo "── 3/3 PROMOTE (INV-162 expérimentation + INV-163 rollback) ──"
post "{
  \"action\": \"promote\",
  \"proposalUid\": \"$EVO_UID\",
  \"actor\": $DECIDER,
  \"rollbackPlan\": \"Revenir au prompt v1 (3 tâches) archivé dans le registre studio ; les missions en cours terminent leur cycle sur v1 ; re-tick sans changement de schéma ni migration\",
  \"experiment\": {
    \"hypothesis\": \"Une décomposition à au moins 5 étapes avec preuve et seuil par tâche capture les classes de défauts réels que la décomposition générique rate\",
    \"baseline\": {
      \"source\": \"MIS-000017 (trace TR-MIS-c41db6f5-a9b) — réel\",
      \"taches\": 3,
      \"criteres_preuve_par_tache\": 0,
      \"defauts_RUN000019_couverts\": \"0/6 — middleware objet, MONGO_URI, SQL/PostgreSQL, login non routé, index.js cassé, nommage incohérent non couverts par aucune tâche\"
    },
    \"treatment\": \"Prompt v2 : plan à 5+ étapes, chaque tâche = action + preuve attendue + seuil d'acceptation\",
    \"benchmark\": {
      \"methode\": \"re-décomposition rétrospective miroir de la mission RUN-000019 sous contraintes v2 (hors production, documentée dans cette décision)\",
      \"taches\": 5,
      \"mapping\": \"diagnostic boot → défauts 1-2 ; chaîne auth → défauts 3-4 ; harmonisation env → défaut 2 ; validateurs → défaut 6 ; suite live curl → garde-fou transversal\",
      \"couverture_defauts\": \"6/6 mappés à une étape avec preuve\"
    },
    \"verification\": \"Comparaison statique baseline vs traitement : 0 critère de preuve → 5 preuves + seuils ; couverture 0/6 → 6/6\",
    \"conclusion\": \"Adoption recommandée ; effet réel mesurable au prochain tick de mission D.07\"
  }
}"

echo "── État final + preuves ──"
curl -s -m 15 "$BASE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for p in d['proposals']:
    if p['proposalUid']=='EVO-000020':
        print('EVO-000020 :', p['state'], '| décidée par:', p['decidedBy'])
"
curl -s -m 15 "http://localhost:3000/api/yahria/evidence?take=200" | python3 -c "
import json,sys
d=json.load(sys.stdin)
items=d.get('evidence') or d.get('items') or []
evo=[e for e in items if 'EVO-000020' in json.dumps(e)]
print(f'preuves EVO-000020 scellées : {len(evo)}')
for e in evo: print('  -', str(e.get('claim',''))[:95])
"