// ═══════════════════════════════════════════════════════════════════
// YAHRIA STUDIO — BOUCLE DE RÉPARATION CIBLÉE AU NIVEAU RUN (EVO-000028
// + EVO-000029) — YAHRIA-STD-007 · « Les notes chirurgicales des portes
// nourrissent une régénération bornée » — convertir les quasi-réussites
// en runs SEALED.
//
// Motivation mesurée (PTA-002 it.7, few-shot EVO-000027 PROMOTED) :
// première passe fichiers 97,4 % (38/39) mais 0/3 runs SEALED. Les
// échecs sont CONCENTRÉS et COMPORTEMENTAUX :
//   RUN-000010 — 1 erreur de syntaxe (main.py:40 « from_ gw »), 13/13
//                fichiers vérifiés du premier coup ;
//   RUN-000011 — boot PASS puis pytest 2/4 (test_initiate_payment 500≠201,
//                test_webhook_handler 500≠200), 12/13 première passe ;
//   RUN-000012 — 13/13 première passe puis uvicorn sans réponse HTTP 30s.
// Les trois portes produisent des notes CHIRURGICALES (fichier:ligne, nom
// exact du test pytest, sortie d'assertion) mais le pipeline ne les
// exploite PAS : au premier verdict FAIL, le run meurt et le générateur
// ne voit JAMAIS le retour d'information. Fait décisif : l'exemplaire
// doré lui-même (RUN-000023-corrige) a requis une correction — pytest
// 7/7 APRÈS réparation. Montrer au générateur son erreur précise est
// exactement le mécanisme qui a produit l'étalon.
//
// Protocole signé EVO-000028 (décision HUMAN:reviewer, INV-227) :
//   1. ARMEMENT     — isRunRepairActive() : UNIQUEMENT si EVO-000028 est
//                     PROMOTED dans le registre (registre = interrupteur ;
//                     registre indisponible → boucle inerte).
//   2. DÉCLENCHEUR  — porte v1 (boot) ou v2 (comportementale) FAIL avec
//                     classification MODÈLE. Un échec INFRA n'est JAMAIS
//                     réparé (INV-210). UNE SEULE boucle par run.
//   3. CIBLAGE      — mapGateNotesToTargets() PURE : syntaxe→fichier
//                     exact ; pytest→imports (handlers) + fichier de test ;
//                     uvicorn→racine + imports racine. Budget ≤ 3 fichiers.
//   4. RÉPARATION   — régénération via generateFileContent (1 tentative
//                     par fichier) avec le verdict EXACT de la porte +
//                     le contenu actuel (jamais réparer à l'aveugle,
//                     INV-210) ; few-shot EVO-000027 reste armé ; S1 par
//                     fichier ; attempts incrémenté HONNÊTEMENT (une
//                     réparation n'est PAS une première passe).
//   5. RE-VÉRIF     — la ré-exécution de la porte fautive est faite par
//                     l'orchestrateur (studio-pipeline) ; PASS → le run
//                     continue vers SEALED ; FAIL → failRun avec
//                     l'HISTORIQUE COMPLET. Chaque étape scellée en
//                     preuve (ARTIFACT si réparation réussie, INCIDENT sinon).
//
// EVO-000029 (PROMOTED par HUMAN:reviewer — fidélité des entrées + contrats
// inter-fichiers, causes racines mesurées PTA-002 it.8, preuve EV-ARTIFACT-000212) :
//   RC1 — la porte de boot capte stderr DÈS LE SPAWN (traceback perdu avant) ;
//   RC2 — la porte comportementale met le traceback pytest dans son détail ;
//   RC3 — chaque fichier réparé reçoit le CONTRAT DE SES FRÈRES (co-cibles
//         + modules internes importés) : sign top-level déjà définies,
//         à importer TELLES QUELLES — plus jamais « PaymentInitiate »
//         importé ici mais défini nulle part (dérive RUN-000013/000022).
//
// EVO-000030 (PROMOTED par HUMAN:reviewer — budget par porte + contrat
// pydantic v2, causes prouvées it.9 RUN-000027/28) : le BUDGET de cycles
// est gouverné par repair-budget.ts — ≤1 cycle par PORTE, ≤2 cycles/run
// (legacy 1 cycle/run si EVO-000030 ROLLED_BACK) ; le contrat pydantic v2
// (model_validate/from_attributes/model_dump) et la ligne « le pytest EST
// le contrat comportemental » enrichissent les prompts via studio.ts et
// golden-exemplar.ts. Le MÉCANISME de cette boucle est INCHANGÉ : ≤3
// fichiers, 1 tentative/fichier, MODÈLE uniquement (INV-210), attempts
// honnêtes, bilan scellé par cycle.
// ═══════════════════════════════════════════════════════════════════

import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent } from './realtime';
import { classifyFailure } from './completeness-gate';
import { generateFileContent, type GenerationContext, type BlueprintEntry } from './studio';

export const RUN_REPAIR_EVO_UID = 'EVO-000028';

/** Budget borné : ≤ 3 fichiers réparés par cycle (protocole EVO-000028). */
export const REPAIR_MAX_FILES = 3;

const PACING_MS = 700; // pacing anti-rafale identique à la boucle GENERATING

// ── RR-1. ARMEMENT GOUVERNÉ — le registre EST l'interrupteur ────────

let activeCache: { value: boolean; at: number } | null = null;
const ACTIVE_TTL_MS = 5_000;

export async function isRunRepairActive(): Promise<boolean> {
  if (activeCache && Date.now() - activeCache.at < ACTIVE_TTL_MS) return activeCache.value;
  let value = false;
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: RUN_REPAIR_EVO_UID } });
    value = p?.state === 'PROMOTED';
  } catch {
    value = false; // registre indisponible → boucle inerte (jamais active par accident)
  }
  activeCache = { value, at: Date.now() };
  return value;
}

/** Invalidation forcée du cache d'armement (tests, rollback drill). */
export function resetRunRepairCache(): void {
  activeCache = null;
}

// ── RR-2. TYPES ─────────────────────────────────────────────────────

export interface RepairTarget {
  path: string;
  reason: string;
}

export interface GateFailStage {
  stage: string;
  detail: string;
}

export interface RepairTargetingInput {
  gateKind: 'BOOT' | 'BEHAVIORAL';
  /** uniquement les stages en état FAIL du rapport de porte */
  failStages: GateFailStage[];
  /** tous les chemins planifiés du run — aucune cible hors arbre (INV-120) */
  treePaths: string[];
  /** fichier → modules importés résolus dans l'arbre (résolu par l'appelant depuis la DB) */
  importsByFile?: Record<string, string[]>;
}

export interface RepairCycleInput {
  runId: string;
  runUid: string;
  traceId?: string;
  gateKind: 'BOOT' | 'BEHAVIORAL';
  failStages: GateFailStage[];
  brief: string;
  stack: string;
  blueprint: BlueprintEntry[];
  treePaths: { path: string; role: string }[];
  workspaceDir: string;
}

export interface RepairCycleResult {
  /** true = la boucle a AGI (armée + MODÈLE + cibles) ; false = échec legacy immédiat */
  attempted: boolean;
  /** pourquoi la boucle n'a pas agi (null si attempted) */
  skippedReason: string | null;
  classification: 'INFRA' | 'MODÈLE' | null;
  targets: RepairTarget[];
  repaired: string[];
  stillBroken: { path: string; note: string }[];
  addedAttempts: number;
  addedMs: number;
  addedBytes: number;
}

// ── RR-3. RÉSOLUTION DES IMPORTS PYTHON (fonction PURE — testable) ──

/**
 * Mappe les imports Python d'un contenu vers les chemins réellement
 * planifiés dans l'arbre. Les imports stdlib/paquets externes (sans
 * fichier correspondant) sont ignorés — seuls les modules INTERNES
 * intéressent le ciblage (chemin d'exécution du test ou du boot).
 */
export function resolvePythonImports(content: string, treePaths: string[]): string[] {
  const out = new Set<string>();
  const tryMod = (mod: string): void => {
    if (!/^[\w.]+$/.test(mod)) return;
    const rel = mod.split('.').join('/');
    const candidates = [`${rel}.py`, `${rel}/__init__.py`];
    for (const c of candidates) {
      const hit = treePaths.find((p) => p === c || p.endsWith(`/${c}`));
      if (hit) out.add(hit);
    }
  };
  for (const m of content.matchAll(/^\s*from\s+([\w.]+)\s+import\b/gm)) tryMod(m[1]);
  for (const m of content.matchAll(/^\s*import\s+([^\n#]+)/gm)) {
    for (const raw of m[1].split(',')) {
      const mod = raw.trim().replace(/\s+as\s+\w+$/, '');
      if (mod) tryMod(mod);
    }
  }
  return [...out];
}

// ── RR-4. CIBLAGE (fonction PURE — testable sans FS/DB/LLM) ─────────

/** Résout un nom de fichier cité par une porte vers un chemin de l'arbre. */
function resolveToTreePath(name: string, treePaths: string[]): string | null {
  const clean = name.trim().replace(/^["']|["']:?\s*$/g, '');
  if (!clean || !clean.includes('.')) return null;
  const exact = treePaths.find((p) => p === clean);
  if (exact) return exact;
  const suffix = treePaths.find((p) => p.endsWith(`/${clean}`));
  if (suffix) return suffix;
  const base = clean.split('/').pop()!;
  const byBase = treePaths.find((p) => p.split('/').pop() === base);
  return byBase ?? null; // hors arbre → jamais inventé (INV-120/210)
}

/** Module python cité (« gateways », « app.main ») → chemin de l'arbre. */
function moduleToTreePath(mod: string, treePaths: string[]): string | null {
  const rel = mod.split('.').join('/');
  const hit = treePaths.find((p) => p === `${rel}.py` || p.endsWith(`/${rel}.py`));
  if (hit) return hit;
  const pkg = treePaths.find((p) => p === `${rel}/__init__.py` || p.endsWith(`/${rel}/__init__.py`));
  return pkg ?? null;
}

const ENTRY_CANDIDATES = ['main.py', 'app.py', 'server.py'];

/** Candidats racine pour un échec de boot : module uvicorn cité + entrées canoniques présentes. */
function bootEntryCandidates(detail: string, treePaths: string[]): string[] {
  const out: string[] = [];
  const uv = /uvicorn\s+([\w.]+):/.exec(detail);
  if (uv) {
    const hit = moduleToTreePath(uv[1], treePaths);
    if (hit) out.push(hit);
  }
  for (const c of ENTRY_CANDIDATES) {
    const hit = treePaths.find((p) => p === c || p.endsWith(`/${c}`));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/**
 * Ciblage PUR : mapping notes de porte → fichiers responsables.
 * Budget ≤ REPAIR_MAX_FILES, dédupliqué, ordre de citation respecté,
 * JAMAIS de chemin hors arbre (INV-120). Règles (protocole EVO-000028) :
 *   - SYNTAXE  → le(s) fichier(s) cité(s) exactement ;
 *   - STRUCTURE→ les îlots non importables cités ;
 *   - BOOT     → racine (module uvicorn / entrées canoniques) + imports racine ;
 *   - PYTEST   → modules importés par le test (handlers, priorité) puis le test ;
 *   - DÉCOUVERTE (boot)  → entrées canoniques ;
 *   - DÉCOUVERTE (comportementale) → fichiers de test planifiés s'ils existent.
 */
export function mapGateNotesToTargets(input: RepairTargetingInput): RepairTarget[] {
  const targets: RepairTarget[] = [];
  const seen = new Set<string>();
  const push = (name: string | null | undefined, reason: string): void => {
    if (!name) return;
    const p = resolveToTreePath(name, input.treePaths);
    if (!p || seen.has(p)) return;
    seen.add(p);
    targets.push({ path: p, reason: reason.slice(0, 300) });
  };
  const pushResolved = (p: string | null, reason: string): void => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    targets.push({ path: p, reason: reason.slice(0, 300) });
  };
  const importsFor = (p: string | null): string[] => (p && input.importsByFile?.[p]) || [];

  for (const fail of input.failStages) {
    const d = fail.detail ?? '';
    if (fail.stage === 'SYNTAXE') {
      // « 1 fichier(s) en erreur de syntaxe : main.py — File "main.py", line 40 … »
      for (const m of d.matchAll(/([\w.\-/]+\.[A-Za-z0-9]+)/g)) {
        push(m[1], `erreur de syntaxe signalée par la porte : ${d.slice(0, 180)}`);
      }
    } else if (fail.stage === 'STRUCTURE') {
      // « N îlot(s) non importable(s) : x/y.py (chemin de package invalide…) »
      const cited = [...d.matchAll(/([\w.\-/]+\.py)\s*\(/g)].map((m) => m[1]);
      for (const c of (cited.length ? cited : [...d.matchAll(/([\w.\-/]+\.py)/g)].map((m) => m[1]))) {
        push(c, `îlot non importable : ${d.slice(0, 180)}`);
      }
    } else if (fail.stage === 'BOOT' && input.gateKind === 'BOOT') {
      // « uvicorn main:app sans réponse HTTP en 30s — <stderr> »
      // (a) racine — protocole EVO-000028
      const entries = bootEntryCandidates(d, input.treePaths);
      if (entries[0]) {
        pushResolved(entries[0], `boot sans réponse HTTP — racine visée : ${d.slice(0, 160)}`);
      }
      // (b) EVO-000029 RC1 — traceback réel (stderr capté dès le spawn) :
      //     frames « File "…/xxx.py", line N » résolues dans l'arbre,
      //     ordre d'apparition ; les frames stdlib/uvicorn ne résolvent PAS
      //     (hors arbre → ignorées, INV-120)
      for (const m of d.matchAll(/File\s+"([^"]+\.py)",\s*line\s+(\d+)/g)) {
        const base = m[1].split('/').pop() ?? m[1];
        push(base, `traceback boot — ${base}:${m[2]} (frame de l'échec)`);
      }
      // (c) modules manquants / symboles rompus (contrat inter-fichiers RC3)
      for (const m of d.matchAll(/No module named '([\w.]+)'/g)) {
        const hit = moduleToTreePath(m[1], input.treePaths);
        pushResolved(hit, `ModuleNotFoundError signalé au boot : ${m[1]}`);
      }
      for (const m of d.matchAll(/cannot import name\s+'(\w+)'\s+from\s+'([\w.]+)'/g)) {
        const hit = moduleToTreePath(m[2], input.treePaths);
        pushResolved(hit, `ImportError — « ${m[1]} » absent de ${m[2]} (contrat inter-fichiers rompu, EVO-000029)`);
      }
      // (d) imports racine — chemin d'exécution du boot (priorité basse :
      //     les cibles précises du traceback passent d'abord dans le budget)
      if (entries[0]) {
        for (const imp of importsFor(entries[0])) {
          pushResolved(imp, `import racine de ${entries[0]} — chemin d'exécution du boot`);
        }
      }
    } else if (fail.stage === 'DÉCOUVERTE' && input.gateKind === 'BOOT') {
      // « aucun module racine avec instance FastAPI( ou create_app( »
      for (const c of ENTRY_CANDIDATES) {
        const hit = input.treePaths.find((p) => p === c || p.endsWith(`/${c}`));
        pushResolved(hit ?? null, 'aucune instance FastAPI/create_app découverte — racine à corriger');
      }
    } else if (fail.stage === 'PYTEST' && input.gateKind === 'BEHAVIORAL') {
      // « pytest exit 1 — 2 failed … — test_initiate_payment: E assert 500 == 201 | … ||
      //   tests/test_api.py:12: AssertionError » (détail fidèle EVO-000029 RC2)
      const testFiles = new Set<string>();
      for (const m of d.matchAll(/(?:FAILED|ERROR)\s+([\w.\-/]+\.py)/g)) testFiles.add(m[1]);
      for (const m of d.matchAll(/([\w.\-/]+\.py)::\w+/g)) testFiles.add(m[1]);
      // EVO-000029 — localisations « fichier.py:ligne: Erreur » du détail fidèle
      for (const m of d.matchAll(/([\w.\-/]+\.py):\d+:/g)) testFiles.add(m[1]);
      // priorité : modules du chemin d'exécution (handlers/imports directs), puis le test lui-même
      for (const t of testFiles) {
        const resolved = resolveToTreePath(t, input.treePaths);
        for (const imp of importsFor(resolved)) {
          pushResolved(imp, `échec pytest — module du chemin d'exécution (test ${t})`);
        }
      }
      for (const t of testFiles) push(t, `échec pytest signalé : ${d.slice(0, 160)}`);
    } else if (fail.stage === 'DÉCOUVERTE' && input.gateKind === 'BEHAVIORAL') {
      // « aucun test découvert (tests/ ou test_*.py) » — mêmes critères que
      // discoverTests (test_*.py / *_test.py) ; les __init__.py sont exclus
      // (glue de ré-export, jamais responsables de l'absence de tests)
      for (const p of input.treePaths) {
        const b = p.split('/').pop() ?? p;
        if (b.startsWith('test_') || b.endsWith('_test.py')) {
          pushResolved(p, 'aucun test découvert — fichier de test planifié à régénérer');
        }
      }
    }
    // INVENTAIRE / COMPORTEMENT / ERREUR / SONDES : aucun ciblage fiable →
    // aucune cible → échec legacy honnête (jamais réparer à l'aveugle, INV-210)
  }
  return targets.slice(0, REPAIR_MAX_FILES);
}

// ── RR-6. CONTRATS INTER-FICHIERS (EVO-000029 RC3 — fonctions pures) ─

/** Signatures publiques top-level d'un module Python (le CONTRAT du fichier). */
const PY_CONTRACT = /^(class\s+\w+|def\s+\w+|async\s+def\s+\w+|[A-Z][A-Z0-9_]{1,63}\s*=)/;

export function extractPythonContracts(content: string, maxLines = 14, maxLineChars = 110): string[] {
  const out: string[] = [];
  for (const raw of (content ?? '').split('\n')) {
    // top-level STRICT : les lignes indentées (corps de classe/fonction) ne
    // font pas partie du contrat public — les shapes complets restent
    // accessibles via les dependencySources (test + dependsOn)
    if (!raw || raw.startsWith(' ') || raw.startsWith('\t')) continue;
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (PY_CONTRACT.test(line)) {
      out.push(line.slice(0, maxLineChars));
      if (out.length >= maxLines) break;
    }
  }
  return out;
}

export interface SiblingContract { path: string; lines: string[] }

/**
 * EVO-000029 (RC3) — contexte frères d'un fichier à réparer. Frères =
 * co-cibles du cycle + modules internes importés par le contenu courant.
 * PURE par injection du lecteur (async pour la DB, fake Map en test).
 */
export async function buildSiblingContracts(
  targetPath: string,
  currentContent: string | null,
  coTargets: string[],
  treePaths: string[],
  readContent: (p: string) => Promise<string | null>,
  opts: { maxSiblings?: number; maxChars?: number } = {},
): Promise<SiblingContract[]> {
  const maxSiblings = opts.maxSiblings ?? 3;
  const maxChars = opts.maxChars ?? 2400;
  const order: string[] = [];
  const seen = new Set<string>([targetPath]);
  const add = (p: string | null | undefined): void => {
    if (!p || seen.has(p) || order.includes(p)) return;
    seen.add(p);
    order.push(p);
  };
  for (const c of coTargets) add(c); // co-cibles d'abord (réparées ENSEMBLE)
  const internalImports = currentContent ? resolvePythonImports(currentContent, treePaths) : [];
  for (const imp of internalImports) add(imp);
  const out: SiblingContract[] = [];
  let budget = maxChars;
  for (const p of order) {
    if (out.length >= maxSiblings || budget <= 200) break;
    const content = await readContent(p);
    if (!content) continue; // absent/vide → pas de contrat inventé (INV-210)
    const lines = extractPythonContracts(content);
    if (!lines.length) continue; // sans contrat utile → sauté, ne consomme PAS de slot utile
    const joined = lines.join('\n').slice(0, budget);
    budget -= joined.length;
    out.push({ path: p, lines: joined.split('\n') });
  }
  return out;
}

// ── RR-7. ÉCRITURE WORKSPACE (garde chemin — duplicata volontaire de ─
//     safeJoin pour éviter tout import cyclique avec studio-pipeline) ─

function safeJoinWorkspace(root: string, rel: string): string | null {
  const resolved = path.resolve(root, rel);
  const normalizedRoot = path.resolve(root);
  return resolved.startsWith(normalizedRoot + path.sep) ? resolved : null;
}

// ── RR-8. LE CYCLE DE RÉPARATION ────────────────────────────────────

/**
 * Cycle UNIQUE de réparation ciblée. Appelé par studio-pipeline aux
 * points d'échec boot/comportemental. Inerte tant que EVO-000028 n'est
 * pas PROMOTED ; saute INFRA (INV-210) ; régénère ≤ 3 fichiers, 1
 * tentative chacun ; ne ré-exécute JAMAIS la porte elle-même
 * (l'orchestrateur re-vérifie avec le rapport complet sous les yeux).
 */
export async function runRepairCycle(input: RepairCycleInput): Promise<RepairCycleResult> {
  const idle: RepairCycleResult = {
    attempted: false, skippedReason: null, classification: null,
    targets: [], repaired: [], stillBroken: [],
    addedAttempts: 0, addedMs: 0, addedBytes: 0,
  };

  // 1. ARMEMENT — registre = interrupteur (INV-227)
  if (!(await isRunRepairActive())) {
    return { ...idle, skippedReason: 'boucle inerte — EVO-000028 non PROMOTED (décision humaine = interrupteur, INV-227)' };
  }

  // 2. CLASSIFICATION (INV-210) — mêmes signatures que la mesure scellée
  const classification = classifyFailure(input.failStages.map((s) => s.detail));
  if (classification === 'INFRA') {
    await captureAndPersist({
      category: 'INCIDENT', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: 'yahria-repair-loop',
      claim: `Boucle de réparation EVO-000028 non engagée — classification INFRA (panne fabric, JAMAIS réparée — INV-210) : ${input.runUid}`,
      payload: { runUid: input.runUid, gateKind: input.gateKind, failStages: input.failStages.map((s) => ({ stage: s.stage, detail: s.detail.slice(0, 220) })) },
      traceId: input.traceId,
    });
    return { ...idle, skippedReason: 'classification INFRA — échec infrastructure jamais réparé (INV-210), rejet au rejeu mesure', classification };
  }

  // 3. CIBLAGE — imports résolus depuis la DB (source de vérité, jamais mémoire)
  const treePathList = input.treePaths.map((t) => t.path);
  const importsByFile: Record<string, string[]> = {};
  if (input.stack === 'PYTHON') {
    const rows = await db.generatedFile.findMany({ where: { runId: input.runId, state: 'VERIFIED' } });
    for (const row of rows) {
      const base = row.path.split('/').pop() ?? row.path;
      const isTest = row.path.startsWith('tests/') || base.startsWith('test_') || base.endsWith('_test.py');
      const isEntry = ENTRY_CANDIDATES.includes(base);
      if (!isTest && !isEntry) continue;
      importsByFile[row.path] = resolvePythonImports(row.content ?? '', treePathList);
    }
  }
  const targets = mapGateNotesToTargets({
    gateKind: input.gateKind, failStages: input.failStages,
    treePaths: treePathList, importsByFile,
  });
  if (targets.length === 0) {
    await captureAndPersist({
      category: 'INCIDENT', criticality: 'STANDARD', actorType: 'SYSTEM', actorId: 'yahria-repair-loop',
      claim: `Boucle de réparation EVO-000028 : aucune cible identifiée dans les notes de la porte ${input.gateKind} — échec legacy conservé : ${input.runUid}`,
      payload: { runUid: input.runUid, gateKind: input.gateKind, failStages: input.failStages.map((s) => ({ stage: s.stage, detail: s.detail.slice(0, 220) })) },
      traceId: input.traceId,
    });
    return { ...idle, skippedReason: 'aucune cible de réparation identifiable dans les notes de la porte', classification };
  }

  emitYahriaEvent({
    type: 'studio.repair.cycle', source: '03', severity: 'WARN',
    message: `Studio ${input.runUid} : boucle de réparation EVO-000028 engagée (${input.gateKind}) — ${targets.length} fichier(s) ciblé(s) : ${targets.map((t) => t.path).join(', ')}`,
    payload: { runUid: input.runUid, gateKind: input.gateKind, targets: targets.map((t) => ({ path: t.path, reason: t.reason.slice(0, 120) })) },
  });

  const result: RepairCycleResult = {
    attempted: true, skippedReason: null, classification,
    targets, repaired: [], stillBroken: [],
    addedAttempts: 0, addedMs: 0, addedBytes: 0,
  };

  // 4. RÉPARATION — 1 tentative par fichier, verdict EXACT + contenu actuel
  for (const target of targets) {
    if (result.addedAttempts > 0) await new Promise((r) => setTimeout(r, PACING_MS));
    const row = await db.generatedFile.findFirst({ where: { runId: input.runId, path: target.path } });
    const bp = input.blueprint.find((b) => b.path === target.path);
    if (!row) {
      // sans ligne generatedFile, aucune persistance possible : jamais réparer en aveugle hors registre
      result.stillBroken.push({ path: target.path, note: 'ligne generatedFile absente — non persistable, non régénérée' });
      continue;
    }
    const current = row?.content ?? null;

    // détail de porte pertinent : ce qui mentionne CE fichier, sinon l'ensemble des FAIL
    const own = input.failStages.filter((s) => s.detail.includes(target.path)).map((s) => `${s.stage} : ${s.detail}`);
    // EVO-000029 — verdict 2000 car. : les détails fidèles RC1/RC2 (tracebacks)
    // sont LA valeur ajoutée — 800 car. les tronquait à nouveau
    const verdict = (own.length ? own : input.failStages.map((s) => `${s.stage} : ${s.detail}`)).join(' || ').slice(0, 2000);

    // EVO-000029 (RC3) — contrat des frères : co-cibles du cycle + modules
    // internes importés par le contenu courant, lus À JOUR en DB (une
    // réparation antérieure du cycle est visible pour les suivantes)
    const siblings = await buildSiblingContracts(
      target.path, current,
      targets.map((t) => t.path), treePathList,
      async (p) => (await db.generatedFile.findFirst({ where: { runId: input.runId, path: p } }))?.content ?? null,
    );
    const siblingPoint = siblings.length
      ? `SIBLING CONTRACTS (EVO-000029 cross-file repair context) — these sibling files ALREADY define these exact symbols; import and use them EXACTLY as declared, NEVER re-declare, re-name, or invent different shapes:\n${siblings.map((s) => `--- ${s.path} ---\n${s.lines.join('\n')}`).join('\n')}`
      : null;

    const entry: BlueprintEntry = {
      path: target.path,
      purpose: bp?.purpose ?? row?.note ?? 'fichier à réparer pour passer la porte',
      dependsOn: bp?.dependsOn ?? [],
      keyPoints: [
        ...(bp?.keyPoints ?? []),
        `REPAIR DIRECTIVE (EVO-000028 bounded repair loop) — the ${input.gateKind} quality gate FAILED with this EXACT verdict: ${verdict}`,
        'The current content may contain accidental prompt artifacts (leading lines like "--- file.py ---" copied from the prompt); they are NEVER valid source code — your output must start directly with real code.',
        ...(current
          ? [`CURRENT FILE CONTENT (fix it, do not start from scratch):\n${current.slice(0, 3500)}`]
          : []),
        ...(current
          ? ['The file already exists — apply the precise fix for the exact verdict above, keep the valid structure, and output the COMPLETE corrected file.']
          : []),
        ...(siblingPoint ? [siblingPoint] : []),
      ],
      order: bp?.order ?? row.order ?? 999,
    };

    // dépendances : fichier de test (contrat comportemental) en priorité, puis dependsOn VERIFIED
    const depSources: { path: string; content: string }[] = [];
    if (input.stack === 'PYTHON' && !entry.path.startsWith('tests/')) {
      const testRow = await db.generatedFile.findFirst({
        where: { runId: input.runId, state: 'VERIFIED', path: { contains: 'test' } },
      });
      if (testRow?.content) depSources.push({ path: testRow.path, content: testRow.content });
    }
    for (const dep of entry.dependsOn.slice(0, 3)) {
      if (depSources.length >= 3) break;
      if (depSources.some((d) => d.path === dep)) continue;
      const depRow = await db.generatedFile.findFirst({ where: { runId: input.runId, path: dep, state: 'VERIFIED' } });
      if (depRow?.content) depSources.push({ path: dep, content: depRow.content });
    }

    const ctx: GenerationContext = {
      brief: input.brief, stack: input.stack, entry,
      treePaths: input.treePaths, dependencySources: depSources,
    };
    const gen = await generateFileContent(ctx, 1); // 1 SEULE tentative par fichier : budget borné
    result.addedAttempts += gen.attempts;
    result.addedMs += gen.ms;

    if (gen.verified) {
      const bytes = Buffer.byteLength(gen.content, 'utf8');
      const hash = createHash('sha256').update(gen.content, 'utf8').digest('hex');
      await db.generatedFile.update({
        where: { id: row.id },
        data: {
          state: 'VERIFIED', content: gen.content, bytes, sha256: hash,
          attempts: row.attempts + gen.attempts, // honnête : réparation ≠ première passe
          genMs: (row.genMs ?? 0) + gen.ms,
          note: `réparation EVO-000028 : ${gen.note}`.slice(0, 240),
        },
      });
      // réécriture workspace — la re-porte lit le DISQUE
      const absPath = safeJoinWorkspace(input.workspaceDir, entry.path);
      if (absPath) {
        await mkdir(path.dirname(absPath), { recursive: true });
        await writeFile(absPath, gen.content, 'utf8');
      }
      result.repaired.push(entry.path);
      result.addedBytes += bytes;
      await captureAndPersist({
        category: 'ARTIFACT', criticality: 'STANDARD', actorType: 'MODEL', actorId: 'yahria-repair-loop',
        claim: `Fichier réparé par la boucle EVO-000028 : ${entry.path} (${bytes} octets) — ${target.reason.slice(0, 120)}`,
        payload: { runUid: input.runUid, gateKind: input.gateKind, path: entry.path, bytes, sha256: hash, repairReason: target.reason.slice(0, 200) },
        traceId: input.traceId,
      });
    } else {
      await db.generatedFile.update({
        where: { id: row.id },
        data: {
          attempts: row.attempts + gen.attempts,
          note: `réparation EVO-000028 échouée : ${gen.note}`.slice(0, 240),
        },
      });
      result.stillBroken.push({ path: entry.path, note: gen.note });
      await captureAndPersist({
        category: 'INCIDENT', criticality: 'STANDARD', actorType: 'MODEL', actorId: 'yahria-repair-loop',
        claim: `Réparation EVO-000028 échouée : ${entry.path} — ${gen.note.slice(0, 140)}`,
        payload: { runUid: input.runUid, gateKind: input.gateKind, path: entry.path, note: gen.note.slice(0, 300) },
        traceId: input.traceId,
      });
    }
  }

  // 5. BILAN du cycle — scellé ; la re-vérification de la porte appartient à l'orchestrateur
  const cycleOk = result.repaired.length > 0 && result.stillBroken.length === 0;
  await captureAndPersist({
    category: cycleOk ? 'ARTIFACT' : 'INCIDENT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'yahria-repair-loop',
    claim: `Boucle de réparation EVO-000028 (${input.gateKind}) : ${result.repaired.length} fichier(s) réparé(s), ${result.stillBroken.length} en échec persistant — re-vérification de la porte par l'orchestrateur : ${input.runUid}`,
    payload: {
      runUid: input.runUid, gateKind: input.gateKind, classification,
      targets: targets.map((t) => ({ path: t.path, reason: t.reason.slice(0, 160) })),
      repaired: result.repaired, stillBroken: result.stillBroken,
      addedAttempts: result.addedAttempts, addedMs: result.addedMs, addedBytes: result.addedBytes,
    },
    traceId: input.traceId,
  });
  return result;
}
