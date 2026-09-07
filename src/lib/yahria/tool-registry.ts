// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — TOOL REGISTRY ENGINE (Domain 09)
// Doc ID: YAHRIA-KRN-025 | Spec: TOOL_REGISTRY_SPECIFICATION.md
//
// Tools are DECLARED, VALIDATED, AUTHORIZED, then EXECUTED — four
// independent gates. The constitutional spine of this module:
//
//   INV-062 — REGISTERED ≠ AUTHORIZED. Registration makes a tool
//             *known*; only an explicit policy decision makes it
//             *invocable*. Every invocation re-evaluates policy.
//   INV-042 — bounded execution: hard timeout per tool, capped output.
//   INV-052/INV-133 — deny-by-default: no matching policy → DENY.
//   INV-080 — the result of a tool is a CLAIM, not a fact; it is
//             recorded as evidence and carries its auth trace.
//   INV-190 — tool versions recorded; downgrades refused.
//   INV-213 — handlers never see process secrets (no env passthrough).
//
// Contract validation is S1 (deterministic, zero LLM): a strict JSON
// Schema subset. Unknown fields are rejected — tools cannot be fed
// untracked inputs.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { evaluatePolicy, type PolicyRuleDef } from './policy-engine';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';
import { detectToolchains } from './sandbox-executor';

// ── TR-1. TYPES ────────────────────────────────────────────────────

export type ToolRiskClass = 'READ_ONLY' | 'SIDE_EFFECT';

/** Strict JSON-Schema subset — S1 validator vocabulary. */
export interface ToolContract {
  type: 'object';
  description?: string;
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    maxLength?: number;
    items?: { type: 'string' | 'number' | 'boolean' };
  }>;
  required: string[];
}

export interface ToolDef {
  toolId: string;               // dotted: domain.capability.verb
  name: string;
  version: string;              // semver — monotonic
  description: string;
  ownerDomain: string;          // canonical domain code
  riskClass: ToolRiskClass;
  contract: ToolContract;
  executable: boolean;          // built-in handler bound?
}

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

export interface AuthorizationTrace {
  effect: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';
  matchedRule: string | null;
  reason: string;
  precedence: string;
  resourceRequested: string;
}

export interface InvokeOutcome {
  toolId: string;
  version: string;
  authorized: boolean;
  auth: AuthorizationTrace;
  validated: boolean;
  validationErrors: string[];
  ok: boolean;
  result: unknown | null;
  error: string | null;
  ms: number;
  invocationId: string | null;
  evidenceUid: string | null;
  verdict: 'INVOKED' | 'DENIED' | 'REQUIRE_APPROVAL' | 'VALIDATION_FAILED' | 'EXECUTION_FAILED';
}

// ── TR-2. S1 CONTRACT VALIDATOR (deterministic, strict) ────────────

export function validateToolInput(contract: ToolContract, input: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['input doit être un objet JSON'] };
  }
  const obj = input as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!contract.properties[key]) errors.push(`champ « ${key} » : non déclaré dans le contrat (rejet strict)`);
  }
  for (const req of contract.required) {
    if (!(req in obj)) errors.push(`champ requis « ${req} » manquant`);
  }
  for (const [key, spec] of Object.entries(contract.properties)) {
    if (!(key in obj)) continue;
    const v = obj[key];
    switch (spec.type) {
      case 'string':
        if (typeof v !== 'string') { errors.push(`« ${key} » : attendu string`); break; }
        if (spec.enum && !spec.enum.includes(v)) errors.push(`« ${key} » : valeur hors énumération (${spec.enum.join(' | ')})`);
        if (spec.maxLength !== undefined && v.length > spec.maxLength) errors.push(`« ${key} » : longueur ${v.length} > maxLength ${spec.maxLength}`);
        break;
      case 'number':
        if (typeof v !== 'number' || Number.isNaN(v)) { errors.push(`« ${key} » : attendu number`); break; }
        if (spec.minimum !== undefined && v < spec.minimum) errors.push(`« ${key} » : ${v} < minimum ${spec.minimum}`);
        if (spec.maximum !== undefined && v > spec.maximum) errors.push(`« ${key} » : ${v} > maximum ${spec.maximum}`);
        break;
      case 'boolean':
        if (typeof v !== 'boolean') errors.push(`« ${key} » : attendu boolean`);
        break;
      case 'array':
        if (!Array.isArray(v)) { errors.push(`« ${key} » : attendu array`); break; }
        if (spec.items && v.some((x) => typeof x !== spec.items!.type)) errors.push(`« ${key} » : éléments de type ${spec.items.type} requis`);
        break;
      case 'object':
        if (typeof v !== 'object' || v === null || Array.isArray(v)) errors.push(`« ${key} » : attendu object`);
        break;
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateToolContract(contract: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof contract !== 'object' || contract === null) return { ok: false, errors: ['contrat absent'] };
  const c = contract as Partial<ToolContract>;
  if (c.type !== 'object') errors.push('contract.type doit être "object"');
  if (!c.properties || typeof c.properties !== 'object') errors.push('contract.properties requis');
  else {
    for (const [k, spec] of Object.entries(c.properties)) {
      if (!spec || typeof spec !== 'object' || !['string', 'number', 'boolean', 'array', 'object'].includes(String((spec as { type?: string }).type))) {
        errors.push(`property « ${k} » : type non supporté`);
      }
      if ((spec as { enum?: unknown[] })?.enum && !Array.isArray((spec as { enum?: unknown[] }).enum)) {
        errors.push(`property « ${k} » : enum doit être un tableau`);
      }
    }
  }
  if (!Array.isArray(c.required)) errors.push('contract.required doit être un tableau');
  else if (c.properties && c.required.some((r) => !(r in c.properties!))) errors.push('contract.required référence un champ non déclaré');
  return { ok: errors.length === 0, errors };
}

// ── TR-3. BUILT-IN TOOLS (real handlers over the existing kernel) ──

export const BUILT_IN_TOOLS: (ToolDef & { handler: ToolHandler })[] = [
  {
    toolId: 'system.domains.list', name: 'Liste des domaines canoniques', version: '1.0.0',
    description: 'Retourne les 24 domaines constitutionnels avec leur statut d\u2019activation fondé sur preuves.',
    ownerDomain: '00', riskClass: 'READ_ONLY', executable: true,
    contract: { type: 'object', properties: { core: { type: 'boolean', description: 'Filtrer les domaines transverses' } }, required: [] },
    handler: async () => {
      const rows = await db.domain.findMany({ orderBy: { phase: 'asc' } });
      return rows.map((d) => ({ code: d.code, name: d.name, phase: d.phase, status: d.status, isCore: d.isCore }));
    },
  },
  {
    toolId: 'studio.runs.list', name: 'Liste des runs Studio', version: '1.0.0',
    description: 'Dernières livraisons Studio avec état pipeline et preuve live (lecture seule).',
    ownerDomain: '03', riskClass: 'READ_ONLY', executable: true,
    contract: { type: 'object', properties: { limit: { type: 'number', description: 'Nombre max (1-20)', minimum: 1, maximum: 20 } }, required: [] },
    handler: async (input) => {
      const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 20);
      const runs = await db.generationRun.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, runUid: true, state: true, stack: true, liveState: true, createdAt: true } });
      return runs;
    },
  },
  {
    toolId: 'sandbox.toolchains.detect', name: 'Détection des toolchains', version: '1.0.0',
    description: 'Sonde les toolchains installés sur l\u2019hôte (INV-190 : exécution versionnée).',
    ownerDomain: '10', riskClass: 'READ_ONLY', executable: true,
    contract: { type: 'object', properties: {}, required: [] },
    handler: async () => detectToolchains(),
  },
  {
    toolId: 'evidence.recent.list', name: 'Preuves récentes', version: '1.0.0',
    description: 'Derniers enregistrements de preuves de la chaîne hash-chaînée (lecture seule).',
    ownerDomain: '11', riskClass: 'READ_ONLY', executable: true,
    contract: { type: 'object', properties: { limit: { type: 'number', description: 'Nombre max (1-50)', minimum: 1, maximum: 50 } }, required: [] },
    handler: async (input) => {
      const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 50);
      const rows = await db.evidence.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { evidenceUid: true, category: true, criticality: true, claim: true, contentHash: true, createdAt: true } });
      return rows;
    },
  },
  {
    toolId: 'constitution.invariants.list', name: 'Invariants constitutionnels', version: '1.0.0',
    description: 'Liste les invariants globaux (INV-xxx) du contrat constitutionnel, filtrables par famille — la constitution lisible par les agents.',
    ownerDomain: '00', riskClass: 'READ_ONLY', executable: true,
    contract: {
      type: 'object',
      properties: {
        family: { type: 'string', description: 'Filtrer par famille (ex. SECURITY, POLICY)', maxLength: 40 },
        limit: { type: 'number', description: 'Nombre max (1-100)', minimum: 1, maximum: 100 },
      },
      required: [],
    },
    handler: async (input) => {
      const { INVARIANTS } = await import('./invariants');
      const family = typeof input.family === 'string' && input.family.length > 0 ? input.family : null;
      const limit = Math.min(Math.max(Number(input.limit ?? 100), 1), 100);
      return INVARIANTS
        .filter((i) => !family || i.family.toUpperCase() === family.toUpperCase())
        .slice(0, limit)
        .map((i) => ({ id: i.id, family: i.family, title: i.title, rule: i.rule }));
    },
  },
  {
    toolId: 'policy.decisions.recent', name: 'Décisions de politique récentes', version: '1.0.0',
    description: 'Dernières décisions du plan de contrôle de politique (ALLOW/DENY/REQUIRE_APPROVAL) — lecture seule, transparence INV-123.',
    ownerDomain: '12', riskClass: 'READ_ONLY', executable: true,
    contract: {
      type: 'object',
      properties: {
        effect: { type: 'string', description: 'Filtrer par effet', enum: ['ALLOW', 'DENY', 'REQUIRE_APPROVAL'] },
        limit: { type: 'number', description: 'Nombre max (1-50)', minimum: 1, maximum: 50 },
      },
      required: [],
    },
    handler: async (input) => {
      const effect = typeof input.effect === 'string' && ['ALLOW', 'DENY', 'REQUIRE_APPROVAL'].includes(input.effect) ? input.effect : null;
      const limit = Math.min(Math.max(Number(input.limit ?? 15), 1), 50);
      const rows = await db.policyDecision.findMany({
        where: effect ? { effect } : {},
        orderBy: { createdAt: 'desc' }, take: limit,
        select: { ruleId: true, request: true, effect: true, reason: true, decidedBy: true, createdAt: true },
      });
      return rows;
    },
  },
  {
    toolId: 'sandbox.cli.run', name: 'Commande de diagnostic sandbox', version: '1.0.0',
    description: 'Exécute une commande de diagnostic WHITELISTÉE dans le workspace sandbox. SIDE_EFFECT : refusée par défaut (INV-062) — autorisation gouvernée explicite requise.',
    ownerDomain: '10', riskClass: 'SIDE_EFFECT', executable: true,
    contract: { type: 'object', description: 'Aucune argv libre : seules des sondes whitelistées sont exécutables.', properties: { probe: { type: 'string', description: 'Sonde à exécuter', enum: ['uname', 'uptime', 'disk'] } }, required: ['probe'] },
    handler: async (input) => {
      const { runStep } = await import('./tool-executor');
      const argvByProbe: Record<string, string[]> = { uname: ['uname', '-a'], uptime: ['uptime'], disk: ['df', '-h', '/'] };
      const argv = argvByProbe[String(input.probe)];
      const step = await runStep(argv, { cwd: process.cwd(), timeoutMs: 10_000 });
      return { probe: input.probe, exitCode: step.exitCode, out: step.out.slice(0, 500), err: step.err.slice(0, 300) };
    },
  },
];

// ── TR-4. REGISTRY SYNC (built-ins seeded idempotently) ────────────

export async function syncBuiltInTools(): Promise<{ synced: number }> {
  for (const t of BUILT_IN_TOOLS) {
    await db.registeredTool.upsert({
      where: { toolId: t.toolId },
      create: {
        toolId: t.toolId, name: t.name, version: t.version, description: t.description,
        ownerDomain: t.ownerDomain, riskClass: t.riskClass,
        contract: JSON.stringify(t.contract), executable: true, active: true,
      },
      update: { executable: true, description: t.description, name: t.name },
    });
  }
  return { synced: BUILT_IN_TOOLS.length };
}

const SEMVER = /^\d+\.\d+\.\d+$/;
function versionRank(v: string): [number, number, number] {
  const m = v.split('.').map((x) => parseInt(x, 10));
  return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0];
}
function isDowngrade(current: string, next: string): boolean {
  const a = versionRank(current); const b = versionRank(next);
  return b[0] < a[0] || (b[0] === a[0] && b[1] < a[1]) || (b[0] === a[0] && b[1] === a[1] && b[2] < a[2]);
}

export async function registerTool(def: {
  toolId: string; name: string; version: string; description: string;
  ownerDomain?: string; riskClass: ToolRiskClass; contract: ToolContract;
}): Promise<{ ok: boolean; errors: string[]; created: boolean }> {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(def.toolId)) errors.push('toolId : format domaine.capabilité.verbe attendu (ex. tools.deploy.run)');
  if (!SEMVER.test(def.version)) errors.push('version : semver X.Y.Z attendu');
  const contractCheck = validateToolContract(def.contract);
  if (!contractCheck.ok) errors.push(...contractCheck.errors);
  if (def.riskClass !== 'READ_ONLY' && def.riskClass !== 'SIDE_EFFECT') errors.push('riskClass : READ_ONLY | SIDE_EFFECT');
  if (errors.length > 0) return { ok: false, errors, created: false };

  const existing = await db.registeredTool.findUnique({ where: { toolId: def.toolId } });
  if (existing) {
    if (existing.version === def.version) return { ok: false, errors: [`version ${def.version} déjà enregistrée pour ${def.toolId} — versions immuables (INV-190)`], created: false };
    if (isDowngrade(existing.version, def.version)) return { ok: false, errors: [`downgrade refusé : ${existing.version} → ${def.version} (INV-190 : versions monotones)`], created: false };
    await db.registeredTool.update({
      where: { toolId: def.toolId },
      data: {
        name: def.name, version: def.version, description: def.description,
        ownerDomain: def.ownerDomain ?? existing.ownerDomain, riskClass: def.riskClass,
        contract: JSON.stringify(def.contract), executable: false, active: true,
      },
    });
    emitYahriaEvent({ type: REALTIME_EVENT_TYPES.TOOL_REGISTERED, source: '09', severity: 'INFO', message: `Outil ${def.toolId} re-registré en v${def.version} (bump, handler non lié)`, payload: { toolId: def.toolId, version: def.version } });
    return { ok: true, errors: [], created: false };
  }
  await db.registeredTool.create({
    data: {
      toolId: def.toolId, name: def.name, version: def.version, description: def.description,
      ownerDomain: def.ownerDomain ?? '09', riskClass: def.riskClass,
      contract: JSON.stringify(def.contract), executable: false, active: true,
    },
  });
  emitYahriaEvent({ type: REALTIME_EVENT_TYPES.TOOL_REGISTERED, source: '09', severity: 'INFO', message: `Outil ${def.toolId} v${def.version} enregistré (déclaratif, non autorisé — INV-062)`, payload: { toolId: def.toolId, version: def.version, riskClass: def.riskClass } });
  return { ok: true, errors: [], created: true };
}

// ── TR-5. AUTHORIZATION GATE (INV-062 — every invocation re-checks) ─

const BUILT_IN_HANDLERS = new Map<string, ToolHandler>(BUILT_IN_TOOLS.map((t) => [t.toolId, t.handler]));

function resourceFor(riskClass: ToolRiskClass, toolId: string): string {
  return riskClass === 'READ_ONLY' ? `readonly.${toolId}` : `sideeffect.${toolId}`;
}

export async function authorizeInvoke(toolId: string, callerType: string, callerId: string): Promise<{ known: null | { riskClass: ToolRiskClass; version: string; executable: boolean }; auth: AuthorizationTrace }> {
  const row = await db.registeredTool.findUnique({ where: { toolId } });
  const rules = await db.policyRule.findMany({ where: { active: true } });
  const ruleDefs: PolicyRuleDef[] = rules.map((r) => {
    const cond = JSON.parse(r.condition) as { action: string; resource: string; actorType?: string; actorId?: string };
    return {
      ruleId: r.ruleId, name: r.name, effect: r.effect as PolicyRuleDef['effect'], scope: r.scope,
      action: cond.action, resource: cond.resource, priority: r.priority, active: r.active,
      reason: r.name, version: r.version,
      // fine-RBAC actor scope MUST survive the DB→engine hop (R13 — a scoped
      // rule that loses its scope becomes an unscoped grant: privilege leak)
      actorType: cond.actorType as PolicyRuleDef['actorType'],
      actorId: cond.actorId,
    };
  });
  if (!row || !row.active) {
    const auth0 = evaluatePolicy({ actorType: callerType as 'HUMAN' | 'AGENT' | 'SYSTEM', actorId: callerId, action: 'tool.execute', resource: `unregistered.${toolId}` }, ruleDefs);
    return { known: null, auth: { ...auth0, resourceRequested: `unregistered.${toolId}` } };
  }
  const riskClass = row.riskClass as ToolRiskClass;
  const auth = evaluatePolicy({ actorType: callerType as 'HUMAN' | 'AGENT' | 'SYSTEM', actorId: callerId, action: 'tool.execute', resource: resourceFor(riskClass, toolId) }, ruleDefs);
  return { known: { riskClass, version: row.version, executable: row.executable }, auth: { ...auth, resourceRequested: resourceFor(riskClass, toolId) } };
}

/** Governed authorization mutation — creates/deactivates an explicit ALLOW rule. */
export async function setToolAuthorization(toolId: string, allow: boolean, reason: string): Promise<{ ok: boolean; errors: string[]; ruleId: string | null }> {
  const row = await db.registeredTool.findUnique({ where: { toolId } });
  if (!row) return { ok: false, errors: [`outil ${toolId} inconnu du registre — rien à autoriser`], ruleId: null };
  if (row.riskClass === 'READ_ONLY') return { ok: false, errors: ['outil READ_ONLY déjà autorisé par POL-011 — mutation inutile'], ruleId: null };
  const ruleId = `POL-AUTH-${toolId.replace(/\./g, '-').toUpperCase()}`;
  if (!allow) {
    await db.policyRule.updateMany({ where: { ruleId }, data: { active: false } });
    emitYahriaEvent({ type: REALTIME_EVENT_TYPES.TOOL_AUTHORIZED, source: '09', severity: 'WARN', message: `Autorisation RÉVOQUÉE pour ${toolId} (${ruleId})`, payload: { toolId, allow: false } });
    return { ok: true, errors: [], ruleId };
  }
  await db.policyRule.upsert({
    where: { ruleId },
    create: {
      ruleId, name: `Autorisation explicite outil ${toolId} — ${reason.slice(0, 80)}`,
      effect: 'ALLOW', scope: 'TOOL', condition: JSON.stringify({ action: 'tool.execute', resource: `sideeffect.${toolId}` }),
      priority: 4, version: '1.0.0', active: true,
    },
    update: { active: true, name: `Autorisation explicite outil ${toolId} — ${reason.slice(0, 80)}` },
  });
  emitYahriaEvent({ type: REALTIME_EVENT_TYPES.TOOL_AUTHORIZED, source: '09', severity: 'WARN', message: `Outil SIDE_EFFECT ${toolId} AUTORISÉ par décision gouvernée (${ruleId}) — trace auditable`, payload: { toolId, allow: true, ruleId } });
  return { ok: true, errors: [], ruleId };
}

// ── TR-6. INVOKE (validate → authorize → execute → record) ─────────

const TOOL_TIMEOUT_MS = 10_000;
const RESULT_CAP = 20_000;

function cap(v: unknown): unknown {
  const s = JSON.stringify(v);
  if (s && s.length > RESULT_CAP) return { truncated: true, preview: s.slice(0, RESULT_CAP) };
  return v;
}

export async function invokeTool(params: {
  toolId: string; input: unknown;
  callerType: 'HUMAN' | 'AGENT' | 'SYSTEM'; callerId: string; traceId?: string;
}): Promise<InvokeOutcome> {
  const t0 = Date.now();
  const { toolId, input, callerType, callerId } = params;
  const base = { toolId, version: '—', validated: false, validationErrors: [] as string[], result: null as unknown, error: null as string | null, invocationId: null as string | null, evidenceUid: null as string | null, ms: 0 };

  const { known, auth } = await authorizeInvoke(toolId, callerType, callerId);
  await db.policyDecision.create({
    data: {
      ruleId: auth.matchedRule,
      request: JSON.stringify({ actorType: callerType, actorId: callerId, action: 'tool.execute', resource: auth.resourceRequested, trace: params.traceId ?? null }),
      effect: auth.effect, reason: auth.reason, decidedBy: 'POLICY_ENGINE',
    },
  });

  // GATE 1 — registration (unknown tools never reach execution)
  if (!known) {
    const verdict: InvokeOutcome = { ...base, version: '—', authorized: false, auth, ok: false, ms: Date.now() - t0, verdict: auth.effect === 'REQUIRE_APPROVAL' ? 'REQUIRE_APPROVAL' : 'DENIED' };
    emitYahriaEvent({ type: REALTIME_EVENT_TYPES.TOOL_DENIED, source: '09', severity: 'WARN', message: `Outil ${toolId} NON REGISTRÉ — ${auth.effect} (${auth.matchedRule ?? 'default-deny'})`, payload: { toolId } });
    return verdict;
  }
  // GATE 2 — authorization (REGISTERED ≠ AUTHORIZED)
  if (auth.effect !== 'ALLOW') {
    const verdict: InvokeOutcome = { ...base, version: known.version, authorized: false, auth, ok: false, ms: Date.now() - t0, verdict: auth.effect === 'REQUIRE_APPROVAL' ? 'REQUIRE_APPROVAL' : 'DENIED' };
    await captureAndPersist({
      category: 'TOOL', criticality: 'HIGH', actorType: callerType, actorId: callerId,
      claim: `Invocation REFUSÉE de ${toolId}@${known.version} — ${auth.effect} par ${auth.matchedRule ?? 'default-deny'} (INV-062 : REGISTERED ≠ AUTHORIZED)`,
      payload: { toolId, auth, input: input ?? null }, traceId: params.traceId,
    });
    emitYahriaEvent({ type: REALTIME_EVENT_TYPES.TOOL_DENIED, source: '09', severity: 'WARN', message: `Outil ${toolId} REFUSÉ — ${auth.effect} (${auth.matchedRule ?? 'default-deny'})`, payload: { toolId, matchedRule: auth.matchedRule } });
    const inv = await db.toolInvocation.create({
      data: { toolId, toolVersion: known.version, callerType, callerId, input: JSON.stringify(input ?? {}), authEffect: auth.effect, authRule: auth.matchedRule, ok: false, ms: verdict.ms, traceId: params.traceId },
    });
    return { ...verdict, invocationId: inv.id };
  }

  // GATE 3 — contract validation (S1, strict)
  const contract = JSON.parse((await db.registeredTool.findUnique({ where: { toolId } }))!.contract) as ToolContract;
  const v = validateToolInput(contract, input);
  if (!v.ok) {
    const verdict: InvokeOutcome = { ...base, version: known.version, authorized: true, auth, validationErrors: v.errors, ok: false, ms: Date.now() - t0, verdict: 'VALIDATION_FAILED' };
    emitYahriaEvent({ type: REALTIME_EVENT_TYPES.TOOL_INVOKED, source: '09', severity: 'WARN', message: `Outil ${toolId} : contrat violé (${v.errors.length} erreur(s)) — aucune exécution`, payload: { toolId, errors: v.errors } });
    const inv = await db.toolInvocation.create({
      data: { toolId, toolVersion: known.version, callerType, callerId, input: JSON.stringify(input ?? {}), authEffect: auth.effect, authRule: auth.matchedRule, ok: false, error: v.errors.join(' ; ').slice(0, 500), ms: verdict.ms, traceId: params.traceId },
    });
    return { ...verdict, invocationId: inv.id };
  }

  // GATE 4 — executable handler bound? (declarative registrations are honest: no fake run)
  const handler = BUILT_IN_HANDLERS.get(toolId);
  if (!known.executable || !handler) {
    const verdict: InvokeOutcome = { ...base, version: known.version, authorized: true, auth, ok: false, error: 'registration déclarative : aucun handler exécutable lié dans ce noyau (INV-210 : pas de fausse réussite)', ms: Date.now() - t0, verdict: 'EXECUTION_FAILED' };
    const inv = await db.toolInvocation.create({
      data: { toolId, toolVersion: known.version, callerType, callerId, input: JSON.stringify(input ?? {}), authEffect: auth.effect, authRule: auth.matchedRule, ok: false, error: verdict.error, ms: verdict.ms, traceId: params.traceId },
    });
    return { ...verdict, invocationId: inv.id };
  }

  // GATE 5 — bounded execution (INV-042)
  let result: unknown; let execErr: string | null = null; let ok = true;
  try {
    result = await Promise.race([
      handler(input as Record<string, unknown>),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT outil ${toolId} > ${TOOL_TIMEOUT_MS} ms (INV-042)`)), TOOL_TIMEOUT_MS)),
    ]);
  } catch (e) {
    ok = false; execErr = String(e instanceof Error ? e.message : e).slice(0, 500);
  }
  const ms = Date.now() - t0;
  const inv = await db.toolInvocation.create({
    data: { toolId, toolVersion: known.version, callerType, callerId, input: JSON.stringify(input ?? {}), result: ok ? JSON.stringify(cap(result)) : null, error: execErr, authEffect: auth.effect, authRule: auth.matchedRule, ok, ms, traceId: params.traceId },
  });
  const ev = await captureAndPersist({
    category: 'TOOL', criticality: ok ? 'STANDARD' : 'HIGH', actorType: callerType, actorId: callerId,
    claim: `Outil ${toolId}@${known.version} ${ok ? 'exécuté' : 'en échec'} par ${callerType}:${callerId} en ${ms} ms — auth ${auth.effect} (${auth.matchedRule})`,
    payload: { toolId, version: known.version, ok, ms, auth: { effect: auth.effect, rule: auth.matchedRule } }, traceId: params.traceId,
  });
  emitYahriaEvent({ type: REALTIME_EVENT_TYPES.TOOL_INVOKED, source: '09', severity: ok ? 'INFO' : 'WARN', message: `Outil ${toolId}@${known.version} ${ok ? 'INVOQUÉ ✓' : 'ÉCHEC ✗'} (${ms} ms)`, payload: { toolId, ok, ms, invocationId: inv.id } });
  return { toolId, version: known.version, authorized: true, auth, validated: true, validationErrors: [], ok, result: ok ? cap(result) : null, error: execErr, ms, invocationId: inv.id, evidenceUid: ev.uid, verdict: ok ? 'INVOKED' : 'EXECUTION_FAILED' };
}

export const TOOL_REGISTRY_ID = 'YAHRIA-KRN-025';
