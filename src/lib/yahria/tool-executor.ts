// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — BOUNDED TOOL EXECUTOR (Domain 09 executor gate)
// Doc ID: YAHRIA-KRN-026
//
// The ONLY execution surface reachable by tool handlers. Fixed argv
// in, capped output out — no shell, no free-form commands, no env
// passthrough (INV-213). Mirrors the sandbox-executor discipline
// (INV-042 timeouts, group kill) without exposing its internals:
// tools consume this contract, never sandbox internals (§28).
// ═══════════════════════════════════════════════════════════════

import { spawn } from 'child_process';

export interface ToolExecStep {
  argv: string[];
  exitCode: number | null;
  ok: boolean;
  ms: number;
  out: string;   // tail, capped
  err: string;   // tail, capped
}

const OUT_TAIL_BYTES = 4_000;

function tail(s: string, max = OUT_TAIL_BYTES): string {
  return s.length <= max ? s : `…${s.slice(-max)}`;
}

/** Scrubbed child env — INV-213: tools never inherit secrets. */
function childEnv(): Record<string, string> {
  const keep = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'SHELL', 'USER', 'LOGNAME'];
  const env: Record<string, string> = {};
  for (const k of keep) if (process.env[k]) env[k] = process.env[k] as string;
  return env;
}

/**
 * Run a FIXED argv with a hard timeout. The caller (tool handler) is
 * responsible for argv being whitelist-derived, never user-supplied.
 */
export function runStep(argv: string[], opts: { cwd: string; timeoutMs: number }): Promise<ToolExecStep> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), {
        cwd: opts.cwd, env: childEnv() as unknown as NodeJS.ProcessEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      resolve({ argv, ok: false, exitCode: null, ms: 0, out: '', err: `spawn impossible : ${String(e)}` });
      return;
    }
    let out = '', err = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* gone */ }
      resolve({ argv, ok: false, exitCode: null, ms: Date.now() - t0, out: tail(out), err: tail(`${err}\n[TIMEOUT ${opts.timeoutMs} ms — INV-042]`) });
    }, opts.timeoutMs);
    child.stdout?.on('data', (d: Buffer) => { if (out.length < OUT_TAIL_BYTES * 3) out += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { if (err.length < OUT_TAIL_BYTES * 3) err += d.toString(); });
    child.on('error', (e) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ argv, ok: false, exitCode: null, ms: Date.now() - t0, out: tail(out), err: tail(`${err}\n${e.message}`) });
    });
    child.on('close', (code) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ argv, ok: code === 0, exitCode: code, ms: Date.now() - t0, out: tail(out), err: tail(err) });
    });
  });
}
