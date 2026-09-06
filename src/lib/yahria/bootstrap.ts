// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Bootstrap & Seed (Domain 00)
// Doc ID: YAHRIA-KRN-009 | Source: ROOT ZIP CONTRACT §3 BOOTSTRAP SEQUENCE
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { DOMAINS } from './domains';
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
  }

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
