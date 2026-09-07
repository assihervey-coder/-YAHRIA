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
  | 'VERIFYING' | 'SEALED' | 'LIVE_PROVED' | 'FAILED' | 'CANCELLED';

export type FileRole = 'config' | 'entry' | 'component' | 'module' | 'test' | 'doc' | 'asset';

/** Transitions légales — toute autre transition est illégale et refusée (422). */
export const STUDIO_RUN_TRANSITIONS: Record<StudioRunState, StudioRunState[]> = {
  SUBMITTED: ['PERCEIVED', 'FAILED', 'CANCELLED'],
  PERCEIVED: ['PLANNED', 'FAILED', 'CANCELLED'],
  PLANNED: ['GENERATING', 'FAILED', 'CANCELLED'],
  GENERATING: ['VERIFYING', 'FAILED', 'CANCELLED'],
  VERIFYING: ['SEALED', 'FAILED'],
  SEALED: ['LIVE_PROVED'], // R11 : preuve live réussie (monotone — jamais de retour en arrière)
  LIVE_PROVED: [],
  FAILED: [],
  CANCELLED: [],
};

export const STUDIO_STATES: StudioRunState[] = [
  'SUBMITTED', 'PERCEIVED', 'PLANNED', 'GENERATING', 'VERIFYING', 'SEALED', 'LIVE_PROVED',
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

/** Stacks sélectionnables — le choix humain gouverne sur la détection (INV-081 : l'incertitude est étiquetée). */
export const STUDIO_STACKS = ['AUTO', 'NEXTJS', 'NODE', 'PYTHON', 'STATIC_WEB', 'GO', 'RUST', 'JAVA', 'C', 'CPP', 'CSHARP', 'FORTRAN'] as const;
export type StudioStack = (typeof STUDIO_STACKS)[number];

export const STACK_LABELS: Record<string, string> = {
  AUTO: 'Détection automatique',
  NEXTJS: 'Next.js / React (site web ou app)',
  NODE: 'Node.js (Express / API / CLI)',
  PYTHON: 'Python (FastAPI / Flask / CLI)',
  STATIC_WEB: 'Site web statique (HTML/CSS/JS)',
  GO: 'Go (service / CLI)',
  RUST: 'Rust (binaire / service)',
  JAVA: 'Java (Spring / Maven / Gradle)',
  C: 'C (gcc — binaire / système / CLI)',
  CPP: 'C++ (g++ — binaire / système / CLI)',
  CSHARP: 'C# (dotnet / mono — console / application)',
  FORTRAN: 'Fortran (gfortran — calcul scientifique)',
};

export const STACK_HINTS: Record<string, string> = {
  NEXTJS: 'App Router, pages sous src/app/, next.config.mjs, package.json avec next/react — site web réel rendu côté serveur',
  NODE: 'serveur HTTP Express minimal sans build, package.json avec start script',
  PYTHON: 'bibliothèque standard + FastAPI/Flask si nécessaire, requirements.txt, point d\'entrée __main__.py ou app.py',
  STATIC_WEB: 'HTML/CSS/JS vanilla ouvrables directement dans un navigateur, aucun outil de build',
  GO: 'go.mod, main.go, package unique, tests _test.go',
  RUST: 'Cargo.toml, src/main.rs, modules src/',
  JAVA: 'pom.xml ou build.gradle, src/main/java, classe Main',
  C: 'sources .c/.h sous src/, point d\'entrée main() dans src/main.c, compilé gcc -std=c11 — le programme doit imprimer exactement la ligne YAHRIA-LINK-OK quand il réussit',
  CPP: 'sources .cpp/.hpp sous src/, point d\'entrée main() dans src/main.cpp, compilé g++ -std=c++17 — le programme doit imprimer exactement la ligne YAHRIA-LINK-OK quand il réussit',
  CSHARP: 'un seul .csproj à la racine (le nom du fichier csproj = nom d\'assembly) + Program.cs, style .NET 8 console ou mono — le programme doit imprimer exactement la ligne YAHRIA-LINK-OK quand il réussit',
  FORTRAN: 'sources .f90 sous src/, entry point program dans src/main.f90, compilé gfortran -std=f2018 — le programme doit imprimer exactement la ligne YAHRIA-LINK-OK quand il réussit',
};

/**
 * Enforcement S1 du choix de langage humain — INV-081/INV-210 :
 * la détection reste exécutée mais n'est JAMAIS autoritaire face à l'intention explicite.
 * Une divergence est étiquetée (warning) et le choix humain l'emporte.
 */
export function enforceStackChoice(tree: ParsedTree, requestedStack: string): ParsedTree {
  if (!requestedStack || requestedStack === 'AUTO') return tree;
  if (tree.files.length === 0) return tree;
  if (tree.stack === requestedStack) {
    tree.warnings.unshift(`langage imposé ${requestedStack} : confirmé par la détection S1`);
    return tree;
  }
  tree.warnings.unshift(
    `langage imposé ${requestedStack} : la détection S1 a trouvé ${tree.stack} — le choix humain gouverne (INV-081), blueprint et coder agents contraints à ${requestedStack}`,
  );
  tree.stack = requestedStack;
  return tree;
}

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

/**
 * Profondeur d'une ligne d'arborescence : nombre d'unités de 4 caractères en tête
 * (`├── `, `└── `, `│   `, `    `) — 0 si la ligne commence directement par du contenu.
 */
function treeLineDepth(line: string): number {
  const m = line.match(/^[\s│|├└─]*/);
  const prefix = m ? m[0] : '';
  if (!prefix || prefix.length === 0) return 0;
  const hasGlyph = /[│|├└─]/.test(prefix);
  if (!hasGlyph) {
    // indentation pure (arbre dessiné aux espaces) : 1 niveau / 2 espaces
    return Math.max(1, Math.ceil(prefix.length / 2));
  }
  return Math.max(1, Math.round(prefix.length / 4));
}

/** S1 — parse une arborescence soumise : glyphes `tree` (avec hiérarchie), chemins simples, ou JSON. */
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

  // Reconstruction hiérarchique : les lignes à glyphes `tree` héritent du répertoire parent
  // (ex : `src/app/` puis `├── page.tsx` → src/app/page.tsx). Sans glyphes : chemin intégral (comportement historique).
  const dirStack: { depth: number; path: string }[] = [];

  for (const c of candidates) {
    const depth = treeLineDepth(c);
    const cleaned = cleanTreeLine(c);
    if (!cleaned) continue;
    const norm = normalizePath(cleaned);
    if (!norm.path) {
      if (norm.reason && !/ignoré/.test(norm.reason)) rejections.push({ path: cleaned.slice(0, 60), reason: norm.reason });
      else if (norm.reason) warnings.push(`${cleaned.slice(0, 40)} → ${norm.reason}`);
      continue;
    }
    const isDirectory = cleaned.endsWith('/') || !isFileEntry(norm.path);
    if (isDirectory) {
      while (dirStack.length > 0 && dirStack[dirStack.length - 1].depth >= depth) dirStack.pop();
      const parent = dirStack.length > 0 ? `${dirStack[dirStack.length - 1].path}/` : '';
      dirStack.push({ depth, path: `${parent}${norm.path}` });
      continue;
    }
    let fullPath = norm.path;
    if (depth > 0 && dirStack.length > 0) {
      let k = dirStack.length - 1;
      while (k >= 0 && dirStack[k].depth >= depth) k--;
      if (k >= 0) {
        const prefix = dirStack[k].path;
        if (!fullPath.startsWith(`${prefix}/`)) fullPath = `${prefix}/${fullPath}`;
      }
    }
    if (!files.has(fullPath)) files.set(fullPath, { path: fullPath, role: classifyRole(fullPath) });
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
  if (has(/\.(cpp|cc|cxx)$/i)) return 'CPP';
  if (has(/\.(f90|f95|f03|f08|for|f)$/i)) return 'FORTRAN';
  if (has(/\.(csproj|cs)$/i)) return 'CSHARP';
  if (has(/\.c$/i)) return 'C';
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
      /^(program|main)\.(cs|cpp|cc|cxx|f90|f95|f03)$/i.test(base) ||
      /^((src\/)?app\/)?(layout|page|route)\.(tsx|ts|jsx|js)$/.test(p)) return 'entry';
  if (/\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|mp4|mp3|pdf)$/i.test(base)) return 'asset';
  if (/\.(tsx|jsx|vue|svelte)$/i.test(base)) return 'component';
  return 'module';
}

// ── ST-4. COUCHE LLM (S2) — SDK avec fallback explicite (INV-210) ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Backoff anti-429 : nouvelle tentative différée quand le SDK rate-limit (3 essais : 4 s, 12 s, 30 s). */
async function callLLMWithBackoff(system: string, user: string): Promise<string> {
  const backoffs = [4000, 12000, 30000];
  for (let i = 0; ; i++) {
    try {
      return await callLLM(system, user);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      const rateLimited = /429|too many requests/i.test(msg);
      if (!rateLimited || i >= backoffs.length) throw e;
      await sleep(backoffs[i]);
    }
  }
}

async function callLLM(system: string, user: string): Promise<string> {
  // INV-212: single LLM route — multi-provider fabric with ordered fallback.
  // The fabric reports which provider actually served the call in its attempts trace.
  const { runLLMChat } = await import('./llm-fabric');
  const r = await runLLMChat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    thinking: true,
  });
  if (!r.ok) {
    const trace = r.attempts.map((a) => `${a.provider}:${a.error ?? 'FAIL'}`).join(' | ');
    throw new Error(`LLM fabric exhausted — ${trace}`);
  }
  return r.text;
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

export async function proposeTree(brief: string, forcedStack?: string): Promise<ParsedTree> {
  const stackRule = forcedStack && forcedStack !== 'AUTO'
    ? `- MANDATORY: the stack is ${forcedStack}. Every file, config and dependency MUST belong to this stack (${STACK_HINTS[forcedStack] ?? forcedStack}).`
    : `- Choose the single best stack for the brief among NEXTJS, NODE, PYTHON, STATIC_WEB, GO, RUST, JAVA, C, CPP, CSHARP, FORTRAN.`;
  try {
    const raw = await callLLMWithBackoff(
      `You are YAHRIA's architect agent. Design the MINIMAL viable file tree for a complete, runnable application.
Rules:
- STRICT JSON only: {"stack": "NEXTJS|NODE|PYTHON|STATIC_WEB|GO|RUST|JAVA|C|CPP|CSHARP|FORTRAN", "files": [{"path": "relative/path.ext", "purpose": "one line"}]}
${stackRule}
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
    const tree = parseTreeSpec(minimalTreeFor(forcedStack).join('\n'), true);
    if (forcedStack && forcedStack !== 'AUTO') tree.stack = forcedStack;
    tree.warnings.unshift('S2 inexploitable → arborescence heuristique minimale (UNVERIFIED, INV-081)');
    return tree;
  } catch {
    const tree = parseTreeSpec(minimalTreeFor(forcedStack).join('\n'), true);
    if (forcedStack && forcedStack !== 'AUTO') tree.stack = forcedStack;
    tree.warnings.unshift('modèle S2 indisponible → arborescence heuristique minimale (UNVERIFIED, INV-081)');
    return tree;
  }
}

/** Arborescence minimale par stack pour le fallback déterministe (INV-081). */
function minimalTreeFor(stack?: string): string[] {
  switch (stack) {
    case 'PYTHON': return ['requirements.txt', 'README.md', 'app.py'];
    case 'STATIC_WEB': return ['index.html', 'css/style.css', 'js/main.js', 'README.md'];
    case 'GO': return ['go.mod', 'main.go', 'README.md'];
    case 'RUST': return ['Cargo.toml', 'src/main.rs', 'README.md'];
    case 'JAVA': return ['pom.xml', 'src/main/java/com/yahria/Main.java', 'README.md'];
    case 'C': return ['src/main.c', 'src/util.c', 'src/util.h', 'README.md'];
    case 'CPP': return ['src/main.cpp', 'src/util.cpp', 'src/util.hpp', 'README.md'];
    case 'CSHARP': return ['YahriaApp.csproj', 'Program.cs', 'README.md'];
    case 'FORTRAN': return ['src/main.f90', 'README.md'];
    case 'NEXTJS': return ['package.json', 'next.config.mjs', 'src/app/layout.tsx', 'src/app/page.tsx', 'README.md'];
    default: return ['package.json', 'README.md', 'src/index.js'];
  }
}

// ── ST-6. PLANIFICATION S2 — BLUEPRINT PAR FICHIER ─────────────────

const ROLE_RANK: Record<FileRole, number> = {
  config: 0, entry: 1, module: 2, component: 3, test: 4, doc: 5, asset: 6,
};

export async function planBlueprint(brief: string, tree: ParsedTree): Promise<{ blueprint: BlueprintEntry[]; modelUsed: string }> {
  const fileList = tree.files.map((f) => `- ${f.path} (${f.role})`).join('\n');
  try {
    const raw = await callLLMWithBackoff(
      `You are YAHRIA's planner agent. Produce an implementation blueprint for each file of a fixed file tree.
Rules:
- STRICT JSON only: {"plans": [{"path": "...", "purpose": "one line", "depends_on": ["other paths"], "key_points": ["3-6 concrete implementation requirements"]}]}
- Cover EVERY file in the tree exactly once, same paths, no invented paths.
- depends_on lists files that must exist before this one (imports/config). Empty array if none.
- key_points must be specific (functions, routes, exports, schemas) — not generic advice.
- The stack is AUTHORITATIVE: every plan must fit ${tree.stack} idioms and tooling${tree.stack === 'NEXTJS' ? ' (App Router — src/app/ structure)' : tree.stack === 'STATIC_WEB' ? ' (plain HTML/CSS/JS, no build step)' : tree.stack === 'PYTHON' ? ' (stdlib-first, requirements.txt)' : ''}${STACK_HINTS[tree.stack] ? ` — STACK CONVENTIONS: ${STACK_HINTS[tree.stack]}` : ''}.`,
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
  // NB: `body` exclu — balise HTML légitime ; pattern réservé aux balises-placeholder réelles
  { re: /<\s*(implementation|rest|logic|todo)\s*>/i, label: 'balise placeholder' },
];

/** Extensions markup où les balises standard rendent le pattern 4 non fiable (faux positif `<body>`). */
const MARKUP_EXTS = ['html', 'htm', 'xml', 'svg', 'vue'];

const MAX_FILE_BYTES = 32 * 1024;

/** Vérification indépendante du contenu généré (INV-080). */
export function verifyGeneratedContent(content: string, filePath: string): { ok: boolean; note: string } {
  const c = stripFences(content);
  if (c.trim().length < 25) return { ok: false, note: 'contenu vide ou trop court (<25 chars)' };
  if (c.length > MAX_FILE_BYTES) return { ok: false, note: `contenu trop volumineux (${c.length} > ${MAX_FILE_BYTES} octets)` };
  for (const { re, label } of PLACEHOLDER_PATTERNS.slice(0, 3)) {
    if (re.test(c)) return { ok: false, note: `placeholder détecté : ${label} (INV-080)` };
  }
  const base = filePath.split('/').pop() ?? filePath;
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
  if (!MARKUP_EXTS.includes(ext)) {
    const tagPattern = PLACEHOLDER_PATTERNS[3].re;
    if (tagPattern.test(c)) return { ok: false, note: `placeholder détecté : balise placeholder (INV-080)` };
  }
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
- Keep the file focused: ${ctx.stack} conventions, clean structure.${STACK_HINTS[ctx.stack] ? ` STACK CONVENTIONS: ${STACK_HINTS[ctx.stack]}` : ''}`;

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
      const raw = await callLLMWithBackoff(
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
