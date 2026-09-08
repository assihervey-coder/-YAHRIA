#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════
# Option 23 (Self-Evolution D.15) — Injection de volume de travail
# Crée 8 propositions d'évolution ancrées dans l'état réel de la
# plateforme (audit de complétude + MIS-000017 + RUN-000019) et les
# fait progresser : DRAFTED → SUBMITTED → UNDER_REVIEW.
#
# Frontière gouvernée (INV-227) : le proposant (AGENT:super-z) ne
# peut pas approuver. Les décisions approve/reject restent à
# l'autorité humaine souveraine.
# ═══════════════════════════════════════════════════════════════
import json
import sys
import urllib.request

BASE = "http://localhost:3000/api/yahria/evolution"
PROPOSER = {"type": "AGENT", "id": "super-z"}

PROPOSALS = [
    {
        "title": "Bascule PostgreSQL sur VPS (D.21)",
        "kind": "WORKFLOW", "riskClass": "MEDIUM",
        "rationale": "Bloqueur prod #1 de l'audit : SQLite mono-fichier plafonne la concurrence et la réplication. Migrer vers PostgreSQL 16 via les migrations Prisma déjà packagées dans le runbook VPS, avec sauvegarde pg_dump planifiée et test de restauration.",
    },
    {
        "title": "Sandbox Docker pour prévalidation npm (INV-215)",
        "kind": "WORKFLOW", "riskClass": "MEDIUM",
        "rationale": "Bloqueur prod #2 : la vérification statique du studio scelle des livrables sans boot réel (démontré par RUN-000019 : 6 défauts non détectés). Un sandbox Docker permettrait npm install + jest sur chaque RUN avant SEALED, fermant la frontière honnête INV-215.",
    },
    {
        "title": "Rate-limiter distribué Redis (D.14)",
        "kind": "WORKFLOW", "riskClass": "MEDIUM",
        "rationale": "Bloqueur prod #3 : le limiter en mémoire ne protège qu'une instance et se réinitialise à chaque redémarrage. Un limiter distribué (Redis, fenêtre glissante) garantit le quota global et la persistance des compteurs, condition de la résilience multi-réplica.",
    },
    {
        "title": "TLS + HSTS en terminaison passerelle (D.14)",
        "kind": "WORKFLOW", "riskClass": "HIGH",
        "rationale": "Bloqueur prod #5 : aucun chiffrement transport aujourd'hui. Terminaison TLS 1.2+ sur la passerelle, certificats à renouvellement automatique, HSTS strict, redirection 80→443. Risque HIGH car une erreur de certificat coupe l'accès à toute la plateforme.",
    },
    {
        "title": "Révocation et rotation des tokens de session",
        "kind": "WORKFLOW", "riskClass": "HIGH",
        "rationale": "Bloqueur prod #4 : les tokens émis ne sont jamais révocables avant expiration. Denylist persistée (jti), rotation à chaque refresh, révocation d'urgence globale, audit des émissions. Risque HIGH car une mauvaise denylist peut déconnecter tous les acteurs légitimes.",
    },
    {
        "title": "Prompt de décomposition D.07 plus granulaire",
        "kind": "PROMPT", "riskClass": "LOW",
        "rationale": "Retour MIS-000017 : la décomposition a produit 3 tâches génériques (listes registres) sans critères de preuve par tâche. Exiger un plan à au moins 5 étapes, chacune avec preuve attendue et seuil d'acceptation, améliore l'observabilité de l'exécution autonome.",
    },
    {
        "title": "Backoff exponentiel des ticks de mission",
        "kind": "STRATEGY", "riskClass": "LOW",
        "rationale": "Les ticks en échec repartent à intervalle fixe, ce qui martèle les dépendances indisponibles. Un backoff exponentiel borné (2^n, plafond 15 min, reset au succès) réduit la charge et accélère la convergence, sans changer la machine à états.",
    },
    {
        "title": "Génome agent spécialisé livrables métier",
        "kind": "AGENT_GENOME", "riskClass": "LOW",
        "rationale": "Retour RUN-000019 : les livrables applicatifs échouent toujours sur les mêmes classes (branchement serveur, harmonisation noms, tests isolés). Un profil de génome 'générateur applicatif' qui impose factory + point d'entrée unique + helpers de test isolés dès la génération.",
    },
]


def post(payload):
    req = urllib.request.Request(
        BASE,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def main():
    created, failed = [], []
    print(f"Injection de {len(PROPOSALS)} propositions (proposant {PROPOSER['type']}:{PROPOSER['id']})\n")
    for p in PROPOSALS:
        st, res = post({**p, "action": "create", "proposedBy": PROPOSER})
        uid = res.get("proposalUid")
        if st != 201 or not uid:
            print(f"  ✗ create {p['title'][:50]} → {st} {res.get('errors', res)}")
            failed.append(p["title"])
            continue
        ev = []
        st1, r1 = post({"action": "submit", "proposalUid": uid, "actor": PROPOSER})
        ev.append(f"submit:{st1}")
        st2, r2 = post({"action": "review", "proposalUid": uid, "actor": PROPOSER})
        ev.append(f"review:{st2}")
        ok = st1 == 200 and st2 == 200 and r1.get("ok") and r2.get("ok")
        state = r2.get("state") or (r1.get("state") if st1 == 200 else "?")
        mark = "✓" if ok else "✗"
        print(f"  {mark} {uid} [{p['kind']}/{p['riskClass']}] {p['title'][:52]} → {state} ({', '.join(ev)})")
        (created if ok else failed).append(uid if ok else p["title"])

    print(f"\nRésultat : {len(created)} propositions en UNDER_REVIEW, {len(failed)} échecs")
    if failed:
        print("Échecs :", failed)
        sys.exit(1)
    # Récap final de tout le pipeline
    with urllib.request.urlopen(BASE, timeout=30) as r:
        d = json.loads(r.read().decode("utf-8"))
    states = {}
    for pr in d["proposals"]:
        states[pr["state"]] = states.get(pr["state"], 0) + 1
    print("Pipeline global :", json.dumps(states, ensure_ascii=False))


if __name__ == "__main__":
    main()
