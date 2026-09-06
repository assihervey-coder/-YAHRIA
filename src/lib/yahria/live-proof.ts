// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — LIVE PROOF ORCHESTRATOR (Domain 08, R11)
// Doc ID: YAHRIA-STD-003 | Spec: SANDBOX_EXECUTION_SPECIFICATION.md
//
// The governed closure of the autonomy loop:
//   SEALED delivery → [install → syntax → build → launch → probe]
//   → on failure: SELF-HEAL via the AI editor (bounded budget) → retry
//   → PROVED: state machine SEALED → LIVE_PROVED (monotone, guarded)
//
// Constitutional constraints:
//   POL-009 — execution.run on sandbox.live must be ALLOWed (D.6 governs)
//   INV-042 — bounded: attempt budget + wall-clock budget + per-step timeouts
//   INV-080 — a probe result is evidence, computed here, never assumed
//   INV-210 — final UNPROVED is an honest outcome, the SEALED delivery survives
//   INV-211 — every attempt is persisted (LiveCheck), failures leave evidence
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import { evaluatePolicy, SEED_POLICY_RULES } from './policy-engine';
import { STUDIO_EVENTS, editGeneratedFile, transitionRun } from './studio-pipeline';
import { emitYahriaEvent } from './realtime';
import { executeLiveAttempt, type LiveReport } from './sandbox-executor';

const MAX_ATTEMPTS = Math.max(1, Number(process.env.YAHRIA_LIVE_MAX_ATTEMPTS ?? 3));
const BUDGET_MS = Math.max(60_000, Number(process.env.YAHRIA_LIVE_BUDGET_MS ?? 900_000));

export interface LiveProofResult {
  ok: boolean;
  verdict: 'PROVED' | 'PARTIAL' | 'UNPROVED';
  attempts: number;
  repaired: { attempt: number; path: string }[];
  reason: string;
  port: number | null;
  state: string;
  error?: string;
}

function emitLive(type: string, severity: 'INFO' | 'SUCCESS' | 'WARN' | 'CRITICAL', message: string, runUid: string, payload?: Record<string, unknown>): void {
  emitYahriaEvent({ type, source: '03', severity, message, payload: { runUid, ...payload } });
}

/** Locate the faulty file from the failing step's output; fallback: entry, then first module. */
function guessFaultyFile(report: LiveReport, files: { path: string; role: string }[]): { path: string; source: 'error' | 'fallback' } | null {
  const bad = report.steps.find((s) => !s.ok);
  const errorText = `${bad?.err ?? ''}\n${bad?.out ?? ''}\n${report.reason}`;
  // Heuristique : échec d'install → le manifeste de dépendances est la cible naturelle
  if (bad?.label === 'install') {
    const manifest = files.find((f) => /(^|\/)(requirements\.txt|package\.json|pyproject\.toml)$/.test(f.path));
    if (manifest) return { path: manifest.path, source: 'error' };
  }
  const candidates = files.map((f) => f.path).sort((a, b) => b.length - a.length); // longest match first
  for (const p of candidates) {
    if (errorText.includes(p)) return { path: p, source: 'error' };
  }
  const entry = files.find((f) => f.role === 'entry');
  if (entry) return { path: entry.path, source: 'fallback' };
  const mod = files.find((f) => f.role === 'module');
  return mod ? { path: mod.path, source: 'fallback' } : null;
}

function repairInstruction(report: LiveReport, faultyPath: string): string {
  const bad = report.steps.find((s) => !s.ok);
  const errTail = `${bad?.err ?? ''} ${bad?.out ?? ''} ${report.reason}`.replace(/\s+/g, ' ').slice(0, 700);
  const cmd = bad?.cmd ?? report.launch?.argv.join(' ') ?? 'le lancement';
  return `REPAIR DIRECTIVE (live proof, attempt ${report.attempt}): the ${bad?.label ?? 'launch'} step failed. ` +
    `Make this file correct so that « ${cmd} » succeeds. ERROR CONTEXT: ${errTail}. ` +
    `Fix only the root cause of this error — keep everything else intact.` +
    ` (fichier incriminé : ${faultyPath})`;
}

/** Full governed live-proof loop: execute → self-heal → retry → decide. */
export async function runLiveProof(runId: string): Promise<LiveProofResult> {
  const run = await db.generationRun.findUnique({ where: { id: runId }, include: { files: true } });
  if (!run) return { ok: false, verdict: 'UNPROVED', attempts: 0, repaired: [], reason: 'run introuvable', port: null, state: '?', error: 'run introuvable' };
  if (run.state === 'LIVE_PROVED') return { ok: false, verdict: 'PROVED', attempts: 0, repaired: [], reason: 'déjà prouvé live (transition monotone — re-exécution refusée)', port: run.livePort ?? null, state: run.state };
  if (run.state !== 'SEALED') return { ok: false, verdict: 'UNPROVED', attempts: 0, repaired: [], reason: `état ${run.state} — SEALED requis avant preuve live`, port: null, state: run.state };
  if (run.liveState === 'RUNNING') return { ok: false, verdict: 'UNPROVED', attempts: 0, repaired: [], reason: 'une preuve live est déjà en cours', port: run.livePort ?? null, state: run.state };

  // ── D.6 gouverne le lancement (POL-009 : execution.run sur sandbox.*) ──
  const policy = evaluatePolicy(
    { actorType: 'SYSTEM', actorId: 'yahria-studio-live', action: 'execution.run', resource: 'sandbox.live' },
    SEED_POLICY_RULES,
  );
  if (policy.effect !== 'ALLOW') {
    emitLive(STUDIO_EVENTS.LIVE_UNPROVED, 'CRITICAL',
      `Studio ${run.runUid} : lancement sandbox refusé par la politique (${policy.matchedRule})`, run.runUid,
      { effect: policy.effect, rule: policy.matchedRule });
    return { ok: false, verdict: 'UNPROVED', attempts: 0, repaired: [], reason: `politique : ${policy.reason}`, port: null, state: run.state };
  }

  const workspaceDir = run.workspacePath ? `${process.cwd()}/${run.workspacePath}` : '';
  if (!workspaceDir) return { ok: false, verdict: 'UNPROVED', attempts: 0, repaired: [], reason: 'workspace absent', port: null, state: run.state };

  const files = run.files.filter((f) => f.state === 'VERIFIED' && f.content !== null)
    .map((f) => ({ path: f.path, content: f.content as string, role: f.role }));
  const recipeFiles = files.map((f) => ({ path: f.path, content: f.content }));

  await db.generationRun.update({ where: { id: runId }, data: { liveState: 'RUNNING', livePort: null } });
  emitLive(STUDIO_EVENTS.LIVE_STARTED, 'INFO',
    `Studio ${run.runUid} : preuve live démarrée — install → syntaxe → build → lancement → sonde HTTP (budget ${MAX_ATTEMPTS} tentative(s))`, run.runUid,
    { stack: run.stack, maxAttempts: MAX_ATTEMPTS });

  const t0 = Date.now();
  const repaired: { attempt: number; path: string }[] = [];
  let lastReport: LiveReport | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (Date.now() - t0 > BUDGET_MS) {
      emitLive(STUDIO_EVENTS.LIVE_UNPROVED, 'WARN', `Studio ${run.runUid} : budget temps épuisé (${Math.round(BUDGET_MS / 1000)}s) — arrêt honnête`, run.runUid);
      break;
    }

    const report = await executeLiveAttempt({
      runUid: run.runUid, stack: run.stack, attempt, workspaceDir, files: recipeFiles,
      preferredPort: 3910 + attempt * 2,
    });
    lastReport = report;

    await db.liveCheck.create({ data: { runId, attempt, state: report.verdict, report: JSON.stringify(report) } });
    emitLive(STUDIO_EVENTS.LIVE_ATTEMPT, report.verdict === 'UNPROVED' ? 'WARN' : 'INFO',
      `Studio ${run.runUid} : tentative ${attempt} → ${report.verdict} (${report.reason})`, run.runUid,
      { attempt, verdict: report.verdict, reason: report.reason, ms: report.ms });

    if (report.verdict === 'PROVED' || report.verdict === 'PARTIAL') {
      const port = report.launch?.port ?? null;
      await db.generationRun.update({ where: { id: runId }, data: { liveState: report.verdict, livePort: port } });
      await captureAndPersist({
        category: 'ARTIFACT', criticality: report.verdict === 'PROVED' ? 'CRITICAL' : 'STANDARD',
        actorType: 'SYSTEM', actorId: 'yahria-studio-live',
        claim: `Preuve live ${report.verdict} : ${run.runUid} (${run.stack}) — ${report.reason}`,
        payload: { runUid: run.runUid, attempt, probes: report.probes, steps: report.steps.map((s) => ({ label: s.label, ok: s.ok, cmd: s.cmd })), toolchain: report.toolchain },
        traceId: run.traceId ?? undefined,
      });
      if (report.verdict === 'PROVED') {
        await transitionRun(runId, run.runUid, 'SEALED', 'LIVE_PROVED');
        emitLive(STUDIO_EVENTS.LIVE_PROVED, 'SUCCESS',
          `Studio ${run.runUid} : APP RÉELLEMENT EXÉCUTÉE — HTTP ${report.probes.find((p) => p.status !== null && p.status < 400)?.status} sur port ${port} en ${Math.round(report.ms / 100) / 10}s${repaired.length > 0 ? ` (auto-réparée : ${repaired.map((r) => r.path).join(', ')})` : ''}`,
          run.runUid, { port, probes: report.probes, attempts: attempt, repaired });
        return { ok: true, verdict: 'PROVED', attempts: attempt, repaired, reason: report.reason, port, state: 'LIVE_PROVED' };
      }
      emitLive(STUDIO_EVENTS.LIVE_PROVED, 'INFO',
        `Studio ${run.runUid} : preuve PARTIELLE — ${report.reason}`, run.runUid, { attempts: attempt, repaired });
      return { ok: true, verdict: 'PARTIAL', attempts: attempt, repaired, reason: report.reason, port, state: 'SEALED' };
    }

    // ── UNPROVED → self-heal borné (éditeur IA) puis nouvelle tentative ──
    if (attempt < MAX_ATTEMPTS) {
      const faulty = guessFaultyFile(report, files);
      if (!faulty) {
        emitLive(STUDIO_EVENTS.LIVE_UNPROVED, 'WARN', `Studio ${run.runUid} : aucun fichier incriminé identifiable — self-heal impossible`, run.runUid);
        break;
      }
      const instruction = repairInstruction(report, faulty.path);
      emitLive(STUDIO_EVENTS.LIVE_REPAIRED, 'INFO',
        `Studio ${run.runUid} : self-heal → régénération de ${faulty.path} (${faulty.source === 'error' ? 'fichier désigné par l\u2019erreur' : 'candidat entry'})`, run.runUid,
        { path: faulty.path, attempt });
      const edit = await editGeneratedFile(runId, faulty.path, instruction);
      if (!edit.ok) {
        emitLive(STUDIO_EVENTS.LIVE_UNPROVED, 'WARN', `Studio ${run.runUid} : réparation refusée/échouée — ${edit.error}`, run.runUid, { path: faulty.path });
        break;
      }
      repaired.push({ attempt, path: faulty.path });
      await new Promise((r) => setTimeout(r, 1_000)); // laisser le re-zip se stabiliser
    }
  }

  // ── budget épuisé — échec honnête, la livraison SEALED survit (INV-210/211) ──
  const reason = lastReport?.reason ?? 'aucune tentative exécutée';
  await db.generationRun.update({ where: { id: runId }, data: { liveState: 'UNPROVED' } });
  await captureAndPersist({
    category: 'ARTIFACT', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: 'yahria-studio-live',
    claim: `Preuve live UNPROVED : ${run.runUid} après ${repaired.length} réparation(s) — ${reason}`,
    payload: { runUid: run.runUid, attempts: lastReport?.attempt ?? 0, repaired },
    traceId: run.traceId ?? undefined,
  });
  emitLive(STUDIO_EVENTS.LIVE_UNPROVED, 'WARN',
    `Studio ${run.runUid} : preuve live non établie après ${lastReport?.attempt ?? 0} tentative(s) — livraison SEALED conservée`, run.runUid,
    { attempts: lastReport?.attempt ?? 0, repaired, reason });
  return { ok: false, verdict: 'UNPROVED', attempts: lastReport?.attempt ?? 0, repaired, reason, port: null, state: 'SEALED' };
}
