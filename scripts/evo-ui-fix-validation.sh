#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# VALIDATION DU FIX UI OPTION 23 (rollback HIGH + promote gouverné)
#
# 1. EVO-000023 — proposition de TEST explicite (HIGH) : cycle
#    complet create → submit → review → approve(rollback) →
#    schedule → promote(expérience+rollback) → rollback
#    Prouve le payload exact que l'UI corrigée envoie, y compris
#    le chemin ROLLED_BACK jamais exercé.
# 2. EVO-000024 — proposition méta RÉELLE (LOW) : adoption du fix
#    UI, laissée en UNDER_REVIEW pour décision de l'opérateur.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
BASE="http://localhost:3000/api/yahria/evolution"
PROP='{"type":"AGENT","id":"super-z"}'
DEC='{"type":"HUMAN","id":"reviewer"}'

post() { curl -s -m 30 -X POST "$BASE" -H 'Content-Type: application/json' -d "$1"; }

echo "═══ 1. Cycle de test EVO-000023 (HIGH, jetable) ═══"
R=$(post "{
  \"action\":\"create\",
  \"title\":\"TEST pipeline : cycle HIGH avec rollback final (jetable)\",
  \"kind\":\"WORKFLOW\",\"riskClass\":\"HIGH\",
  \"rationale\":\"Proposition jetable validant le fix UI option 23 : approve HIGH avec plan de rollback (INV-163), promote avec expérimentation (INV-162), puis rollback final pour exercer le chemin ROLLED_BACK jamais testé. Ne correspond à aucun changement réel.\",
  \"proposedBy\":$PROP}")
echo "$R" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' create →',d.get('proposalUid'),d.get('errors',''))"
T=$(echo "$R" | python3 -c "import json,sys;print(json.load(sys.stdin)['proposalUid'])")

post "{\"action\":\"submit\",\"proposalUid\":\"$T\",\"actor\":$PROP}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' submit →',d.get('state'),d.get('errors',''))"
post "{\"action\":\"review\",\"proposalUid\":\"$T\",\"actor\":$PROP}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' review →',d.get('state'),d.get('errors',''))"
post "{
  \"action\":\"approve\",\"proposalUid\":\"$T\",\"actor\":$DEC,
  \"reason\":\"Validation mécanique du fix UI : approve HIGH doit accepter avec rollback fourni\",
  \"rollbackPlan\":\"Restaurer l état précédent depuis la preuve scellée ; la proposition est un test sans effet réel, aucune action d infrastructure à défaire\"
}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' approve (rollback fourni) →',d.get('state'),d.get('errors',''))"
post "{\"action\":\"schedule\",\"proposalUid\":\"$T\",\"actor\":$DEC}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' schedule →',d.get('state'),d.get('errors',''))"
post "{
  \"action\":\"promote\",\"proposalUid\":\"$T\",\"actor\":{\"type\":\"HUMAN\",\"id\":\"release\"},
  \"experiment\":{\"note\":\"Test mécanique : mesure du payload UI corrigé, aucune expérimentation métier — proposition jetable\"}
}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' promote (INV-162 note) →',d.get('state'),d.get('errors',''))"
post "{
  \"action\":\"rollback\",\"proposalUid\":\"$T\",\"actor\":$DEC,
  \"reason\":\"Fin du test pipeline : proposition jetable marquée ROLLED_BACK, aucun effet réel n'a jamais existé\"
}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' rollback →',d.get('state'),d.get('errors',''))"

echo
echo "═══ 2. Proposition méta réelle EVO-000024 (LOW, décision opérateur) ═══"
R=$(post "{
  \"action\":\"create\",
  \"title\":\"UI option 23 : rollback HIGH au approve + garde-fous au promote\",
  \"kind\":\"WORKFLOW\",\"riskClass\":\"LOW\",
  \"rationale\":\"Défaut prouvé : le bouton Approuver de l onglet Évolution ne collecte pas de plan de rollback, rendant l approbation des propositions HIGH impossible (INV-163, testé 422 sur EVO-000018). Le promote n exigeait ni rollback ni expérience réelle. Correctif appliqué dans panels-intelligence.tsx : prompt rollback ≥ 15 caractères pour HIGH/CRITICAL, prompt rollback + expérience pour PROMOTED si absents.\",
  \"proposedBy\":$PROP}")
echo "$R" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' create →',d.get('proposalUid'),d.get('errors',''))"
M=$(echo "$R" | python3 -c "import json,sys;print(json.load(sys.stdin)['proposalUid'])")
post "{\"action\":\"submit\",\"proposalUid\":\"$M\",\"actor\":$PROP}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' submit →',d.get('state'),d.get('errors',''))"
post "{\"action\":\"review\",\"proposalUid\":\"$M\",\"actor\":$PROP}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(' review →',d.get('state'),d.get('errors',''))"

echo
echo "═══ 3. Preuves scellées ═══"
curl -s -m 15 "http://localhost:3000/api/yahria/evidence?take=200" | python3 -c "
import json,sys
d=json.load(sys.stdin)
items=d.get('evidence') or d.get('items') or []
n23=[e for e in items if 'EVO-000023' in json.dumps(e)]
n24=[e for e in items if 'EVO-000024' in json.dumps(e)]
print(f'EVO-000023 (test) : {len(n23)} preuves')
print(f'EVO-000024 (méta) : {len(n24)} preuves')
"
echo "── État final des deux propositions ──"
curl -s -m 15 "$BASE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for p in d['proposals']:
    if p['proposalUid'] in ('EVO-000023','EVO-000024'):
        print(f\" {p['proposalUid']} → {p['state']} | {p['title'][:55]}\")
"