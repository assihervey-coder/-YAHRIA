// ═══════════════════════════════════════════════════════════════════
// YAHRIA STUDIO — CONTRATS CROISÉS INTER-CO-GÉNÉRÉS (EVO-000033)
// « Deux fichiers générés indépendamment ne peuvent pas convenir de
//  noms qu'ils n'ont jamais échangés » (PesaPal vs PesaPalGateway,
//  « name » vs « service », /webhook vs /webhooks — it.12 prouvé).
//
// Motivation mesurée (preuves scellées EV-FORENSIC-000861/000862,
// EV-METRIC-000863) : les blueprints réels RUN-000051/000052 déclarent
// dependsOn VIDE pour 13/13 fichiers → l'injection du contenu des
// dépendances (studio-pipeline.ts:226-230) est INERTE et
// l'ordonnancement topologique (studio.ts orderBlueprint) DÉGÉNÈRE en
// rang de rôle — gateways/__init__.py (l'importeur) est généré EN
// PREMIER, pesapal.py en 6ᵉ, tests/test_api.py en 12ᵉ. En réparation,
// le contrat est invisible AUX DEUX SENS : la fermeture EVO-000031 ne
// voit que les imports de la cible (jamais ses DÉPENDANTS), et
// extractPythonContracts capture les signatures des tests sans leurs
// ASSERTIONS. La charge de génération (55-57 tentatives/run en ~3 min,
// ~19 appels LLM/min) déclenche la limitation zai → circuit OPEN →
// tentatives à sec en cascade (callLLMWithBackoff ne couvre que 429).
//
// Protocole signé EVO-000033 (décision HUMAN:reviewer, INV-227) —
// QUATRE interrupteurs indépendants, pattern golden-exemplar
// (TTL 5s, catch→false, resets pour drills promotion-safe) :
//   A. isCrossContractsActive()       — génération (GC1 registre
//      incrémental + GC2 arêtes dependsOn dérivées)
//   B. isReverseDependentsActive()    — réparation (dépendants inverses
//      + assertions de test dans les contrats frères)
//   C. isSealedFidelityActive()       — scellé des détails de porte
//      (600 → 2400 car., tête+queue)
//   D. isFabricBackoffActive()        — attente bornée sur circuit OPEN
//
// Périmètre signé inchangé hors armement : ≤3 fichiers/cycle,
// 1 tentative/fichier, budget par porte EVO-000030, fermeture
// EVO-000031, registres/fidélité boot EVO-000032, INV-210.
// ═══════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { CircuitSnapshot } from './llm-fabric';

export const CROSS_CONTRACTS_EVO_UID = 'EVO-000033';

// ── CC-0. BORNES ─────────────────────────────────────────────────────

/** Budget du bloc registre injecté dans les prompts de génération (GC1). */
export const LEDGER_BUDGET_CHARS = 3600;
/** Cap d'un detail de stage SCELLÉ quand C est armé (BF3 — défaut signé : 600). */
export const SEALED_DETAIL_CAP = 2400;
export const SEALED_HEAD_CHARS = 1200;
export const SEALED_TAIL_CHARS = 1200;
/** Attente maximale sur circuit OPEN (D) — une seule fois par fichier. */
export const FABRIC_BACKOFF_MAX_MS = 90_000;
export const FABRIC_POLL_MS = 5_000;

// ── CC-1. ARMEMENT GOUVERNÉ — le registre EST l'interrupteur ─────────

interface GateCache { value: boolean; at: number }
const ACTIVE_TTL_MS = 5_000;
const caches: Record<string, GateCache | null> = {
  cross: null, reverse: null, sealed: null, backoff: null,
};

async function gateActive(cacheKey: string): Promise<boolean> {
  const cached = caches[cacheKey];
  if (cached && Date.now() - cached.at < ACTIVE_TTL_MS) return cached.value;
  let value = false;
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: CROSS_CONTRACTS_EVO_UID } });
    value = p?.state === 'PROMOTED';
  } catch {
    value = false; // registre indisponible → inerte (jamais actif par accident)
  }
  caches[cacheKey] = { value, at: Date.now() };
  return value;
}

/** A (GC) — contrats croisés en GÉNÉRATION : registre incrémental + arêtes dérivées. */
export async function isCrossContractsActive(): Promise<boolean> {
  return gateActive('cross');
}
/** B (XR) — réparation croisée : dépendants inverses + assertions de test. */
export async function isReverseDependentsActive(): Promise<boolean> {
  return gateActive('reverse');
}
/** C (BF3) — scellé fidèle des détails de porte (600 → 2400 tête+queue). */
export async function isSealedFidelityActive(): Promise<boolean> {
  return gateActive('sealed');
}
/** D (FB) — backoff fabric : attente bornée sur circuit OPEN. */
export async function isFabricBackoffActive(): Promise<boolean> {
  return gateActive('backoff');
}

/** Resets pour drills promotion-safe (état EXACT restauré). */
export function resetCrossContractsCaches(): void {
  caches.cross = null; caches.reverse = null; caches.sealed = null; caches.backoff = null;
}

// ── CC-2. GC2 — ARÊTES dependsOn DÉRIVÉES (déterministe, conservative) ─

export interface EdgeEntry { path: string; dependsOn: string[] }

/** Entrées canoniques du boot (miroir local — cross-contracts reste sans dépendance cyclique). */
const ENTRY_CANDIDATES_LOCAL = ['main.py', 'app.py', 'server.py'];

const isTestPath = (p: string): boolean =>
  p.startsWith('tests/') || /(^|\/)test_[^/]+\.py$/.test(p) || /(^|\/)[^/]+_test\.py$/.test(p);

const isInitPath = (p: string): boolean => /(^|\/)__init__\.py$/.test(p);

const dirOf = (p: string): string => {
  const i = p.lastIndexOf('/');
  return i > 0 ? p.slice(0, i) : '';
};

/**
 * Dérive DÉTERMINISTEMENT les arêtes manquantes (entrées dependsOn vides
 * uniquement — une arête déclarée par le planificateur n'est JAMAIS
 * retirée ni modifiée). Règles conservatives, filtrées sur l'arbre :
 *   1. pkg/__init__.py        → chaque frère *.py du même package ;
 *   2. entry (main/app/server) → modules *.py top-level + __init__.py des
 *      packages présents dans l'arbre ;
 *   3. tests/*.py             → entry + modules *.py top-level.
 * Cap 8 arêtes/entrée ; les fichiers non-Python (requirements.txt) ne
 * reçoivent ni ne portent aucune arête.
 */
export function deriveDependsOnEdges<T extends EdgeEntry>(entries: T[], treePaths: string[]): T[] {
  const treeSet = new Set(treePaths);
  const pyPaths = treePaths.filter((p) => p.endsWith('.py'));
  const topLevel = pyPaths.filter((p) => !p.includes('/') && !isInitPath(p) && !isTestPath(p));
  const entryFile = pyPaths.find((p) => !p.includes('/') && ENTRY_CANDIDATES_LOCAL.includes(p));
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const derived: T[] = entries.map((e) => {
    if (!e.path.endsWith('.py') || e.dependsOn.length > 0) return e; // déclaré → intact
    const deps = new Set<string>();
    if (isInitPath(e.path)) {
      // règle 1 — frères du même package
      const dir = dirOf(e.path);
      for (const p of pyPaths) {
        if (p === e.path || dirOf(p) !== dir || isInitPath(p)) continue;
        deps.add(p);
      }
    } else if (!isTestPath(e.path) && ENTRY_CANDIDATES_LOCAL.includes(e.path.split('/').pop() ?? '') && !e.path.includes('/')) {
      // règle 2 — entry racine : modules top-level + __init__ des packages
      // NON-TEST (main → tests/__init__ créerait le cycle main → tests/__init__
      // → tests/test_api → main, brisé au dépens de l'ordre tests-APRÈS-main)
      for (const p of topLevel) deps.add(p);
      for (const p of pyPaths) {
        if (isInitPath(p) && p.includes('/') && !isTestPath(p)) deps.add(p); // gateways/__init__.py etc.
      }
    } else if (isTestPath(e.path)) {
      // règle 3 — tests : entry + modules top-level (hors tests/__init__)
      if (entryFile) deps.add(entryFile);
      for (const p of topLevel) deps.add(p);
    }
    const filtered = [...deps].filter((d) => d !== e.path && treeSet.has(d) && byPath.has(d)).slice(0, 8);
    return filtered.length ? { ...e, dependsOn: filtered } : e;
  });
  return derived;
}

// ── CC-3. GC1 — REGISTRE INCRÉMENTAL (bloc de prompt borné) ──────────

export interface LedgerEntry { path: string; lines: string[] }

/**
 * Bloc « registre de contrats » injecté dans les prompts de génération :
 * les fichiers DÉJÀ VÉRIFIÉS du run publient leurs contrats (signatures,
 * clés de registre, routes, retours de handlers) ; le fichier courant les
 * voit AVANT d'écrire les siens. Adjacence d'abord (même package que le
 * fichier à générer), ordre de complétion ensuite, budget 3600 car.
 * PURE — testable sans DB ni LLM.
 */
export function buildLedgerBlock(
  ledger: LedgerEntry[],
  currentPath: string,
  budget: number = LEDGER_BUDGET_CHARS,
): string {
  if (!ledger.length || budget <= 0) return '';
  const dir = dirOf(currentPath);
  const sameDir = ledger.filter((l) => dirOf(l.path) === dir && l.path !== currentPath);
  const rest = ledger.filter((l) => dirOf(l.path) !== dir && l.path !== currentPath);
  const ordered = [...sameDir, ...rest];
  // mesure incrémentale EXACTE (séparateurs \n\n compris — sinon le bloc
  // dépasse le budget signé de 2 car. par entrée acceptée)
  let block = '';
  for (const l of ordered) {
    const body = `--- ${l.path} ---\n${l.lines.join('\n')}`;
    const candidate = block ? `${block}\n\n${body}` : body;
    if (candidate.length > budget) break;
    block = candidate;
  }
  return block;
}

// ── CC-4. BF3 — SCELLÉ FIDÈLE (tête + marqueur + queue) ─────────────

/**
 * Détail de stage scellé : ≤ 2400 car. → intégral ; au-delà → tête 1200 +
 * marqueur d'omission + queue 1200 (même format que formatBootStderr
 * EVO-000032 — les frames workspace d'un traceback sont dans la QUEUE).
 * Défaut sans C armé (appelant) : slice(0,600) signé EXACT.
 */
export function sealedDetail(detail: string): string {
  const s = String(detail ?? '');
  if (s.length <= SEALED_DETAIL_CAP) return s;
  const omitted = s.length - SEALED_HEAD_CHARS - SEALED_TAIL_CHARS;
  return `${s.slice(0, SEALED_HEAD_CHARS).trimEnd()}\n[… ${omitted} caractères de détail intermédiaires omis …]\n${s.slice(-SEALED_TAIL_CHARS).trimStart()}`;
}

// ── CC-5. FB — ATTENTE BORNÉE SUR CIRCUIT OPEN ──────────────────────

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Attend la fermeture du disjoncteur fabric (poll pur — circuitCooldownSnapshot
 * n'a AUCUN effet de bord half-open), bornée : au plus maxMs, poll toutes les
 * pollMs. Une SEULE attente par fichier (l'appelant tient le drapeau).
 * Injectable pour tests (snapshot/sleep factices).
 */
export async function waitFabricClosed(
  snapshot: () => CircuitSnapshot,
  maxMs: number = FABRIC_BACKOFF_MAX_MS,
  pollMs: number = FABRIC_POLL_MS,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ waitedMs: number; closed: boolean }> {
  const t0 = Date.now();
  for (;;) {
    const snap = snapshot();
    if (!snap.anyOpen) return { waitedMs: Date.now() - t0, closed: true };
    const elapsed = Date.now() - t0;
    if (elapsed >= maxMs) return { waitedMs: elapsed, closed: false };
    const remaining = maxMs - elapsed;
    await sleep(Math.min(pollMs, remaining));
  }
}

/** Note de tentative = déclencheur FB (fabric épuisé / disjoncteur ouvert). */
export function isFabricExhaustedNote(note: string | null | undefined): boolean {
  return /fabric exhausted|circuit OPEN/i.test(String(note ?? ''));
}
