// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — SANDBOX EXECUTOR (Domain 08 — Execution Fabric)
// Doc ID: YAHRIA-KRN-024 | Spec: SANDBOX_EXECUTION_SPECIFICATION.md
//
// Turns a SEALED Studio delivery into a LIVE PROOF:
//   install → syntax-check → build → launch → HTTP probe → kill.
//
// Constitutional constraints:
//   INV-042 — bounded execution (per-step timeouts, output tails capped)
//   POL-009 — execution.run on sandbox.* is ALLOW; anything else → no launch
//   FS-001  — host is read-only: all writes stay inside the workspace dir
//   INV-190 — toolchain versions recorded (versioned execution)
//   INV-210 — honest verdicts: PROVED / PARTIAL / UNPROVED (never fake success)
//   INV-213 — child processes get a SCRUBBED env (no secrets, no DB URL)
//
// Isolation honesty: process-level confinement (cwd + scrubbed env +
// fixed recipes + bounded resources), NOT a container. Documented limit.
// ═══════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import { stat } from 'fs/promises';
import net from 'net';
import path from 'path';

// ── SE-1. TYPES ────────────────────────────────────────────────────

export type LiveVerdict = 'PROVED' | 'PARTIAL' | 'UNPROVED';

export interface ExecStep {
  label: string;           // install | syntax | build
  cmd: string;             // rendered argv (display only)
  ok: boolean;
  exitCode: number | null;
  ms: number;
  out: string;             // tail (capped)
  err: string;             // tail (capped)
  tolerated?: boolean;     // install failures tolerated when launch later proves
}

export interface ProbeResult {
  path: string;
  status: number | null;
  ms: number;
  bodyStart: string;       // first bytes of the response (title, JSON…)
}

export interface LaunchInfo { argv: string[]; port: number }

export interface LiveReport {
  runUid: string;
  stack: string;
  attempt: number;
  verdict: LiveVerdict;
  reason: string;                              // human-readable decision basis
  toolchain: Record<string, string | null>;    // INV-190
  steps: ExecStep[];
  launch: LaunchInfo | null;
  probes: ProbeResult[];
  ms: number;
  decidedAt: string;
}

interface Recipe {
  requiredTools: string[];
  install: { argv: string[]; tolerated: boolean } | null;
  syntax: { path: string; argv: string[] }[];
  build: { argv: string[] } | null;
  launch: { argv: (port: number) => string[] } | null;
  probes: string[];
  noServerNote: string | null;                 // set → PARTIAL candidate if nothing fails
}

// ── SE-2. PRIMITIVES (bounded process runner) ──────────────────────

const OUT_TAIL_BYTES = 8_000;

function tail(s: string, max = OUT_TAIL_BYTES): string {
  return s.length <= max ? s : `…${s.slice(-max)}`;
}

/** Scrubbed child environment — INV-213 hygiene: no secrets, no DB, no keys. */
function childEnv(port?: number): Record<string, string> {
  const keep = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'SHELL', 'USER', 'LOGNAME'];
  const env: Record<string, string> = {};
  for (const k of keep) if (process.env[k]) env[k] = process.env[k] as string;
  env.NEXT_TELEMETRY_DISABLED = '1';
  env.PYTHONUNBUFFERED = '1';
  if (port) env.PORT = String(port);
  return env;
}

interface RunStepOptions { cwd: string; timeoutMs: number; env?: Record<string, string> }

async function runStep(argv: string[], opts: RunStepOptions): Promise<ExecStep> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), {
        cwd: opts.cwd, env: (opts.env ?? childEnv()) as unknown as NodeJS.ProcessEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      resolve({ label: '', cmd: argv.join(' '), ok: false, exitCode: null, ms: 0, out: '', err: `spawn impossible : ${String(e)}` });
      return;
    }
    let out = '', err = '';
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* already gone */ }
        resolve({ label: '', cmd: argv.join(' '), ok: false, exitCode: null, ms: Date.now() - t0, out: tail(out), err: tail(`${err}\n[TIMEOUT ${opts.timeoutMs} ms]`) });
      }
    }, opts.timeoutMs);

    child.stdout?.on('data', (d: Buffer) => { if (out.length < OUT_TAIL_BYTES * 3) out += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { if (err.length < OUT_TAIL_BYTES * 3) err += d.toString(); });
    child.on('error', (e) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ label: '', cmd: argv.join(' '), ok: false, exitCode: null, ms: Date.now() - t0, out: tail(out), err: tail(`${err}\n${e.message}`) });
    });
    child.on('close', (code) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ label: '', cmd: argv.join(' '), ok: code === 0, exitCode: code, ms: Date.now() - t0, out: tail(out), err: tail(err) });
    });
  });
}

async function toolVersion(argv: string[]): Promise<string | null> {
  const r = await runStep(argv, { cwd: process.cwd(), timeoutMs: 6_000, env: { ...childEnv() } });
  return r.ok ? `${argv[0]} ${r.out.trim().split('\n')[0] ?? ''}`.trim() : null;
}

export async function detectToolchains(): Promise<Record<string, string | null>> {
  const probes: [string, string[]][] = [
    ['python3', ['python3', '--version']],
    ['pip3', ['pip3', '--version']],
    ['bun', ['bun', '--version']],
    ['node', ['node', '--version']],
    ['go', ['go', 'version']],
    ['cargo', ['cargo', '--version']],
    ['javac', ['javac', '-version']],
  ];
  const out: Record<string, string | null> = {};
  for (const [k, argv] of probes) out[k] = await toolVersion(argv);
  return out;
}

/** Free port scan inside a bounded range (execution fabric concession). */
async function freePort(preferred: number): Promise<number> {
  for (let p = preferred; p < preferred + 80; p++) {
    const ok = await new Promise<boolean>((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => srv.close(() => resolve(true)));
      srv.listen(p, '127.0.0.1');
    });
    if (ok) return p;
  }
  throw new Error(`aucun port libre dans ${preferred}..${preferred + 79}`);
}

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

// ── SE-3. RECIPES PAR STACK (fixed argv — never user-supplied shell) ──

function serverModuleOf(files: { path: string; content: string | null }[]): { module: string } | null {
  for (const f of files) {
    if (f.path.endsWith('.py') && f.content && /FastAPI\s*\(/.test(f.content)) {
      // app/main.py → app.main ; main.py → main ; app.py → app (dotted module relatif au workspace)
      const dotted = f.path.replace(/\.py$/, '').replace(/\//g, '.');
      return { module: dotted };
    }
  }
  return null;
}

function buildRecipe(stack: string, files: { path: string; content: string | null }[]): Recipe {
  const pyFiles = files.filter((f) => f.path.endsWith('.py'));
  const jsLike = files.filter((f) => /\.(m?js|cjs)$/.test(f.path));
  const tsLike = files.filter((f) => /\.ts$/.test(f.path));
  const hasReq = files.some((f) => /(^|\/)requirements\.txt$/.test(f.path));

  switch (stack) {
    case 'PYTHON': {
      const server = serverModuleOf(files);
      return {
        requiredTools: ['python3'],
        install: hasReq ? { argv: ['pip3', 'install', '-q', '-r', 'requirements.txt'], tolerated: true } : null,
        syntax: pyFiles.map((f) => ({ path: f.path, argv: ['python3', '-m', 'py_compile', f.path] })),
        build: null,
        launch: server ? { argv: (port) => ['python3', '-m', 'uvicorn', `${server.module}:app`, '--host', '127.0.0.1', '--port', String(port)] } : null,
        probes: ['/health', '/docs', '/'],
        noServerNote: server ? null : 'aucun module FastAPI détecté — preuve de compilation sans serveur HTTP',
      };
    }
    case 'NEXTJS':
      return {
        requiredTools: ['bun'],
        install: { argv: ['bun', 'install'], tolerated: false },
        syntax: [],
        build: { argv: ['bunx', 'next', 'build'] },
        launch: { argv: (port) => ['bunx', 'next', 'start', '-p', String(port)] },
        probes: ['/'],
        noServerNote: null,
      };
    case 'NODE': {
      const candidates = ['server.js', 'app.js', 'index.js', 'main.ts', 'server.ts', 'src/index.ts', 'src/server.ts'];
      const entry = candidates.find((c) => files.some((f) => f.path === c || f.path.endsWith(`/${c}`)));
      const useBun = tsLike.length > 0;
      return {
        requiredTools: ['bun', 'node'],
        install: { argv: ['bun', 'install'], tolerated: true },
        syntax: jsLike.map((f) => ({ path: f.path, argv: ['node', '--check', f.path] })),
        build: null,
        launch: entry ? { argv: (port) => (useBun ? ['bun', 'run', entry] : ['node', entry]) } : null,
        probes: ['/', '/health', '/api'],
        noServerNote: entry ? null : 'aucun point d\u2019entrée serveur reconnu (server/app/index) — preuve syntaxique seule',
      };
    }
    case 'STATIC_WEB':
      return {
        requiredTools: ['python3'],
        install: null,
        syntax: [],
        build: null,
        launch: { argv: (port) => ['python3', '-m', 'http.server', String(port), '--bind', '127.0.0.1'] },
        probes: ['/'],
        noServerNote: null,
      };
    case 'GO':
      return {
        requiredTools: ['go'],
        install: null,
        syntax: [],
        build: { argv: ['go', 'build', '-o', 'yahria_app.bin', '.'] },
        launch: { argv: () => ['./yahria_app.bin'] },
        probes: ['/', '/health'],
        noServerNote: null,
      };
    case 'RUST':
      return {
        requiredTools: ['cargo'],
        install: null,
        syntax: [],
        build: { argv: ['cargo', 'build', '--release'] },
        launch: { argv: () => ['./target/release/app'] },
        probes: ['/', '/health'],
        noServerNote: null,
      };
    case 'JAVA':
      return {
        requiredTools: ['javac'],
        install: null,
        syntax: [],
        build: { argv: ['javac', '-d', 'yahria_classes', ...(files.filter((f) => f.path.endsWith('.java')).map((f) => f.path))] },
        launch: null,
        probes: [],
        noServerNote: 'preuve de compilation javac uniquement (lancement JVM non recetté)',
      };
    default:
      return {
        requiredTools: [],
        install: null, syntax: [], build: null, launch: null, probes: [],
        noServerNote: `stack ${stack} sans recette d'exécution — preuve live non applicable`,
      };
  }
}

// ── SE-4. HTTP PROBES ──────────────────────────────────────────────

async function probeOnce(port: number, probePath: string, timeoutMs: number): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`http://127.0.0.1:${port}${probePath}`, { signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(timer);
    const body = (await res.text()).slice(0, 200).replace(/\s+/g, ' ').trim();
    return { path: probePath, status: res.status, ms: Date.now() - t0, bodyStart: body };
  } catch {
    return { path: probePath, status: null, ms: Date.now() - t0, bodyStart: '' };
  }
}

async function probeUntilUp(port: number, probePaths: string[], deadlineMs: number): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    results.length = 0;
    for (const p of probePaths) results.push(await probeOnce(port, p, 3_000));
    if (results.some((r) => r.status !== null && r.status < 400)) return results;
    await new Promise((r) => setTimeout(r, 800));
  }
  return results;
}

function killGroup(pid: number): void {
  try { process.kill(-pid, 'SIGTERM'); } catch { return; }
  setTimeout(() => { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } }, 1_500);
}

// ── SE-5. LAUNCH + HARVEST (single live attempt) ───────────────────

export interface LiveAttemptInput {
  runUid: string;
  stack: string;
  attempt: number;
  workspaceDir: string;
  files: { path: string; content: string | null }[];
  preferredPort: number;
  probeDeadlineMs?: number;
}

async function launchAndProbe(input: LiveAttemptInput, recipe: Recipe, port: number): Promise<{ launch: LaunchInfo; probes: ProbeResult[]; ok: boolean; childPid: number | null; launchErr: string }> {
  const argv = recipe.launch!.argv(port);
  const child = spawn(argv[0], argv.slice(1), {
    cwd: input.workspaceDir, env: childEnv(port) as unknown as NodeJS.ProcessEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let launchErr = '';
  child.stderr?.on('data', (d: Buffer) => { if (launchErr.length < OUT_TAIL_BYTES * 2) launchErr += d.toString(); });
  child.on('error', (e) => { launchErr += `\n${e.message}`; });

  const probes = await probeUntilUp(port, recipe.probes, input.probeDeadlineMs ?? 45_000);
  const ok = probes.some((p) => p.status !== null && p.status < 400);
  killGroup(child.pid!);
  return { launch: { argv, port }, probes, ok, childPid: child.pid ?? null, launchErr: tail(launchErr, 2_000) };
}

/** One bounded live attempt — no AI, no repair: pure mechanical proof. */
export async function executeLiveAttempt(input: LiveAttemptInput): Promise<LiveReport> {
  const t0 = Date.now();
  const toolchain = await detectToolchains();
  const recipe = buildRecipe(input.stack, input.files);
  const steps: ExecStep[] = [];

  const finish = (verdict: LiveVerdict, reason: string, launch: LaunchInfo | null = null, probes: ProbeResult[] = []): LiveReport => ({
    runUid: input.runUid, stack: input.stack, attempt: input.attempt, verdict, reason,
    toolchain, steps, launch, probes, ms: Date.now() - t0, decidedAt: new Date().toISOString(),
  });

  // 1. toolchain gate (INV-190, INV-210: honest refusal)
  for (const t of recipe.requiredTools) {
    if (!toolchain[t]) {
      return finish('UNPROVED', `toolchain manquante : ${t} introuvable sur l'hôte — preuve live impossible (INV-210 : échec explicite, pas de fausse réussite)`);
    }
  }

  // 2. install (tolerance: packages may already be present system-wide)
  if (recipe.install) {
    const s = await runStep(recipe.install.argv, { cwd: input.workspaceDir, timeoutMs: 150_000 });
    steps.push({ ...s, label: 'install', tolerated: recipe.install.tolerated });
    if (!s.ok && !recipe.install.tolerated) {
      return finish('UNPROVED', `échec de l'installation des dépendances (exit ${s.exitCode}) — voir err`, null, []);
    }
  }

  // 3. syntax gate
  for (const syn of recipe.syntax) {
    const s = await runStep(syn.argv, { cwd: input.workspaceDir, timeoutMs: 20_000 });
    steps.push({ ...s, label: 'syntax' });
    if (!s.ok) {
      return finish('UNPROVED', `échec de la vérification syntaxique : ${syn.path} (exit ${s.exitCode})`, null, []);
    }
  }

  // 4. build gate
  if (recipe.build) {
    const s = await runStep(recipe.build.argv, { cwd: input.workspaceDir, timeoutMs: 300_000 });
    steps.push({ ...s, label: 'build' });
    if (!s.ok) {
      return finish('UNPROVED', `échec du build (exit ${s.exitCode}) — voir err`, null, []);
    }
  }

  // 5. no server → PARTIAL (compilation-only proof)
  if (!recipe.launch) {
    return finish('PARTIAL', recipe.noServerNote ?? 'aucun serveur HTTP à sonder — compilation vérifiée uniquement');
  }

  // 6. launch + HTTP probes (the real proof)
  let port: number;
  try { port = await freePort(input.preferredPort); } catch (e) {
    return finish('UNPROVED', String(e));
  }
  const launched = await launchAndProbe(input, recipe, port);
  if (launched.ok) {
    return finish('PROVED', `serveur démarré et sondé HTTP < 400 sur le port ${port}`, launched.launch, launched.probes);
  }
  // la queue de stderr porte l'erreur réelle (ModuleNotFoundError etc.) — pas la tête
  const launchDiag = launched.launchErr.length > 300 ? `…${launched.launchErr.slice(-300)}` : launched.launchErr;
  return finish('UNPROVED', `lancement/sonde en échec sur le port ${port} — sortie : ${launchDiag || 'aucune sortie'}`, launched.launch, launched.probes);
}

export const SANDBOX_EXECUTOR_ID = 'YAHRIA-KRN-024';
