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
//
// EVO-000031 (PROMOTED par HUMAN:reviewer — fermeture des dépendances,
// causes prouvées par reproduction vivante sur les workspaces it.10 :
// RUN-000035 « ImportError: cannot import name 'verify_hmac' » depuis
// pesapal.py réparé ; RUN-000041 3 pytest FAIL = 3 appels hallucinés
// — get_gateway(name) au lieu de (name, config), verify_webhook_signature
// au lieu du réel verify_hmac) :
//   DC1 — buildSiblingContracts ordonne les modules internes RÉELLEMENT
//         importés par la cible AVANT les co-cibles : les co-cibles sont
//         MUTABLES (régénérées dans le même cycle), les dépendances
//         existantes sont la vérité FIXE ;
//   DC2 — bornes relevées : 5 frères / 3600 car. — 2-3 co-cibles ne
//         consomment plus tous les slots (l'ordre signé EVO-000029 les
//         faisait gagner à tous les coups).
//   Gouverné par isDependencyClosureActive() (registre = interrupteur,
//   INV-227) ; ROLLED_BACK → ordre et bornes EVO-000029 EXACTS
//   (co-cibles d'abord, 3 / 2400) sans redéploiement.
//
// EVO-000032 (PROMOTED par HUMAN:reviewer — contrats de REGISTRE + fidélité
// BOOT totale, causes restantes it.11 prouvées par reproduction vivante :
// RUN-000042 la fabrique enregistre « notch » alors que le contrat de test
// envoie « notchpay » — extractPythonContracts STRICT top-level rendait les
// clés indentées de GATEWAYS = { INVISIBLES ; RUN-000044 pesapal.py:10
// jamais ciblé — le tail 1200 perdait le début du traceback et le parseur
// confondait importlib/__init__.py stdlib avec gateways/__init__.py) :
//   REG — contrats de registre : une ligne top-level se terminant par '{'
//         ou '[' (ou ': {') capture les lignes indentées de continuation
//         JUSQU'À la fermeture, borné ≤8 lignes / 110 car./ligne — les
//         clés de fabrique (« notch » : NotchPayGateway) entrent au contrat
//         (génération ET réparation via buildSiblingContracts) ; défaut
//         sans opts = extraction STRICTE signée EXACTE (rollback) ;
//   BF-1 — ciblage BOOT en MATCH STRICT : les frames du traceback ne
//         résolvent que des chemins DE L'ARBRE (relatifs ou sous
//         workspaceDir) — « importlib/__init__.py » stdlib n'est plus
//         confondu avec gateways/__init__.py, <frozen …> et site-packages
//         jamais ciblés ; le budget ≤3 va aux vraies frames ;
//   BF-2 — boot-gate.ts conserve le stderr en TÊTE (800 car. — frames
//         d'ouverture) + QUEUE (1200 car. — ImportError finale) au lieu
//         du tail seul.
//   Gouverné par isRegistryContractsActive() + isBootFidelityActive()
//   (registre = interrupteur, INV-227) ; ROLLED_BACK → extraction STRICTE
//   + tail seul + ciblage basename signé EVO-000029, sans redéploiement.
// ═══════════════════════════════════════════════════════════════════

import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent } from './realtime';
import { classifyFailure } from './completeness-gate';
import { generateFileContent, type GenerationContext, type BlueprintEntry } from './studio';
import { isBootFidelityActive } from './boot-gate';
import { isReverseDependentsActive } from './cross-contracts';

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

// ── RR-1 bis. ARMEMENT EVO-000031 — fermeture des dépendances ────────

export const DEPENDENCY_CLOSURE_EVO_UID = 'EVO-000031';

let closureCache: { value: boolean; at: number } | null = null;

/**
 * EVO-000031 — la fermeture des dépendances (imports réels de la cible
 * d'abord, bornes 5/3600) n'est active QUE si la proposition est PROMOTED
 * (registre = interrupteur, INV-227) ; registre indisponible → comportement
 * signé EVO-000029 (jamais actif par accident).
 */
export async function isDependencyClosureActive(): Promise<boolean> {
  if (closureCache && Date.now() - closureCache.at < ACTIVE_TTL_MS) return closureCache.value;
  let value = false;
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: DEPENDENCY_CLOSURE_EVO_UID } });
    value = p?.state === 'PROMOTED';
  } catch {
    value = false;
  }
  closureCache = { value, at: Date.now() };
  return value;
}

/** Invalidation forcée du cache d'armement EVO-000031 (tests, rollback drill). */
export function resetDependencyClosureCache(): void {
  closureCache = null;
}

// ── RR-1 ter. ARMEMENT EVO-000032 — contrats de registre ────────────

export const REGISTRY_CONTRACTS_EVO_UID = 'EVO-000032';

let registryCache: { value: boolean; at: number } | null = null;

/**
 * EVO-000032 (moitié REG) — les contrats de REGISTRE (corps indenté des
 * littéraux dict/list top-level : clés de fabrique GATEWAYS = { … }) ne
 * sont actifs QUE si la proposition est PROMOTED (registre = interrupteur,
 * INV-227) ; registre indisponible → extraction STRICTE signée (jamais
 * active par accident).
 */
export async function isRegistryContractsActive(): Promise<boolean> {
  if (registryCache && Date.now() - registryCache.at < ACTIVE_TTL_MS) return registryCache.value;
  let value = false;
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: REGISTRY_CONTRACTS_EVO_UID } });
    value = p?.state === 'PROMOTED';
  } catch {
    value = false;
  }
  registryCache = { value, at: Date.now() };
  return value;
}

/** Invalidation forcée du cache d'armement EVO-000032/REG (tests, rollback drill). */
export function resetRegistryContractsCache(): void {
  registryCache = null;
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
  /** EVO-000032 (BF-1) — frames boot résolues en match STRICT contre l'arbre */
  bootFidelity?: boolean;
  /** répertoire workspace — les frames absolues hors workspaceDir sont exclues */
  workspaceDir?: string;
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
    // BF-DC1 (outillage, fidélité des entrées — pas un changement de
    // protocole) : les modules RELATIFS (« from .base import X »)
    // produisaient un candidat « /base.py » et le matcher testait
    // « //base.py » — jamais résolu. filter(Boolean) normalise les points
    // initiaux : '.base' → 'base' → suffixe « /base.py » → gateways/base.py.
    const rel = mod.split('.').filter(Boolean).join('/');
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

/**
 * EVO-000032 (BF-1) — résolution STRICTE d'une frame « File "…", line N »
 * vers un chemin de l'arbre planifié. Une frame ne résout que si :
 *   — ce n'est PAS une frame d'interpréteur (« <frozen …> ») ;
 *   — son chemin est RELATIF (py_compile) ou sous workspaceDir (boot
 *     uvicorn) — site-packages, /home/z/.local/… et <frozen …> sont
 *     JAMAIS résolus ;
 *   — le chemin relatif correspond EXACTEMENT à un chemin planifié
 *     (jamais inventé, INV-120).
 * Leçon RUN-000044 : « importlib/__init__.py » stdlib n'est plus confondu
 * avec gateways/__init__.py — le budget ≤3 va aux vraies frames.
 */
function resolveFrameToTreePath(framePath: string, treePaths: string[], workspaceDir?: string): string | null {
  if (framePath.startsWith('<')) return null;
  let rel: string | null = null;
  if (workspaceDir) {
    const root = workspaceDir.endsWith('/') ? workspaceDir : `${workspaceDir}/`;
    if (framePath.startsWith(root)) rel = framePath.slice(root.length);
  } else if (!framePath.startsWith('/')) {
    rel = framePath;
  }
  if (!rel) return null;
  return treePaths.find((p) => p === rel) ?? null;
}

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
      //     (hors arbre → ignorées, INV-120).
      //     EVO-000032 (BF-1) — quand la fidélité BOOT est PROMOTED, la
      //     résolution est STRICTE (resolveFrameToTreePath) : les frames
      //     stdlib/site-packages ne sont plus confondues avec l'arbre via
      //     leur basename (importlib/__init__.py ≠ gateways/__init__.py) ;
      //     sans bootFidelity → comportement signé EVO-000029 EXACT.
      for (const m of d.matchAll(/File\s+"([^"]+\.py)",\s*line\s+(\d+)/g)) {
        if (input.bootFidelity) {
          const hit = resolveFrameToTreePath(m[1], input.treePaths, input.workspaceDir);
          if (hit) pushResolved(hit, `traceback boot — ${hit}:${m[2]} (frame de l'échec, arbre)`);
        } else {
          const base = m[1].split('/').pop() ?? m[1];
          push(base, `traceback boot — ${base}:${m[2]} (frame de l'échec)`);
        }
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

/** EVO-000032 (REG) — une ligne top-level ouvrant un littéral dict/list. */
const REGISTRY_OPEN = /[{[]\s*$/;
/** EVO-000032 (REG) — borne signée : ≤8 lignes de continuation par registre. */
const REGISTRY_MAX_CONTINUATION = 8;

export interface PythonContractOpts {
  /** EVO-000032 — capturer le corps indenté des registres top-level */
  registry?: boolean;
  /** EVO-000033 (A/GC1) — capturer les routes des décorateurs FastAPI/Router (toute indentation) */
  routes?: boolean;
  /** EVO-000033 (A/GC1) — capturer les littéraux de retour des handlers (return { … }, ≤8 lignes) */
  returns?: boolean;
  /** EVO-000033 (B/XR) — fichier TEST : capturer les routes appelées (client.get/post) et les clés assertées */
  testAssertions?: boolean;
  /** EVO-000033 (B/XR) — capturer les lignes d'import top-level (surface de contrat d'un __init__.py dépendant) */
  includeImports?: boolean;
  maxLines?: number;
  maxLineChars?: number;
}

// EVO-000033 (A/B) — motifs de la passe DÉDIÉE (toute indentation — routes,
// retours et assertions vivent dans les corps de fonctions, invisibles à la
// passe top-level STRICT) : DÉFAULT sans opts = aucun de ces motifs (extraction
// signée EXACTE, rollback).
const ROUTE_DECORATOR = /^\s*@(\w+)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/;
const HANDLER_RETURN = /^\s*return\s*\{/;
const TEST_ROUTE_CALL = /\b(?:client|requests)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/;
const TEST_ASSERT_KEY = /assert\s+["']([^"']+)["']\s+in\s+\w+/;
const TEST_ASSERT_STATUS = /assert\s+response\.status_code\s*==\s*(\d+)/;
// EVO-000033 (B/XR) — surface d'import TOP-LEVEL d'un __init__.py dépendant :
// « from .pesapal import PesaPalGateway » est LE contrat que le dépendant
// attend de pesapal.py — invisible à PY_CONTRACT (ni class/def/CONST)
const TOPLEVEL_IMPORT = /^(?:from\s+[\w.]+\s+import\s+|import\s+[\w.]+)/;

function isTestFilePath(p: string): boolean {
  return p.startsWith('tests/') || /(^|\/)test_[^/]+\.py$/.test(p) || /(^|\/)[^/]+_test\.py$/.test(p);
}

function isInitFilePath(p: string): boolean {
  return /(^|\/)__init__\.py$/.test(p);
}

/**
 * EVO-000033 (A/B) — passe DÉDIÉE sur TOUTES les lignes (toute indentation) :
 * routes des décorateurs, retours de handlers (continuation bornée par
 * pushRegistryBody — même borne ≤8 lignes que REG), assertions de test
 * (routes appelées, clés « x » in data, status_code). Dédupliqué, borné
 * par maxLines/maxLineChars — ne produit RIEN sans opts (rollback).
 */
function pushCrossContractLines(
  lines: string[],
  out: string[],
  opts: { routes?: boolean; returns?: boolean; testAssertions?: boolean },
  maxLines: number,
  maxLineChars: number,
): void {
  const seen = new Set<string>(out);
  const push = (line: string): boolean => {
    const t = line.trim().slice(0, maxLineChars);
    if (!t || seen.has(t)) return false;
    if (out.length >= maxLines) return false;
    seen.add(t);
    out.push(t);
    return true;
  };
  for (let i = 0; i < lines.length && out.length < maxLines; i++) {
    const raw = lines[i] ?? '';
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (opts.routes) {
      const m = raw.match(ROUTE_DECORATOR);
      if (m) { push(raw.trim()); continue; }
    }
    if (opts.returns && HANDLER_RETURN.test(raw)) {
      if (!push(raw.trim())) continue;
      // littéral multi-ligne → même borne que REG (≤8 lignes de continuation)
      const braces = (raw.match(/\{/g) ?? []).length - (raw.match(/\}/g) ?? []).length;
      if (braces > 0) i = pushRegistryBody(lines, i, out, maxLines, maxLineChars);
      continue;
    }
    if (opts.testAssertions) {
      const r = raw.match(TEST_ROUTE_CALL);
      if (r) { push(`${r[1]}("${r[2]}")`); continue; }
      const k = raw.match(TEST_ASSERT_KEY);
      if (k) { push(`assert "${k[1]}" in data`); continue; }
      const s = raw.match(TEST_ASSERT_STATUS);
      if (s) { push(`assert response.status_code == ${s[1]}`); continue; }
    }
  }
}

/**
 * Consomme les lignes indentées de continuation d'un registre ouvert en
 * `openIdx` JUSQU'À la fermeture ('}' / ']'), borné ≤8 lignes / maxLineChars
 * (EVO-000032 REG — les clés de fabrique « "notch": NotchPayGateway »
 * deviennent visibles). Retourne l'index de la dernière ligne consommée.
 */
function pushRegistryBody(lines: string[], openIdx: number, out: string[], maxLines: number, maxLineChars: number): number {
  let consumed = openIdx;
  for (let j = openIdx + 1; j < lines.length && out.length < maxLines; j++) {
    const raw = lines[j] ?? '';
    if (!raw.trim()) continue; // ligne vide : sautée, ne termine pas le registre
    const trimmed = raw.trim();
    if (trimmed.startsWith('}') || trimmed.startsWith(']')) break; // fermeture : hors contrat
    if (trimmed.startsWith('#')) continue;
    out.push(trimmed.slice(0, maxLineChars));
    consumed = j;
    if (j - openIdx >= REGISTRY_MAX_CONTINUATION) break;
  }
  return consumed;
}

export function extractPythonContracts(content: string, opts: PythonContractOpts = {}): string[] {
  const maxLines = opts.maxLines ?? 14;
  const maxLineChars = opts.maxLineChars ?? 110;
  const registry = opts.registry ?? false;
  const out: string[] = [];
  const lines = (content ?? '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (out.length >= maxLines) break;
    const raw = lines[i] ?? '';
    // top-level STRICT : les lignes indentées (corps de classe/fonction) ne
    // font pas partie du contrat public — les shapes complets restent
    // accessibles via les dependencySources (test + dependsOn)
    if (!raw || raw.startsWith(' ') || raw.startsWith('\t')) continue;
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (PY_CONTRACT.test(line) || (opts.includeImports && TOPLEVEL_IMPORT.test(line))) {
      out.push(line.slice(0, maxLineChars));
      // EVO-000032 (REG) — « GATEWAYS = { » : la déclaration OUVRE un
      // registre dont les clés indentées entrent au contrat (défaut sans
      // opts.registry = extraction STRICTE signée EXACTE, rollback)
      if (registry && REGISTRY_OPEN.test(line)) {
        i = pushRegistryBody(lines, i, out, maxLines, maxLineChars);
      }
    } else if (registry && REGISTRY_OPEN.test(line)) {
      // ouverture non-PY_CONTRACT (« ROUTES: { », « ITEMS = [ ») :
      // l'ouverture elle-même entre au contrat puis son corps indenté
      out.push(line.slice(0, maxLineChars));
      i = pushRegistryBody(lines, i, out, maxLines, maxLineChars);
    }
  }
  // EVO-000033 (A/B) — passe DÉDIÉE toute-indentation (routes / retours de
  // handlers / assertions de test) : NE PRODUIT RIEN sans opts (défaut =
  // extraction STRICTE signée EXACTE, rollback)
  if (opts.routes || opts.returns || opts.testAssertions) {
    pushCrossContractLines(lines, out, opts, maxLines, maxLineChars);
  }
  return out;
}

export interface SiblingContract { path: string; lines: string[] }

/**
 * EVO-000029 (RC3) — contexte frères d'un fichier à réparer. Frères =
 * co-cibles du cycle + modules internes importés par le contenu courant.
 * PURE par injection du lecteur (async pour la DB, fake Map en test).
 * EVO-000031 (DC1/DC2) — opts.depsFirst inverse l'ordre : les imports
 * internes RÉELS d'abord (contrats stables, lus À JOUR), co-cibles ensuite
 * ; bornes portées à 5 frères / 3600 car. par l'appelant quand PROMOTED.
 * EVO-000032 (REG) — opts.registry capture le corps indenté des registres
 * top-level (clés de fabrique GATEWAYS = { … }) dans les contrats frères.
 * EVO-000033 (B/XR) — opts.dependents : les DÉPENDANTS INVERSES de la cible
 * (fichiers qui l'importent — calculés par l'appelant depuis les imports
 * réels des fichiers VERIFIED) entrent au contexte entre les imports et les
 * co-cibles (depsFirst) ; opts.testAssertions : un frère TEST expose ses
 * ASSERTIONS (routes appelées, clés assertées) — le contrat test↔impl
 * devient visible aux deux sens (RUN-000051/000052).
 * Sans opts (défaut) → comportement signé EVO-000029 EXACT (rollback).
 */
export async function buildSiblingContracts(
  targetPath: string,
  currentContent: string | null,
  coTargets: string[],
  treePaths: string[],
  readContent: (p: string) => Promise<string | null>,
  opts: { maxSiblings?: number; maxChars?: number; depsFirst?: boolean; registry?: boolean; dependents?: string[]; testAssertions?: boolean } = {},
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
  const internalImports = currentContent ? resolvePythonImports(currentContent, treePaths) : [];
  const dependents = opts.dependents ?? [];
  if (opts.depsFirst) {
    // EVO-000031 (DC1) — dépendances STABLES d'abord : les co-cibles sont
    // régénérées dans le MÊME cycle (contrats mutables), les modules
    // importés existants sont la vérité fixe (RUN-000035/000041).
    // EVO-000033 (XR) — dépendants inverses ENTRE les deux : le dépendant
    // existe (vérifié) et expose le contrat ATTENDU de la cible
    // (gateways/__init__.py attend PesaPalGateway — RUN-000052).
    for (const imp of internalImports) add(imp);
    for (const d of dependents) add(d);
    for (const c of coTargets) add(c);
  } else {
    for (const c of coTargets) add(c); // co-cibles d'abord (réparées ENSEMBLE, EVO-000029)
    for (const d of dependents) add(d); // EVO-000033 (XR) — après co-cibles, avant imports
    for (const imp of internalImports) add(imp);
  }
  const out: SiblingContract[] = [];
  let budget = maxChars;
  for (const p of order) {
    if (out.length >= maxSiblings || budget <= 200) break;
    const content = await readContent(p);
    if (!content) continue; // absent/vide → pas de contrat inventé (INV-210)
    // EVO-000033 (XR) — un frère TEST expose ses ASSERTIONS (routes appelées,
    // clés assertées) et un frère __init__.py expose sa SURFACE D'IMPORT
    // (le contrat attendu de la cible) quand opts.testAssertions est armé ;
    // défaut = signatures seules (extraction signée EVO-000029/31/32 EXACTE)
    const lines = extractPythonContracts(content, {
      registry: opts.registry,
      testAssertions: opts.testAssertions === true && isTestFilePath(p),
      includeImports: opts.testAssertions === true && isInitFilePath(p),
      // les assertions des derniers tests webhook dépassent la fenêtre de 14
      // lignes — 30 lignes quand XR armé (borné par le budget car. du frère)
      maxLines: opts.testAssertions === true ? 30 : undefined,
    });
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
  // EVO-000031 (DC1/DC2) + EVO-000032 (REG/BF) + EVO-000033 (XR) — armements lus
  // AVANT le ciblage (les interrupteurs gouvernent les deux étapes) : fermeture
  // des dépendances (imports réels d'abord, bornes 5/3600), contrats de registre,
  // ciblage frames STRICT, dépendants inverses + assertions de test —
  // indépendants (interrupteurs séparés).
  const closureActive = await isDependencyClosureActive();
  const registryActive = await isRegistryContractsActive();
  const bootFidelity = await isBootFidelityActive();
  const reverseActive = await isReverseDependentsActive();
  const siblingOpts: { depsFirst?: boolean; maxSiblings?: number; maxChars?: number; registry?: boolean; dependents?: string[]; testAssertions?: boolean } = {};
  if (closureActive) {
    siblingOpts.depsFirst = true;
    siblingOpts.maxSiblings = 5;
    siblingOpts.maxChars = 3600;
  }
  if (registryActive) siblingOpts.registry = true;
  if (reverseActive) siblingOpts.testAssertions = true;
  const treePathList = input.treePaths.map((t) => t.path);
  // EVO-000033 (XR) — dépendants inverses par cible : reverse map des imports
  // réels de TOUS les fichiers VERIFIED (T ∈ imports(F) ⇒ F dépendant de T).
  // Calculé UNE fois par cycle, borné par l'arbre (≤13 fichiers) ; la map
  // importsByFile du ciblage garde sa sémantique signée (tests + entrées).
  const dependentsByFile: Record<string, string[]> = {};
  const importsByFile: Record<string, string[]> = {};
  if (input.stack === 'PYTHON') {
    const rows = await db.generatedFile.findMany({ where: { runId: input.runId, state: 'VERIFIED' } });
    const allImports: Record<string, string[]> = {};
    for (const row of rows) {
      const base = row.path.split('/').pop() ?? row.path;
      const isTest = row.path.startsWith('tests/') || base.startsWith('test_') || base.endsWith('_test.py');
      const isEntry = ENTRY_CANDIDATES.includes(base);
      if (!isTest && !isEntry) {
        if (reverseActive) allImports[row.path] = resolvePythonImports(row.content ?? '', treePathList);
        continue;
      }
      const resolved = resolvePythonImports(row.content ?? '', treePathList);
      importsByFile[row.path] = resolved;
      if (reverseActive) allImports[row.path] = resolved;
    }
    if (reverseActive) {
      for (const [importer, deps] of Object.entries(allImports)) {
        for (const dep of deps) {
          (dependentsByFile[dep] ??= []).push(importer);
        }
      }
    }
  }
  const targets = mapGateNotesToTargets({
    gateKind: input.gateKind, failStages: input.failStages,
    treePaths: treePathList, importsByFile,
    bootFidelity, workspaceDir: input.workspaceDir,
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
  // (armements EVO-000031/032 déjà lus en tête du ciblage — siblingOpts)
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

    // EVO-000029 (RC3) + EVO-000031 (DC1/DC2) — contrat des frères : modules
    // internes importés par le contenu courant + co-cibles du cycle, lus
    // À JOUR en DB (une réparation antérieure du cycle est visible pour les
    // suivantes) ; l'ORDRE et les BORNES dépendent de isDependencyClosureActive()
    const siblings = await buildSiblingContracts(
      target.path, current,
      targets.map((t) => t.path), treePathList,
      async (p) => (await db.generatedFile.findFirst({ where: { runId: input.runId, path: p } }))?.content ?? null,
      // EVO-000033 (XR) — dépendants inverses DE LA CIBLE (reverse map calculée
      // en tête du cycle) ; bornes/ordre gouvernés par les interrupteurs
      { ...siblingOpts, dependents: reverseActive ? (dependentsByFile[target.path] ?? []) : undefined },
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
