// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Bootstrap & Seed (Domain 00)
// Doc ID: YAHRIA-KRN-009 | Source: ROOT ZIP CONTRACT §3 BOOTSTRAP SEQUENCE
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { DOMAINS, DOMAIN_ACTIVATIONS } from './domains';
import { CANONICAL_AGENTS } from './agent-os';
import { SEED_POLICY_RULES } from './policy-engine';

export async function bootstrap(): Promise<{ seeded: boolean; counts: Record<string, number> }> {
  // Idempotent bootstrap — safe to call on every load
  const domainCount = await db.domain.count();
  const agentCount = await db.agent.count();
  const policyCount = await db.policyRule.count();

  if (domainCount === 0) {
    await db.domain.createMany({
      data: DOMAINS.map((d) => ({
        code: d.code,
        name: d.name,
        purpose: d.purpose,
        phase: d.phase,
        isCore: d.isCore,
        status: d.phase <= 8 ? 'IMPLEMENTING' : 'NOT_STARTED',
      })),
    });
  }

  // Domain activation ledger — application IDEMPOTENTE à chaque bootstrap :
  // la DB déjà seedée rattrape le registre des preuves. Montée MONOTONE
  // NOT_STARTED → IMPLEMENTING uniquement (jamais de rétrogradation ;
  // la clôture DONE exigera une décision gouvernée D.6 avec preuves).
  for (const a of DOMAIN_ACTIVATIONS) {
    await db.domain.updateMany({
      where: { code: a.code, status: 'NOT_STARTED' },
      data: { status: 'IMPLEMENTING' },
    });
  }

  if (agentCount === 0) {
    for (const a of CANONICAL_AGENTS) {
      await db.agent.create({
        data: {
          key: a.key,
          name: a.name,
          role: a.role,
          capabilities: JSON.stringify(a.capabilities),
          autonomy: a.autonomy,
          status: 'IDLE',
        },
      });
    }
  }

  if (policyCount === 0) {
    await db.policyRule.createMany({
      data: SEED_POLICY_RULES.map((r) => ({
        ruleId: r.ruleId,
        name: r.name,
        effect: r.effect,
        scope: r.scope,
        condition: JSON.stringify({ action: r.action, resource: r.resource }),
        priority: r.priority,
        version: r.version,
        active: true,
      })),
    });
  } else {
    // Idempotent seed catch-up: new canonical rules (e.g. POL-011/012, D.09)
    // join an already-seeded DB without ever overwriting governed mutations
    // (an existing rule keeps its state; only missing ruleIds are created).
    for (const r of SEED_POLICY_RULES) {
      await db.policyRule.upsert({
        where: { ruleId: r.ruleId },
        create: {
          ruleId: r.ruleId, name: r.name, effect: r.effect, scope: r.scope,
          condition: JSON.stringify({ action: r.action, resource: r.resource }),
          priority: r.priority, version: r.version, active: true,
        },
        update: {}, // never mutate an existing governed rule here
      });
    }
  }

  // D.09 — Tool Registry: built-in tools are seeded/refreshed idempotently
  const { syncBuiltInTools } = await import('./tool-registry');
  await syncBuiltInTools();

  // Default tenant/organization/project hierarchy (INV-020/021/022)
  const tenantCount = await db.tenant.count();
  if (tenantCount === 0) {
    const tenant = await db.tenant.create({ data: { key: 'root', name: 'YAHRIA Root Tenant' } });
    const org = await db.organization.create({ data: { tenantId: tenant.id, name: 'YAHRIA Core Organization', slug: 'yahria-core' } });
    await db.project.create({
      data: {
        organizationId: org.id,
        name: 'YAHRIA Self-Implementation',
        slug: 'yahria-self',
        description: 'The canonical project through which YAHRIA implements itself under governance.',
      },
    });
  }

  const [d, a, p, t] = await Promise.all([
    db.domain.count(), db.agent.count(), db.policyRule.count(), db.tenant.count(),
  ]);
  return { seeded: true, counts: { domains: d, agents: a, policies: p, tenants: t } };
}

export async function ensureBootstrapped() {
  const c = await db.domain.count();
  if (c === 0) await bootstrap();
}
