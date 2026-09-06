// ═══════════════════════════════════════════════════════════════
// YAHRIA — Custom Server with real-time WebSocket fan-out
// Domain 11 (Execution Observability) → WS endpoint: /ws/yahria
//
// Runs Next.js (dev or prod) AND a WebSocket server in the SAME
// process, so route handlers (src/lib/yahria/realtime.ts) and this
// server share the globalThis.__yahriaRealtime bus. Shapes MUST
// stay identical to the contract documented in realtime.ts.
//
// Start:  node server.mjs          (NODE_ENV unset → dev)
// Prod :  NODE_ENV=production node server.mjs   (after next build)
// ═══════════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import next from 'next';

const port = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => handle(req, res));

// ── Shared realtime bus accessor (contract mirror of realtime.ts) ──
function getBus() {
  if (!globalThis.__yahriaRealtime) {
    globalThis.__yahriaRealtime = { subs: new Set(), recent: [], seq: 0 };
  }
  return globalThis.__yahriaRealtime;
}
function subscribeYahria(fn) {
  const b = getBus();
  b.subs.add(fn);
  return () => b.subs.delete(fn);
}
function recentYahriaEvents(limit = 100) {
  return getBus().recent.slice(-limit);
}

// ── WebSocket fan-out ────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

function safeSend(ws, data) {
  if (ws.readyState === 1 /* OPEN */) {
    try { ws.send(JSON.stringify(data)); } catch { /* client gone */ }
  }
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  ws.isAlive = true;

  // Canonical handshake: hello + snapshot of recent constitutional events
  safeSend(ws, {
    kind: 'hello',
    system: 'YAHRIA',
    domain: '11',
    transport: 'ws',
    path: '/ws/yahria',
    clients: clients.size,
    ts: new Date().toISOString(),
  });
  safeSend(ws, { kind: 'snapshot', events: recentYahriaEvents(100) });

  // Fan-out every constitutional event as it is emitted
  const unsubscribe = subscribeYahria((event) => safeSend(ws, { kind: 'event', event }));

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg = null;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (msg && msg.type === 'ping') safeSend(ws, { kind: 'pong', ts: new Date().toISOString() });
  });

  ws.on('close', () => {
    clients.delete(ws);
    clearInterval(heartbeat);
    unsubscribe();
  });
  ws.on('error', () => {
    clients.delete(ws);
    clearInterval(heartbeat);
    unsubscribe();
  });

  const heartbeat = setInterval(() => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch { /* noop */ } return; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* noop */ }
  }, 25000);
});

// ── Upgrade routing: only /ws/yahria is ours (Next dev HMR uses SSE) ──
httpServer.on('upgrade', (req, socket, head) => {
  let pathname = '';
  try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { pathname = ''; }
  if (pathname === '/ws/yahria') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

httpServer.listen(port, () => {
  const bus = getBus();
  console.log(`[yahria-server] next ${dev ? 'dev' : 'prod'} + ws on http://localhost:${port} — ws endpoint: /ws/yahria (bus seq=${bus.seq})`);
});
