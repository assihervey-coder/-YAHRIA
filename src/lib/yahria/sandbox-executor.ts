// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — SANDBOX EXECUTOR (Domain 08 — Execution Fabric)
// Doc ID: YAHRIA-KRN-024 | Spec: SANDBOX_EXECUTION_SPECIFICATION.md
//
// Turns a SEALED Studio delivery into a LIVE PROOF:
//   install → syntax-check → build → launch → HTTP probe → kill
//   (stacks serveur)  |  build → run CLI → marker capture (stacks binaires : C/C++/C#/Fortran)
//
// Constitutional constraints:
//   INV-042 — bounded execution (per-step timeouts, output tails capped)
//   POL-009 — execution.run on sandbox.* is ALLOW; anything else → no launch
//   FS-001  — host is read-only: all writes stay inside the workspace dir
//   INV-190 — toolchain versions recorded (versioned execution)
//   INV-210 — honest verdicts: PROVED / PARTIAL / UNPROVED (never fake success)
//   INV-213 — child processes get a SCRUBBED env (no secrets, no DB URL)
//   INV-214 — polyglot parity: every requested stack goes through the SAME proof
//   INV-215 — docker backend: no network, read-only rootfs, caps dropped, bounded
//
// Isolation honesty: default backend is process-level confinement (cwd + scrubbed
// env + fixed recipes + bounded resources), NOT a container. YAHRIA_SANDBOX_BACKEND=docker
// upgrades every step to a hardened container (no network, read-only rootfs, caps
// dropped, cpu/mem/pids bounded) — requires the yahria-sandbox image (docker/).
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

/** Porte d'exécution CLI — preuve binaire : exit 0 (+ marqueur optionnel dans stdout). */
export interface CliRun { argv: string[]; expectStdout?: string }

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
  cli: CliRun | null;                          // set → compile+run proof (stacks binaires)
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

interface RunStepOptions { cwd: string; timeoutMs: number; env?: Record<string, string>; dockerWrap?: { workspaceDir: string; port?: number } }

// ── SE-0. BACKEND — process (défaut) ou conteneur durci (YAHRIA_SANDBOX_BACKEND=docker) ──

type SandboxBackend = 'process' | 'docker';
const SANDBOX_BACKEND: SandboxBackend = process.env.YAHRIA_SANDBOX_BACKEND === 'docker' ? 'docker' : 'process';
const SANDBOX_IMAGE = process.env.YAHRIA_SANDBOX_IMAGE ?? 'yahria-sandbox:latest';

/** INV-215 : conteneur sans réseau, rootfs read-only, capabilities droppées, ressources bornées. */
function dockerize(argv: string[], workspaceDir: string, port?: number): string[] {
  const base = ['docker', 'run', '--rm', '--network', 'none', '--cpus', '1', '--memory', '512m', '--pids-limit', '128',
    '--read-only', '--tmpfs', '/tmp:rw,size=64m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '-v', `${workspaceDir}:/work`, '-w', '/work'];
  if (port) base.push('-e', `PORT=${port}`);
  return [...base, SANDBOX_IMAGE, ...argv];
}

function dockerWrapFor(workspaceDir: string, port?: number): { workspaceDir: string; port?: number } | undefined {
  return SANDBOX_BACKEND === 'docker' ? { workspaceDir, port } : undefined;
}

async function runStep(argv: string[], opts: RunStepOptions): Promise<ExecStep> {
  const t0 = Date.now();
  const finalArgv = opts.dockerWrap ? dockerize(argv, opts.dockerWrap.workspaceDir, opts.dockerWrap.port) : argv;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(finalArgv[0], finalArgv.slice(1), {
        cwd: opts.cwd, env: (opts.env ?? childEnv()) as unknown as NodeJS.ProcessEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      resolve({ label: '', cmd: finalArgv.join(' '), ok: false, exitCode: null, ms: 0, out: '', err: `spawn impossible : ${String(e)}` });
      return;
    }
    let out = '', err = '';
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* already gone */ }
        resolve({ label: '', cmd: finalArgv.join(' '), ok: false, exitCode: null, ms: Date.now() - t0, out: tail(out), err: tail(`${err}\n[TIMEOUT ${opts.timeoutMs} ms]`) });
      }
    }, opts.timeoutMs);

    child.stdout?.on('data', (d: Buffer) => { if (out.length < OUT_TAIL_BYTES * 3) out += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { if (err.length < OUT_TAIL_BYTES * 3) err += d.toString(); });
    child.on('error', (e) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ label: '', cmd: finalArgv.join(' '), ok: false, exitCode: null, ms: Date.now() - t0, out: tail(out), err: tail(`${err}\n${e.message}`) });
    });
    child.on('close', (code) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ label: '', cmd: finalArgv.join(' '), ok: code === 0, exitCode: code, ms: Date.now() - t0, out: tail(out), err: tail(err) });
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
    ['gcc', ['gcc', '--version']],
    ['g++', ['g++', '--version']],
    ['gfortran', ['gfortran', '--version']],
    ['dotnet', ['dotnet', '--version']],
    ['mono', ['mono', '--version']],
    ['mcs', ['mcs', '--version']],
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
        cli: null,
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
        cli: null,
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
        cli: null,
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
        cli: null,
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
        cli: null,
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
        cli: null,
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
        cli: null,
        probes: [],
        noServerNote: 'preuve de compilation javac uniquement (lancement JVM non recetté)',
      };
    // ── R11.2 — STACKS BINAIRES : preuve compile + run CLI (INV-214) ──
    case 'C': {
      const cFiles = files.filter((f) => /\.c$/i.test(f.path)).map((f) => f.path);
      if (cFiles.length === 0) {
        return { requiredTools: ['gcc'], install: null, syntax: [], build: null, launch: null, cli: null, probes: [],
          noServerNote: 'aucune source .c dans la livraison — recette C inapplicable' };
      }
      return {
        requiredTools: ['gcc'],
        install: null,
        syntax: [],
        build: { argv: ['gcc', '-std=c11', '-O2', '-Wall', '-Wextra', '-o', 'yahria_app', ...cFiles] },
        launch: null,
        cli: { argv: ['./yahria_app'], expectStdout: 'YAHRIA-LINK-OK' },
        probes: [],
        noServerNote: null,
      };
    }
    case 'CPP': {
      const cppFiles = files.filter((f) => /\.(cpp|cc|cxx)$/i.test(f.path)).map((f) => f.path);
      if (cppFiles.length === 0) {
        return { requiredTools: ['g++'], install: null, syntax: [], build: null, launch: null, cli: null, probes: [],
          noServerNote: 'aucune source .cpp/.cc/.cxx dans la livraison — recette C++ inapplicable' };
      }
      return {
        requiredTools: ['g++'],
        install: null,
        syntax: [],
        build: { argv: ['g++', '-std=c++17', '-O2', '-Wall', '-Wextra', '-o', 'yahria_app', ...cppFiles] },
        launch: null,
        cli: { argv: ['./yahria_app'], expectStdout: 'YAHRIA-LINK-OK' },
        probes: [],
        noServerNote: null,
      };
    }
    case 'FORTRAN': {
      const freeForm = files.filter((f) => /\.(f90|f95|f03|f08)$/i.test(f.path)).map((f) => f.path);
      const fixedForm = files.filter((f) => /\.(f|for)$/i.test(f.path)).map((f) => f.path);
      const srcs = freeForm.length > 0 ? freeForm : fixedForm;
      const stdFlags = freeForm.length > 0 ? ['-std=f2018'] : [];
      if (srcs.length === 0) {
        return { requiredTools: ['gfortran'], install: null, syntax: [], build: null, launch: null, cli: null, probes: [],
          noServerNote: 'aucune source Fortran (.f90/.f95/.f03/.f) dans la livraison — recette inapplicable' };
      }
      return {
        requiredTools: ['gfortran'],
        install: null,
        syntax: [],
        build: { argv: ['gfortran', ...stdFlags, '-O2', '-Wall', '-o', 'yahria_app', ...srcs] },
        launch: null,
        cli: { argv: ['./yahria_app'], expectStdout: 'YAHRIA-LINK-OK' },
        probes: [],
        noServerNote: null,
      };
    }
    case 'CSHARP': {
      const csproj = files.find((f) => /\.csproj$/i.test(f.path));
      const csFiles = files.filter((f) => /\.cs$/i.test(f.path)).map((f) => f.path);
      if (csproj) {
        const asm = (csproj.path.split('/').pop() ?? '').replace(/\.csproj$/i, '');
        return {
          requiredTools: ['dotnet'],
          install: null,
          syntax: [],
          build: { argv: ['dotnet', 'build', '-c', 'Release', '-o', 'yahria_out', '--nologo'] },
          launch: null,
          cli: { argv: ['dotnet', `yahria_out/${asm}.dll`], expectStdout: 'YAHRIA-LINK-OK' },
          probes: [],
          noServerNote: null,
        };
      }
      if (csFiles.length === 0) {
        return { requiredTools: ['mcs'], install: null, syntax: [], build: null, launch: null, cli: null, probes: [],
          noServerNote: 'aucune source .cs ni .csproj dans la livraison — recette C# inapplicable' };
      }
      return {
        requiredTools: ['mcs', 'mono'],
        install: null,
        syntax: [],
        build: { argv: ['mcs', '-out:yahria_app.exe', ...csFiles] },
        launch: null,
        cli: { argv: ['mono', 'yahria_app.exe'], expectStdout: 'YAHRIA-LINK-OK' },
        probes: [],
        noServerNote: null,
      };
    }
    default:
      return {
        requiredTools: [],
        install: null, syntax: [], build: null, launch: null, cli: null, probes: [],
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
  const rawArgv = recipe.launch!.argv(port);
  const argv = SANDBOX_BACKEND === 'docker' ? dockerize(rawArgv, input.workspaceDir, port) : rawArgv;
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

  // 1. backend gate — docker demandé : le démon doit répondre (INV-215) ; sinon toolchains hôtes (INV-190/210)
  if (SANDBOX_BACKEND === 'docker') {
    const d = await runStep(['docker', 'version', '--format', '{{.Server.Version}}'], { cwd: process.cwd(), timeoutMs: 10_000 });
    steps.push({ ...d, label: 'docker-gate' });
    if (!d.ok) {
      return finish('UNPROVED', 'YAHRIA_SANDBOX_BACKEND=docker mais démon Docker indisponible sur l\'hôte — preuve refusée honnêtement (INV-210)');
    }
  } else {
    for (const t of recipe.requiredTools) {
      if (!toolchain[t]) {
        return finish('UNPROVED', `toolchain manquante : ${t} introuvable sur l'hôte — preuve live impossible (INV-210 : échec explicite, pas de fausse réussite)`);
      }
    }
  }

  // 2. install (tolerance: packages may already be present system-wide)
  if (recipe.install) {
    const s = await runStep(recipe.install.argv, { cwd: input.workspaceDir, timeoutMs: 150_000, dockerWrap: dockerWrapFor(input.workspaceDir) });
    steps.push({ ...s, label: 'install', tolerated: recipe.install.tolerated });
    if (!s.ok && !recipe.install.tolerated) {
      return finish('UNPROVED', `échec de l'installation des dépendances (exit ${s.exitCode}) — voir err`, null, []);
    }
  }

  // 3. syntax gate
  for (const syn of recipe.syntax) {
    const s = await runStep(syn.argv, { cwd: input.workspaceDir, timeoutMs: 20_000, dockerWrap: dockerWrapFor(input.workspaceDir) });
    steps.push({ ...s, label: 'syntax' });
    if (!s.ok) {
      return finish('UNPROVED', `échec de la vérification syntaxique : ${syn.path} (exit ${s.exitCode})`, null, []);
    }
  }

  // 4. build gate
  if (recipe.build) {
    const s = await runStep(recipe.build.argv, { cwd: input.workspaceDir, timeoutMs: 300_000, dockerWrap: dockerWrapFor(input.workspaceDir) });
    steps.push({ ...s, label: 'build' });
    if (!s.ok) {
      return finish('UNPROVED', `échec du build (exit ${s.exitCode}) — voir err`, null, []);
    }
  }

  // 5. CLI run gate — stacks binaires (C/C++/C#/Fortran) : le binaire DOIT s'exécuter (INV-214)
  if (recipe.cli) {
    const s = await runStep(recipe.cli.argv, { cwd: input.workspaceDir, timeoutMs: 90_000, dockerWrap: dockerWrapFor(input.workspaceDir) });
    steps.push({ ...s, label: 'run' });
    const marker = recipe.cli.expectStdout;
    if (s.ok && (!marker || s.out.includes(marker))) {
      return finish('PROVED', marker
        ? `compilé et exécuté (exit 0) — marqueur « ${marker} » capturé dans la sortie`
        : 'compilé et exécuté (exit 0)', null, []);
    }
    if (s.ok) {
      return finish('PARTIAL', `binaire exécuté (exit 0) mais marqueur « ${marker} » absent de la sortie — preuve partielle honnête`, null, []);
    }
    return finish('UNPROVED', `échec de l'exécution CLI (exit ${s.exitCode}) — voir err`, null, []);
  }

  // 6. no server, no CLI → PARTIAL (compilation-only proof)
  if (!recipe.launch) {
    return finish('PARTIAL', recipe.noServerNote ?? 'aucun serveur HTTP à sonder — compilation vérifiée uniquement');
  }

  // 7. launch + HTTP probes (the real proof)
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
