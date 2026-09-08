// ═══════════════════════════════════════════════════════════════════
// YAHRIA STUDIO — PORTE DE BOOT (EVO-000016) — YAHRIA-STD-003
// « Prévalidation boot avant SEALED » : aucun livrable n'est scellé
// sans avoir DÉMARRÉ réellement. Jumeau TS de scripts/pta-boot-gate.py
// (calibré par rétro-test : RUN-000021 original → FAIL, corrigé → PASS).
//
// ACTIVATION GOUVERNÉE (INV-110/227) : la porte ne s'arme QUE si
// EVO-000016 est PROMOTED dans le registre d'évolution — la décision
// humaine est l'interrupteur réel, pas une variable d'environnement.
// Tant que la proposition est UNDER_REVIEW, la porte est inerte et la
// frontière honnête INV-215 (statique seul) demeure documentée.
// ═══════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { readFile, readdir } from 'fs/promises';
import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import { isSealedFidelityActive, sealedDetail } from './cross-contracts';

export const BOOT_GATE_EVO_UID = 'EVO-000016';
const BOOT_WAIT_MS = 30_000;
const PROBE_INTERVAL_MS = 1_000;

// ── BG-1 bis. ARMEMENT EVO-000032 — fidélité BOOT (interrupteur registre) ──

export const BOOT_FIDELITY_EVO_UID = 'EVO-000032';

let bootFidelityCache: { value: boolean; at: number } | null = null;
const FIDELITY_TTL_MS = 5_000;

/**
 * EVO-000032 (moitié BF) — la fidélité BOOT (stderr tête+queue BF-2) n'est
 * active QUE si la proposition est PROMOTED (registre = interrupteur,
 * INV-227) ; registre indisponible → tail seul signé EVO-000029 (jamais
 * actif par accident). Le ciblage strict des frames (BF-1) vit dans
 * run-repair-loop.ts et lit la MÊME proposition.
 */
export async function isBootFidelityActive(): Promise<boolean> {
  if (bootFidelityCache && Date.now() - bootFidelityCache.at < FIDELITY_TTL_MS) return bootFidelityCache.value;
  let value = false;
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: BOOT_FIDELITY_EVO_UID } });
    value = p?.state === 'PROMOTED';
  } catch {
    value = false;
  }
  bootFidelityCache = { value, at: Date.now() };
  return value;
}

/** Invalidation forcée du cache d'armement EVO-000032/BF (tests, rollback drill). */
export function resetBootFidelityCache(): void {
  bootFidelityCache = null;
}

// ── BG-1. ARMEMENT — lu dans le registre d'évolution, jamais ailleurs ──

export async function isBootGateActive(): Promise<boolean> {
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: BOOT_GATE_EVO_UID } });
    return p?.state === 'PROMOTED';
  } catch {
    return false; // registre indisponible → porte inerte (jamais bloquante par accident)
  }
}

// ── BG-2. TYPES ─────────────────────────────────────────────────────

export interface BootGateStage { stage: string; state: 'PASS' | 'FAIL' | 'SKIP'; detail: string; ms: number }
export interface BootGateReport { passed: boolean; stack: string; stages: BootGateStage[]; totalMs: number }

// ── BG-3. UTILITAIRES FS / PROCESS ──────────────────────────────────

const SKIP_DIRS = new Set(['__pycache__', 'node_modules', '.git', '.pytest_cache', 'venv', '.venv']);

async function listFiles(root: string, ext?: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, rel: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await walk(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
      } else if (e.isFile()) {
        if (!ext || e.name.toLowerCase().endsWith(ext)) out.push(rel ? `${rel}/${e.name}` : e.name);
      }
    }
  }
  await walk(root, '');
  return out.sort();
}

const MODULE_NAME_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;
const STANDARD_EXT = /^\.[A-Za-z0-9]{1,8}$/;
const PY_SNIFF = /^\s*(from\s+\w+|import\s+\w+|def\s+\w+|class\s+\w+|async\s+def\s+\w+)\b/m;

/** Règle A (code Python hors module) + règle B (chemin de package invalide) — cause racine RUN-000021. */
async function structureScan(root: string): Promise<string[]> {
  const invalid: string[] = [];
  for (const rel of await listFiles(root)) {
    const parts = rel.split('/');
    const name = parts[parts.length - 1];
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    if (ext.toLowerCase() === '.py') {
      const badDir = parts.slice(0, -1).find((d) => !MODULE_NAME_OK.test(d));
      if (badDir) invalid.push(`${rel} (chemin de package invalide : « ${badDir.slice(0, 52)} » — non importable)`);
      else if (!MODULE_NAME_OK.test(stem)) invalid.push(`${rel} (nom de module invalide — non importable)`);
    } else if (!STANDARD_EXT.test(ext) && !name.startsWith('.')) {
      try {
        const body = (await readFile(path.join(root, rel), 'utf8')).slice(0, 60_000);
        if (PY_SNIFF.test(body)) invalid.push(`${rel} (code Python hors module — îlot non importable, extension ${ext ? ext.slice(0, 24) : 'absente'})`);
      } catch { /* binaire illisible → ignoré */ }
    }
  }
  return invalid.sort();
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function terminate(child: ReturnType<typeof spawn>): void {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 3_000).unref();
}

// ── BG-3 bis. FIDÉLITÉ BOOT (EVO-000032 BF-2) — stderr TÊTE + QUEUE ──

export const BOOT_STDERR_HEAD_CHARS = 800;
export const BOOT_STDERR_TAIL_CHARS = 1200;

/**
 * EVO-000032 (BF-2) — le stderr est conservé en TÊTE (premiers 800 car. —
 * frames d'ouverture du traceback, dont les frames workspace quand la chaîne
 * d'import est longue) + QUEUE (1200 car. — ImportError finale) au lieu du
 * tail seul : la note it.11 (RUN-000044) ne contenait QUE les frames
 * stdlib/site-packages de la fin et perdait les frames workspace du début —
 * la réparation régénérait à l'aveugle. Sous la somme des deux fenêtres,
 * le stderr intégral est conservé (comportement identique).
 */
export function formatBootStderr(all: string): string {
  const s = (all ?? '').trim();
  if (!s) return '';
  if (s.length <= BOOT_STDERR_HEAD_CHARS + BOOT_STDERR_TAIL_CHARS) return s;
  const omitted = s.length - BOOT_STDERR_HEAD_CHARS - BOOT_STDERR_TAIL_CHARS;
  return `${s.slice(0, BOOT_STDERR_HEAD_CHARS).trimEnd()}\n[… ${omitted} caractères de traceback intermédiaires omis …]\n${s.slice(-BOOT_STDERR_TAIL_CHARS).trimStart()}`;
}

/** Toute réponse HTTP compte (même 404/500) — la connexion elle-même est la preuve de boot. */
async function probe(url: string, timeoutMs = 3_000): Promise<number | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    return res.status;
  } catch { return null; }
}

// ── BG-4. LA PORTE ──────────────────────────────────────────────────

export async function runBootGate(runUid: string, workspaceDir: string, stack: string, traceId?: string): Promise<BootGateReport> {
  const t0 = Date.now();
  const stages: BootGateStage[] = [];
  let passed = false;
  let openapiNote = '';
  // EVO-000032 (BF-2) — armement lu UNE FOIS par porte (TTL 5s) : stderr
  // tête+queue si PROMOTED, tail seul (comportement signé EVO-000029) sinon.
  const bootFidelity = await isBootFidelityActive();
  // EVO-000033 (C/BF3) — scellé fidèle : cap des détails de stages 600 → 2400
  // (tête 1200 + marqueur + queue 1200 au-delà) — les frames workspace d'un
  // traceback (en QUEUE) survivent au TRACÉ scellé ; défaut sans EVO-000033 =
  // slice(0,600) signé EXACT (rollback). La note LIVE consommée par le ciblage
  // est déjà complète (objet failStages) — BF3 ne change QUE le scellé.
  const sealedFidelity = await isSealedFidelityActive();

  try {
    if (stack !== 'PYTHON') {
      stages.push({
        stage: 'BOOT', state: 'SKIP',
        detail: `stack ${stack} : boot hors périmètre v1 de la porte (sandbox Docker = forme complète, frontière INV-215)`,
        ms: 0,
      });
      passed = true; // SKIP n'est pas un échec — frontière documentée, pas un mensonge
    } else {
      // 1. INVENTAIRE
      const pyFiles = await listFiles(workspaceDir, '.py');
      stages.push({ stage: 'INVENTAIRE', state: pyFiles.length ? 'PASS' : 'FAIL', detail: `${pyFiles.length} fichier(s) .py`, ms: 0 });
      if (!pyFiles.length) throw new GateStop();

      // 2. STRUCTURE — importabilité (cause racine RUN-000021 : îlots)
      const t1 = Date.now();
      const invalid = await structureScan(workspaceDir);
      const head = invalid.slice(0, 6).join('; ') + (invalid.length > 6 ? ` … (+${invalid.length - 6})` : '');
      stages.push({
        stage: 'STRUCTURE', state: invalid.length ? 'FAIL' : 'PASS',
        detail: invalid.length ? `${invalid.length} îlot(s) non importable(s) : ${head}` : 'tous les fichiers Python sont importables (extensions + chemins de package valides)',
        ms: Date.now() - t1,
      });
      if (invalid.length) throw new GateStop();

      // 3. SYNTAXE — py_compile (échec rapide, liste les fichiers coupés)
      const t2 = Date.now();
      const py = spawn('python3', ['-m', 'py_compile', ...pyFiles], { cwd: workspaceDir });
      const syntaxErr = await new Promise<string>((resolve) => {
        let err = '';
        py.stderr?.on('data', (c: Buffer) => { err += c.toString(); });
        py.on('close', (code) => resolve(code === 0 ? '' : err.trim() || `py_compile exit ${code}`));
        py.on('error', (e) => resolve(String(e)));
      });
      // EVO-000029 (fidélité) — fichiers cités par les frames « File "x.py", line N »
      // de py_compile EN PLUS des lignes SyntaxError (la dernière ligne seule ne
      // contenait pas la localisation — note appauvrie pour la réparation).
      const badFiles = [...new Set([
        ...[...syntaxErr.matchAll(/File\s+"([^"]+\.py)"/g)].map((m) => m[1]),
        ...syntaxErr.split('\n').filter((l) => l.includes('SyntaxError') || l.includes('never closed') || l.includes('unterminated')).map((l) => l.split(':')[0]),
      ])].filter((f) => f && f.includes('.py'));
      stages.push({
        stage: 'SYNTAXE', state: syntaxErr ? 'FAIL' : 'PASS',
        detail: syntaxErr ? `${badFiles.length || 1} fichier(s) en erreur de syntaxe : ${badFiles.slice(0, 8).join(', ') || '?'} — ${syntaxErr.split('\n').filter(Boolean).slice(-4).join(' | ').slice(0, 400)}` : `${pyFiles.length} fichiers compilés sans erreur`,
        ms: Date.now() - t2,
      });
      if (syntaxErr) throw new GateStop();

      // 4. DÉCOUVERTE — module:instance FastAPI/create_app (packages inclus : app/main.py → app.main)
      const appPat = /^(\w+)\s*=\s*(?:FastAPI|create_app)\s*\(/m;
      let found: { module: string; instance: string } | null = null;
      for (const rel of pyFiles) {
        const base = path.basename(rel);
        if (base.startsWith('test_') || base === 'conftest.py') continue;
        try {
          const src = (await readFile(path.join(workspaceDir, rel), 'utf8')).slice(0, 200_000);
          const m = appPat.exec(src);
          if (m) {
            const mod = rel.slice(0, -3).split('/').join('.');
            const cand = { module: mod, instance: m[1] };
            const bn = base.slice(0, -3);
            if (!found || bn === 'main' || bn === 'app' || bn === 'server') {
              found = found && !['main', 'app', 'server'].includes(bn) ? found : cand;
              if (!found || bn === 'main') found = cand;
            }
          }
        } catch { /* ignoré */ }
      }
      stages.push({
        stage: 'DÉCOUVERTE', state: found ? 'PASS' : 'FAIL',
        detail: found ? `module ${found.module}:${found.instance} (FastAPI/create_app)` : 'aucun module racine avec instance FastAPI( ou create_app(',
        ms: 0,
      });
      if (!found) throw new GateStop();

      // 5. BOOT — uvicorn réel, port libre, fenêtre 30 s
      const port = await freePort();
      const child = spawn('python3', ['-m', 'uvicorn', `${found.module}:${found.instance}`, '--host', '127.0.0.1', '--port', String(port), '--log-level', 'warning'], { cwd: workspaceDir });
      // EVO-000029 (RC1) — stderr capté DÈS LE SPAWN : les listeners attachés
      // APRÈS la fenêtre d'attente perdaient le traceback émis PENDANT le boot
      // (RUN-000013 : ImportError écrit à t+1s, note de porte réduite à
      // « connexion refusée » — réparation régénérée à l'aveugle).
      let stderrAll = '';
      child.stderr?.on('data', (c: Buffer) => { stderrAll += c.toString(); });
      const t3 = Date.now();
      let up = false;
      while (Date.now() - t3 < BOOT_WAIT_MS) {
        if (child.exitCode !== null) break;
        if ((await probe(`http://127.0.0.1:${port}/openapi.json`, 2_000)) !== null) { up = true; break; }
        await new Promise((r) => setTimeout(r, PROBE_INTERVAL_MS));
      }
      const bootMs = Date.now() - t3;
      let stderrNote = '';
      if (!up) {
        // 1,5 s de grâce pour drainer les derniers octets, puis terminaison —
        // EVO-000032 (BF-2) : tête (800) + queue (1200) si PROMOTED — les
        // frames workspace du DÉBUT du traceback survivent ; sinon tail 1200
        // seul (comportement signé EVO-000029, rollback sans redéploiement).
        await new Promise((r) => setTimeout(r, 1_500));
        stderrNote = bootFidelity ? formatBootStderr(stderrAll) : stderrAll.slice(-1200);
        terminate(child);
      }
      stages.push({
        stage: 'BOOT', state: up ? 'PASS' : 'FAIL',
        detail: up ? `uvicorn ${found.module}:${found.instance} répond sur :${port} (boot ${bootMs} ms)` : `uvicorn ${found.module}:${found.instance} sans réponse HTTP en ${BOOT_WAIT_MS / 1000}s — ${stderrNote.trim() || 'connexion refusée'}`,
        ms: bootMs,
      });
      if (!up) throw new GateStop();

      // 6. SONDES + OPENAPI
      const probes: Record<string, number | null> = {};
      for (const p of ['/openapi.json', '/docs', '/health', '/']) probes[p] = await probe(`http://127.0.0.1:${port}${p}`);
      const serving = Object.values(probes).filter((s) => s !== null).length;
      stages.push({ stage: 'SONDES', state: serving ? 'PASS' : 'FAIL', detail: `${serving}/4 routes répondent : ${JSON.stringify(probes)}`, ms: Date.now() - t3 - bootMs });

      const st = probes['/openapi.json'];
      if (st === 200) {
        try {
          const spec = (await (await fetch(`http://127.0.0.1:${port}/openapi.json`)).json()) as { paths?: Record<string, unknown> };
          const nPaths = Object.keys(spec.paths ?? {}).length;
          openapiNote = `${nPaths} chemins exposés`;
          stages.push({ stage: 'OPENAPI', state: nPaths > 0 ? 'PASS' : 'SKIP', detail: `${nPaths} chemins / opérations exposés`, ms: 0 });
        } catch { stages.push({ stage: 'OPENAPI', state: 'SKIP', detail: 'openapi.json non décodable', ms: 0 }); }
      } else {
        stages.push({ stage: 'OPENAPI', state: 'SKIP', detail: 'openapi.json absent (app non-FastAPI ?)', ms: 0 });
      }
      terminate(child);
      passed = stages.every((s) => s.state !== 'FAIL');
    }
  } catch (e) {
    if (!(e instanceof GateStop)) {
      stages.push({ stage: 'ERREUR', state: 'FAIL', detail: String((e as Error).message ?? e).slice(0, 300), ms: 0 });
    }
    passed = false;
  }

  const report: BootGateReport = { passed, stack, stages, totalMs: Date.now() - t0 };
  await captureAndPersist({
    category: passed ? 'ARTIFACT' : 'INCIDENT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'yahria-boot-gate',
    claim: `Porte de boot (EVO-000016) ${passed ? 'PASS' : 'FAIL'} : ${runUid} — ${stages.map((s) => `${s.stage}:${s.state}`).join(' ')}`,
    payload: { runUid, stack, passed, totalMs: report.totalMs, openapi: openapiNote, bootFidelity, sealedFidelity, stages: stages.map((s) => ({ stage: s.stage, state: s.state, detail: sealedFidelity ? sealedDetail(s.detail) : s.detail.slice(0, 600) })) },
    traceId,
  });
  return report;
}

class GateStop extends Error {}
