# YAHRIA CODE OS — RUNBOOK PRODUCTION VPS (R15)

**Document ID** : YAHRIA-OPS-002 · **Statut** : ACTIF · **Autorité** : opérationnelle
**Objectif** : passer d'un environnement de développement prouvé à une **production dure sur VPS**, en une séquence d'étapes mesurées — aucune étape « espérée », chaque section a un critère de vérification (INV-232 : pas de déclaration verte sans preuve).

**Ordre critique** (ne pas permuter) :

```
0. Révoquer le token GitHub exposé  →  1. Provisionner le VPS
→ 2. Cloner + .env.production       →  3. PostgreSQL
→ 4. Docker durci (sandbox)         →  5. App prod (rate limit DB)
→ 6. TLS (Caddy)                    →  7. Alerting externe
→ 8. Sauvegardes                    →  9. Validation complète
→ 10. Décision gouvernée D.6
```

---

## Étape 0 — Révoquer le token GitHub exposé ⚠️ OBLIGATOIRE EN PREMIER

Un token GitHub avec portée push a été exposé par le passé (URL remote). Tant qu'il n'est pas révoqué, TOUT le reste est secondaire.

1. Ouvrir https://github.com/settings/tokens
2. **Revoke** immédiatement tout token « classic » ou fine-grained inutile — en particulier celui qui commence par `ghp_` ou `github_pat_` ayant servi aux pushes de ce dépôt.
3. Vérifier les accès OAuth actifs : https://github.com/settings/applications (révoquer les inconnus).
4. Émettre un **nouveau token fine-grained** : Repository access → `-YAHRIA` uniquement · Permissions → Contents: Read and write · expiration ≤ 90 jours.
5. Reconfigurer le remote **sans stocker le token en clair** dans `.git/config` :

```bash
git remote set-url origin https://github.com/assihervey-coder/-YAHRIA.git
git config credential.helper store   # ou cache 1h : git config credential.helper 'cache --timeout=3600'
git push origin main                  # saisir le NOUVEAU token à la demande
```

**Critère de réussite** : `git config --get remote.origin.url` ne contient plus aucun token ; l'ancien token renvoie 401 sur l'API GitHub.

---

## Étape 1 — Provisionner le VPS

Requis : Ubuntu 24.04 LTS, 2 Go RAM min, 10 Go disque, 1 IPv4 + 1 IPv6 (optionnel).

```bash
adduser yahria && usermod -aG sudo yahria
# SSH durci : copier la clé publique d'abord, PUIS :
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

apt update && apt upgrade -y
apt install -y ufw unattended-upgrades
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80,443/tcp
ufw enable

# Docker officiel
curl -fsSL https://get.docker.com | sh
usermod -aG docker yahria
```

**Critère** : `docker info` fonctionne en tant que `yahria` ; `ufw status` = 22/80/443 uniquement.

---

## Étape 2 — Cloner + configurer

```bash
sudo mkdir -p /opt/yahria && sudo chown yahria:yahria /opt/yahria
cd /opt/yahria
git clone https://github.com/assihervey-coder/-YAHRIA.git .

cp .env.production.example .env.production
chmod 600 .env.production
# Éditer : POSTGRES_PASSWORD (openssl rand -base64 24), YAHRIA_DOMAIN,
# clés LLM (au moins un fournisseur), YAHRIA_ALERT_WEBHOOK_URL/SECRET (§7)
```

**Critère** : `grep -c '=$' .env.production` ne liste plus que les champs volontairement vides ; `stat -c '%a' .env.production` = 600.

---

## Étape 3 — Bascule PostgreSQL (SQLite → PostgreSQL)

La bascule de provider est gérée par `scripts/db-provider.mjs` (déclenché par l'entrypoint du conteneur). Le schéma est poussé idempotemment au démarrage (`prisma db push --skip-generate`).

> **Honnêteté sur les données** : l'historique de dev (runs, preuves locales) reste sur SQLite local. Sur le VPS, le bootstrap re-seed les données canoniques (24 domaines, règles POL-*, outils built-in) automatiquement — c'est le comportement voulu : la production démarre propre.

```bash
docker build -t yahria-os:latest .
docker compose -f docker-compose.prod.yml --env-file .env.production up -d db
sleep 15
docker compose -f docker-compose.prod.yml exec db pg_isready -U yahria
```

**Critères** :
- `pg_isready` → `accepting connections`
- Port exposé uniquement en local : `docker compose -f docker-compose.prod.yml port db 5432` → `127.0.0.1:5432`
- Le mot de passe est bien celui de `.env.production` (jamais `yahria` par défaut).

---

## Étape 4 — Sandbox Docker durci (INV-215)

```bash
docker build -f docker/sandbox.Dockerfile -t yahria-sandbox:latest .
```

Le compose prod monte `/var/run/docker.sock` dans l'app et active `YAHRIA_SANDBOX_BACKEND=docker`. L'isolation est garantie par les drapeaux du backend : `--network none`, rootfs read-only, `--cap-drop ALL`, `--security-opt no-new-privileges`, bornes CPU/RAM/PIDs.

**Critère** (preuve d'isolation réelle) :

```bash
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory 64m yahria-sandbox:latest bash -c 'echo YAHRIA-LINK-OK'
# attendu : YAHRIA-LINK-OK
```

---

## Étape 5 — Application en production

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build app
sleep 40
curl -s http://127.0.0.1:3000/api/yahria/ops | head -c 400
```

**Critères** (tous mesurés par `/ops`, INV-233) :
- `liveness.ok: true`
- sonde `DATABASE` verte (`24 domaines lisibles`)
- `version.sandboxBackend: "docker"`
- `/api/v1/system` sans clé → **401** ; avec clé émise → **200** (rate limit désormais **persisté en DB**, INV-235 — vérifiable : plusieurs appels créent des lignes `ApiRateEvent`)
- Un scale horizontal fonctionne : `docker compose up -d --scale app=2` partage la même fenêtre de rate limit via la base.

---

## Étape 6 — TLS automatique (Caddy)

Prérequis : l'enregistrement DNS A/AAAA de `YAHRIA_DOMAIN` pointe vers l'IP du VPS ; ports 80/443 ouverts.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d caddy
docker compose -f docker-compose.prod.yml logs caddy | grep -i certificate
```

Caddy émet seul le certificat Let's Encrypt et le renouvelle. Le WebSocket realtime (`/ws`) est proxifié nativement.

**Critère** : `curl -s https://$YAHRIA_DOMAIN/api/yahria/ops` → 200 sur HTTPS valide ; `curl -sI https://$YAHRIA_DOMAIN` contient `strict-transport-security`.

---

## Étape 7 — Alerting externe (D.22 / KRN-039)

Configurer `YAHRIA_ALERT_WEBHOOK_URL` (+ `YAHRIA_ALERT_WEBHOOK_SECRET`) dans `.env.production`, puis `docker compose ... up -d app` pour recharger.

Comportement prouvé (suite R15) :
- sonde rouge (DB injoignable, backend absent…) → webhook **POST JSON signé** `X-Yahria-Signature: sha256=HMAC(secret, body)`, timeout 5 s ;
- livraisons archivées : `SENT` / `FAILED` (latence mesurée) / `DEDUP_SKIPPED` (anti-tempête 10 min) / `NOT_CONFIGURED` (canal absent — jamais d'abandon silencieux, INV-210/236) ;
- consultation : `GET /api/yahria/alerts`.

Récepteurs compatibles : n'importe quel endpoint POST JSON (Slack via transformer, Discord webhook, serveur maison, n8n…).

---

## Étape 8 — Sauvegardes

```bash
chmod +x scripts/backup-db.sh
sudo mkdir -p /var/backups/yahria && sudo chown yahria:yahria /var/backups/yahria
crontab -e
# ajouter :
15 3 * * * cd /opt/yahria && ./scripts/backup-db.sh >> /var/backups/yahria/backup.log 2>&1
```

**Critère** : lancer `./scripts/backup-db.sh` une fois à la main → archive `.sql.gz` valide (`gzip -t`) listée, rétention 14 jours active.

---

## Étape 9 — Validation complète

```bash
bash scripts/vps-validate.sh
```

La suite exécute et mesure : prérequis système, PostgreSQL, isolation sandbox réelle, app prod (sondes + cycle clé API 200→révocation→401), alerting, TLS. **Toute section rouge = étape correspondante à refaire — pas de contournement (INV-232).**

Critère final : `RÉSULTAT : N PASS / 0 FAIL`.

---

## Étape 10 — Décision gouvernée D.6 (clôture de domaines)

Les 24 domaines sont **IMPLEMENTING** — la constitution interdit un passage automatique à DONE. La clôture d'un domaine est une **décision gouvernée** :

1. Rassembler : suites de preuves (R12 22/22, R13 46/46, R14 47/47, R15 16/16) + run CI verte + validation VPS 0 FAIL + archives `DOMAIN_ACTIVATIONS`.
2. Tenir la revue D.6 : chaque domaine est clos par décision enregistrée (raison, date, preuves référencées) — jamais « parce que ça marche ».
3. La bascule de statut se fait alors via le mécanisme gouverné existant (bootstrap monotone), pas à la main dans la base.

---

## Rollback (à tout moment)

| Incident | Action |
|---|---|
| App cassée après déploiement | `docker compose -f docker-compose.prod.yml down app && docker compose ... up -d app` sur l'image précédente : `docker tag yahria-os:latest yahria-os:prev` avant chaque upgrade |
| PostgreSQL corrompu | `down db` → restaurer : `gunzip -c /var/backups/yahria/yahria-XXXX.sql.gz \| docker compose exec -T db psql -U yahria yahria` → `up db app` |
| TLS échoue | l'app reste servie en local (`127.0.0.1:3000`) ; vérifier DNS/ports puis `logs caddy` |
| Webhook alerting en tempête | vider `YAHRIA_ALERT_WEBHOOK_URL` → l'état redevient honnêtement NOT_CONFIGURED |

---

## Frontières honnêtes restantes (INV-210)

- La preuve finale (C/D/E/F de `vps-validate.sh`) **doit être exécutée sur le VPS réel** — ce runbook packagé ici ne la remplace pas.
- Le montant `docker.sock` monté dans l'app est la surface d'attaque connue du backend Docker (INV-215) — alternative durcie future : socket proxy (tecnativa/docker-socket-proxy) restreint aux endpoints images/containers.
- Réplication PostgreSQL / haute dispo : hors périmètre de ce runbook (mono-VPS) — sauvegardes quotidiennes + rollback documenté.
