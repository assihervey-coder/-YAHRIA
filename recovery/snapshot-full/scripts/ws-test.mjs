// ═══════════════════════════════════════════════════════════════
// YAHRIA — WebSocket end-to-end test (Domain 11)
// 1. Connects to ws://localhost:3000/ws/yahria (Node native client)
// 2. Asserts hello + snapshot frames
// 3. Triggers a policy decision via REST → asserts live event frame
// Usage: node scripts/ws-test.mjs
// ═══════════════════════════════════════════════════════════════

const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws/yahria';
const REST_BASE = process.env.REST_BASE || 'http://localhost:3000';

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const ws = new WebSocket(WS_URL);
const received = [];
let snapshotReceived = false;
let helloReceived = false;

const timeout = setTimeout(() => fail(`timeout — frames reçus: ${JSON.stringify(received.map((r) => r.kind))}`), 30000);

ws.onopen = async () => {
  console.log(`✓ connecté à ${WS_URL}`);
  // Small delay to let hello/snapshot arrive, then trigger a REST mutation
  setTimeout(async () => {
    try {
      const res = await fetch(`${REST_BASE}/api/yahria/policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorType: 'AGENT', actorId: 'ws-test-agent',
          action: 'filesystem.write', resource: 'workspace.overlay',
        }),
      });
      const json = await res.json();
      console.log(`✓ décision politique déclenchée via REST: effect=${json?.evaluation?.effect} (HTTP ${res.status})`);
    } catch (e) {
      fail(`échec déclenchement REST: ${e}`);
    }
  }, 1200);
};

ws.onmessage = (raw) => {
  let msg;
  try { msg = JSON.parse(String(raw.data)); } catch { return; }
  received.push(msg);

  if (msg.kind === 'hello') {
    helloReceived = true;
    console.log(`✓ hello reçu — system=${msg.system} domaine=${msg.domain} path=${msg.path}`);
  }
  if (msg.kind === 'snapshot') {
    snapshotReceived = true;
    console.log(`✓ snapshot reçu — ${msg.events?.length ?? 0} événement(s) historique(s)`);
  }
  if (msg.kind === 'event' && msg.event?.type === 'policy.decision') {
    console.log(`✓ événement temps réel reçu: ${msg.event.type} — ${msg.event.message}`);
    console.log(`  id=${msg.event.id} sévérité=${msg.event.severity} source=DOM ${msg.event.source}`);
    clearTimeout(timeout);
    ws.close();
    if (!helloReceived) fail('hello manquant');
    if (!snapshotReceived) fail('snapshot manquant');
    console.log('\n═══ TEST WEBSOCKET TEMPS RÉEL : PASS ═══');
    process.exit(0);
  }
};

ws.onerror = (e) => fail(`erreur websocket: ${e.message ?? e}`);
ws.onclose = (code) => console.log(`connexion fermée (code=${code})`);
