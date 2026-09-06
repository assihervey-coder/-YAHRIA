// ═══════════════════════════════════════════════════════════════
// YAHRIA STUDIO — Autonomous Code Generation (Domain 03 Workspace / 04 Code Genome)
// Doc ID: YAHRIA-STD-001
//
// Pipeline constitutionnel (machine à états gardée — voir studio-pipeline.ts):
//   SUBMITTED → PERCEIVED (S1: parse + validation) → PLANNED (S2: blueprint)
//   → GENERATING (agent coder, vérification par fichier) → VERIFYING → SEALED (workspace + ZIP)
//
// Invariants appliqués:
//   INV-052/133 — policy DENY par défaut : D.6 gouverne toute écriture workspace
//   INV-080     — la sortie du modèle n'est pas un fait → vérification indépendante par fichier
//   INV-081     — l'incertitude est représentable (fallbacks étiquetés UNVERIFIED)
//   INV-120     — deny-by-default : traversal, chemins absolus, artefacts → refusés
//   INV-210     — jamais deviner silencieusement (UNKNOWN ≠ SUCCESS)
// ═══════════════════════════════════════════════════════════════

// ── ST-1. TYPES & VOCABULAIRE CANONIQUE ────────────────────────────

export type StudioRunState =
  | 'SUBMITTED' | 'PERCEIVED' | 'PLANNED' | 'GENERATING'
  | 'VERIFYING' | 'SEALED' | 'FAILED' | 'CANCELLED';

export type FileRole = 'config' | 'entry' | 'component' | 'module' | 'test' | 'doc' | 'asset';

/** Transitions légales — toute autre transition est illégale et refusée (422). */
export const STUDIO_RUN_TRANSITIONS: Record<StudioRunState, StudioRunState[]> = {
  SUBMITTED: ['PERCEIVED', 'FAILED', 'CANCELLED'],
  PERCEIVED: ['PLANNED', 'FAILED', 'CANCELLED'],
  PLANNED: ['GENERATING', 'FAILED', 'CANCELLED'],
  GENERATING: ['VERIFYING', 'FAILED', 'CANCELLED'],
  VERIFYING: ['SEALED', 'FAILED'],
  SEALED: [],
  FAILED: [],
  CANCELLED: [],
};

export const STUDIO_STATES: StudioRunState[] = [
  'SUBMITTED', 'PERCEIVED', 'PLANNED', 'GENERATING', 'VERIFYING', 'SEALED',
];

export interface ParsedFile { path: string; role: FileRole; }

export interface ParsedTree {
  stack: string;
  files: ParsedFile[];
  warnings: string[];
  rejections: { path: string; reason: string }[];
  aiDesigned: boolean;
}

export interface BlueprintEntry {
  path: string;
  purpose: string;
  dependsOn: string[];
  keyPoints: string[];
  order: number;
}

export interface GeneratedContent {
  content: string;
  attempts: number;
  verified: boolean;
  note: string;
  ms: number;
}

export const MAX_TREE_FILES = 48;

// ── ST-2. PERCEPTION S1 — PARSING & NORMALISATION DE L'ARBORESCENCE ─

const JUNK_PREFIXES = [
  'node_modules/', '.git/', 'dist/', 'build/', '.next/', 'out/', '__pycache__/',
  'venv/', '.venv/', 'coverage/', '.turbo/', 'target/', '.idea/', '.vscode/',
];

const KNOWN_BARE_FILES = /^(makefile|dockerfile|license|procfile|vagrantfile|jenkinsfile|gemfile|rakefile|changelog|codex\.md|readme)$/i;

/** Nettoie une ligne d'arborescence (glyphes `tree`, commentaires, numéros). */
function cleanTreeLine(line: string): string | null {
  let s = line.replace(/[├└│─┬┤┼╰╭]/g, ' ').trim();
  if (!s || s.startsWith('#') || s.startsWith('//')) return null;
  // lignes de résumé "12 directories, 34 files"
  if (/\d+\s+(director(y|ies)|files?)(\s*,\s*\d+\s+files?)?$/i.test(s) && !s.includes('/')) return null;
  s = s.replace(/^\d+[\]:.)]\s*/, '');            // préfixes "01:" "2."
  const hash = s.indexOf(' #');                    // annotations "# commentaires"
  if (hash > 0) s = s.slice(0, hash);
  s = s.replace(/\s+->.*$/, '');                   // flèches de liens symboliques
  return s.trim() || null;
}

/** Normalise et sécurise un chemin relatif (INV-120 — deny-by-default). */
export function normalizePath(raw: string): { path: string | null; reason?: string } {
  let p = raw.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '');
  if (!p) return { path: null, reason: 'chemin vide' };
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return { path: null, reason: 'chemin absolu refusé (INV-120)' };
  if (p.split('/').some((seg) => seg === '..')) return { path: null, reason: 'traversal .. refusé (INV-120)' };
  if (/[\x00-\x1f]/.test(p)) return { path: null, reason: 'caractères de contrôle refusés' };
  if (p.length > 200) return { path: null, reason: 'chemin > 200 caractères' };
  if (p.split('/').length > 10) return { path: null, reason: 'profondeur > 10 refusée' };
  const lower = p.toLowerCase();
  for (const j of JUNK_PREFIXES) {
    const bare = j.slice(0, -1);
    if (lower === bare || lower.startsWith(j)) return { path: null, reason: `artefact ignoré (${bare})` };
  }
  p = p.replace(/\/+$/, '');
  return { path: p };
}

function isFileEntry(p: string): boolean {
  const base = p.split('/').pop() ?? p;
  return base.includes('.') || KNOWN_BARE_FILES.test(base);
}

function flattenTreeObject(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}/${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenTreeObject(v as Record<string, unknown>, p));
    } else {
      out.push(p);
    }
  }
  return out;
}

/** S1 — parse une arborescence soumise : glyphes `tree`, chemins simples, ou JSON. */
export function parseTreeSpec(raw: string, aiDesigned = false): ParsedTree {
  const warnings: string[] = [];
  const rejections: { path: string; reason: string }[] = [];
  const files = new Map<string, ParsedFile>();

  const candidates: string[] = [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      if (Array.isArray(json)) {
        for (const item of json) {
          if (typeof item === 'string') candidates.push(item);
          else if (item && typeof item === 'object' && 'path' in item) candidates.push(String((item as { path: unknown }).path));
        }
      } else if (json && typeof json === 'object') {
        candidates.push(...flattenTreeObject(json as Record<string, unknown>));
      }
    } catch {
      warnings.push('JSON invalide → interprétation ligne à ligne');
      candidates.push(...trimmed.split(/\r?\n/));
    }
  } else {
    candidates.push(...trimmed.split(/\r?\n/));
  }

  for (const c of candidates) {
    const cleaned = cleanTreeLine(c);
    if (!cleaned) continue;
    const norm = normalizePath(cleaned);
    if (!norm.path) {
      if (norm.reason && !/ignoré/.test(norm.reason)) rejections.push({ path: cleaned.slice(0, 60), reason: norm.reason });
      else if (norm.reason) warnings.push(`${cleaned.slice(0, 40)} → ${norm.reason}`);
      continue;
    }
    if (!isFileEntry(norm.path)) { warnings.push(`répertoire ignoré : ${norm.path}`); continue; }
    if (!files.has(norm.path)) files.set(norm.path, { path: norm.path, role: classifyRole(norm.path) });
  }

  const list = Array.from(files.values());
  if (list.length > MAX_TREE_FILES) {
    warnings.push(`arborescence tronquée à ${MAX_TREE_FILES} fichiers (${list.length} soumis) — budget LLM`);
    list.length = MAX_TREE_FILES;
  }
  if (list.length === 0 && !aiDesigned) warnings.push('aucun fichier exploitable détecté');

  return { stack: detectStack(list.map((f) => f.path)), files: list, warnings, rejections, aiDesigned };
}

// ── ST-3. DÉTECTION DE STACK & CLASSIFICATION DE RÔLES ─────────────

export function detectStack(paths: string[]): string {
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  if (has(/(^|\/)next\.config\.(m?js|ts)$/i) || has(/(^|\/)(src\/)?app\/(page|layout)\.tsx$/i)) return 'NEXTJS';
  if (has(/(^|\/)package\.json$/i)) return 'NODE';
  if (has(/(^|\/)(requirements\.txt|pyproject\.toml)$/i) || has(/\.py$/i)) return 'PYTHON';
  if (has(/(^|\/)go\.mod$/i) || has(/\.go$/i)) return 'GO';
  if (has(/(^|\/)Cargo\.toml$/i) || has(/\.rs$/i)) return 'RUST';
  if (has(/(^|\/)(pom\.xml|build\.gradle)$/i)) return 'JAVA';
  if (has(/\.(html?|css)$/i)) return 'STATIC_WEB';
  return 'UNKNOWN';
}

export function classifyRole(p: string): FileRole {
  const base = (p.split('/').pop() ?? p).toLowerCase();
  const ext = base.includes('.') ? base.split('.').pop()! : '';
  if (/(^|\/)(tests?|spec|__tests__)(\/|$)|\.(test|spec)\.[a-z]+$|_test\.py$|_test\.go$/i.test(p)) return 'test';
  if (/\.(md|mdx|rst|txt)$/i.test(base) || /^(readme|changelog|contributing|license)/i.test(base)) return 'doc';
  if (/^(package(-lock)?\.json|tsconfig[^/]*\.json|bun\.lock|package-lock\.json)$/.test(base) ||
      /\.(config|mjs|cjs)\.(m?js|ts)$/.test(base) || /\.(config)\.(m?js|ts|json)$/.test(base) ||
      /^(dockerfile|\.dockerignore|\.gitignore|\.env[^/]*|makefile|requirements\.txt|pyproject\.toml|go\.mod|go\.sum|cargo\.toml|pom\.xml|build\.gradle|next\.env\.d\.ts|components\.json|eslint.*|\.eslintrc.*|prettier.*|\.prettierrc.*)$/i.test(base)) return 'config';
  if (ext === 'yaml' || ext === 'yml' || ext === 'toml' || ext === 'ini' || ext === 'env' || ext === 'lock') return 'config';
  if (/^(index|main|app|server|bootstrap|entry|wsgi|asgi|manage|__init__)\.[a-z]+$/i.test(base) ||
      /^((src\/)?app\/)?(layout|page|route)\.(tsx|ts|jsx|js)$/.test(p)) return 'entry';
  if (/\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|mp4|mp3|pdf)$/i.test(base)) return 'asset';
  if (/\.(tsx|jsx|vue|svelte)$/i.test(base)) return 'component';
  return 'module';
}

// ── ST-4. COUCHE LLM (S2) — SDK avec fallback explicite (INV-210) ──

async function callLLM(system: string, user: string): Promise<string> {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: system },
      { role: 'user', content: user },
    ],
    thinking: { type: 'enabled' },
  });
  return completion.choices[0]?.message?.content ?? '';
}

/** Extrait le premier objet/tableau JSON d'une réponse LLM (tolère les fences). */
export function extractJson(raw: string): unknown | null {
  const unfenced = raw.replace(/```(?:json)?/gi, '');
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const i = unfenced.indexOf(open);
    const j = unfenced.lastIndexOf(close);
    if (i >= 0 && j > i) {
      try { return JSON.parse(unfenced.slice(i, j + 1)); } catch { /* essai suivant */ }
    }
  }
  return null;
}

// ── ST-5. ARBORESCENCE CONÇUE PAR L'IA (mode autonome total) ───────

export async function proposeTree(brief: string): Promise<ParsedTree> {
  try {
    const raw = await callLLM(
      `You are YAHRIA's architect agent. Design the MINIMAL viable file tree for a complete, runnable application.
Rules:
- STRICT JSON only: {"stack": "NEXTJS|NODE|PYTHON|STATIC_WEB|GO|RUST|JAVA", "files": [{"path": "relative/path.ext", "purpose": "one line"}]}
- Maximum 16 files. Every file must be essential to run the application.
- NEVER include node_modules, dist, build, .git, lock files, or binary assets.
- Include exactly the config files the stack needs (package.json / requirements.txt / ...).
- Paths are POSIX relative, never absolute, no leading slash.`,
      `MISSION BRIEF:\n${brief.slice(0, 2000)}`,
    );
    const parsed = extractJson(raw) as { stack?: string; files?: { path?: string; purpose?: string }[] } | null;
    if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
      const lines = parsed.files.map((f) => String(f.path ?? '')).filter(Boolean).join('\n');
      const tree = parseTreeSpec(lines, true);
      if (tree.files.length > 0) {
        tree.stack = typeof parsed.stack === 'string' ? parsed.stack : tree.stack;
        tree.warnings.unshift('arborescence conçue par l\'architecte S2 (vérification S1 appliquée)');
        return tree;
      }
    }
    // LLM a répondu mais inexploitable → fallback heuristique étiqueté (INV-081)
    const fallback = ['package.json', 'README.md', 'src/index.ts'];
    const tree = parseTreeSpec(fallback.join('\n'), true);
    tree.warnings.unshift('S2 inexploitable → arborescence heuristique minimale (UNVERIFIED, INV-081)');
    return tree;
  } catch {
    const fallback = ['package.json', 'README.md', 'src/index.ts'];
    const tree = parseTreeSpec(fallback.join('\n'), true);
    tree.warnings.unshift('modèle S2 indisponible → arborescence heuristique minimale (UNVERIFIED, INV-081)');
    return tree;
  }
}

// ── ST-6. PLANIFICATION S2 — BLUEPRINT PAR FICHIER ─────────────────

const ROLE_RANK: Record<FileRole, number> = {
  config: 0, entry: 1, module: 2, component: 3, test: 4, doc: 5, asset: 6,
};

export async function planBlueprint(brief: string, tree: ParsedTree): Promise<{ blueprint: BlueprintEntry[]; modelUsed: string }> {
  const fileList = tree.files.map((f) => `- ${f.path} (${f.role})`).join('\n');
  try {
    const raw = await callLLM(
      `You are YAHRIA's planner agent. Produce an implementation blueprint for each file of a fixed file tree.
Rules:
- STRICT JSON only: {"plans": [{"path": "...", "purpose": "one line", "depends_on": ["other paths"], "key_points": ["3-6 concrete implementation requirements"]}]}
- Cover EVERY file in the tree exactly once, same paths, no invented paths.
- depends_on lists files that must exist before this one (imports/config). Empty array if none.
- key_points must be specific (functions, routes, exports, schemas) — not generic advice.`,
      `STACK: ${tree.stack}
MISSION BRIEF:
${brief.slice(0, 1800)}
FILE TREE:
${fileList}`,
    );
    const parsed = extractJson(raw) as { plans?: { path?: string; purpose?: string; depends_on?: string[]; key_points?: string[] }[] } | null;
    if (parsed && Array.isArray(parsed.plans) && parsed.plans.length > 0) {
      const byPath = new Map(tree.files.map((f) => [f.path, f]));
      const entries: BlueprintEntry[] = [];
      for (const p of parsed.plans) {
        const pathStr = String(p.path ?? '');
        if (!byPath.has(pathStr)) continue; // chemin inventé → ignoré (INV-080)
        entries.push({
          path: pathStr,
          purpose: String(p.purpose ?? 'implémentation du module').slice(0, 300),
          dependsOn: (Array.isArray(p.depends_on) ? p.depends_on : [])
            .map((d) => String(d)).filter((d) => byPath.has(d) && d !== pathStr).slice(0, 6),
          keyPoints: (Array.isArray(p.key_points) ? p.key_points : [])
            .map((k) => String(k).slice(0, 240)).slice(0, 8),
          order: 0,
        });
      }
      // couverture complète : tout fichier sans plan reçoit un plan heuristique
      for (const f of tree.files) {
        if (!entries.some((e) => e.path === f.path)) {
          entries.push({
            path: f.path, purpose: `implémentation ${f.role} (heuristique, UNVERIFIED)`,
            dependsOn: [], keyPoints: [`respecter le rôle ${f.role} et la stack ${tree.stack}`], order: 0,
          });
        }
      }
      return { blueprint: orderBlueprint(entries), modelUsed: 'YAHRIA-S2-LLM' };
    }
  } catch { /* SDK indisponible → fallback */ }
  // Fallback heuristique explicite (INV-210) : ordre par rôle, pas de dépendances connues
  const heuristic: BlueprintEntry[] = tree.files.map((f, i) => ({
    path: f.path,
    purpose: `implémentation ${f.role} (heuristique — S2 indisponible)`,
    dependsOn: [],
    keyPoints: [`stack ${tree.stack}`, `rôle ${f.role}`, 'code complet exécutable, sans placeholder'],
    order: i,
  }));
  return { blueprint: orderBlueprint(heuristic), modelUsed: 'HEURISTIC_FALLBACK' };
}

/** Ordonnancement : topologique (dependsOn) puis rang de rôle — cycles brisés par rang. */
export function orderBlueprint(entries: BlueprintEntry[]): BlueprintEntry[] {
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const visited = new Map<string, number>(); // 0=en cours 1=fait
  const out: BlueprintEntry[] = [];
  const roleOf = (p: string): FileRole => classifyRole(p);

  const visit = (p: string, stack: Set<string>) => {
    if (visited.get(p) === 1 || stack.has(p)) return;
    stack.add(p);
    const e = byPath.get(p);
    if (e) {
      for (const d of e.dependsOn) if (byPath.has(d)) visit(d, stack);
      visited.set(p, 1);
      out.push(e);
    }
    stack.delete(p);
  };
  const sorted = [...entries].sort((a, b) => (ROLE_RANK[roleOf(a.path)] - ROLE_RANK[roleOf(b.path)]) || a.path.localeCompare(b.path));
  for (const e of sorted) visit(e.path, new Set());
  return out.map((e, i) => ({ ...e, order: i }));
}

// ── ST-7. GÉNÉRATION PAR FICHIER (agent coder) + VÉRIFICATION ──────

const FENCE_RE = /^```[a-zA-Z0-9_+-]*\r?\n([\s\S]*?)\r?\n?```$/;

function stripFences(s: string): string {
  const m = s.trim().match(FENCE_RE);
  return m ? m[1] : s;
}

const PLACEHOLDER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /^\s*\.\.\.\s*$/m, label: 'ligne "..." (corps absent)' },
  { re: /(\.\.\.)\s*(rest|remaining|le reste)/i, label: 'ellipsis "rest of the code"' },
  { re: /(your code here|implementation (here|goes)|à compléter|code ici)/i, label: 'placeholder explicite' },
  { re: /<\s*(implementation|rest|body|logic)\s*>/i, label: 'balise placeholder' },
];

const MAX_FILE_BYTES = 32 * 1024;

/** Vérification indépendante du contenu généré (INV-080). */
export function verifyGeneratedContent(content: string, filePath: string): { ok: boolean; note: string } {
  const c = stripFences(content);
  if (c.trim().length < 25) return { ok: false, note: 'contenu vide ou trop court (<25 chars)' };
  if (c.length > MAX_FILE_BYTES) return { ok: false, note: `contenu trop volumineux (${c.length} > ${MAX_FILE_BYTES} octets)` };
  for (const { re, label } of PLACEHOLDER_PATTERNS.slice(0, 4)) {
    if (re.test(c)) return { ok: false, note: `placeholder détecté : ${label} (INV-080)` };
  }
  const base = filePath.split('/').pop() ?? filePath;
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
  if (ext === 'json') {
    try { JSON.parse(c); } catch (e) { return { ok: false, note: `JSON invalide : ${(e as Error).message.slice(0, 120)}` }; }
  }
  if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss'].includes(ext)) {
    const stripped = c
      .replace(/`(?:[^`\\]|\\.)*`/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, '""').replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const count = (open: string, close: string) =>
      stripped.split('').filter((ch) => ch === open).length - stripped.split('').filter((ch) => ch === close).length;
    for (const [o, cl, name] of [['{', '}', 'accolades'], ['(', ')', 'parenthèses'], ['[', ']', 'crochets']] as const) {
      const d = count(o, cl);
      if (d !== 0) return { ok: false, note: `déséquilibre ${name} (${d > 0 ? '+' : ''}${d})` };
    }
  }
  return { ok: true, note: 'vérification S1 structurelle : OK' };
}

export interface GenerationContext {
  brief: string;
  stack: string;
  entry: BlueprintEntry;
  treePaths: { path: string; role: string }[];
  dependencySources: { path: string; content: string }[];
}

/** Agent coder — génère le contenu d'un fichier avec retries correctifs. */
export async function generateFileContent(ctx: GenerationContext, maxAttempts = 3): Promise<GeneratedContent> {
  const t0 = Date.now();
  const system = `You are YAHRIA's coder agent. You write COMPLETE, production-quality source files.
STRICT OUTPUT RULES:
- Output ONLY the raw file content. No markdown fences, no explanations before or after.
- The file must be complete and self-consistent: no TODOs, no placeholders, no truncated bodies.
- Imports may only reference files present in the provided tree or standard/well-known libraries of the stack.
- Match the declared purpose and key points exactly.
- Keep the file focused: ${ctx.stack} conventions, clean structure.`;

  const depBlock = ctx.dependencySources.length > 0
    ? `\nDEPENDENCY FILES (already generated):\n${ctx.dependencySources
        .map((d) => `--- ${d.path} ---\n${d.content.slice(0, 3000)}`)
        .join('\n\n')}`
    : '';

  let lastNote = '';
  let attempts = 0;
  for (let i = 0; i < maxAttempts; i++) {
    attempts += 1;
    try {
      const corrective = i === 0
        ? ''
        : `\n\nCORRECTIVE NOTICE — your previous attempt failed verification: ${lastNote}. Fix this specific problem and output the full corrected file.`;
      const raw = await callLLM(
        system,
        `STACK: ${ctx.stack}
MISSION BRIEF:
${ctx.brief.slice(0, 1800)}

FILE TREE (paths that will exist):
${ctx.treePaths.map((t) => `- ${t.path} (${t.role})`).join('\n')}${depBlock}

FILE TO GENERATE: ${ctx.entry.path}
PURPOSE: ${ctx.entry.purpose}
KEY POINTS:
${ctx.entry.keyPoints.map((k) => `- ${k}`).join('\n') || '- implémentation complète et exécutable'}${corrective}`,
      );
      const content = stripFences(raw.trim());
      const verdict = verifyGeneratedContent(content, ctx.entry.path);
      if (verdict.ok) {
        return { content, attempts, verified: true, note: verdict.note, ms: Date.now() - t0 };
      }
      lastNote = verdict.note;
    } catch (e) {
      lastNote = `erreur modèle : ${(e as Error).message.slice(0, 140)}`;
    }
  }
  return { content: '', attempts, verified: false, note: `échec après ${attempts} tentatives — dernier verdict : ${lastNote}`, ms: Date.now() - t0 };
}
