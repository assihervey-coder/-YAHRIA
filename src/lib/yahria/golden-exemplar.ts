// ═══════════════════════════════════════════════════════════════════
// YAHRIA STUDIO — FEW-SHOT EXEMPLAIRE DORÉ (EVO-000027) — YAHRIA-STD-006
// « Le générateur ne manque pas de règles mais d'un EXEMPLAIRE POSITIF »
//
// Motivation mesurée (PTA-002, baseline RUN-000024/25/26 : 0/3 runs
// SEALED au premier passage, taux première passe fichiers 0-23 %) :
// le coder agent ne voit JAMAIS à quoi ressemble un fichier qui passe
// réellement les portes. RUN-000023-corrige est l'étalon — SEALED au
// premier passage sous porte de boot, pytest 7/7 après correction,
// FastAPI idiomatique (13 fichiers).
//
// Protocole signé EVO-000027 (décision HUMAN:reviewer, INV-227) :
//   1. ARMEMENT   — isGoldenFewShotActive() : UNIQUEMENT si EVO-000027
//      est PROMOTED dans le registre d'évolution (la décision humaine
//      est l'interrupteur réel — registre indisponible → inerte).
//   2. LECTURE    — FS upload/RUN-000023-corrige/ + cache mémoire TTL.
//   3. SÉLECTION  — UN fichier exemplaire par rôle (chemin/purpose) ;
//      autres stacks : contrat seul, PAS d'exemplaire cross-langage
//      (frontière honnête, INV-215).
//   4. CONTRAT    — distillé des leçons scellées RUN-000022..26
//      (découverte boot `app = FastAPI(`, imports résolus, symboles
//      inter-fichiers verbatim, pas d'auth inventée, requirements
//      minimal, style pytest importable).
//   5. BUDGET     — addendum ≤ 6000 chars ; un exemplaire tronqué
//      n'est JAMAIS injecté (un fichier partiel enseignerait la
//      partialité — INV-080) : s'il ne tient pas dans le budget,
//      exemplaire suivant ou contrat seul.
//
// Intégration (studio.ts generateFileContent) : `system += addendum`
// si armé — AUCUN autre changement (retries, S1, portes intacts).
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/db';

export const GOLDEN_FEWSHOT_EVO_UID = 'EVO-000027';

/** Racine FS de l'exemplaire doré (RUN-000023-corrige — pytest 7/7). */
export const GOLDEN_DIR = path.join(process.cwd(), 'upload', 'RUN-000023-corrige');

/** Budget maximal de l'addendum injecté dans le prompt système. */
export const ADDENDUM_BUDGET_CHARS = 6000;

// ── GF-1. ARMEMENT GOUVERNÉ — le registre EST l'interrupteur ────────

let activeCache: { value: boolean; at: number } | null = null;
const ACTIVE_TTL_MS = 5_000;

export async function isGoldenFewShotActive(): Promise<boolean> {
  if (activeCache && Date.now() - activeCache.at < ACTIVE_TTL_MS) return activeCache.value;
  let value = false;
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: GOLDEN_FEWSHOT_EVO_UID } });
    value = p?.state === 'PROMOTED';
  } catch {
    value = false; // registre indisponible → addendum inerte (jamais actif par accident)
  }
  activeCache = { value, at: Date.now() };
  return value;
}

/** Invalidation forcée du cache d'armement (tests, rollback drill). */
export function resetGoldenFewShotCache(): void {
  activeCache = null;
}

// ── GF-2. LECTURE FS + CACHE MÉMOIRE ────────────────────────────────

export interface GoldenExemplar {
  path: string; // chemin relatif (« main.py », « gateways/base.py »)
  content: string;
  bytes: number;
}

/** Liste fixe et déterministe des fichiers candidats (aucun scan récursif).
 *  Les __init__.py sont exclus : glue de ré-export, pauvres en enseignement. */
const GOLDEN_CANDIDATE_PATHS = [
  'main.py',
  'config.py',
  'models.py',
  'schemas.py',
  'security.py',
  'webhooks.py',
  'requirements.txt',
  'gateways/base.py',
  'gateways/notchpay.py',
  'gateways/pesapal.py',
  'tests/test_api.py',
];

let exemplarCache: { files: GoldenExemplar[]; at: number } | null = null;
const EXEMPLAR_TTL_MS = 60_000;

/** Lit les fichiers exemplaires présents sur disque (cache TTL 60 s). */
export function loadGoldenExemplars(force = false): GoldenExemplar[] {
  if (!force && exemplarCache && Date.now() - exemplarCache.at < EXEMPLAR_TTL_MS) return exemplarCache.files;
  const files: GoldenExemplar[] = [];
  try {
    for (const rel of GOLDEN_CANDIDATE_PATHS) {
      const abs = path.join(GOLDEN_DIR, rel);
      try {
        const content = fs.readFileSync(abs, 'utf8');
        if (content.trim().length >= 25) files.push({ path: rel, content, bytes: Buffer.byteLength(content, 'utf8') });
      } catch {
        // fichier candidat absent → ignoré silencieusement (liste déterministe)
      }
    }
  } catch {
    // répertoire absent → aucun exemplaire (contrat seul)
  }
  exemplarCache = { files, at: Date.now() };
  return files;
}

/** Invalidation forcée du cache FS (tests). */
export function resetGoldenExemplarCache(): void {
  exemplarCache = null;
}

// ── GF-3. SÉLECTION PAR RÔLE (fonction PURE — testable sans FS/DB) ──

interface RoleMatch { exemplar: GoldenExemplar; score: number }

/**
 * Sélectionne l'exemplaire pour le fichier à générer.
 * Score : 4 = même nom de base ; 3 = même répertoire ; 2 = mot-clé
 * de domaine (purpose/path) ; 0 = défaut (main.py, vue d'ensemble).
 * Retourne les candidats triés (score desc, taille desc) —
 * l'appelant applique le budget en prenant le premier qui tient ENTIER.
 */
export function rankGoldenExemplars(entryPath: string, purpose: string, files: GoldenExemplar[]): GoldenExemplar[] {
  if (files.length === 0) return [];
  const entryBase = entryPath.split('/').pop()?.toLowerCase() ?? '';
  const entryDir = entryPath.includes('/') ? entryPath.slice(0, entryPath.lastIndexOf('/')) : '';
  const hay = `${entryPath} ${purpose}`.toLowerCase();
  const kw = (re: RegExp) => (re.test(hay) ? 1 : 0);

  const scored = files.map((ex) => {
    const exBase = ex.path.split('/').pop()?.toLowerCase() ?? '';
    const exDir = ex.path.includes('/') ? ex.path.slice(0, ex.path.lastIndexOf('/')) : '';
    let score = 0;
    if (entryBase && entryBase === exBase) score = 4;
    else if (entryDir && exDir && entryDir === exDir) score = 3;
    else score = Math.min(
      2,
      kw(/test|pytest/) * (ex.path.startsWith('tests/') ? 2 : 0) +
        kw(/webhook/) * (ex.path.includes('webhook') ? 2 : 0) +
        kw(/security|auth|hmac|signature|token/) * (ex.path.includes('security') ? 2 : 0) +
        kw(/schema|pydantic|dto/) * (ex.path.includes('schemas') ? 2 : 0) +
        kw(/model\b|models/) * (ex.path.includes('models') ? 2 : 0) +
        kw(/config|settings|environ/) * (ex.path.includes('config') ? 2 : 0) +
        kw(/requirements|dependanc|dependency|package/) * (ex.path.includes('requirements') ? 2 : 0) +
        kw(/gateway|payment|provider|adapter|passerelle|notchpay|pesapal/) *
          (ex.path.includes('gateway') ? 2 : 0) +
        kw(/interface|abstract|contrat|base class/) * (ex.path.includes('base') ? 2 : 0) +
        kw(/main|entry|bootstrap|server|asgi|app\b/) * (ex.path === 'main.py' ? 1 : 0),
    );
    return { exemplar: ex, score };
  });

  const best = Math.max(...scored.map((s) => s.score));
  // candidats pertinents uniquement (score > 0), sinon défaut : main.py
  const pool = best > 0 ? scored.filter((s) => s.score === best) : scored.filter((s) => s.exemplar.path === 'main.py');
  // à score égal : le PLUS GRAND d'abord (l'implémentation complète enseigne
  // mieux que le squelette) — le budget, appliqué par l'appelant, retombera
  // naturellement sur le suivant si le plus grand ne tient pas ENTIER.
  return pool
    .sort((a, b) => b.score - a.score || b.exemplar.bytes - a.exemplar.bytes)
    .map((s) => s.exemplar);
}

// ── GF-4. CONTRAT DISTILLÉ (leçons scellées RUN-000022..26) ─────────

const GENERIC_CONTRACT = `GOLDEN CONTRACT — distilled from sealed post-mortems of previous runs:
- Every import must resolve: to a file present in the tree, or to a package declared in the dependency manifest.
- Symbols imported from sibling files must match their definition VERBATIM (exact name, exact spelling) — read the dependency files before importing from them.
- NO authentication, no tokens, no API-key machinery unless the mission brief explicitly asks for it.
- Complete bodies only: no TODO, no placeholder, no truncated function, no mocked stub.
- Dependency manifest is minimal: only what is actually imported.`;

const PYTHON_CONTRACT_EXTRA = `- Boot discovery: the FastAPI instance MUST be a module-level variable named \`app\` (\`app = FastAPI(...)\`) in the entry file — the boot gate imports the entry and looks for \`app\`.
- Routes return JSON-serializable dicts; NO database: in-memory storage only unless the brief explicitly asks otherwise.
- Tests use fastapi.testclient.TestClient and must be importable by pytest without a running server.`;

// ── GF-5. ADDENDUM — l'unique point d'entrée pour studio.ts ─────────

const HEADER =
  '\n\nGOLDEN EXEMPLAR ADDENDUM (EVO-000027): below is the golden contract distilled from sealed lessons, followed (when the stack matches) by ONE complete reference file from a previous run that passed ALL quality gates (boot, structural verification, pytest 7/7). Imitate its structure, completeness and style — adapt to the current file purpose.';

/**
 * Addendum few-shot pour le prompt système du coder agent.
 * Retourne '' si inerte (EVO-000027 non PROMOTED) — l'appelant ne
 * modifie alors RIEN au comportement legacy.
 */
export async function goldenSystemAddendum(stack: string, entryPath: string, purpose: string): Promise<string> {
  if (!(await isGoldenFewShotActive())) return '';

  const isPython = stack === 'PYTHON';
  const contract = isPython ? `${GENERIC_CONTRACT}\n${PYTHON_CONTRACT_EXTRA}` : GENERIC_CONTRACT;

  let body = `\n\nGOLDEN CONTRACT:\n${contract}`;

  if (isPython) {
    // frontière honnête (INV-215) : PAS d'exemplaire cross-langage
    const files = loadGoldenExemplars();
    const ranked = rankGoldenExemplars(entryPath, purpose, files);
    const used = HEADER.length + body.length;
    const budget = ADDENDUM_BUDGET_CHARS - used;
    // l'overhead des marqueurs fait PARTIE du budget — sinon le slice final
    // tronquerait l'exemplaire (un fichier partiel enseigne la partialité, INV-080)
    const overhead = (rel: string) =>
      `\n\nREFERENCE EXEMPLAR — ${rel} (complete, unmodified, from the sealed run):\n--- ${rel} ---\n`.length;
    const chosen = ranked.find((ex) => ex.bytes + overhead(ex.path) <= budget);
    if (chosen) {
      const candidate = `${body}\n\nREFERENCE EXEMPLAR — ${chosen.path} (complete, unmodified, from the sealed run):\n--- ${chosen.path} ---\n${chosen.content}`;
      // garde-fou : si le total dépassait quand même → contrat seul, JAMAIS tronqué
      const total = HEADER + candidate;
      if (total.length <= ADDENDUM_BUDGET_CHARS) body = candidate;
    }
    // aucun candidat ne tient en entier → contrat seul (INV-080)
  }

  return (HEADER + body).slice(0, ADDENDUM_BUDGET_CHARS);
}
