// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — POLICY CONSOLE (Domain 12)
// Doc ID: YAHRIA-KRN-029 | R13
//
// Governed management of the policy rule base — fine-grained RBAC
// over tools, with three hard constitutional walls:
//
//   INV-219 — constitutional seed rules (POL-001..POL-012) are LOCKED:
//             never deleted, never deactivated, never weakened from
//             the console. Only governed rules (POL-C-*, POL-AUTH-*)
//             are mutable.
//   INV-220 — simulation and impact analysis are SIDE-EFFECT FREE:
//             nothing persisted, nothing flipped.
//   INV-121 — every mutation carries an explicit reason and emits an
//             auditable event; rules are never DELETED (deactivation
//             only) so the decision history stays explainable.
//
// Impact analysis composes with D.09: a candidate rule is evaluated
// against every registered tool's live resource to show exactly which
// authorizations would flip BEFORE the rule exists.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { SEED_POLICY_RULES, evaluatePolicy, type PolicyRuleDef } from './policy-engine';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

const CONSTITUTIONAL_IDS = new Set(SEED_POLICY_RULES.map((r) => r.ruleId));
const EFFECTS = ['ALLOW', 'DENY', 'REQUIRE_APPROVAL'] as const;
const SCOPES = ['TOOL', 'EXECUTION', 'FILESYSTEM', 'NETWORK', 'EVOLUTION', 'MODEL'] as const;
const ACTOR_TYPES = ['HUMAN', 'AGENT', 'SYSTEM', 'TOOL', 'MODEL'] as const;

export interface GovernedRuleInput {
  name: string;
  effect: string;
  scope: string;
  action: string;          // exact or wildcard, e.g. 'tool.execute'
  resource: string;        // exact or wildcard, e.g. 'sideeffect.sandbox.cli.run'
  priority: number;        // 1..100 — lower evaluated first
  actorType?: string;      // optional fine-RBAC actor scope
  actorId?: string;        // optional exact actor identity
  reason: string;          // mandatory governed justification (≥ 10 chars)
}

export interface RuleRow {
  id: string; ruleId: string; name: string; effect: string; scope: string;
  condition: { action: string; resource: string; actorType?: string; actorId?: string };
  priority: number; version: string; active: boolean;
  constitutional: boolean; createdAt: string;
}

function toRuleRow(r: {
  id: string; ruleId: string; name: string; effect: string; scope: string;
  condition: string; priority: number; version: string; active: boolean; createdAt: Date;
}): RuleRow {
  let cond: { action: string; resource: string; actorType?: string; actorId?: string } = { action: '', resource: '' };
  try { cond = JSON.parse(r.condition) as typeof cond; } catch { /* keep empty */ }
  return {
    id: r.id, ruleId: r.ruleId, name: r.name, effect: r.effect, scope: r.scope,
    condition: cond, priority: r.priority, version: r.version, active: r.active,
    constitutional: CONSTITUTIONAL_IDS.has(r.ruleId), createdAt: r.createdAt.toISOString(),
  };
}

async function liveRuleDefs(): Promise<PolicyRuleDef[]> {
  const rules = await db.policyRule.findMany({ where: { active: true } });
  return rules.map((r) => {
    const cond = JSON.parse(r.condition) as { action: string; resource: string; actorType?: string; actorId?: string };
    return {
      ruleId: r.ruleId, name: r.name, effect: r.effect as PolicyRuleDef['effect'],
      scope: r.scope, action: cond.action, resource: cond.resource,
      priority: r.priority, active: r.active, reason: r.name, version: r.version,
      actorType: cond.actorType as PolicyRuleDef['actorType'],
      actorId: cond.actorId,
    };
  });
}

// ── PC-1. READ STATE ────────────────────────────────────────────────

export async function policyConsoleState(): Promise<{
  ok: boolean;
  rules: RuleRow[];
  decisions: { id: string; ruleId: string | null; effect: string; reason: string; decidedBy: string; createdAt: string }[];
  counts: { total: number; constitutional: number; governed: number; active: number; inactive: number };
}> {
  const [rules, decisions] = await Promise.all([
    db.policyRule.findMany({ orderBy: [{ priority: 'asc' }, { ruleId: 'asc' }] }),
    db.policyDecision.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);
  const rows = rules.map(toRuleRow);
  return {
    ok: true, rules: rows,
    decisions: decisions.map((d) => ({
      id: d.id, ruleId: d.ruleId, effect: d.effect, reason: d.reason,
      decidedBy: d.decidedBy, createdAt: d.createdAt.toISOString(),
    })),
    counts: {
      total: rows.length,
      constitutional: rows.filter((r) => r.constitutional).length,
      governed: rows.filter((r) => !r.constitutional).length,
      active: rows.filter((r) => r.active).length,
      inactive: rows.filter((r) => !r.active).length,
    },
  };
}

// ── PC-2. GOVERNED MUTATIONS ────────────────────────────────────────

export async function createGovernedRule(input: GovernedRuleInput): Promise<{ ok: boolean; errors: string[]; rule: RuleRow | null }> {
  const errors: string[] = [];
  const name = input.name?.trim() ?? '';
  const action = input.action?.trim() ?? '';
  const resource = input.resource?.trim() ?? '';
  const reason = input.reason?.trim() ?? '';
  if (name.length < 3) errors.push('nom : au moins 3 caractères');
  if (!EFFECTS.includes(input.effect as typeof EFFECTS[number])) errors.push(`effet : ${EFFECTS.join(' | ')}`);
  if (!SCOPES.includes(input.scope as typeof SCOPES[number])) errors.push(`scope : ${SCOPES.join(' | ')}`);
  if (!/^[a-z][a-z0-9._*]*$/.test(action)) errors.push('action : format pointu attendu (ex. tool.execute, fs.*)');
  if (!/^[a-z0-9][a-z0-9._*\-]*$/.test(resource)) errors.push('resource : format attendu (ex. sideeffect.sandbox.cli.run, readonly.*)');
  if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 100) errors.push('priorité : entier 1..100');
  if (reason.length < 10) errors.push('raison : justification gouvernée obligatoire (≥ 10 caractères — INV-121)');
  if (input.actorType !== undefined && !ACTOR_TYPES.includes(input.actorType as typeof ACTOR_TYPES[number])) {
    errors.push(`actorType : ${ACTOR_TYPES.join(' | ')}`);
  }
  if (input.actorId !== undefined && (typeof input.actorId !== 'string' || input.actorId.trim().length < 2)) {
    errors.push('actorId : identité d\'au moins 2 caractères');
  }
  if (errors.length > 0) return { ok: false, errors, rule: null };

  // Unique governed ruleId — POL-C-<seq>
  let seq = await db.policyRule.count({ where: { ruleId: { startsWith: 'POL-C-' } } });
  let ruleId = `POL-C-${String(seq + 1).padStart(3, '0')}`;
  while (await db.policyRule.findUnique({ where: { ruleId } })) {
    seq += 1;
    ruleId = `POL-C-${String(seq + 1).padStart(3, '0')}`;
  }

  const condition: { action: string; resource: string; actorType?: string; actorId?: string } = { action, resource };
  if (input.actorType) condition.actorType = input.actorType;
  if (input.actorId) condition.actorId = input.actorId.trim();

  const created = await db.policyRule.create({
    data: {
      ruleId, name: name.slice(0, 120),
      effect: input.effect, scope: input.scope,
      condition: JSON.stringify(condition),
      priority: input.priority, version: '1.0.0', active: true,
    },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.POLICY_RULE_CREATED, source: '12', severity: 'WARN',
    message: `Règle gouvernée ${ruleId} créée — ${input.effect} ${action} → ${resource}${condition.actorType ? ` (acteur ${condition.actorType}${condition.actorId ? ':' + condition.actorId : ''})` : ''}`,
    payload: { ruleId, effect: input.effect, action, resource, actorType: condition.actorType ?? null, actorId: condition.actorId ?? null },
  });
  await captureAndPersist({
    category: 'POLICY', criticality: 'HIGH', actorType: 'HUMAN', actorId: 'yahria-operator',
    claim: `Règle gouvernée ${ruleId} créée : ${input.effect} sur ${action} → ${resource}`,
    payload: { ruleId, name, effect: input.effect, scope: input.scope, condition, priority: input.priority, reason },
  });
  return { ok: true, errors: [], rule: toRuleRow(created) };
}

export async function toggleRule(ruleId: string, active: boolean, reason: string): Promise<{ ok: boolean; errors: string[]; rule: RuleRow | null }> {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < 10) return { ok: false, errors: ['raison : justification gouvernée obligatoire (≥ 10 caractères)'], rule: null };
  if (CONSTITUTIONAL_IDS.has(ruleId)) {
    return { ok: false, errors: [`règle constitutionnelle ${ruleId} verrouillée — jamais désactivée ni affaiblie depuis la console (INV-219)`], rule: null };
  }
  const row = await db.policyRule.findUnique({ where: { ruleId } });
  if (!row) return { ok: false, errors: [`règle ${ruleId} inconnue`], rule: null };
  if (!ruleId.startsWith('POL-C-') && !ruleId.startsWith('POL-AUTH-')) {
    return { ok: false, errors: [`seules les règles gouvernées (POL-C-*, POL-AUTH-*) sont mutables — ${ruleId} hors périmètre (INV-219)`], rule: null };
  }
  const updated = await db.policyRule.update({ where: { ruleId }, data: { active } });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.POLICY_RULE_TOGGLED, source: '12', severity: 'WARN',
    message: `Règle ${ruleId} ${active ? 'ACTIVÉE' : 'DÉSACTIVÉE'} — ${trimmed.slice(0, 100)}`,
    payload: { ruleId, active },
  });
  await captureAndPersist({
    category: 'POLICY', criticality: 'HIGH', actorType: 'HUMAN', actorId: 'yahria-operator',
    claim: `Règle ${ruleId} ${active ? 'activée' : 'désactivée'} — ${trimmed.slice(0, 120)}`,
    payload: { ruleId, active, reason: trimmed },
  });
  return { ok: true, errors: [], rule: toRuleRow(updated) };
}

// ── PC-3. SIMULATION (side-effect free — INV-220) ───────────────────

export interface SimulationRequest {
  actorType: 'HUMAN' | 'AGENT' | 'SYSTEM';
  actorId: string;
  action: string;
  resource: string;
}

export async function simulatePolicy(req: SimulationRequest): Promise<{
  ok: boolean; effect: string; matchedRule: string | null; reason: string; precedence: string;
  note: string;
}> {
  const rules = await liveRuleDefs();
  const verdict = evaluatePolicy(
    { actorType: req.actorType, actorId: req.actorId, action: req.action, resource: req.resource },
    rules,
  );
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.POLICY_SIMULATED, source: '12', severity: 'INFO',
    message: `Simulation ${req.actorType}:${req.actorId} ${req.action} → ${req.resource} ⇒ ${verdict.effect} (${verdict.matchedRule ?? 'default-deny'}) — aucun effet persisté`,
    payload: { effect: verdict.effect, matchedRule: verdict.matchedRule },
  });
  return {
    ok: true, effect: verdict.effect, matchedRule: verdict.matchedRule,
    reason: verdict.reason, precedence: verdict.precedence,
    note: 'Simulation SANS EFFET DE BORD (INV-220) — aucune décision persistée, aucune autorisation modifiée.',
  };
}

// ── PC-4. IMPACT ANALYSIS (rule draft vs live registry) ─────────────

export type RuleDraft = GovernedRuleInput;

export interface ImpactFlip {
  toolId: string;
  riskClass: string;
  before: string;
  after: string;
  flips: boolean;
}

export async function impactAnalysis(draft: RuleDraft): Promise<{
  ok: boolean; errors: string[]; flips: ImpactFlip[]; wouldFlip: number; note: string;
}> {
  // Validate the same way create does, but WITHOUT persisting anything (INV-220)
  const probe = await createGovernedRuleDraftValidation(draft);
  if (probe.length > 0) return { ok: false, errors: probe, flips: [], wouldFlip: 0, note: 'brouillon invalide — aucune analyse' };

  const tools = await db.registeredTool.findMany({ where: { active: true } });
  const live = await liveRuleDefs();
  const draftDef: PolicyRuleDef = {
    ruleId: 'DRAFT', name: draft.name, effect: draft.effect as PolicyRuleDef['effect'],
    scope: draft.scope, action: draft.action, resource: draft.resource,
    priority: draft.priority, active: true, reason: 'draft', version: 'draft',
    actorType: draft.actorType as PolicyRuleDef['actorType'],
    actorId: draft.actorId,
  };
  const flips: ImpactFlip[] = tools.map((t) => {
    const resource = t.riskClass === 'READ_ONLY' ? `readonly.${t.toolId}` : `sideeffect.${t.toolId}`;
    const before = evaluatePolicy({ actorType: 'AGENT', actorId: 'impact-probe', action: 'tool.execute', resource }, live).effect;
    const after = evaluatePolicy({ actorType: 'AGENT', actorId: 'impact-probe', action: 'tool.execute', resource }, [...live, draftDef]).effect;
    return { toolId: t.toolId, riskClass: t.riskClass, before, after, flips: before !== after };
  });
  return {
    ok: true, errors: [], flips,
    wouldFlip: flips.filter((f) => f.flips).length,
    note: 'Analyse d’impact SANS PERSISTANCE (INV-220) — le brouillon n’existe pas encore : seules les autorisations SIMULÉES changent.',
  };
}

async function createGovernedRuleDraftValidation(input: GovernedRuleInput): Promise<string[]> {
  const errors: string[] = [];
  const action = input.action?.trim() ?? '';
  const resource = input.resource?.trim() ?? '';
  const reason = input.reason?.trim() ?? '';
  if ((input.name?.trim() ?? '').length < 3) errors.push('nom : au moins 3 caractères');
  if (!EFFECTS.includes(input.effect as typeof EFFECTS[number])) errors.push(`effet : ${EFFECTS.join(' | ')}`);
  if (!SCOPES.includes(input.scope as typeof SCOPES[number])) errors.push(`scope : ${SCOPES.join(' | ')}`);
  if (!/^[a-z][a-z0-9._*]*$/.test(action)) errors.push('action : format pointu attendu');
  if (!/^[a-z0-9][a-z0-9._*\-]*$/.test(resource)) errors.push('resource : format attendu');
  if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 100) errors.push('priorité : entier 1..100');
  if (reason.length < 10) errors.push('raison : justification gouvernée obligatoire (≥ 10 caractères)');
  if (input.actorType !== undefined && !ACTOR_TYPES.includes(input.actorType as typeof ACTOR_TYPES[number])) errors.push('actorType invalide');
  return errors;
}

export const POLICY_CONSOLE_ID = 'YAHRIA-KRN-029';
