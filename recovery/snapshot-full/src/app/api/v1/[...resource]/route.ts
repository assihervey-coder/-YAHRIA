// ═══════════════════════════════════════════════════════════════
// YAHRIA API — PUBLIC VERSIONED SURFACE (Domain 17, R14 / KRN-034)
//
//   GET  /api/v1/{system|domains|missions|tools|memory|evidence|roadmap|ops}
//   POST /api/v1/missions          { goal, strategy?, tasks? }   (scope write)
//
//   Gouvernance (INV-230) : Authorization: Bearer yah_live_…
//   - clé absente/inconnue → 401, révoquée → 401, hors scope → 403
//   - rate limit par clé (fenêtre 60 s), chaque appel journalisé
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/yahria/bootstrap';
import { verifyApiKey, scopeCovers, logV1Call, type ApiAuth } from '@/lib/yahria/api-gateway';
import { createMission } from '@/lib/yahria/mission-graph';

export const dynamic = 'force-dynamic';

const V1_API_VERSION = '1.0.0';

async function authenticate(req: Request, needed: 'read' | 'write'): Promise<{ auth: ApiAuth } | { response: NextResponse }> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  const auth = await verifyApiKey(token);
  if (!auth.ok) {
    return { response: NextResponse.json(
      { ok: false, error: auth.detail, failure: auth.failure },
      { status: auth.failure === 'RATE_LIMITED' ? 429 : 401, headers: { 'WWW-Authenticate': 'Bearer realm="yahria-v1"' } },
    ) };
  }
  if (!scopeCovers(auth.scopes, needed)) {
    return { response: NextResponse.json(
      { ok: false, error: `scope insuffisant — « ${needed} » requis, clé « ${auth.keyName} » porte [${(auth.scopes ?? []).join(', ')}]` },
      { status: 403 },
    ) };
  }
  return { auth };
}

export async function GET(req: Request, ctx: { params: Promise<{ resource: string[] }> }) {
  const t0 = Date.now();
  try {
    await ensureBootstrapped();
    const { resource } = await ctx.params;
    const path = (resource ?? []).join('/');
    const guard = await authenticate(req, 'read');
    if ('response' in guard) return guard.response;
    const auth = guard.auth;

    const { db } = await import('@/lib/db');
    let payload: Record<string, unknown>;
    switch (path) {
      case 'system': {
        const [domains, agents, tools, evidence] = await Promise.all([
          db.domain.findMany({ orderBy: { phase: 'asc' } }),
          db.agent.count(), db.registeredTool.count(), db.evidence.count(),
        ]);
        payload = {
          version: V1_API_VERSION,
          domains: domains.map((d) => ({ code: d.code, name: d.name, phase: d.phase, status: d.status, isCore: d.isCore })),
          counts: { agents, tools, evidence },
        };
        break;
      }
      case 'domains': {
        const domains = await db.domain.findMany({ orderBy: { phase: 'asc' } });
        payload = { version: V1_API_VERSION, domains: domains.map((d) => ({ code: d.code, name: d.name, purpose: d.purpose, phase: d.phase, status: d.status })) };
        break;
      }
      case 'missions': {
        const missions = await db.mission.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { tasks: { orderBy: { seq: 'asc' } } } });
        payload = {
          version: V1_API_VERSION,
          missions: missions.map((m) => ({ missionUid: m.missionUid, goal: m.goal, state: m.state, strategy: m.strategy, tasks: m.tasks.map((t) => ({ seq: t.seq, agentKey: t.agentKey, toolId: t.toolId, state: t.state })) })),
        };
        break;
      }
      case 'tools': {
        const tools = await db.registeredTool.findMany({ where: { active: true }, orderBy: { toolId: 'asc' } });
        payload = { version: V1_API_VERSION, tools: tools.map((t) => ({ toolId: t.toolId, name: t.name, version: t.version, riskClass: t.riskClass, executable: t.executable })) };
        break;
      }
      case 'memory': {
        const rows = await db.memoryRecord.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 });
        payload = { version: V1_API_VERSION, records: rows.map((r) => ({ kind: r.kind, key: r.key, validation: r.validation, confidence: r.confidence, source: r.source, updatedAt: r.updatedAt.toISOString() })) };
        break;
      }
      case 'evidence': {
        const rows = await db.evidence.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { evidenceUid: true, category: true, criticality: true, state: true, claim: true, contentHash: true, createdAt: true } });
        payload = { version: V1_API_VERSION, evidence: rows };
        break;
      }
      case 'ops': case 'health': {
        const { opsReport } = await import('@/lib/yahria/ops');
        payload = { version: V1_API_VERSION, report: await opsReport() };
        break;
      }
      case 'roadmap': {
        const { computeRoadmap } = await import('@/lib/yahria/roadmap');
        payload = { version: V1_API_VERSION, roadmap: await computeRoadmap() };
        break;
      }
      default:
        logV1Call({ keyName: auth.keyName ?? '?', resource: path || '(vide)', method: 'GET', status: 404, ms: Date.now() - t0 });
        return NextResponse.json({ ok: false, error: `ressource inconnue « ${path} » — surface v1 : system | domains | missions | tools | memory | evidence | ops | roadmap` }, { status: 404 });
    }
    logV1Call({ keyName: auth.keyName ?? '?', resource: path, method: 'GET', status: 200, ms: Date.now() - t0 });
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ resource: string[] }> }) {
  const t0 = Date.now();
  try {
    await ensureBootstrapped();
    const { resource } = await ctx.params;
    const path = (resource ?? []).join('/');
    const guard = await authenticate(req, 'write');
    if ('response' in guard) return guard.response;
    const auth = guard.auth;

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'corps JSON invalide' }, { status: 422 }); }

    if (path === 'missions') {
      const res = await createMission({
        goal: String(body.goal ?? ''),
        strategy: body.strategy ? String(body.strategy) : undefined,
        tasks: Array.isArray(body.tasks)
          ? (body.tasks as Record<string, unknown>[]).map((t) => ({
              title: String(t.title ?? ''), agentKey: String(t.agentKey ?? ''),
              toolId: String(t.toolId ?? ''), input: (t.input ?? {}) as Record<string, unknown>,
              dependsOn: Array.isArray(t.dependsOn) ? (t.dependsOn as number[]) : [],
            }))
          : undefined,
      });
      logV1Call({ keyName: auth.keyName ?? '?', resource: path, method: 'POST', status: res.status, ms: Date.now() - t0 });
      return NextResponse.json(res, { status: res.status });
    }
    logV1Call({ keyName: auth.keyName ?? '?', resource: path, method: 'POST', status: 404, ms: Date.now() - t0 });
    return NextResponse.json({ ok: false, error: `écriture v1 non supportée pour « ${path} » — seule POST missions existe (surface minimale, lecture par défaut)` }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
