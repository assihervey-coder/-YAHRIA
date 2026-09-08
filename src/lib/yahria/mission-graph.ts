// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — MISSION GRAPH ENGINE (Domain 07) — KRN-031 · R14
//
// Orchestration multi-agents gouvernée : une mission est un DAG de
// tâches, chaque tâche = UN agent canonique × UN outil du registre.
//
//   GATE 1 — DAG integrity (INV-223) : graphe acyclic, dépendances
//            internes à la mission, tâche non prête ≠ schedulée.
//   GATE 2 — actor identity (INV-224) : un agent canonique par tâche.
//   GATE 3 — exécution via la passerelle agents↔registre (INV-216/062) :
//            capacité PUIS politique, preuve à chaque pas (INV-217).
//
// Retry gouverné (INV-092) : seul un échec d'EXÉCUTION est rejouable ;
// un refus de politique ou de capacité est FINAL — jamais retenté.
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { CANONICAL_AGENTS } from './agent-os';
import { BUILT_IN_TOOLS } from './tool-registry';
import { runAgentMission } from './agent-tools';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

export const MISSION_MODULE_ID = 'YAHRIA-KRN-031';

// ── MG-1. STATE MACHINES (guarded transitions, INV-090) ────────────

export const MISSION_STATES = ['PLANNED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED'] as const;
export const MISSION_TASK_STATES = ['PENDING', 'READY', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED'] as const;

const MISSION_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED'],
  COMPLETED: [], FAILED: [], BLOCKED: [], CANCELLED: [],
};

const TASK_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['READY', 'SKIPPED', 'CANCELLED'],
  READY: ['RUNNING', 'SKIPPED', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  FAILED: ['READY'], // retry gouverné — uniquement échec d'exécution (INV-092)
  COMPLETED: [], SKIPPED: [], CANCELLED: [],
};

export function assertMissionTransition(from: string, to: string): { ok: boolean; reason?: string } {
  const allowed = MISSION_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return { ok: false, reason: `transition mission illégale ${from} → ${to} (autorisées : ${allowed.join(', ') || 'aucune'})` };
  }
  return { ok: true };
}

export function assertTaskTransition(from: string, to: string): { ok: boolean; reason?: string } {
  const allowed = TASK_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return { ok: false, reason: `transition tâche illégale ${from} → ${to} (autorisées : ${allowed.join(', ') || 'aucune'})` };
  }
  return { ok: true };
}

/** Machine à états exposée pour les gates qualité (D.20) et le blueprint. */
export const MISSION_MACHINE = {
  name: 'MISSION',
  states: MISSION_STATES as unknown as string[],
  transitions: Object.entries(MISSION_TRANSITIONS).flatMap(([from, tos]) =>
    tos.map((to) => ({ from, to, guard: 'guarded', authority: 'mission-graph' }))),
};

// ── MG-2. S1 DECOMPOSER (deterministic templates, no invention) ────

interface DecomposedTask {
  title: string; agentKey: string; toolId: string; input: Record<string, unknown>; dependsOn: number[];
}

/**
 * Décomposition S1 DÉTERMINISTE par patrons (INV-191) — aucune
 * invention : chaque patron assemble des tâches réelles (agents et
 * outils existants). `strategy: 'MANUAL'` conserve les tâches soumises.
 */
export function decomposeGoal(goal: string): { strategy: 'DECOMPOSED'; tasks: DecomposedTask[]; rationale: string } {
  const g = goal.toLowerCase();
  if (/état|status|diagnostic|santé|health|audit/.test(g)) {
    return {
      strategy: 'DECOMPOSED',
      rationale: 'Patron DIAGNOSTIC : lire la constitution (architecte) → livraisons enregistrées (explorateur) → sonder les toolchains (explorateur).',
      tasks: [
        { title: 'Lire l\'état des domaines canoniques', agentKey: 'architect', toolId: 'system.domains.list', input: {}, dependsOn: [] },
        { title: 'Lister les exécutions studio enregistrées', agentKey: 'explorer', toolId: 'studio.runs.list', input: {}, dependsOn: [] },
        { title: 'Sonder les toolchains de l\'hôte', agentKey: 'explorer', toolId: 'sandbox.toolchains.detect', input: {}, dependsOn: [1, 2] },
      ],
    };
  }
  if (/politiq|rbac|autoris|sécurit|security|policy/.test(g)) {
    return {
      strategy: 'DECOMPOSED',
      rationale: 'Patron GOUVERNANCE : décisions politiques récentes (sécurité) → preuves associées (debugger) → lecture constitutionnelle (architecte).',
      tasks: [
        { title: 'Lire les décisions politiques récentes', agentKey: 'security', toolId: 'policy.decisions.recent', input: {}, dependsOn: [] },
        { title: 'Croiser avec les preuves récentes', agentKey: 'debugger', toolId: 'evidence.recent.list', input: {}, dependsOn: [1] },
        { title: 'Synthétiser la posture de gouvernance', agentKey: 'architect', toolId: 'system.domains.list', input: { core: true }, dependsOn: [1, 2] },
      ],
    };
  }
  // Patron par défaut — lecture seule, zéro effet de bord
  return {
    strategy: 'DECOMPOSED',
    rationale: 'Patron OBSERVATION par défaut : constitution (architecte) → livraisons (explorateur) → preuves récentes (debugger) — lecture seule, aucun outil à effet de bord.',
    tasks: [
      { title: 'Lire les domaines canoniques', agentKey: 'architect', toolId: 'system.domains.list', input: {}, dependsOn: [] },
      { title: 'Lister les exécutions studio', agentKey: 'explorer', toolId: 'studio.runs.list', input: {}, dependsOn: [] },
      { title: 'Collecter les preuves récentes', agentKey: 'debugger', toolId: 'evidence.recent.list', input: {}, dependsOn: [1] },
    ],
  };
}

// ── MG-2b. CREATED TASK SHAPE ──────────────────────────────────────

interface CreatedTaskRow {
  id: string; seq: number; title: string; agentKey: string; toolId: string; state: string; dependsOn: string[];
}

// ── MG-3. CREATION (DAG validation, INV-223/224) ───────────────────

export interface MissionCreationResult {
  ok: boolean; status: number;
  mission?: {
    missionUid: string; goal: string; state: string; strategy: string; traceId: string;
    tasks: { id: string; seq: number; title: string; agentKey: string; toolId: string; state: string; dependsOn: string[] }[];
  };
  errors: string[];
}

export async function createMission(params: {
  goal: string; strategy?: string;
  tasks?: { title: string; agentKey: string; toolId: string; input?: Record<string, unknown>; dependsOn?: number[] }[];
}): Promise<MissionCreationResult> {
  const errors: string[] = [];
  const goal = String(params.goal ?? '').trim();
  if (goal.length < 5) errors.push('objectif de mission requis (≥ 5 caractères) — aucune action sans intention');

  let tasks = params.tasks;
  let strategy = String(params.strategy ?? 'MANUAL').toUpperCase();
  if (strategy === 'DECOMPOSED') {
    const d = decomposeGoal(goal);
    tasks = d.tasks;
    strategy = 'DECOMPOSED';
  }
  if (!['MANUAL', 'DECOMPOSED'].includes(strategy)) errors.push(`strategy invalide « ${strategy} » — vocabulaire : MANUAL | DECOMPOSED`);
  if (!Array.isArray(tasks) || tasks.length === 0) errors.push('au moins une tâche est requise (ou strategy: DECOMPOSED pour la décomposition S1)');
  if (errors.length > 0) return { ok: false, status: 422, errors };
  const list = tasks!;

  // Identity + tool validation against the CANONICAL registries only (INV-224)
  for (const t of list) {
    const agentKey = String(t.agentKey ?? '');
    if (!CANONICAL_AGENTS.some((a) => a.key === agentKey)) {
      errors.push(`agent « ${agentKey} » inconnu — seuls les agents canoniques existent (INV-224)`);
    }
    const toolId = String(t.toolId ?? '');
    if (!BUILT_IN_TOOLS.some((x) => x.toolId === toolId)) {
      errors.push(`outil « ${toolId} » non enregistré — seule la surface du registre D.09 est invoquable (INV-062)`);
    }
    if (!Array.isArray(t.dependsOn ?? [])) errors.push(`tâche « ${t.title} » : dependsOn doit être un tableau de numéros de tâches`);
  }
  if (errors.length > 0) return { ok: false, status: 422, errors };

  // DAG integrity — seq-based deps, cycle-free by construction check (INV-223)
  const n = list.length;
  const deps = list.map((t, i) => (t.dependsOn ?? []).map((d) => Number(d)));
  for (let i = 0; i < n; i++) {
    for (const d of deps[i]) {
      if (!Number.isInteger(d) || d < 1 || d > n) errors.push(`tâche ${i + 1} : dépendance ${d} hors bornes (1..${n})`);
      else if (d === i + 1) errors.push(`tâche ${i + 1} : auto-dépendance interdite (graphe acyclique, INV-223)`);
      else if (d > i + 1) errors.push(`tâche ${i + 1} : dépendance vers une tâche ultérieure (${d}) — ordre topologique impossible`);
    }
  }
  if (errors.length > 0) return { ok: false, status: 422, errors };

  // Mission UID — monotonic sequence, no guess
  const last = await db.mission.findMany({ orderBy: { createdAt: 'desc' }, take: 1, select: { missionUid: true } });
  const nextSeq = (() => {
    const m = /(\d+)$/.exec(last[0]?.missionUid ?? '');
    return m ? parseInt(m[1], 10) + 1 : 1;
  })();
  const missionUid = `MIS-${String(nextSeq).padStart(6, '0')}`;
  const traceId = `TR-MIS-${randomUUID().slice(0, 12)}`;

  const mission = await db.mission.create({
    data: { missionUid, goal, state: 'PLANNED', strategy, traceId },
  });

  const createdTasks: CreatedTaskRow[] = [];
  const idBySeq = new Map<number, string>();
  for (let i = 0; i < n; i++) {
    const t = list[i];
    const row = await db.missionTask.create({
      data: {
        missionId: mission.id, seq: i + 1,
        title: String(t.title ?? `Tâche ${i + 1}`).slice(0, 200),
        agentKey: String(t.agentKey), toolId: String(t.toolId),
        input: JSON.stringify(t.input ?? {}),
        dependsOn: '[]', // rempli après création (ids réels)
        state: 'PENDING',
      },
    });
    idBySeq.set(i + 1, row.id);
    createdTasks.push({
      id: row.id, seq: row.seq, title: row.title, agentKey: row.agentKey,
      toolId: row.toolId, state: row.state, dependsOn: [],
    });
  }
  for (let i = 0; i < n; i++) {
    const depIds = deps[i].map((d) => idBySeq.get(d)!).filter(Boolean);
    await db.missionTask.update({
      where: { id: idBySeq.get(i + 1)! },
      data: { dependsOn: JSON.stringify(depIds) },
    });
    createdTasks[i].dependsOn = depIds;
  }

  await captureAndPersist({
    category: 'TASK', criticality: 'STANDARD', actorType: 'HUMAN', actorId: 'mission-console',
    claim: `Mission ${missionUid} créée — ${n} tâche(s), stratégie ${strategy}, DAG acyclique validé (INV-223)`,
    payload: { missionUid, goal: goal.slice(0, 300), strategy, traceId, tasks: createdTasks.map((t) => ({ seq: t.seq, agent: t.agentKey, tool: t.toolId })) },
    traceId,
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.MISSION_CREATED, source: '07', severity: 'INFO',
    message: `Mission ${missionUid} planifiée — ${n} tâche(s) (${strategy})`,
    payload: { missionUid, traceId, tasks: n },
  });

  return {
    ok: true, status: 201,
    mission: { missionUid, goal, state: 'PLANNED', strategy, traceId, tasks: createdTasks },
    errors: [],
  };
}

// ── MG-4. SCHEDULER + DAG TICK (INV-091/092, one tick = one wave) ──

export interface TickReport {
  missionUid: string; state: string;
  executed: { seq: number; title: string; agentKey: string; toolId: string; verdict: string; ok: boolean; retryScheduled: boolean }[];
  pending: number; ready: number; completed: number; failed: number;
  summary: string;
}

export async function tickMission(missionUid: string): Promise<{ ok: boolean; status: number; report?: TickReport; errors: string[] }> {
  const mission = await db.mission.findUnique({ where: { missionUid }, include: { tasks: { orderBy: { seq: 'asc' } } } });
  if (!mission) return { ok: false, status: 404, errors: [`mission introuvable : ${missionUid}`] };
  if (!['SCHEDULED', 'RUNNING'].includes(mission.state)) {
    return { ok: false, status: 422, errors: [`mission ${mission.state} — tick impossible (machine à états : SCHEDULED/RUNNING seulement, INV-090)`] };
  }
  if (mission.state === 'SCHEDULED') {
    await db.mission.update({ where: { id: mission.id }, data: { state: 'RUNNING' } });
  }

  const tasks = mission.tasks;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const executed: TickReport['executed'] = [];

  for (const t of tasks) {
    if (t.state === 'PENDING') {
      const depIds = JSON.parse(t.dependsOn || '[]') as string[];
      const deps = depIds.map((id) => byId.get(id)).filter(Boolean) as typeof tasks;
      const allDone = deps.length > 0 && deps.every((d) => d.state === 'COMPLETED');
      const anyBlockedForever = deps.some((d) => d.state === 'SKIPPED' || d.state === 'CANCELLED');
      if (allDone) {
        const gate = assertTaskTransition(t.state, 'READY');
        if (gate.ok) await db.missionTask.update({ where: { id: t.id }, data: { state: 'READY' } });
      } else if (anyBlockedForever) {
        await db.missionTask.update({ where: { id: t.id }, data: { state: 'SKIPPED' } });
      }
    }
  }

  // Re-read — READY set refreshed after the promotion wave
  const fresh = await db.mission.findUnique({ where: { id: mission.id }, include: { tasks: { orderBy: { seq: 'asc' } } } });
  if (!fresh) return { ok: false, status: 500, errors: ['relecture mission impossible'] };
  for (const t of fresh.tasks) {
    if (t.state !== 'READY') continue;
    const startGate = assertTaskTransition(t.state, 'RUNNING');
    if (!startGate.ok) continue;
    await db.missionTask.update({ where: { id: t.id }, data: { state: 'RUNNING' } });
    emitYahriaEvent({
      type: REALTIME_EVENT_TYPES.MISSION_TASK_STARTED, source: '07', severity: 'INFO',
      message: `Mission ${missionUid} · tâche ${t.seq} démarrée (${t.agentKey} × ${t.toolId})`,
      payload: { missionUid, seq: t.seq, traceId: mission.traceId },
    });

    // Execution through the governed agents↔registry bridge — the ONLY path
    const res = await runAgentMission({
      agentKey: t.agentKey, mission: `${missionUid} · ${t.title}`,
      toolCalls: [{ toolId: t.toolId, input: JSON.parse(t.input || '{}') as Record<string, unknown> }],
    });
    const step = res.steps[0];
    const executionFailure = !!step && step.verdict === 'EXECUTION_FAILED';
    const blockedByGovernance = !!step && (step.verdict === 'DENIED' || step.verdict === 'REQUIRE_APPROVAL' || step.verdict === 'CAPABILITY_DENIED');

    let nextState: string; let errorTail: string | null = null;
    let retryScheduled = false;
    if (step?.ok) {
      nextState = 'COMPLETED';
    } else if (executionFailure && t.retries < t.maxRetries) {
      nextState = 'READY'; // retry gouverné (INV-092)
      retryScheduled = true;
      errorTail = (step?.detail ?? 'échec exécution').slice(0, 400);
      await db.missionTask.update({ where: { id: t.id }, data: { retries: { increment: 1 } } });
    } else {
      nextState = 'FAILED';
      errorTail = blockedByGovernance
        ? `REFUS GOUVERNÉ (final, non retenté — INV-092) : ${step?.detail ?? 'politique/capacité'}`
        : (step?.detail ?? 'échec exécution — budget retries épuisé').slice(0, 400);
    }
    const endGate = assertTaskTransition('RUNNING', nextState === 'READY' ? 'FAILED' : nextState);
    // RUNNING→READY passe par FAILED→READY (machine à états) : on encode
    // le retour retry comme RUNNING→FAILED puis FAILED→READY.
    if (nextState === 'READY') {
      await db.missionTask.update({ where: { id: t.id }, data: { state: 'FAILED', error: errorTail, runId: res.runId } });
      const rGate = assertTaskTransition('FAILED', 'READY');
      if (rGate.ok) await db.missionTask.update({ where: { id: t.id }, data: { state: 'READY' } });
    } else if (endGate.ok) {
      await db.missionTask.update({ where: { id: t.id }, data: { state: nextState, error: errorTail, runId: res.runId, result: step?.ok ? JSON.stringify({ toolId: t.toolId, ms: res.ms }).slice(0, 4000) : null } });
    }
    executed.push({
      seq: t.seq, title: t.title, agentKey: t.agentKey, toolId: t.toolId,
      verdict: step?.verdict ?? res.verdict, ok: !!step?.ok, retryScheduled,
    });
    emitYahriaEvent({
      type: step?.ok ? REALTIME_EVENT_TYPES.MISSION_TASK_COMPLETED : REALTIME_EVENT_TYPES.MISSION_TASK_FAILED,
      source: '07', severity: step?.ok ? 'SUCCESS' : 'WARN',
      message: `Mission ${missionUid} · tâche ${t.seq} ${step?.ok ? 'terminée' : `en échec (${step?.verdict ?? res.verdict})`}${retryScheduled ? ' — retry programmé' : ''}`,
      payload: { missionUid, seq: t.seq, verdict: step?.verdict ?? res.verdict },
    });
  }

  // Mission-level aggregation — honest verdicts only
  const after = await db.mission.findUnique({ where: { id: mission.id }, include: { tasks: true } });
  if (!after) return { ok: false, status: 500, errors: ['relecture mission finale impossible'] };
  const counts = {
    pending: after.tasks.filter((t) => t.state === 'PENDING').length,
    ready: after.tasks.filter((t) => t.state === 'READY').length,
    completed: after.tasks.filter((t) => t.state === 'COMPLETED').length,
    failed: after.tasks.filter((t) => t.state === 'FAILED').length,
  };
  const total = after.tasks.length;
  let finalState: string | null = null;
  if (counts.completed === total) finalState = 'COMPLETED';
  else if (counts.failed + counts.completed === total) finalState = 'FAILED';
  else if (counts.pending + counts.ready === 0) finalState = 'FAILED'; // rien d'exécutable et pas fini
  if (finalState) {
    const gate = assertMissionTransition('RUNNING', finalState);
    if (gate.ok) await db.mission.update({ where: { id: after.id }, data: { state: finalState } });
    await captureAndPersist({
      category: 'TASK', criticality: finalState === 'COMPLETED' ? 'STANDARD' : 'HIGH',
      actorType: 'SYSTEM', actorId: 'mission-graph',
      claim: `Mission ${missionUid} ${finalState} — ${counts.completed}/${total} tâche(s) complétée(s), ${counts.failed} échec(s)`,
      payload: { missionUid, finalState, counts, traceId: after.traceId },
      traceId: after.traceId ?? undefined,
    });
    emitYahriaEvent({
      type: finalState === 'COMPLETED' ? REALTIME_EVENT_TYPES.MISSION_COMPLETED : REALTIME_EVENT_TYPES.MISSION_FAILED,
      source: '07', severity: finalState === 'COMPLETED' ? 'SUCCESS' : 'WARN',
      message: `Mission ${missionUid} ${finalState} — ${counts.completed}/${total} tâche(s)`,
      payload: { missionUid, finalState, counts },
    });
  }

  const state = finalState ?? 'RUNNING';
  const summary = executed.length === 0
    ? `Aucune tâche exécutable ce tick — ${counts.pending} en attente de dépendances (INV-091), ${counts.ready} prêtes.`
    : `${executed.length} tâche(s) exécutée(s) via la passerelle gouvernée — ${executed.filter((e) => e.ok).length} succès, ${executed.filter((e) => !e.ok).length} refus/échec(s).`;
  return { ok: true, status: 200, report: { missionUid, state, executed, ...counts, summary }, errors: [] };
}

// ── MG-5. SCHEDULE + CANCEL (governed) ─────────────────────────────

export async function scheduleMission(missionUid: string): Promise<{ ok: boolean; status: number; errors: string[] }> {
  const mission = await db.mission.findUnique({ where: { missionUid }, include: { tasks: true } });
  if (!mission) return { ok: false, status: 404, errors: [`mission introuvable : ${missionUid}`] };
  const gate = assertMissionTransition(mission.state, 'SCHEDULED');
  if (!gate.ok) return { ok: false, status: 422, errors: [gate.reason!] };
  await db.mission.update({ where: { id: mission.id }, data: { state: 'SCHEDULED' } });
  // Les tâches sans dépendance passent PENDING → READY (INV-091 respecté)
  for (const t of mission.tasks) {
    const deps = JSON.parse(t.dependsOn || '[]') as string[];
    if (t.state === 'PENDING' && deps.length === 0) {
      const tg = assertTaskTransition(t.state, 'READY');
      if (tg.ok) await db.missionTask.update({ where: { id: t.id }, data: { state: 'READY' } });
    }
  }
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.MISSION_SCHEDULED, source: '07', severity: 'INFO',
    message: `Mission ${missionUid} programmée — ${mission.tasks.length} tâche(s)`,
    payload: { missionUid, traceId: mission.traceId },
  });
  return { ok: true, status: 200, errors: [] };
}

export async function cancelMission(missionUid: string, reason: string): Promise<{ ok: boolean; status: number; errors: string[] }> {
  if (String(reason ?? '').trim().length < 10) {
    return { ok: false, status: 422, errors: ['raison d\'annulation obligatoire (≥ 10 caractères) — INV-200/201 : la main humaine est explicite'] };
  }
  const mission = await db.mission.findUnique({ where: { missionUid }, include: { tasks: true } });
  if (!mission) return { ok: false, status: 404, errors: [`mission introuvable : ${missionUid}`] };
  const gate = assertMissionTransition(mission.state, 'CANCELLED');
  if (!gate.ok) return { ok: false, status: 422, errors: [gate.reason!] };
  await db.mission.update({ where: { id: mission.id }, data: { state: 'CANCELLED', note: String(reason).slice(0, 400) } });
  for (const t of mission.tasks) {
    if (['PENDING', 'READY'].includes(t.state)) {
      await db.missionTask.update({ where: { id: t.id }, data: { state: 'CANCELLED' } });
    }
  }
  await captureAndPersist({
    category: 'TASK', criticality: 'HIGH', actorType: 'HUMAN', actorId: 'mission-console',
    claim: `Mission ${missionUid} annulée par autorité humaine — raison : ${String(reason).slice(0, 200)}`,
    payload: { missionUid, reason: String(reason).slice(0, 300) },
    traceId: mission.traceId ?? undefined,
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.MISSION_CANCELLED, source: '07', severity: 'WARN',
    message: `Mission ${missionUid} annulée (autorité humaine)`,
    payload: { missionUid },
  });
  return { ok: true, status: 200, errors: [] };
}
