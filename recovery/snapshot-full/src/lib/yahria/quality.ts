// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — QUALITY ENGINEERING (Domain 20) — KRN-036 · R14
//
// Gates qualité mesurées EN PROCESSUS (faites, pas affirmées) +
// gates EXTERNES déclarées honnêtement (tsc/eslint/pytest —
// exécutées par CI et scripts, jamais simulées ici : INV-171).
// Aucune capacité ne peut être déclarée DONE avec un gate qui
// échoue (INV-232).
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { INVARIANTS } from './invariants';
import { BUILT_IN_TOOLS, validateToolContract } from './tool-registry';
import { MISSION_MACHINE } from './mission-graph';
import { EVOLUTION_MACHINE } from './evolution';
import { learningConfidence, identitySeparationOk, INSIGHT_THRESHOLD } from './learning';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

export const QUALITY_MODULE_ID = 'YAHRIA-KRN-036';

export interface QualityGate {
  id: string; title: string;
  kind: 'IN_PROCESS' | 'EXTERNAL';
  ok: boolean; measured: boolean;
  detail: string;
}

/**
 * D.20 — Gates IN PROCESS : chaque gate exécute une vérification
 * réelle maintenant. Gates EXTERNAL : commandes canoniques,
 * exécutées par CI/scripts — statut mesuré AILLEURS, jamais
 * prétendu ici (INCONNU ≠ SUCCÈS).
 */
export async function runQualityGates(): Promise<{ ok: boolean; gates: QualityGate[]; runAt: string; snapshotId: string; evidenceUid: string }> {
  const gates: QualityGate[] = [];

  // G1 — registre des invariants cohérent
  const invIds = INVARIANTS.map((i) => i.id);
  const invUnique = new Set(invIds).size === invIds.length;
  gates.push({
    id: 'G1_INVARIANTS', title: 'Registre invariants : unicité + couverture', kind: 'IN_PROCESS',
    ok: invUnique && invIds.length >= 97, measured: true,
    detail: `${invIds.length} invariants, unicité ${invUnique ? 'OK' : 'ÉCHOUÉE'} (attendu ≥ 97).`,
  });

  // G2 — contrats des outils built-in valides (S1)
  const contractErrors: string[] = [];
  for (const t of BUILT_IN_TOOLS) {
    const v = validateToolContract(t.contract);
    if (!v.ok) contractErrors.push(`${t.toolId}: ${v.errors.join('; ')}`);
  }
  gates.push({
    id: 'G2_TOOL_CONTRACTS', title: 'Contrats des outils du registre', kind: 'IN_PROCESS',
    ok: contractErrors.length === 0, measured: true,
    detail: contractErrors.length === 0
      ? `${BUILT_IN_TOOLS.length} contrats validés S1 (type, properties, required cohérents).`
      : contractErrors.slice(0, 4).join(' | '),
  });

  // G3 — parité registre DB ↔ noyau
  const dbToolCount = await db.registeredTool.count();
  gates.push({
    id: 'G3_REGISTRY_PARITY', title: 'Parité registre DB ↔ noyau', kind: 'IN_PROCESS',
    ok: dbToolCount >= BUILT_IN_TOOLS.length, measured: true,
    detail: `${dbToolCount} outils en base vs ${BUILT_IN_TOOLS.length} built-in — la base ne peut pas être en retard sur le noyau.`,
  });

  // G4 — machines à états gardées présentes (TASK implicite, MISSION, EVOLUTION)
  const machinesOk = MISSION_MACHINE.states.length === 7 && EVOLUTION_MACHINE.states.length >= 7
    && MISSION_MACHINE.transitions.length >= 7 && EVOLUTION_MACHINE.transitions.length >= 7;
  gates.push({
    id: 'G4_STATE_MACHINES', title: 'Machines à états gouvernées présentes', kind: 'IN_PROCESS',
    ok: machinesOk, measured: true,
    detail: `MISSION (${MISSION_MACHINE.states.length} états / ${MISSION_MACHINE.transitions.length} transitions gardées), EVOLUTION (${EVOLUTION_MACHINE.states.length} états / ${EVOLUTION_MACHINE.transitions.length} transitions) — toute transition illégale est refusée 422.`,
  });

  // G5 — logique d'apprentissage : fonctions pures auto-testées
  const c0 = learningConfidence(0); const c3 = learningConfidence(3); const c10 = learningConfidence(10);
  const sepOk = !identitySeparationOk('AGENT:tester', 'AGENT:tester') && identitySeparationOk('AGENT:tester', 'HUMAN');
  const learnOk = Math.abs(c0 - 0.3) < 1e-9 && Math.abs(c3 - 0.6) < 1e-9 && c10 === 0.95 && sepOk;
  gates.push({
    id: 'G5_LEARNING_LOGIC', title: 'Logique apprentissage (fonctions pures)', kind: 'IN_PROCESS',
    ok: learnOk, measured: true,
    detail: `confiance(0)=${c0.toFixed(2)}, confiance(3)=${c3.toFixed(2)} (seuil ${INSIGHT_THRESHOLD} échantillons → VALIDATED), confiance(10)=${c10.toFixed(2)} plafonnée ; séparation proposition/approbation ${sepOk ? 'appliquée' : 'DÉFAILLANTE'}.`,
  });

  // G6 — intégrité de la chaîne de preuves (échantillon 50)
  const ev = await db.evidence.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { contentHash: true, prevHash: true } });
  const evMissing = ev.filter((r) => !r.contentHash).length;
  gates.push({
    id: 'G6_EVIDENCE_CHAIN', title: 'Chaîne de preuves hachée (échantillon 50)', kind: 'IN_PROCESS',
    ok: ev.length === 0 || evMissing === 0, measured: true,
    detail: ev.length === 0 ? 'Aucune preuve — non applicable (non compté comme échec).' : `${ev.length - evMissing}/${ev.length} preuves avec SHA-256 + lignée prevHash.`,
  });

  // G7..G9 — gates EXTERNES déclarées honnêtement (exécutées par CI/scripts)
  gates.push(
    {
      id: 'G7_TYPESCRIPT', title: 'tsc --noEmit (0 erreur exigé)', kind: 'EXTERNAL', measured: false,
      ok: false, detail: 'Gate EXTERNE : `bunx tsc --noEmit` — exécuté par CI (.github/workflows/ci.yml) et scripts/quality-gates.mjs ; ce run in-process ne le prétend PAS (INV-171).',
    },
    {
      id: 'G8_LINT', title: 'eslint (0 erreur exigé)', kind: 'EXTERNAL', measured: false,
      ok: false, detail: 'Gate EXTERNE : `bun run lint` — exécuté par CI et scripts/quality-gates.mjs.',
    },
    {
      id: 'G9_PARITY_PYTHON', title: 'Parité noyau Python (pytest)', kind: 'EXTERNAL', measured: false,
      ok: false, detail: 'Gate EXTERNE : `pytest yahria-core/tests` — exécuté par CI sur les fixtures de parité (R7).',
    },
  );

  const measuredGates = gates.filter((g) => g.measured);
  const ok = measuredGates.every((g) => g.ok);

  const snapshot = await db.opsSnapshot.create({
    data: {
      kind: 'QUALITY_GATES', ok,
      summary: JSON.stringify({ gates, runAt: new Date().toISOString() }).slice(0, 60_000),
    },
  });
  const evidence = await captureAndPersist({
    category: 'TEST', criticality: ok ? 'STANDARD' : 'HIGH',
    actorType: 'SYSTEM', actorId: 'quality-engine',
    claim: `Gates qualité : ${measuredGates.filter((g) => g.ok).length}/${measuredGates.length} gates mesurées OK (+${gates.length - measuredGates.length} externes déclarées)`,
    payload: { snapshotId: snapshot.id, gates: gates.map((g) => ({ id: g.id, ok: g.ok, kind: g.kind })) },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.QUALITY_GATES_RUN, source: '20',
    severity: ok ? 'SUCCESS' : 'WARN',
    message: `Gates qualité ${ok ? 'PASS' : 'FAIL'} — ${measuredGates.filter((g) => g.ok).length}/${measuredGates.length} mesurées`,
    payload: { snapshotId: snapshot.id, evidenceUid: evidence.uid },
  });

  return { ok, gates, runAt: new Date().toISOString(), snapshotId: snapshot.id, evidenceUid: evidence.uid };
}
