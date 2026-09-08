// ═══════════════════════════════════════════════════════════════════
// YAHRIA STUDIO — PORTE DE COMPLÉTUDE (EVO-000026) — YAHRIA-STD-005
// « Complétude de génération avant livraison » : aucun livrable PARTIEL
// ne quitte GENERATING. Extension des portes v1/v2 : la v1 (EVO-000016)
// prouve le BOOT, la v2 (EVO-000025) prouve le COMPORTEMENT, la v3
// prouve la COMPLÉTUDE — chaque fichier du blueprint est VERIFIED ou le
// run échoue avec une classification honnête INFRA | MODÈLE (INV-210).
//
// Motivation mesurée (PTA-002, RUN-000026) : fabric LLM ouverte en cours
// de génération (« zai:circuit OPEN, cooldown 90s »), 11/14 fichiers
// FAILED après 3 tentatives chacun, pipeline CONTINUÉ avec 3 fichiers
// vérifiés jusqu'à la porte de boot — rejet indirect, diagnostic
// trompeur. Trou structurel : la boucle GENERATING ne fait échouer le
// run que si generated===0.
//
// Protocole (5 étapes, signé EVO-000026) :
//   1. INVENTAIRE     — partition VERIFIED / FAILED du blueprint (path:note)
//   2. CLASSIFICATION — INFRA (circuit/cooldown/429/timeout…) vs MODÈLE (INV-210)
//   3. CIRCUIT        — si fabric ouverte : attente cooldown BORNÉE, sinon
//                       remédiation sautée (aucun appel brûlé contre l'ouvert)
//   4. REMÉDIATION    — 1 tour borné de régénération des fichiers FAILED
//   5. VERDICT        — PASS si complétude restaurée, sinon FAIL + classification
//
// ACTIVATION GOUVERNÉE (INV-110/227) : la porte ne s'arme QUE si
// EVO-000026 est PROMOTED dans le registre d'évolution — la décision
// humaine est l'interrupteur réel, pas une variable d'environnement.
// ═══════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import { generateFileContent, type GenerationContext, type BlueprintEntry } from './studio';
import { circuitCooldownSnapshot } from './llm-fabric';

export const COMPLETENESS_GATE_EVO_UID = 'EVO-000026';

// ── CG-1. ARMEMENT — lu dans le registre d'évolution, jamais ailleurs ──

export async function isCompletenessGateActive(): Promise<boolean> {
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: COMPLETENESS_GATE_EVO_UID } });
    return p?.state === 'PROMOTED';
  } catch {
    return false; // registre indisponible → porte inerte (jamais bloquante par accident)
  }
}

// ── CG-2. TYPES ─────────────────────────────────────────────────────

export interface CompletenessGateStage { stage: string; state: 'PASS' | 'FAIL' | 'SKIP'; detail: string; ms: number }

/** INV-210 : la classification est la partie honnête du verdict — une panne
 *  d'infrastructure n'est JAMAIS comptée comme un échec d'apprentissage. */
export type CompletenessClassification = 'INFRA' | 'MODÈLE';

export interface CompletenessGateReport {
  passed: boolean;
  classification: CompletenessClassification | null; // null si PASS sans échec
  stages: CompletenessGateStage[];
  totalMs: number;
  /** deltas honnêtes pour les stats du run (remédiation incluse) */
  addedAttempts: number;
  addedMs: number;
  addedBytes: number;
  recovered: string[]; // fichiers restaurés par la remédiation
  stillFailed: { path: string; note: string }[];
}

export interface CompletenessGateInput {
  runId: string;
  runUid: string;
  traceId?: string;
  brief: string;
  stack: string;
  treePaths: { path: string; role: string }[];
  blueprint: BlueprintEntry[];
}

// ── CG-3. CLASSIFICATION (INV-210) ──────────────────────────────────

/** Signatures d'infrastructure : la note d'échec pointe la FABRIC, pas le modèle. */
const INFRA_SIGNATURES = [
  'circuit open', 'cooldown', 'rate-limit', 'rate limit', '429',
  'timeout', 'econnrefused', 'enotfound', 'quota', 'indisponible',
  'inaccessible', 'fetch failed', 'network',
];

export function classifyFailure(notes: string[]): CompletenessClassification {
  const hit = notes.some((n) => {
    const c = (n ?? '').toLowerCase();
    return INFRA_SIGNATURES.some((s) => c.includes(s));
  });
  return hit ? 'INFRA' : 'MODÈLE';
}

// ── CG-4. LA PORTE ──────────────────────────────────────────────────

const CIRCUIT_WAIT_CAP_MS = 120_000; // attente max : cooldown 90s + marge, JAMAIS au-delà
const PACING_MS = 700;               // pacing anti-rafale identique à la boucle GENERATING

export async function runCompletenessGate(input: CompletenessGateInput): Promise<CompletenessGateReport> {
  const t0 = Date.now();
  const stages: CompletenessGateStage[] = [];
  const added = { attempts: 0, ms: 0, bytes: 0 };
  const recovered: string[] = [];
  let stillFailed: { path: string; note: string }[] = [];
  let classification: CompletenessClassification | null = null;
  let passed = false;

  // 1. INVENTAIRE — partition du blueprint (source : DB, jamais mémoire)
  const rows = await db.generatedFile.findMany({ where: { runId: input.runId } });
  const verified = rows.filter((r) => r.state === 'VERIFIED' && Boolean(r.content));
  const failedRows = rows.filter((r) => r.state === 'FAILED');
  stages.push({
    stage: 'INVENTAIRE', state: failedRows.length ? 'FAIL' : 'PASS',
    detail: failedRows.length
      ? `${verified.length}/${rows.length} vérifiés, ${failedRows.length} FAILED : ${failedRows.map((f) => `${f.path}:${(f.note ?? '?').slice(0, 60)}`).join(' | ').slice(0, 300)}`
      : `complétude native : ${verified.length}/${rows.length} fichiers VERIFIED — aucun FAILED`,
    ms: 0,
  });

  if (!failedRows.length) {
    stages.push({ stage: 'CLASSIFICATION', state: 'SKIP', detail: 'aucun échec à classifier', ms: 0 });
    stages.push({ stage: 'CIRCUIT', state: 'SKIP', detail: 'remédiation non requise', ms: 0 });
    stages.push({ stage: 'REMÉDIATION', state: 'SKIP', detail: 'remédiation non requise', ms: 0 });
    stages.push({ stage: 'VERDICT', state: 'PASS', detail: `livrable complet (${verified.length} fichiers)`, ms: 0 });
    passed = true;
  } else {
    // 2. CLASSIFICATION (INV-210) — les notes d'échec désignent-elles la fabric ?
    classification = classifyFailure(failedRows.map((f) => f.note ?? ''));
    stages.push({
      stage: 'CLASSIFICATION', state: 'PASS',
      detail: classification === 'INFRA'
        ? 'INFRA — notes compatibles panne fabric (circuit/cooldown/réseau) : PAS un échec d\'apprentissage du générateur (INV-210)'
        : 'MODÈLE — notes sans signature infra : qualité de génération en cause',
      ms: 0,
    });

    // 3. CIRCUIT — « cooldown fabric respecté » : on lit SANS muter (snapshot pur)
    const snap = circuitCooldownSnapshot();
    if (snap.anyOpen) {
      const wait = Math.min(snap.maxRemainingMs + 2_000, CIRCUIT_WAIT_CAP_MS);
      stages.push({
        stage: 'CIRCUIT', state: 'SKIP',
        detail: `fabric ouverte (${snap.openProviders.join(',')}) — attente bornée ${Math.round(wait / 1000)}s (cooldown respecté, cap ${CIRCUIT_WAIT_CAP_MS / 1000}s)`,
        ms: 0,
      });
      await new Promise((r) => setTimeout(r, wait));
      const after = circuitCooldownSnapshot();
      stages.push({
        stage: 'CIRCUIT-POST', state: after.anyOpen ? 'FAIL' : 'PASS',
        detail: after.anyOpen
          ? `fabric ENCORE ouverte après attente (${after.openProviders.join(',')}) — remédiation sautée, aucun appel brûlé contre l'ouvert`
          : 'fabric refermée — remédiation autorisée',
        ms: Date.now() - t0,
      });
      if (after.anyOpen) {
        stillFailed = failedRows.map((f) => ({ path: f.path, note: f.note ?? '?' }));
        stages.push({ stage: 'REMÉDIATION', state: 'SKIP', detail: 'sautée — circuit toujours ouvert', ms: 0 });
        stages.push({
          stage: 'VERDICT', state: 'FAIL',
          detail: `livrable PARTIEL interdit de sortie (${verified.length}/${rows.length}) — classification INFRA : panne fabric persistante, ${stillFailed.length} fichier(s) non régénéré(s)`,
          ms: 0,
        });
      }
    }

    // 4. REMÉDIATION — 1 tour BORNÉ (pas de boucle : le run échoue si ça ne suffit pas)
    if (!passed && stages.every((s) => s.stage !== 'CIRCUIT-POST' || s.state !== 'FAIL')) {
      const tR = Date.now();
      for (const f of failedRows) {
        const entry: BlueprintEntry | undefined = input.blueprint.find((b) => b.path === f.path);
        if (!entry) {
          stillFailed.push({ path: f.path, note: 'introuvable dans le blueprint — non régénérable' });
          continue;
        }
        if (added.attempts + added.bytes > 0) await new Promise((r) => setTimeout(r, PACING_MS));
        // dépendances re- consultées à l'instant (des deps peuvent être VERIFIED entre-temps)
        const depSources: { path: string; content: string }[] = [];
        for (const dep of entry.dependsOn.slice(0, 3)) {
          const depRow = await db.generatedFile.findFirst({ where: { runId: input.runId, path: dep, state: 'VERIFIED' } });
          if (depRow?.content) depSources.push({ path: dep, content: depRow.content });
        }
        const ctx: GenerationContext = {
          brief: input.brief, stack: input.stack, entry,
          treePaths: input.treePaths, dependencySources: depSources,
        };
        const result = await generateFileContent(ctx, 1); // 1 SEULE tentative par fichier : remédiation bornée
        added.attempts += result.attempts;
        added.ms += result.ms;
        if (result.verified) {
          const bytes = Buffer.byteLength(result.content, 'utf8');
          await db.generatedFile.update({
            where: { id: f.id },
            data: { state: 'VERIFIED', content: result.content, bytes, attempts: f.attempts + result.attempts, genMs: (f.genMs ?? 0) + result.ms, note: `remédiation porte v3 : ${result.note}`.slice(0, 240) },
          });
          added.bytes += bytes;
          recovered.push(f.path);
        } else {
          await db.generatedFile.update({
            where: { id: f.id },
            data: { attempts: f.attempts + result.attempts, note: `remédiation v3 échouée : ${result.note}`.slice(0, 240) },
          });
          stillFailed.push({ path: f.path, note: result.note });
        }
      }
      stages.push({
        stage: 'REMÉDIATION', state: stillFailed.length ? 'FAIL' : 'PASS',
        detail: `1 tour borné : ${recovered.length} restauré(s), ${stillFailed.length} en échec persistant — ${recovered.concat(stillFailed.map((s) => `${s.path} ✗`)).join(', ').slice(0, 260)}`,
        ms: Date.now() - tR,
      });

      // 5. VERDICT
      passed = stillFailed.length === 0;
      stages.push({
        stage: 'VERDICT', state: passed ? 'PASS' : 'FAIL',
        detail: passed
          ? `complétude restaurée : ${verified.length + recovered.length}/${rows.length} fichiers VERIFIED (remédiation +${added.bytes} o, +${Math.round(added.ms / 100) / 10}s)`
          : `livrable PARTIEL interdit de sortie (${verified.length + recovered.length}/${rows.length}) — classification ${classification} : ${stillFailed.map((s) => `${s.path} (${s.note.slice(0, 60)})`).join(' | ').slice(0, 220)}`,
        ms: 0,
      });
    }
  }

  const report: CompletenessGateReport = {
    passed, classification, stages, totalMs: Date.now() - t0,
    addedAttempts: added.attempts, addedMs: added.ms, addedBytes: added.bytes,
    recovered, stillFailed,
  };

  // Preuve de la décision (Domain 11) — chaque verdict de la porte est scellé
  await captureAndPersist({
    category: passed ? 'ARTIFACT' : 'INCIDENT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'yahria-completeness-gate',
    claim: `Porte de complétude (EVO-000026) ${passed ? 'PASS' : `FAIL — classification ${classification ?? '?'}`} : ${input.runUid} — ${stages.map((s) => `${s.stage}:${s.state}`).join(' ')}`,
    payload: {
      runUid: input.runUid, passed, classification, totalMs: report.totalMs,
      recovered, stillFailed, addedBytes: added.bytes,
      stages: stages.map((s) => ({ stage: s.stage, state: s.state, detail: s.detail.slice(0, 220) })),
    },
    traceId: input.traceId,
  });
  return report;
}
