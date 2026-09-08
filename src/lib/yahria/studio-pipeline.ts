// ═══════════════════════════════════════════════════════════════
// YAHRIA STUDIO — Generation Pipeline Orchestrator (Domain 08 Execution Fabric)
// Doc ID: YAHRIA-STD-002
//
// Exécution gouvernée du pipeline Studio :
//   - machine à états GARDÉE (toute transition illégale → 422)
//   - D.6 gouverne l'écriture : policy check avant chaque run (INV-052/120)
//   - preuve SHA-256 chaînée par fichier + artefact workspace + ZIP (Domain 11)
//   - events temps réel sur le bus WS (Domain 11 → /ws/yahria)
//   - livraison : db/workspaces/<runUid>/ + <runUid>.zip
// ═══════════════════════════════════════════════════════════════

import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { db } from '@/lib/db';
import { evaluatePolicy, SEED_POLICY_RULES } from './policy-engine';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';
import {
  parseTreeSpec, proposeTree, planBlueprint, generateFileContent, classifyRole,
  STUDIO_RUN_TRANSITIONS, orderBlueprint, enforceStackChoice,
  type BlueprintEntry, type ParsedTree, type StudioRunState,
} from './studio';
import { isBootGateActive, runBootGate, type BootGateReport } from './boot-gate';
import { isBehavioralGateActive, runBehavioralGate, type BehavioralGateReport } from './behavioral-gate';
import { isCompletenessGateActive, runCompletenessGate, type CompletenessGateReport } from './completeness-gate';

const WORKSPACE_ROOT = path.join(process.cwd(), 'db', 'workspaces');
const MAX_DEPENDENCY_SOURCES = 3;

// ── SP-1. ÉVÉNEMENTS TEMPS RÉEL (vocabulary extension Domain 11) ───

export const STUDIO_EVENTS = {
  RUN_CREATED: 'studio.run.created',
  RUN_STATE: 'studio.run.state',
  TREE_PARSED: 'studio.tree.parsed',
  BLUEPRINT_PLANNED: 'studio.blueprint.planned',
  FILE_GENERATING: 'studio.file.generating',
  FILE_GENERATED: 'studio.file.generated',
  FILE_FAILED: 'studio.file.failed',
  FILE_EDITED: 'studio.file.edited',
  RUN_SEALED: 'studio.run.sealed',
  RUN_FAILED: 'studio.run.failed',
  // EVO-000016 — porte de boot (prévalidation avant SEALED)
  BOOTGATE_RESULT: 'studio.bootgate.result',
  // EVO-000025 — porte comportementale (pytest avant SEALED)
  BEHAVIORALGATE_RESULT: 'studio.behavioralgate.result',
  // EVO-000026 — porte de complétude (aucun livrable partiel ne quitte GENERATING)
  COMPLETENESSGATE_RESULT: 'studio.completenessgate.result',
  // R11 — preuve live (sandbox execution)
  LIVE_STARTED: 'studio.live.started',
  LIVE_ATTEMPT: 'studio.live.attempt',
  LIVE_REPAIRED: 'studio.live.repaired',
  LIVE_PROVED: 'studio.live.proved',
  LIVE_UNPROVED: 'studio.live.unproved',
} as const;

function emit(type: string, severity: 'INFO' | 'SUCCESS' | 'WARN' | 'CRITICAL', message: string, runUid: string, payload?: Record<string, unknown>) {
  emitYahriaEvent({ type, source: '03', severity, message, payload: { runUid, ...payload } });
}

// ── SP-2. TRANSITIONS GARDÉES (machine à états → 422 si illégale) ──

class IllegalTransitionError extends Error {
  constructor(from: string, to: string, runUid: string) {
    super(`transition illégale ${from} → ${to} pour ${runUid} (machine à états gardée)`);
  }
}

export async function transitionRun(runId: string, runUid: string, from: StudioRunState, to: StudioRunState): Promise<void> {
  const legal = STUDIO_RUN_TRANSITIONS[from];
  if (!legal || !legal.includes(to)) throw new IllegalTransitionError(from, to, runUid);
  await db.generationRun.update({
    where: { id: runId },
    data: { state: to, ...(to === 'FAILED' || to === 'CANCELLED' ? {} : { error: null }) },
  });
  emit(REALTIME_EVENT_TYPES.TASK_TRANSITION, 'INFO', `Studio ${runUid} : ${from} → ${to}`, runUid, { from, to });
}

// ── SP-3. POLITIQUE — D.6 GOUVERNE L'ÉCRITURE WORKSPACE ────────────

export function checkWorkspaceWriteAuthorization(runUid: string): { allowed: boolean; rule: string; reason: string } {
  const evaluation = evaluatePolicy(
    { actorType: 'SYSTEM', actorId: 'yahria-studio', action: 'filesystem.write', resource: 'workspace.overlay' },
    SEED_POLICY_RULES,
  );
  if (evaluation.effect !== 'ALLOW') {
    emit(REALTIME_EVENT_TYPES.POLICY_DECISION, 'CRITICAL',
      `Studio ${runUid} : écriture workspace refusée par la politique`, runUid,
      { effect: evaluation.effect, rule: evaluation.matchedRule });
  }
  return { allowed: evaluation.effect === 'ALLOW', rule: evaluation.matchedRule ?? 'DEFAULT-DENY', reason: evaluation.reason };
}

// ── SP-4. SÉCURITÉ CHEMIN — AUCUNE ÉCRITURE HORS WORKSPACE ─────────

function safeJoin(root: string, rel: string): string | null {
  const resolved = path.resolve(root, rel);
  const normalizedRoot = path.resolve(root);
  return resolved.startsWith(normalizedRoot + path.sep) ? resolved : null;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// ── SP-5. PIPELINE PRINCIPAL ───────────────────────────────────────

const running = new Set<string>();

/** Lance le pipeline d'un run (idempotent — un seul démarrage par run). */
export function startStudioRun(runId: string): void {
  if (running.has(runId)) return;
  running.add(runId);
  void runStudioPipeline(runId).finally(() => running.delete(runId));
}

async function failRun(runId: string, runUid: string, error: string): Promise<void> {
  const run = await db.generationRun.findUnique({ where: { id: runId } });
  if (!run || run.state === 'SEALED' || run.state === 'FAILED' || run.state === 'CANCELLED') return;
  await db.generationRun.update({ where: { id: runId }, data: { state: 'FAILED', error } });
  emit(STUDIO_EVENTS.RUN_FAILED, 'CRITICAL', `Studio ${runUid} : échec du pipeline — ${error}`, runUid, { error });
  await captureAndPersist({
    category: 'INCIDENT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'yahria-studio',
    claim: `Studio run ${runUid} failed: ${error.slice(0, 200)}`,
    payload: { runUid, error: error.slice(0, 500) }, traceId: run.traceId ?? undefined,
  });
}

async function runStudioPipeline(runId: string): Promise<void> {
  let run = await db.generationRun.findUnique({ where: { id: runId } });
  if (!run || run.state !== 'SUBMITTED') return;
  const runUid = run.runUid;
  const traceId = run.traceId ?? `TRACE-STUDIO-${runUid}`;

  emit(STUDIO_EVENTS.RUN_CREATED, 'INFO',
    `Studio ${runUid} : mission « ${run.name} » reçue${run.aiDesignedTree ? ' (l\'IA conçoit l\'arborescence)' : ''}`, runUid,
    { name: run.name, aiDesigned: run.aiDesignedTree });

  try {
    // ── Garde politique : sans ALLOW, rien ne s'exécute (INV-052/133) ──
    const auth = checkWorkspaceWriteAuthorization(runUid);
    if (!auth.allowed) {
      await transitionRun(runId, runUid, 'SUBMITTED', 'FAILED');
      await db.generationRun.update({ where: { id: runId }, data: { error: `politique: écriture refusée (${auth.rule}) — ${auth.reason}` } });
      return;
    }

    // ── PERCEIVED — S1 perception de l'arborescence (choix de langage humain gouverne, INV-081) ──
    const requestedStack = run.requestedStack ?? 'AUTO';
    let tree: ParsedTree;
    if (run.aiDesignedTree) {
      await transitionRun(runId, runUid, 'SUBMITTED', 'PERCEIVED');
      tree = await proposeTree(run.brief, requestedStack);
    } else {
      tree = parseTreeSpec(run.treeSpec);
      await transitionRun(runId, runUid, 'SUBMITTED', 'PERCEIVED');
    }
    tree = enforceStackChoice(tree, requestedStack);
    await db.generationRun.update({
      where: { id: runId },
      data: { stack: tree.stack, treeSpec: tree.files.map((f) => f.path).join('\n'), aiDesignedTree: tree.aiDesigned },
    });
    emit(STUDIO_EVENTS.TREE_PARSED, tree.files.length > 0 ? 'INFO' : 'WARN',
      `Studio ${runUid} : arborescence perçue — ${tree.files.length} fichiers, langage ${tree.stack}${requestedStack !== 'AUTO' ? ' (imposé par l\'opérateur)' : ''}`, runUid,
      { files: tree.files.length, stack: tree.stack, requestedStack, warnings: tree.warnings, rejections: tree.rejections.slice(0, 10) });

    if (tree.files.length === 0) {
      await failRun(runId, runUid, 'arborescence vide ou entièrement invalide (INV-120/210)');
      return;
    }

    // ── PLANNED — S2 blueprint ───────────────────────────────────────
    const { blueprint, modelUsed } = await planBlueprint(run.brief, tree);
    await transitionRun(runId, runUid, 'PERCEIVED', 'PLANNED');
    await db.$transaction([
      db.generationRun.update({ where: { id: runId }, data: { blueprint: JSON.stringify(blueprint) } }),
      db.generatedFile.deleteMany({ where: { runId } }),
      ...blueprint.map((b: BlueprintEntry) => db.generatedFile.create({
        data: {
          runId, path: b.path, role: classifyRole(b.path), state: 'PLANNED',
          order: b.order, note: b.purpose,
        },
      })),
    ]);
    emit(STUDIO_EVENTS.BLUEPRINT_PLANNED, 'INFO',
      `Studio ${runUid} : blueprint ${modelUsed} — ${blueprint.length} fichiers planifiés`, runUid,
      { modelUsed, count: blueprint.length });

    // ── GENERATING — agent coder, fichier par fichier ────────────────
    await transitionRun(runId, runUid, 'PLANNED', 'GENERATING');
    let generated = 0;
    let failed = 0;
    let retries = 0;
    let totalBytes = 0;
    let totalGenMs = 0;

    for (const entry of blueprint) {
      const fileRow = await db.generatedFile.findFirst({ where: { runId, path: entry.path } });
      if (!fileRow) continue;
      // pacing anti-rafale : espacer les appels S2 pour rester sous le rate-limit (429)
      if (generated + failed > 0) await new Promise((r) => setTimeout(r, 700));
      emit(STUDIO_EVENTS.FILE_GENERATING, 'INFO', `Studio ${runUid} : génération de ${entry.path}`, runUid, { path: entry.path });
      await db.generatedFile.update({ where: { id: fileRow.id }, data: { state: 'GENERATING' } });

      // contexte : contenu des dépendances déjà générées (cohérence des imports)
      const depSources: { path: string; content: string }[] = [];
      for (const dep of entry.dependsOn.slice(0, MAX_DEPENDENCY_SOURCES)) {
        const depRow = await db.generatedFile.findFirst({ where: { runId, path: dep, state: 'VERIFIED' } });
        if (depRow?.content) depSources.push({ path: dep, content: depRow.content });
      }

      const result = await generateFileContent({
        brief: run.brief,
        stack: tree.stack,
        entry,
        treePaths: tree.files.map((f) => ({ path: f.path, role: f.role })),
        dependencySources: depSources,
      });
      retries += result.attempts - 1;
      totalGenMs += result.ms;

      if (result.verified) {
        const bytes = Buffer.byteLength(result.content, 'utf8');
        const hash = sha256(result.content);
        await db.generatedFile.update({
          where: { id: fileRow.id },
          data: { state: 'VERIFIED', content: result.content, bytes, sha256: hash, attempts: result.attempts, genMs: result.ms, note: result.note },
        });
        generated += 1;
        totalBytes += bytes;
        emit(STUDIO_EVENTS.FILE_GENERATED, 'SUCCESS',
          `Studio ${runUid} : ${entry.path} vérifié (${bytes} octets, ${result.attempts} tentative(s))`, runUid,
          { path: entry.path, bytes, attempts: result.attempts, sha256: hash.slice(0, 16) });
        await captureAndPersist({
          category: 'CODE', criticality: 'STANDARD', actorType: 'MODEL', actorId: 'yahria-coder',
          claim: `Fichier généré et vérifié : ${entry.path} (${bytes} octets)`,
          payload: { runUid, path: entry.path, bytes, sha256: hash, attempts: result.attempts, genMs: result.ms },
          traceId,
        });
      } else {
        await db.generatedFile.update({
          where: { id: fileRow.id },
          data: { state: 'FAILED', attempts: result.attempts, genMs: result.ms, note: result.note },
        });
        failed += 1;
        emit(STUDIO_EVENTS.FILE_FAILED, 'WARN', `Studio ${runUid} : ${entry.path} — ${result.note}`, runUid,
          { path: entry.path, note: result.note, attempts: result.attempts });
        await captureAndPersist({
          category: 'INCIDENT', criticality: 'STANDARD', actorType: 'MODEL', actorId: 'yahria-coder',
          claim: `Génération échouée : ${entry.path}`,
          payload: { runUid, path: entry.path, note: result.note, attempts: result.attempts },
          traceId,
        });
      }
    }

    // ── PORTE DE COMPLÉTUDE (EVO-000026) — avant TOUTE sortie de GENERATING ──
    // Un livrable PARTIEL ne franchit jamais cette frontière : remédiation
    // bornée (1 tour), puis échec classé INFRA|MODÈLE (INV-210). Armée
    // uniquement si EVO-000026 est PROMOTED (décision humaine = interrupteur).
    let completenessGate: CompletenessGateReport | null = null;
    if (await isCompletenessGateActive()) {
      completenessGate = await runCompletenessGate({
        runId, runUid, traceId,
        brief: run.brief, stack: tree.stack,
        treePaths: tree.files.map((f) => ({ path: f.path, role: f.role })),
        blueprint: blueprint.map((b: BlueprintEntry) => ({ path: b.path, purpose: b.purpose, dependsOn: b.dependsOn, keyPoints: b.keyPoints, order: b.order })),
      });
      emit(STUDIO_EVENTS.COMPLETENESSGATE_RESULT, completenessGate.passed ? 'SUCCESS' : 'CRITICAL',
        `Studio ${runUid} : porte de complétude (EVO-000026) ${completenessGate.passed ? 'PASS' : `FAIL — classification ${completenessGate.classification ?? '?'}`} — ${completenessGate.stages.map((s) => `${s.stage}:${s.state}`).join(' ')}`, runUid,
        { passed: completenessGate.passed, classification: completenessGate.classification, totalMs: completenessGate.totalMs, recovered: completenessGate.recovered, stillFailed: completenessGate.stillFailed, stages: completenessGate.stages.map((s) => ({ stage: s.stage, state: s.state, detail: s.detail.slice(0, 220) })) });
      if (!completenessGate.passed) {
        const persist = completenessGate.stillFailed.map((s) => `${s.path} (${s.note.slice(0, 80)})`).join(' ; ').slice(0, 240);
        await failRun(runId, runUid, `porte de complétude (EVO-000026) — classification ${completenessGate.classification ?? '?'} : ${completenessGate.stillFailed.length} fichier(s) en échec persistant — ${persist}`);
        return; // INV-210 : l'échec INFRA est classé comme tel — JAMAIS compté comme échec d'apprentissage
      }
      // remédiation réussie : compteurs rafraîchis depuis la DB (source de vérité)
      const postRows = await db.generatedFile.findMany({ where: { runId } });
      generated = postRows.filter((f) => f.state === 'VERIFIED').length;
      failed = postRows.filter((f) => f.state === 'FAILED').length;
      retries += completenessGate.addedAttempts;
      totalGenMs += completenessGate.addedMs;
      totalBytes += completenessGate.addedBytes;
    }

    // ── VERIFYING — consolidation + livraison workspace + ZIP ────────
    await transitionRun(runId, runUid, 'GENERATING', 'VERIFYING');
    if (generated === 0) {
      await failRun(runId, runUid, 'aucun fichier vérifié — livraison impossible (UNKNOWN ≠ SUCCESS)');
      return;
    }

    const files = await db.generatedFile.findMany({ where: { runId } });
    const deliverable = files.filter((f): f is typeof f & { content: string } => f.state === 'VERIFIED' && Boolean(f.content));
    const workspaceDir = path.join(WORKSPACE_ROOT, runUid);

    for (const f of deliverable) {
      const target = safeJoin(workspaceDir, f.path);
      if (!target) {
        await failRun(runId, runUid, `chemin hors workspace refusé à l'écriture : ${f.path} (INV-120)`);
        return;
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, f.content, 'utf8');
    }
    await captureAndPersist({
      category: 'ARTIFACT', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'yahria-studio',
      claim: `Workspace livré : ${deliverable.length} fichiers écrits dans ${runUid}/`,
      payload: { runUid, files: deliverable.length, bytes: totalBytes }, traceId,
    });

    const zipPath = await packageRunZip(runUid, deliverable.map((f) => ({ path: f.path, content: f.content })));
    const zipHash = sha256(JSON.stringify(deliverable.map((f) => f.sha256)));

    // ── PORTE DE BOOT (EVO-000016) — prévalidation avant SEALED ──────
    // Activation gouvernée : armée uniquement si EVO-000016 est PROMOTED
    // dans le registre d'évolution (la décision humaine est l'interrupteur).
    let bootGate: BootGateReport | null = null;
    if (await isBootGateActive()) {
      bootGate = await runBootGate(runUid, workspaceDir, tree.stack, traceId);
      emit(STUDIO_EVENTS.BOOTGATE_RESULT, bootGate.passed ? 'SUCCESS' : 'CRITICAL',
        `Studio ${runUid} : porte de boot (EVO-000016) ${bootGate.passed ? 'PASS' : 'FAIL'} — ${bootGate.stages.map((s) => `${s.stage}:${s.state}`).join(' ')}`, runUid,
        { passed: bootGate.passed, totalMs: bootGate.totalMs, stages: bootGate.stages.map((s) => ({ stage: s.stage, state: s.state, detail: s.detail.slice(0, 220) })) });
      if (!bootGate.passed) {
        const fail = bootGate.stages.find((s) => s.state === 'FAIL');
        await failRun(runId, runUid, `porte de boot (EVO-000016) — ${fail?.stage ?? '?'} : ${(fail?.detail ?? 'échec boot').slice(0, 240)}`);
        return;
      }
    }

    // ── PORTE COMPORTEMENTALE (EVO-000025) — sondes pytest avant SEALED ──
    // Armée uniquement si EVO-000025 est PROMOTED (décision humaine = interrupteur).
    let behavioralGate: BehavioralGateReport | null = null;
    if (await isBehavioralGateActive()) {
      behavioralGate = await runBehavioralGate(runUid, workspaceDir, tree.stack, traceId);
      emit(STUDIO_EVENTS.BEHAVIORALGATE_RESULT, behavioralGate.passed ? 'SUCCESS' : 'CRITICAL',
        `Studio ${runUid} : porte comportementale (EVO-000025) ${behavioralGate.passed ? 'PASS' : 'FAIL'} — ${behavioralGate.stages.map((s) => `${s.stage}:${s.state}`).join(' ')}`, runUid,
        { passed: behavioralGate.passed, totalMs: behavioralGate.totalMs, stages: behavioralGate.stages.map((s) => ({ stage: s.stage, state: s.state, detail: s.detail.slice(0, 220) })) });
      if (!behavioralGate.passed) {
        const fail = behavioralGate.stages.find((s) => s.state === 'FAIL');
        await failRun(runId, runUid, `porte comportementale (EVO-000025) — ${fail?.stage ?? '?'} : ${(fail?.detail ?? 'échec pytest').slice(0, 240)}`);
        return;
      }
    }

    // ── SEALED — preuve de scellement + stats finales ────────────────
    await transitionRun(runId, runUid, 'VERIFYING', 'SEALED');
    const stats = { files: blueprint.length, generated, failed, retries, bytes: totalBytes, genMs: totalGenMs, ...(completenessGate ? { completenessGate: { passed: completenessGate.passed, classification: completenessGate.classification, totalMs: completenessGate.totalMs, recovered: completenessGate.recovered.length, stillFailed: completenessGate.stillFailed.length } } : {}), ...(bootGate ? { bootGate: { passed: bootGate.passed, totalMs: bootGate.totalMs, stages: bootGate.stages.map((s) => ({ stage: s.stage, state: s.state })) } } : {}), ...(behavioralGate ? { behavioralGate: { passed: behavioralGate.passed, totalMs: behavioralGate.totalMs, stages: behavioralGate.stages.map((s) => ({ stage: s.stage, state: s.state })) } } : {}) };
    await db.generationRun.update({
      where: { id: runId },
      data: { workspacePath: `db/workspaces/${runUid}`, zipPath, stats: JSON.stringify(stats) },
    });
    await captureAndPersist({
      category: 'ARTIFACT', criticality: 'CRITICAL', actorType: 'SYSTEM', actorId: 'yahria-studio',
      claim: `Livraison scellée : ${runUid}.zip (${deliverable.length} fichiers, ${generated}/${blueprint.length} vérifiés)${bootGate?.passed ? ' — porte de boot PASS' : ''}${behavioralGate?.passed ? ' — porte comportementale PASS' : ''}`,
      payload: { runUid, zipPath, zipHash, stats }, traceId,
    });
    emit(STUDIO_EVENTS.RUN_SEALED, 'SUCCESS',
      `Studio ${runUid} : livraison scellée — ${generated}/${blueprint.length} fichiers, ${failed} échec(s), ZIP prêt${bootGate ? ' — boot prévalidé (EVO-000016)' : ''}${behavioralGate ? ' — comportement prévalidé (EVO-000025)' : ''}`, runUid,
      { generated, failed, bytes: totalBytes, zipHash: zipHash.slice(0, 16), bootGate: bootGate?.passed ?? null, behavioralGate: behavioralGate?.passed ?? null });
  } catch (e) {
    await failRun(runId, runUid, (e as Error).message.slice(0, 300));
  }
}

// ── SP-6. EMPAQUETAGE ZIP (livraison) ──────────────────────────────

export async function packageRunZip(runUid: string, files: { path: string; content: string }[]): Promise<string> {
  const zip = new JSZip();
  for (const f of files) {
    if (!f.path || f.path.startsWith('/') || f.path.split('/').some((seg) => seg === '..')) continue; // INV-120
    zip.file(f.path, f.content, { createFolders: true });
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const zipPath = path.join(WORKSPACE_ROOT, `${runUid}.zip`);
  await mkdir(WORKSPACE_ROOT, { recursive: true });
  await writeFile(zipPath, buffer);
  return zipPath;
}

// ── SP-7. ÉDITEUR — RÉGÉNÉRATION D'UN FICHIER SUR INSTRUCTION ──────

export async function editGeneratedFile(runId: string, filePath: string, instruction: string): Promise<{ ok: boolean; error?: string }> {
  const run = await db.generationRun.findUnique({ where: { id: runId } });
  if (!run) return { ok: false, error: 'run introuvable' };
  if (run.state !== 'SEALED') return { ok: false, error: `édition refusée : run en état ${run.state} (SEALED requis)` };
  const file = await db.generatedFile.findFirst({ where: { runId, path: filePath } });
  if (!file) return { ok: false, error: 'fichier introuvable dans ce run' };

  const runUid = run.runUid;
  emit(STUDIO_EVENTS.FILE_GENERATING, 'INFO', `Studio ${runUid} : édition de ${filePath} — ${instruction.slice(0, 80)}`, runUid, { path: filePath, revision: file.revision + 1 });
  await db.generatedFile.update({ where: { id: file.id }, data: { state: 'GENERATING' } });

  const blueprint: BlueprintEntry = {
    path: filePath,
    purpose: file.note ?? 'révision du fichier',
    dependsOn: [],
    keyPoints: [
      `MODIFICATION DEMANDÉE: ${instruction.slice(0, 400)}`,
      // INV-210: une réparation à l'aveugle devine — montrer le contenu actuel est obligatoire
      ...(file.content ? [`CONTENU ACTUEL DU FICHIER (à corriger, ne pas repartir de zéro):\n${file.content.slice(0, 3500)}`] : []),
      ...(file.content ? ['Le fichier existe déjà — applique la modification en conservant la structure valide.'] : []),
    ],
    order: file.order,
  };

  const depSources: { path: string; content: string }[] = [];
  const deps = await db.generatedFile.findMany({ where: { runId, state: 'VERIFIED', path: { not: filePath } } });
  for (const d of deps.slice(0, MAX_DEPENDENCY_SOURCES)) {
    if (d.content) depSources.push({ path: d.path, content: d.content });
  }

  const result = await generateFileContent({
    brief: `${run.brief}\n\nCONTEXTE ÉDITION (révision ${file.revision + 1}): régénère ce fichier en appliquant l'instruction ci-dessous, en te basant sur la version précédente fournie.`,
    stack: run.stack,
    entry: blueprint,
    treePaths: deps.map((d) => ({ path: d.path, role: d.role })),
    dependencySources: depSources,
  });

  if (!result.verified) {
    await db.generatedFile.update({
      where: { id: file.id },
      data: { state: 'FAILED', note: `édition échouée (rév. ${file.revision + 1}) : ${result.note}`, attempts: file.attempts + result.attempts },
    });
    emit(STUDIO_EVENTS.FILE_FAILED, 'WARN', `Studio ${runUid} : édition de ${filePath} échouée — ${result.note}`, runUid, { path: filePath });
    return { ok: false, error: result.note };
  }

  const bytes = Buffer.byteLength(result.content, 'utf8');
  const hash = sha256(result.content);
  await db.generatedFile.update({
    where: { id: file.id },
    data: {
      state: 'VERIFIED', content: result.content, bytes, sha256: hash,
      attempts: result.attempts, genMs: result.ms, revision: file.revision + 1,
      note: `rév. ${file.revision + 1} — ${instruction.slice(0, 160)}`,
    },
  });

  // réécriture workspace + re-zip (livraison à jour)
  const workspaceDir = path.join(WORKSPACE_ROOT, runUid);
  const target = safeJoin(workspaceDir, filePath);
  if (target) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, result.content, 'utf8');
  }
  const all = await db.generatedFile.findMany({ where: { runId, state: 'VERIFIED' } });
  const zipPath = await packageRunZip(runUid, all.filter((f): f is typeof f & { content: string } => Boolean(f.content)).map((f) => ({ path: f.path, content: f.content })));
  await db.generationRun.update({ where: { id: runId }, data: { zipPath } });

  emit(STUDIO_EVENTS.FILE_EDITED, 'SUCCESS', `Studio ${runUid} : ${filePath} édité (rév. ${file.revision + 1}, ${bytes} octets) — ZIP mis à jour`, runUid, { path: filePath, bytes, revision: file.revision + 1 });
  await captureAndPersist({
    category: 'CODE', criticality: 'STANDARD', actorType: 'MODEL', actorId: 'yahria-coder',
    claim: `Fichier édité sur instruction humaine : ${filePath} (rév. ${file.revision + 1})`,
    payload: { runUid, path: filePath, instruction: instruction.slice(0, 400), bytes, sha256: hash, revision: file.revision + 1 },
    traceId: run.traceId ?? undefined,
  });
  return { ok: true };
}

export { parseTreeSpec, orderBlueprint };
