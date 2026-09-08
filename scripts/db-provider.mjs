#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// YAHRIA — DB PROVIDER SWITCHER (R7.2)
// Prisma n'autorise qu'un seul provider par génération de client :
// ce script bascule prisma/schema.prisma entre sqlite (défaut dev)
// et postgresql (production), puis rappelle les étapes à la main.
//
// Usage :
//   node scripts/db-provider.mjs sqlite|postgresql   # bascule le provider
//   YAHRIA_DB_PROVIDER=postgresql npx prisma generate  # mode automatique
// Après bascule : npx prisma generate (obligatoire) + npx prisma db push.
// ═══════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const SCHEMA = path.join(process.cwd(), 'prisma', 'schema.prisma');

function target() {
  const arg = process.argv[2];
  const env = process.env.YAHRIA_DB_PROVIDER;
  const url = process.env.DATABASE_URL ?? '';
  const chosen = arg || env || (url.startsWith('postgres') ? 'postgresql' : 'sqlite');
  if (chosen !== 'sqlite' && chosen !== 'postgresql') {
    console.error(`provider invalide : ${chosen} (sqlite | postgresql)`);
    process.exit(1);
  }
  return chosen;
}

const provider = target();
let text = readFileSync(SCHEMA, 'utf8');
const re = /(\sdatasource db\s*\{[^}]*provider\s*=\s*")(sqlite|postgresql)(")/s;
if (!re.test(text)) {
  console.error('bloc datasource db introuvable dans schema.prisma');
  process.exit(1);
}
const current = text.match(re)[2];
if (current === provider) {
  console.log(`provider déjà "${provider}" — aucune modification`);
} else {
  text = text.replace(re, `$1${provider}$3`);
  writeFileSync(SCHEMA, text);
  console.log(`schema.prisma : provider "${current}" → "${provider}"`);
}
console.log(`\nÉtapes suivantes :`);
console.log(`  npx prisma generate`);
console.log(`  npx prisma db push`);
console.log(`\nDATABASE_URL attendu :`);
console.log(provider === 'sqlite'
  ? `  file:./db/custom.db`
  : `  postgresql://<user>@<host>:5432/<db>`);
