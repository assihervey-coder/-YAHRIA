#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════
// YAHRIA — RELEASE (Domain 21 DevOps & Delivery, R14)
// Versionne, journalise et pousse une release gouvernée.
//
//   bun run scripts/release.mjs --version 2.4.0 --note "R14 plateforme"
//
// Refuse de release si le working tree n'est pas propre (INV-180 :
// pas de changement silencieux) ou si la version ne monte pas.
// ═══════════════════════════════════════════════════════════════

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);
function argOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const version = argOf('--version');
const note = argOf('--note') ?? 'release gouvernée';
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('✗ --version semver requise (ex : 2.4.0)');
  process.exit(1);
}

const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (status) {
  console.error('✗ Working tree non propre — committez d\'abord (INV-180).');
  process.exit(1);
}

const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const cmp = (a, b) => a.split('.').map(Number).reduce((acc, x, i) => acc || (x - b.split('.').map(Number)[i]) || 0, 0);
if (cmp(version, pkg.version) <= 0) {
  console.error(`✗ Version ${version} ≤ version courante ${pkg.version} — semver monotone (INV-190).`);
  process.exit(1);
}
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const changelogPath = new URL('../CHANGELOG.md', import.meta.url);
const entry = `## ${version} — ${new Date().toISOString().slice(0, 10)}\n\n- ${note}\n- Ledger d'activation : ${existsSync(new URL('../src/lib/yahria/domains.ts', import.meta.url)) ? 'DOMAIN_ACTIVATIONS (src/lib/yahria/domains.ts)' : 'indisponible'}\n\n`;
const prev = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '# CHANGELOG — YAHRIA\n\n';
writeFileSync(changelogPath, prev.replace('# CHANGELOG — YAHRIA\n\n', '# CHANGELOG — YAHRIA\n\n') + '');

// prepend after title
const lines = prev.split('\n');
const titleIdx = lines.findIndex((l) => l.startsWith('# '));
lines.splice(titleIdx + 2, 0, '\n' + entry.trimEnd());
writeFileSync(changelogPath, lines.join('\n'));

execSync('git add package.json CHANGELOG.md', { stdio: 'inherit' });
execSync(`git commit -m "release ${version} — ${note}"`, { stdio: 'inherit' });
console.log(`✓ Release ${version} commitée — push manuel : git push origin main (INV-200 : l'humain garde l'autorité de livraison).`);
