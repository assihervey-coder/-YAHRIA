// ═══════════════════════════════════════════════════════════════
// YAHRIA API — LLM FABRIC ENDPOINT (Domain 08)
// GET  : provider statuses, effective order, breaker states (no network)
// POST : { action: 'ping',  provider?: ProviderId }   → connectivity probe
//        { action: 'order', order: ProviderId[] }      → runtime re-order
// INV-212 single route · INV-213 masked credentials only
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { effectiveOrder, pingProvider, providerStatuses, setRuntimeOrder, PROVIDER_IDS, type ProviderId } from '@/lib/yahria/llm-fabric';
import { db } from '@/lib/db';
import { emitYahriaEvent } from '@/lib/yahria/realtime';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const providers = providerStatuses();
    return NextResponse.json({
      ok: true,
      order: effectiveOrder(),
      providers,
      summary: {
        configured: providers.filter((p) => p.configured).length,
        total: providers.length,
        openBreakers: providers.filter((p) => p.breaker === 'OPEN').map((p) => p.id),
      },
      invariants: ['INV-080', 'INV-212', 'INV-213'],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const VALID_ACTIONS = ['ping', 'order'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { action?: string; provider?: string; order?: string[] } | null;
    const action = body?.action;
    if (!action || !(VALID_ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json(
        { ok: false, error: `action invalide — attendu: ${VALID_ACTIONS.join(' | ')} (422 constitutionnel)` },
        { status: 422 },
      );
    }

    if (action === 'order') {
      const order = Array.isArray(body?.order) ? body!.order! : [];
      const r = setRuntimeOrder(order);
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 });
      return NextResponse.json({
        ok: true,
        order: effectiveOrder(),
        note: "ordre runtime actif jusqu'au redémarrage (YAHRIA_LLM_ORDER reste l'autorité env)",
      });
    }

    // action === 'ping'
    const requested = body?.provider as ProviderId | undefined;
    if (requested && !(PROVIDER_IDS as string[]).includes(requested)) {
      return NextResponse.json({ ok: false, error: `fournisseur inconnu: ${requested} — valides: ${PROVIDER_IDS.join(', ')}` }, { status: 422 });
    }

    const result = await pingProvider(requested as ProviderId);
    const trace = result.attempts.map((a) => `${a.provider}:${a.ok ? `OK ${a.ms}ms` : `FAIL(${a.error ?? '?'})`}`).join(' | ');

    try {
      await db.systemEvent.create({
        data: {
          level: result.ok ? 'INFO' : 'WARNING',
          source: '08',
          kind: 'COGNITIVE',
          message: `LLM probe ${requested ?? 'chain'} → ${result.ok ? `${result.provider}:${result.model} (${result.ms} ms)` : 'échec chaîne complète'} [${trace}]`,
          correlationId: 'LLM-FABRIC',
        },
      });
    } catch {
      // journalisation best-effort — ne masque jamais le résultat de la sonde
    }
    emitYahriaEvent({
      type: result.ok ? 'llm.fabric.probe.ok' : 'llm.fabric.probe.failed',
      source: '08',
      severity: result.ok ? 'SUCCESS' : 'WARN',
      message: result.ok
        ? `Connecteur IA ${result.provider} opérationnel (${result.model}, ${result.ms} ms)`
        : `Sonde LLM en échec — ${trace}`,
      payload: { provider: result.provider, model: result.model, ms: result.ms, attempts: result.attempts },
    });

    return NextResponse.json({
      ok: result.ok,
      provider: result.provider,
      model: result.model,
      ms: result.ms,
      attempts: result.attempts,
      excerpt: result.ok ? result.text.slice(0, 120) : null,
      error: result.ok ? null : 'chaîne LLM épuisée — tous les fournisseurs tentés ont échoué (INV-210: échec explicite)',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
