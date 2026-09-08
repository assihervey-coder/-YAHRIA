# ═══════════════════════════════════════════════════════════════
# YAHRIA CODE OS — image application (R11.3)
# Build : docker build -t yahria-os:latest .
# Run   : docker compose up -d   (app + PostgreSQL, recommandé)
# Note honnête : v1 sert l'app via le serveur custom (server.mjs :
# next + WebSocket realtime) — le mode standalone prod est planifié.
# ═══════════════════════════════════════════════════════════════
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Client Prisma généré pour la cible conteneur : PostgreSQL
RUN node scripts/db-provider.mjs postgresql && npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates bash && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV YAHRIA_DB_PROVIDER=postgresql
COPY --from=builder /app ./
EXPOSE 3000
ENTRYPOINT ["bash", "docker/docker-entrypoint.sh"]
