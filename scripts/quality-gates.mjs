#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════
// YAHRIA — QUALITY GATES RUNNER (Domain 20/21, R14)
// Exécute les gates EXTERNES déclarées par quality.ts (KRN-036) :
// tsc, eslint, parité Python. Chaque résultat est un fait mesuré.
//
//   bun run scripts/quality-gates.mjs
//   (prérequis : serveur de dev éteint pour tsc/eslint — gates locales)
// ═══════════════════════════════════════════════════════════════

import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';

let passed = 0, failed = 0;
function gate(id, cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', timeout: 300_000, ...opts });
  const ok = res.status === 0;
  if (ok) { passed++; console.log(`  ✓ ${id}`); }
  else {
    failed++;
    console.log(`  ✗ ${id} (exit ${res.status})`);
    const tail = (res.stdout ?? '').split('\n').slice(-12).join('\n');
    const errTail = (res.stderr ?? '').split('\n').slice(-12).join('\n');
    if (tail.trim()) console.log(`    stdout: ${tail}`);
    if (errTail.trim()) console.log(`    stderr: ${errTail}`);
  }
}

console.log('\nYAHRIA — Gates qualité externes (INV-171/232)\n');

gate('G7_TYPESCRIPT  tsc --noEmit', 'bunx', ['tsc', '--noEmit']);
gate('G8_LINT        eslint', 'bun', ['run', 'lint']);

// G10 — registre invariants : unicité + seuil
try {
  const src = readFileSync(new URL('../src/lib/yahria/invariants.ts', import.meta.url), 'utf8');
  const ids = [...src.matchAll(/id: 'INV-(\d+)'/g)].map((m) => m[1]);
  const unique = new Set(ids).size === ids.length;
  if (unique && ids.length >= 97) { passed++; console.log(`  ✓ G10_INVARIANTS (${ids.length} uniques)`); }
  else { failed++; console.log(`  ✗ G10_INVARIANTS (${ids.length} ids, uniques=${unique})`); }
} catch (e) {
  failed++; console.log(`  ✗ G10_INVARIANTS — lecture impossible : ${e.message}`);
}

// G11 — parité Python (si l'environnement le permet — échec honnête sinon)
const pytest = spawnSync('python3', ['-m', 'pytest', 'yahria-core/tests', '-q'], { encoding: 'utf8', timeout: 180_000 });
if (pytest.status === 0) { passed++; console.log('  ✓ G11_PARITY_PYTHON'); }
else {
  failed++;
  console.log(`  ✗ G11_PARITY_PYTHON (exit ${pytest.status}) — ${String(pytest.stderr ?? '').split('\n').slice(-3).join(' | ').slice(0, 220)}`);
}

console.log(`\n${passed} gate(s) PASS, ${failed} FAIL — un gate qui échoue interdit toute déclaration DONE (INV-232).\n`);
process.exit(failed === 0 ? 0 : 1);
