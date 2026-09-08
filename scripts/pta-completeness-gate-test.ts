#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════
// YAHRIA — TESTS PORTE DE COMPLÉTUDE (EVO-000026) — PTA-002 itération 6
// Tests unitaires de la logique PURE de la porte v3 + armement réel.
//   bun run scripts/pta-completeness-gate-test.mjs
// Chaque assertion est un fait mesuré — aucun résultat simulé (INV-227).
// ═══════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { classifyFailure, COMPLETENESS_GATE_EVO_UID } from '../src/lib/yahria/completeness-gate.ts';
import { circuitCooldownSnapshot } from '../src/lib/yahria/llm-fabric.ts';

const db = new PrismaClient();
let passed = 0, failed = 0;

function check(id: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${id}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.log(`  ✗ ${id}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nPTA-002 · Porte de complétude (EVO-000026) — tests unitaires\n');

// ── CG-T1. CLASSIFICATION (INV-210) — le cœur honnête de la porte ──
check('T1.1 note « circuit OPEN » → INFRA',
  classifyFailure(['circuit OPEN (cooldown 90s)']) === 'INFRA');
check('T1.2 note placeholder (INV-080) → MODÈLE',
  classifyFailure(['échec après 3 tentatives — dernier verdict : placeholder détecté : TODO (INV-080)']) === 'MODÈLE');
check('T1.3 note JSON invalide → MODÈLE (qualité modèle, pas infra)',
  classifyFailure(['JSON invalide : Unexpected token']) === 'MODÈLE');
check('T1.4 mixte [JSON invalide, circuit OPEN] → INFRA (la panne infra domine l\'attribution)',
  classifyFailure(['JSON invalide : Unexpected token', 'zai:circuit OPEN, cooldown 90s']) === 'INFRA');
check('T1.5 signature 429/rate-limit → INFRA',
  classifyFailure(['rate-limit atteint (429)']) === 'INFRA');
check('T1.6 signature réseau (ECONNREFUSED) → INFRA',
  classifyFailure(['fetch failed ECONNREFUSED']) === 'INFRA');
check('T1.7 note vide/absente → MODÈLE (défaut prudent : pas de classification INFRA sans preuve)',
  classifyFailure(['']) === 'MODÈLE' && classifyFailure(['?']) === 'MODÈLE');
check('T1.8 liste vide → MODÈLE',
  classifyFailure([]) === 'MODÈLE');

// ── CG-T2. SNAPSHOT CIRCUIT — pureté + état frais ──────────────────
const snap1 = circuitCooldownSnapshot();
check('T2.1 snapshot pur (processus frais) : anyOpen=false, tableau défini',
  snap1.anyOpen === false && Array.isArray(snap1.openProviders) && snap1.maxRemainingMs === 0,
  JSON.stringify(snap1));
const snap2 = circuitCooldownSnapshot();
check('T2.2 double appel sans mutation : état identique (aucun effet half-open)',
  JSON.stringify(snap1) === JSON.stringify(snap2));

// ── CG-T3. ARMEMENT GOUVERNÉ — le registre EST l'interrupteur ──────
const evo = await db.evolutionProposal.findUnique({ where: { proposalUid: COMPLETENESS_GATE_EVO_UID } });
check('T3.1 EVO-000026 existe dans le registre', Boolean(evo), evo?.state ?? 'ABSENT');
check('T3.2 EVO-000026 est PROMOTED → porte ARMÉE', evo?.state === 'PROMOTED');
check('T3.3 rollbackPlan persisté (INV-163, visible au promote)',
  (evo?.rollbackPlan ?? '').length >= 15, `len=${(evo?.rollbackPlan ?? '').length}`);
check('T3.4 décision humaine tracée (INV-227) : decidedBy HUMAN:*',
  (evo?.decidedBy ?? '').startsWith('HUMAN:'), evo?.decidedBy ?? '—');

// preuve des tests
const { captureAndPersist } = await import('../src/lib/yahria/evidence-store.ts');
await captureAndPersist({
  category: 'TEST', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: 'pta-completeness-gate-test',
  claim: `Tests porte de complétude (EVO-000026) : ${passed}/${passed + failed} PASS — classification INV-210 ×8, pureté snapshot ×2, armement gouverné ×4`,
  payload: { passed, failed, evoState: evo?.state ?? null },
});
await db.$disconnect();

console.log(`\nRésultat : ${passed}/${passed + failed} PASS\n`);
process.exit(failed ? 1 : 0);
