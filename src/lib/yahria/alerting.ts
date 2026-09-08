// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — EXTERNAL ALERTING (Domain 22) — KRN-039 · R15
//
// L'alerting ferme la frontière D.22 documentée en R14 : la santé
// mesurée (INV-233) est désormais PROPAGÉE vers un canal externe.
//
//   - 3 règles déterministes sur le rapport ops (READINESS_RED,
//     SLO_DEGRADED, FAILURE_SPIKE) — jamais d'heuristique libre.
//   - Livraison webhook POST JSON, timeout 5 s (INV-042), signature
//     HMAC-SHA256 (X-Yahria-Signature) quand un secret est configuré.
//   - Canal non configuré → delivery NOT_CONFIGURED archivé — une
//     alerte n'est jamais silencieusement abandonnée (INV-210/236).
//   - Anti-tempête : déduplication gouvernée par kind, fenêtre 10 min
//     — chaque évaluation est un fait archivé (INV-236).
//   - Mode SIMULATION étiqueté (esprit INV-220) : un rapport injecté
//     pour test ne déclenche qu'une alerte clairement marquée.
// ═══════════════════════════════════════════════════════════════

import { createHmac, randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';
import type { OpsReport } from './ops';

export const ALERTING_MODULE_ID = 'YAHRIA-KRN-039';

const DEDUP_WINDOW_MS = 10 * 60_000;
const WEBHOOK_TIMEOUT_MS = 5_000;

export type AlertKind = 'READINESS_RED' | 'SLO_DEGRADED' | 'FAILURE_SPIKE';
export type AlertSeverity = 'WARN' | 'CRITICAL';

export interface AlertDraft {
  kind: AlertKind; severity: AlertSeverity;
  title: string; detail: string;
  payload: Record<string, unknown>;
}

// ── Règles déterministes — mêmes seuils documentés partout ─────────
export const ALERT_RULES = [
  { kind: 'READINESS_RED', severity: 'CRITICAL', rule: 'au moins une sonde readiness rouge (INV-233)' },
  { kind: 'SLO_DEGRADED', severity: 'WARN', rule: 'taux de succès outils < 0.80 sur ≥ 10 échantillons (24 h)' },
  { kind: 'FAILURE_SPIKE', severity: 'WARN', rule: '≥ 10 FailureEvent enregistrés sur la fenêtre 24 h' },
] as const;

export function deriveAlerts(report: OpsReport): AlertDraft[] {
  const drafts: AlertDraft[] = [];

  const redProbes = report.readiness.probes.filter((p) => !p.ok);
  if (redProbes.length > 0) {
    drafts.push({
      kind: 'READINESS_RED', severity: 'CRITICAL',
      title: `Readiness rouge — ${redProbes.length} sonde(s) en échec`,
      detail: redProbes.map((p) => `${p.id} : ${p.detail}`).join(' ; ').slice(0, 400),
      payload: { probes: report.readiness.probes },
    });
  }

  const inv = report.slo.toolInvocations;
  if (inv.total >= 10 && inv.successRate !== null && inv.successRate < 0.8) {
    drafts.push({
      kind: 'SLO_DEGRADED', severity: 'WARN',
      title: `SLO dégradé — succès outils ${(inv.successRate * 100).toFixed(1)}% (${inv.total} échantillons)`,
      detail: `Taux de succès ${(inv.successRate * 100).toFixed(1)}% < seuil 80% sur ${inv.total} invocations 24 h — p50 ${inv.p50Ms} ms, p95 ${inv.p95Ms} ms.`,
      payload: { toolInvocations: inv },
    });
  }

  if (report.slo.failures >= 10) {
    drafts.push({
      kind: 'FAILURE_SPIKE', severity: 'WARN',
      title: `Pic d'échecs — ${report.slo.failures} FailureEvent (24 h)`,
      detail: `${report.slo.failures} échecs enregistrés sur la fenêtre 24 h (seuil 10) — forensics D.11 requis avant tout retry aveugle (INV-092).`,
      payload: { failures: report.slo.failures },
    });
  }

  return drafts;
}

export interface AlertDeliveryResult {
  kind: AlertKind; uid: string; delivery: 'SENT' | 'NOT_CONFIGURED' | 'DEDUP_SKIPPED' | 'FAILED';
  deliveryMs: number | null; simulated: boolean;
}

export async function evaluateAndDispatchAlerts(input: {
  report: OpsReport;
  simulated?: boolean;
  webhookUrl?: string; // override gouverné (console/tests) — sinon env
  webhookSecret?: string;
  actorId?: string;
}): Promise<{ evaluated: number; channelConfigured: boolean; results: AlertDeliveryResult[] }> {
  const simulated = input.simulated === true;
  const url = String(input.webhookUrl ?? process.env.YAHRIA_ALERT_WEBHOOK_URL ?? '').trim();
  const secret = String(input.webhookSecret ?? process.env.YAHRIA_ALERT_WEBHOOK_SECRET ?? '').trim();
  const drafts = deriveAlerts(input.report);
  const results: AlertDeliveryResult[] = [];

  for (const d of drafts) {
    const kind: AlertKind = d.kind;
    const title = simulated ? `[SIMULATION] ${d.title}` : d.title;
    const uid = `ALR-${randomUUID().slice(0, 12)}`;

    // Anti-tempête (INV-236) : même kind dans la fenêtre → skip archivé.
    const recent = await db.alertEvent.findFirst({
      where: { kind, createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      const uid = `ALR-${randomUUID().slice(0, 12)}`;
      await db.alertEvent.create({
        data: {
          uid, kind, severity: d.severity, title,
          detail: `dédupliqué — ${recent.uid} déjà livré pour ce kind dans la fenêtre 10 min`,
          payloadJson: JSON.stringify({ dedupOf: recent.uid, simulated }),
          delivery: 'DEDUP_SKIPPED', deliveredOk: null, deliveryMs: null,
        },
      });
      results.push({ kind, uid, delivery: 'DEDUP_SKIPPED', deliveryMs: null, simulated });
      continue;
    }

    let delivery: AlertDeliveryResult['delivery'] = 'NOT_CONFIGURED';
    let deliveredOk: boolean | null = null;
    let deliveryMs: number | null = null;

    if (url) {
      const t0 = Date.now();
      const body = JSON.stringify({
        uid, kind, severity: d.severity, title, detail: d.detail,
        simulated,
        payload: { ...d.payload, simulated },
        source: 'YAHRIA-CODE-OS', module: ALERTING_MODULE_ID,
        at: new Date().toISOString(),
      });
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Yahria-Alert': kind };
      if (secret) {
        headers['X-Yahria-Signature'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
      }
      let res: Response | null = null;
      try {
        res = await fetch(url, {
          method: 'POST', headers, body,
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS), // INV-042
        });
      } catch {
        res = null; // timeout, DNS, connexion refusée — le fait est archivé ci-dessous
      }
      deliveryMs = Date.now() - t0;
      deliveredOk = res ? res.ok : false;
      delivery = res ? (res.ok ? 'SENT' : 'FAILED') : 'FAILED';
    }

    await db.alertEvent.create({
      data: {
        uid, kind, severity: d.severity, title,
        detail: d.detail.slice(0, 500),
        payloadJson: JSON.stringify({ ...d.payload, simulated }).slice(0, 4000),
        delivery, deliveredOk, deliveryMs,
      },
    });

    const evidence = await captureAndPersist({
      category: 'INCIDENT', criticality: d.severity === 'CRITICAL' ? 'HIGH' : 'STANDARD',
      actorType: 'SYSTEM', actorId: input.actorId ?? 'alerting',
      claim: `${simulated ? 'ALERTE SIMULÉE' : 'ALERTE'} ${kind} — ${title} — delivery ${delivery}${deliveryMs !== null ? ` (${deliveryMs} ms)` : ''}`,
      payload: { uid, kind, delivery, simulated },
    });
    emitYahriaEvent({
      type: REALTIME_EVENT_TYPES.ALERT_RAISED, source: '22',
      severity: d.severity === 'CRITICAL' ? 'CRITICAL' : 'WARN',
      message: `${title} → ${delivery}`,
      payload: { uid, kind, delivery, evidenceUid: evidence.uid, simulated },
    });

    results.push({ kind, uid, delivery, deliveryMs, simulated });
  }

  return { evaluated: drafts.length, channelConfigured: Boolean(url), results };
}

export async function listAlerts(take = 30) {
  const alerts = await db.alertEvent.findMany({ orderBy: { createdAt: 'desc' }, take });
  return alerts.map((a) => ({
    uid: a.uid, kind: a.kind, severity: a.severity, title: a.title,
    detail: a.detail, delivery: a.delivery, deliveredOk: a.deliveredOk,
    deliveryMs: a.deliveryMs, simulated: (() => { try { return JSON.parse(a.payloadJson)?.simulated === true; } catch { return false; } })(),
    createdAt: a.createdAt.toISOString(),
  }));
}
