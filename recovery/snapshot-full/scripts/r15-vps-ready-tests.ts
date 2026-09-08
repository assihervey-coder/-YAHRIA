// ═══════════════════════════════════════════════════════════════
// R15 PROOF SUITE — VPS-READY : rate limit persisté (INV-235) +
// alerting externe signé (KRN-039 / INV-236). Faits mesurés contre
// l'API live (INV-080) :
//
//   bun run scripts/r15-vps-ready-tests.ts
// ═══════════════════════════════════════════════════════════════

import { createHmac } from 'crypto';
import { createServer } from 'http';

const BASE = process.env.YAHRIA_BASE ?? 'http://localhost:3000';
let passed = 0, failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function get(path: string, headers?: Record<string, string>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
async function post(path: string, body?: Record<string, unknown>, headers?: Record<string, string>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function fakeReport(mod: Partial<any>): any {
  const okProbe = { id: 'OK', ok: true, detail: 'ok', ms: 0 };
  return {
    liveness: { ok: true, pid: 1, uptimeSec: 1, rssMb: 1, at: new Date().toISOString() },
    readiness: { ok: true, probes: [okProbe, okProbe, okProbe, okProbe] },
    slo: {
      windowHours: 24,
      toolInvocations: { total: 0, successRate: null, p50Ms: null, p95Ms: null },
      agentRuns: { total: 0, completedRate: null },
      failures: 0,
    },
    version: { constitution: 'V1.0.0', node: process.version, sandboxBackend: 'process', providers: 7 },
    ...mod,
  };
}

const RED_REPORT = fakeReport({
  readiness: {
    ok: false,
    probes: [
      { id: 'DATABASE', ok: false, detail: 'base injoignable (simulée)', ms: 1 },
      { id: 'REALTIME_BUS', ok: true, detail: 'ok', ms: 0 },
      { id: 'SANDBOX_BACKEND', ok: true, detail: 'ok', ms: 0 },
      { id: 'LLM_FABRIC', ok: true, detail: 'ok', ms: 0 },
    ],
  },
});
const SLO_REPORT = fakeReport({
  slo: { windowHours: 24, toolInvocations: { total: 50, successRate: 0.6, p50Ms: 120, p95Ms: 480 }, agentRuns: { total: 0, completedRate: null }, failures: 0 },
});
const SPIKE_REPORT = fakeReport({
  slo: { windowHours: 24, toolInvocations: { total: 30, successRate: 0.9, p50Ms: 20, p95Ms: 90 }, agentRuns: { total: 0, completedRate: null }, failures: 12 },
});

async function main(): Promise<void> {
  console.log(`\nR15 — VPS-ready (rate limit DB + alerting) · cible ${BASE}\n`);

  // ══ A. D.17 — RATE LIMIT PERSISTÉ (INV-235) ═══════════════════
  console.log('── A. Rate limit en base (fenêtre glissante partagée) ──');
  const rl = await post('/api/yahria/apikeys', { name: 'r15-rl-minimal', scopes: ['read'], rateLimitPerMin: 5 });
  check('émission clé rate 5/min', rl.status === 201 && rl.json.key?.plaintext?.startsWith('yah_live_'));
  const RLKEY = rl.json.key.plaintext;
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await get('/api/v1/system', { Authorization: `Bearer ${RLKEY}` });
    statuses.push(r.status);
  }
  check('appels 1-5 acceptés (200)', statuses.slice(0, 5).every((s) => s === 200), JSON.stringify(statuses));
  check('appel 6 refusé (429) — frontière exacte en DB', statuses[5] === 429, `obtenu ${statuses[5]}`);

  const rlBig = await post('/api/yahria/apikeys', { name: 'r15-rl-large', scopes: ['read'], rateLimitPerMin: 600 });
  const BIGKEY = rlBig.json.key.plaintext;
  const bigStatuses: number[] = [];
  for (let i = 0; i < 3; i++) bigStatuses.push((await get('/api/v1/system', { Authorization: `Bearer ${BIGKEY}` })).status);
  check('clé 600/min : aucun faux positif', bigStatuses.every((s) => s === 200), JSON.stringify(bigStatuses));

  console.log('  ⏳ attente 62 s — preuve du reset de fenêtre par faits DB (pas un sleep magique, un fait mesuré)…');
  await new Promise((r) => setTimeout(r, 62_000));
  const after = await get('/api/v1/system', { Authorization: `Bearer ${RLKEY}` });
  check('après 62 s : fenêtre révolue → 200 (reset mesuré)', after.status === 200, `obtenu ${after.status}`);

  // ══ B. D.22 — ALERTING EXTERNE (KRN-039 / INV-236) ════════════
  console.log('── B. Alerting externe — 4 livraisons possibles, toutes prouvées ──');

  const idx = await get('/api/yahria/alerts');
  check('index alerting : module + 3 règles documentées', idx.status === 200 && idx.json.module === 'YAHRIA-KRN-039' && idx.json.rules?.length === 3);
  check('état du canal honnête (env non configurée ici)', idx.json.channelConfigured === false);

  // B1 — canal non configuré → NOT_CONFIGURED (jamais un abandon silencieux)
  const b1 = await post('/api/yahria/alerts', { action: 'evaluate', report: SPIKE_REPORT });
  check('SIMULATION FAILURE_SPIKE sans canal → NOT_CONFIGURED archivé',
    b1.status === 200 && b1.json.simulated === true && b1.json.results?.[0]?.delivery === 'NOT_CONFIGURED',
    JSON.stringify(b1.json.results ?? b1.json));

  // B2 — récepteur down → FAILED (fait archivé, latence mesurée)
  const b2 = await post('/api/yahria/alerts', { action: 'evaluate', report: SLO_REPORT, webhookUrl: 'http://127.0.0.1:39999/hook' });
  check('SIMULATION SLO_DEGRADED vers port mort → FAILED + latence mesurée',
    b2.json.results?.[0]?.delivery === 'FAILED' && typeof b2.json.results?.[0]?.deliveryMs === 'number',
    JSON.stringify(b2.json.results ?? b2.json));

  // B3 — récepteur réel → SENT + signature HMAC vérifiée côté récepteur
  const SECRET = 'r15-webhook-secret';
  const received: { headers: Record<string, string>; body: string }[] = [];
  const srv = createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      received.push({ headers: req.headers as Record<string, string>, body: b });
      res.writeHead(200); res.end('ok');
    });
  });
  await new Promise<void>((resolve) => srv.listen(3941, '127.0.0.1', resolve));
  const b3 = await post('/api/yahria/alerts', { action: 'evaluate', report: RED_REPORT, webhookUrl: 'http://127.0.0.1:3941/hook', webhookSecret: SECRET });
  const sent = b3.json.results?.find((r: any) => r.delivery === 'SENT');
  check('SIMULATION READINESS_RED vers récepteur réel → SENT', Boolean(sent), JSON.stringify(b3.json.results ?? b3.json));
  check('récepteur a reçu exactement 1 webhook', received.length === 1, `obtenu ${received.length}`);
  if (received.length === 1) {
    const payload = JSON.parse(received[0].body);
    const expectedSig = `sha256=${createHmac('sha256', SECRET).update(received[0].body).digest('hex')}`;
    check('signature X-Yahria-Signature = HMAC-SHA256(secret, body)', received[0].headers['x-yahria-signature'] === expectedSig,
      `attendu ${expectedSig.slice(0, 20)}… obtenu ${(received[0].headers['x-yahria-signature'] ?? 'absente').slice(0, 20)}…`);
    check('payload cohérent : uid correspondant, kind, étiquette SIMULATION (top-level + nested)',
      payload.uid === sent.uid && payload.kind === 'READINESS_RED' && payload.simulated === true && payload.title.startsWith('[SIMULATION]'),
      `uid body=${payload.uid} / resp=${sent.uid} · kind=${payload.kind} · sim=${payload.simulated}`);
  }

  // B4 — anti-tempête : même kind à nouveau → DEDUP_SKIPPED (INV-236)
  const b4 = await post('/api/yahria/alerts', { action: 'evaluate', report: RED_REPORT, webhookUrl: 'http://127.0.0.1:3941/hook', webhookSecret: SECRET });
  check('ré-évaluation immédiate même kind → DEDUP_SKIPPED (anti-tempête)',
    b4.json.results?.[0]?.delivery === 'DEDUP_SKIPPED' && received.length === 1,
    JSON.stringify(b4.json.results ?? b4.json));
  srv.close();

  // B5 — archivage complet vérifié
  const b5 = await get('/api/yahria/alerts');
  const byDelivery = (d: string) => b5.json.alerts.filter((a: any) => a.delivery === d).length;
  check('archivage : NOT_CONFIGURED, FAILED, SENT, DEDUP_SKIPPED tous présents',
    byDelivery('NOT_CONFIGURED') >= 1 && byDelivery('FAILED') >= 1 && byDelivery('SENT') >= 1 && byDelivery('DEDUP_SKIPPED') >= 1,
    JSON.stringify({ nc: byDelivery('NOT_CONFIGURED'), f: byDelivery('FAILED'), s: byDelivery('SENT'), dd: byDelivery('DEDUP_SKIPPED') }));
  check('alerte SENT porte uid ALR-… et latence', b5.json.alerts.some((a: any) => a.delivery === 'SENT' && a.uid.startsWith('ALR-') && typeof a.deliveryMs === 'number'));

  console.log(`\nR15 — ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('Suite R15 interrompue :', e); process.exit(1); });
export {}; // module scope — evite les collisions globales avec les autres suites sous tsc
