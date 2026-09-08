// ═══════════════════════════════════════════════════════════════════
// YAHRIA STUDIO — PORTE COMPORTEMENTALE (EVO-000025) — YAHRIA-STD-004
// « Sondes comportementales avant SEALED » : aucun livrable n'est
// scellé sans que ses TESTS passent réellement. Extension de la porte
// de boot (EVO-000016) : la v1 prouvait le boot, la v2 prouve le
// COMPORTEMENT (pytest exécuté sur le workspace livré).
//
// Motivation mesurée (PTA-001, itération 2) : RUN-000023 scellé
// boot-PASS mais 5 tests POST en 500 — dérive de contrat inter-fichiers
// invisible à l'import ET au boot (py_compile PASS, uvicorn PASS).
//
// ACTIVATION GOUVERNÉE (INV-110/227) : la porte ne s'arme QUE si
// EVO-000025 est PROMOTED dans le registre d'évolution — la décision
// humaine est l'interrupteur réel (aucune variable d'environnement).
// ═══════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import path from 'path';
import { readdir, stat } from 'fs/promises';
import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';

export const BEHAVIORAL_GATE_EVO_UID = 'EVO-000025';
const PYTEST_TIMEOUT_MS = 180_000;

// ── BG2-1. ARMEMENT — lu dans le registre d'évolution, jamais ailleurs ──

export async function isBehavioralGateActive(): Promise<boolean> {
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: BEHAVIORAL_GATE_EVO_UID } });
    return p?.state === 'PROMOTED';
  } catch {
    return false; // registre indisponible → porte inerte (jamais bloquante par accident)
  }
}

// ── BG2-2. TYPES ────────────────────────────────────────────────────

export interface BehavioralGateStage { stage: string; state: 'PASS' | 'FAIL' | 'SKIP'; detail: string; ms: number }
export interface BehavioralGateReport { passed: boolean; stack: string; stages: BehavioralGateStage[]; totalMs: number }

// ── BG2-3. DÉCOUVERTE DES TESTS ─────────────────────────────────────

/** tests/ (package) ou fichiers test_*.py / *_test.py à la racine. */
async function discoverTests(root: string): Promise<string[]> {
  const out: string[] = [];
  const testsDir = path.join(root, 'tests');
  try {
    if ((await stat(testsDir)).isDirectory()) {
      for (const e of await readdir(testsDir)) {
        if (e.toLowerCase().endsWith('.py') && (e.startsWith('test_') || e.endsWith('_test.py'))) out.push(`tests/${e}`);
      }
    }
  } catch { /* pas de dossier tests */ }
  if (!out.length) {
    try {
      for (const e of await readdir(root)) {
        if (e.toLowerCase().endsWith('.py') && (e.startsWith('test_') || e.endsWith('_test.py'))) out.push(e);
      }
    } catch { /* ignoré */ }
  }
  return out.sort();
}

// ── BG2-4. LA PORTE ─────────────────────────────────────────────────

export async function runBehavioralGate(runUid: string, workspaceDir: string, stack: string, traceId?: string): Promise<BehavioralGateReport> {
  const t0 = Date.now();
  const stages: BehavioralGateStage[] = [];
  let passed = false;

  try {
    if (stack !== 'PYTHON') {
      stages.push({
        stage: 'PYTEST', state: 'SKIP',
        detail: `stack ${stack} : sondes comportementales hors périmètre v2 (Python uniquement)`,
        ms: 0,
      });
      passed = true; // SKIP documenté, pas un mensonge (frontière honnête)
    } else {
      // 1. DÉCOUVERTE — aucun test = livrable non vérifiable comportementalement
      const t1 = Date.now();
      const testFiles = await discoverTests(workspaceDir);
      stages.push({
        stage: 'DÉCOUVERTE', state: testFiles.length ? 'PASS' : 'FAIL',
        detail: testFiles.length ? `${testFiles.length} fichier(s) de test : ${testFiles.join(', ')}` : 'aucun test découvert (tests/ ou test_*.py) — livrable non vérifiable comportementalement',
        ms: Date.now() - t1,
      });
      if (!testFiles.length) throw new GateStop();

      // 2. PYTEST — exécution réelle, cwd = workspace, plugin asyncio désactivé
      //    (pytest_asyncio du venv plateforme est incompatible ; les tests
      //    TestClient générés sont synchrones — désactivation sans perte)
      const t2 = Date.now();
      const child = spawn('python3', ['-m', 'pytest', ...testFiles, '-q', '-p', 'no:asyncio', '--no-header'], {
        cwd: workspaceDir,
      });
      const { code, stdout, stderr, timedOut } = await new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve) => {
        let out = '', err = '';
        child.stdout?.on('data', (c: Buffer) => { out += c.toString(); });
        child.stderr?.on('data', (c: Buffer) => { err += c.toString(); });
        const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* déjà mort */ } }, PYTEST_TIMEOUT_MS);
        child.on('close', (c) => { clearTimeout(timer); resolve({ code: c, stdout: out, stderr: err, timedOut: false }); });
        child.on('error', (e) => { clearTimeout(timer); resolve({ code: null, stdout: out, stderr: err + String(e), timedOut: false }); });
      });

      // 3. RÉSULTAT — parse de la ligne pytest « N passed, M failed, ... »
      const summary = (stdout.split('\n').reverse().find((l) => /passed|failed|error/.test(l)) ?? '').trim();
      const m = /(\d+) passed/.exec(summary);
      const f = /(\d+) failed/.exec(summary);
      const e = /(\d+) error/.exec(summary);
      const nPassed = m ? parseInt(m[1], 10) : 0;
      const nFailed = (f ? parseInt(f[1], 10) : 0) + (e ? parseInt(e[1], 10) : 0);
      const tail = (stderr || stdout).split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 400);
      stages.push({
        stage: 'PYTEST', state: code === 0 && !timedOut ? 'PASS' : 'FAIL',
        detail: timedOut
          ? `pytest sans terminer en ${PYTEST_TIMEOUT_MS / 1000}s — suite suspendue (blocage réseau ? attente infinie ?)`
          : code === 0
            ? `pytest exit 0 — ${summary || `${nPassed} passed`}`
            : `pytest exit ${code ?? '?'} — ${summary || 'aucun résumé décodable'} — ${tail}`,
        ms: Date.now() - t2,
      });
      if (code !== 0 || timedOut) throw new GateStop();

      stages.push({
        stage: 'COMPORTEMENT', state: nPassed > 0 ? 'PASS' : 'FAIL',
        detail: nPassed > 0 ? `${nPassed} sonde(s) comportementale(s) verte(s), ${nFailed} rouge(s)` : '0 test exécuté — suite vide',
        ms: 0,
      });
      if (nPassed === 0) throw new GateStop();

      passed = stages.every((s) => s.state !== 'FAIL');
    }
  } catch (err) {
    if (!(err instanceof GateStop)) {
      stages.push({ stage: 'ERREUR', state: 'FAIL', detail: String((err as Error).message ?? err).slice(0, 300), ms: 0 });
    }
    passed = false;
  }

  const report: BehavioralGateReport = { passed, stack, stages, totalMs: Date.now() - t0 };
  await captureAndPersist({
    category: passed ? 'ARTIFACT' : 'INCIDENT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'yahria-behavioral-gate',
    claim: `Porte comportementale (EVO-000025) ${passed ? 'PASS' : 'FAIL'} : ${runUid} — ${stages.map((s) => `${s.stage}:${s.state}`).join(' ')}`,
    payload: { runUid, stack, passed, totalMs: report.totalMs, stages: stages.map((s) => ({ stage: s.stage, state: s.state, detail: s.detail.slice(0, 220) })) },
    traceId,
  });
  return report;
}

class GateStop extends Error {}
