// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — LLM FABRIC (Domain 08 — Execution Fabric)
// Doc ID: YAHRIA-KRN-023 | Spec: LLM_CONNECTORS_SPECIFICATION.md
//
// Multi-provider cognitive fabric: every LLM call in YAHRIA routes
// through this module (INV-212). Providers are declared, ordered,
// health-monitored and circuit-broken — never ad-hoc imported.
//
// Supported providers:
//   zai         — z-ai-web-dev-sdk (built-in, always present here)
//   deepseek    — OpenAI-compatible REST (api.deepseek.com)
//   claude      — Anthropic native Messages API
//   openai      — OpenAI Chat Completions
//   openrouter  — OpenAI-compatible aggregator (one key → many models)
//   ollama      — local OpenAI-compatible endpoint (offline fallback)
//   custom      — any OpenAI-compatible base URL
//
// Constitutional constraints:
//   INV-080 — model output is not fact (unchanged by provider)
//   INV-212 — SINGLE LLM ROUTE: all providers go through this fabric
//   INV-213 — credentials never leave the server (masked in telemetry)
//   INV-210 — explicit failure: fallback chain must be visible in the result
// ═══════════════════════════════════════════════════════════════

export type ProviderId = 'zai' | 'deepseek' | 'claude' | 'openai' | 'openrouter' | 'ollama' | 'custom';

export const PROVIDER_IDS: ProviderId[] = ['zai', 'deepseek', 'claude', 'openai', 'openrouter', 'ollama', 'custom'];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  zai: 'Z.ai (SDK intégré)',
  deepseek: 'DeepSeek',
  claude: 'Anthropic Claude',
  openai: 'OpenAI',
  openrouter: 'OpenRouter (agrégateur)',
  ollama: 'Ollama (local)',
  custom: 'Endpoint personnalisé',
};

export interface LLMMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface LLMChatRequest {
  messages: LLMMessage[];
  thinking?: boolean;          // reasoning mode when the provider supports it
  maxTokens?: number;          // default 4096
  timeoutMs?: number;          // default YAHRIA_LLM_TIMEOUT_MS or 90_000
  preferred?: ProviderId;      // pin a provider (skip fallback chain)
}

export interface LLMAttempt {
  provider: ProviderId;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface LLMChatResult {
  ok: boolean;
  text: string;
  provider: ProviderId | null;
  model: string | null;
  ms: number;                  // total wall time across attempts
  attempts: LLMAttempt[];      // full fallback trace (INV-210: visible failure)
}

export interface ProviderAttemptRecord { ok: boolean; ms: number; error?: string; at: string }

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  kind: 'zai-sdk' | 'openai-compatible' | 'anthropic';
  configured: boolean;
  apiKeyMask: string | null;   // INV-213: masked only
  baseUrl: string | null;
  model: string;
  breaker: 'CLOSED' | 'OPEN';
  lastAttempt: ProviderAttemptRecord | null;
  okCount: number;
  failCount: number;
  avgMs: number | null;
}

// ── LF-1. PROVIDER CONFIGURATION (env-driven, server-only) ────────

interface ProviderConfig {
  id: ProviderId;
  kind: 'zai-sdk' | 'openai-compatible' | 'anthropic';
  baseUrl: string;
  apiKey: string | null;
  model: string;
  extraHeaders?: Record<string, string>;
}

function env(k: string): string | null {
  const v = process.env[k];
  return v && v.trim() !== '' ? v.trim() : null;
}

/** Mask a credential: keep 4 first + 2 last chars. INV-213. */
export function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return '***';
  return `${key.slice(0, 4)}…${key.slice(-2)}`;
}

function providerConfigs(): Record<ProviderId, ProviderConfig> {
  return {
    zai: { id: 'zai', kind: 'zai-sdk', baseUrl: 'builtin', apiKey: null, model: env('ZAI_MODEL') ?? 'glm-4.6' },
    deepseek: {
      id: 'deepseek', kind: 'openai-compatible',
      baseUrl: env('DEEPSEEK_BASE_URL') ?? 'https://api.deepseek.com/v1',
      apiKey: env('DEEPSEEK_API_KEY'),
      model: env('DEEPSEEK_MODEL') ?? 'deepseek-chat',
    },
    claude: {
      id: 'claude', kind: 'anthropic',
      baseUrl: env('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com/v1',
      apiKey: env('ANTHROPIC_API_KEY'),
      model: env('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5',
      extraHeaders: { 'anthropic-version': '2023-06-01' },
    },
    openai: {
      id: 'openai', kind: 'openai-compatible',
      baseUrl: env('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
      apiKey: env('OPENAI_API_KEY'),
      model: env('OPENAI_MODEL') ?? 'gpt-4o-mini',
    },
    openrouter: {
      id: 'openrouter', kind: 'openai-compatible',
      baseUrl: env('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1',
      apiKey: env('OPENROUTER_API_KEY'),
      model: env('OPENROUTER_MODEL') ?? 'openrouter/auto',
      extraHeaders: { 'X-Title': 'YAHRIA CODE OS' },
    },
    ollama: {
      id: 'ollama', kind: 'openai-compatible',
      baseUrl: env('OLLAMA_BASE_URL') ?? 'http://localhost:11434/v1',
      apiKey: env('OLLAMA_API_KEY'),
      model: env('OLLAMA_MODEL') ?? 'llama3.1',
    },
    custom: {
      id: 'custom', kind: 'openai-compatible',
      baseUrl: env('YAHRIA_LLM_CUSTOM_BASE_URL') ?? '',
      apiKey: env('YAHRIA_LLM_CUSTOM_API_KEY'),
      model: env('YAHRIA_LLM_CUSTOM_MODEL') ?? 'default',
    },
  };
}

function isConfigured(c: ProviderConfig): boolean {
  switch (c.id) {
    case 'zai': return true;            // SDK is bundled in this environment
    case 'ollama': return c.baseUrl !== '';
    case 'custom': return c.baseUrl !== '' && env('YAHRIA_LLM_CUSTOM_API_KEY') !== null;
    default: return c.apiKey !== null;
  }
}

// ── LF-2. FALLBACK ORDER + RUNTIME OVERRIDE ───────────────────────

const DEFAULT_ORDER: ProviderId[] = ['zai', 'deepseek', 'claude', 'openai', 'openrouter', 'ollama', 'custom'];

let runtimeOrder: ProviderId[] | null = null;

export function effectiveOrder(): ProviderId[] {
  if (runtimeOrder && runtimeOrder.length > 0) return runtimeOrder;
  const raw = env('YAHRIA_LLM_ORDER');
  if (!raw) return DEFAULT_ORDER;
  const parsed = raw.split(',').map((s) => s.trim().toLowerCase() as ProviderId).filter((p) => PROVIDER_IDS.includes(p));
  return parsed.length > 0 ? parsed : DEFAULT_ORDER;
}

/** Runtime re-order (in-memory; survives until process restart — env stays authoritative). */
export function setRuntimeOrder(order: string[]): { ok: boolean; error?: string } {
  const clean = order.map((s) => s.trim().toLowerCase() as ProviderId).filter((p) => PROVIDER_IDS.includes(p));
  const unique = Array.from(new Set(clean));
  if (unique.length === 0) return { ok: false, error: 'Ordre vide ou aucun identifiant valide (INV-212: route unique exigée).' };
  runtimeOrder = unique;
  return { ok: true };
}

export function clearRuntimeOrder(): void { runtimeOrder = null; }

// ── LF-3. CIRCUIT BREAKER (failure-machine style, F-family aligned) ──

const BREAKER_THRESHOLD = Number(env('YAHRIA_LLM_BREAKER_THRESHOLD') ?? 3);   // consecutive failures
const BREAKER_COOLDOWN_MS = Number(env('YAHRIA_LLM_BREAKER_COOLDOWN_MS') ?? 90_000);

interface BreakerState { consecutiveFails: number; openedAt: number | null; }
const breakers = new Map<ProviderId, BreakerState>();
for (const p of PROVIDER_IDS) breakers.set(p, { consecutiveFails: 0, openedAt: null });

function breakerState(p: ProviderId): BreakerState { return breakers.get(p)!; }

function breakerOpen(p: ProviderId): boolean {
  const b = breakerState(p);
  if (b.openedAt === null) return false;
  if (Date.now() - b.openedAt >= BREAKER_COOLDOWN_MS) {
    b.openedAt = null;                 // half-open: allow a probe
    b.consecutiveFails = BREAKER_THRESHOLD - 1;  // one more failure re-opens
    return false;
  }
  return true;
}

function recordSuccess(p: ProviderId): void {
  const b = breakerState(p);
  b.consecutiveFails = 0;
  b.openedAt = null;
}

function recordFailure(p: ProviderId): void {
  const b = breakerState(p);
  b.consecutiveFails += 1;
  if (b.consecutiveFails >= BREAKER_THRESHOLD && b.openedAt === null) b.openedAt = Date.now();
}

// ── LF-4. TELEMETRY (in-memory ring, masked — INV-213) ────────────

const TELEMETRY_CAP = 20;
const telemetry = new Map<ProviderId, ProviderAttemptRecord[]>();
for (const p of PROVIDER_IDS) telemetry.set(p, []);

function recordTelemetry(p: ProviderId, rec: ProviderAttemptRecord): void {
  const arr = telemetry.get(p)!;
  arr.push(rec);
  if (arr.length > TELEMETRY_CAP) arr.shift();
}

// ── LF-3bis. SNAPSHOT CIRCUIT (pur — sans effet de bord half-open) ──
// Exposé pour la porte de complétude (EVO-000026) : « cooldown fabric
// respecté » exige de LIRE l'état des breakers sans les muter (la
// lecture via breakerOpen() déclencherait la transition half-open).

export interface CircuitSnapshot { anyOpen: boolean; maxRemainingMs: number; openProviders: string[] }

export function circuitCooldownSnapshot(): CircuitSnapshot {
  const now = Date.now();
  const openProviders: string[] = [];
  let maxRemainingMs = 0;
  for (const id of PROVIDER_IDS) {
    const b = breakers.get(id);
    if (!b || b.openedAt === null) continue;
    const remaining = BREAKER_COOLDOWN_MS - (now - b.openedAt);
    if (remaining > 0) {
      openProviders.push(id);
      if (remaining > maxRemainingMs) maxRemainingMs = remaining;
    }
  }
  return { anyOpen: openProviders.length > 0, maxRemainingMs, openProviders };
}

export function providerStatuses(): ProviderStatus[] {
  const cfgs = providerConfigs();
  return effectiveOrder().map((id) => {
    const c = cfgs[id];
    const recs = telemetry.get(id) ?? [];
    const oks = recs.filter((r) => r.ok);
    const last = recs.length > 0 ? recs[recs.length - 1] : null;
    return {
      id,
      label: PROVIDER_LABELS[id],
      kind: c.kind,
      configured: isConfigured(c),
      apiKeyMask: maskKey(c.apiKey),
      baseUrl: c.baseUrl === 'builtin' ? null : (c.baseUrl || null),
      model: c.model,
      breaker: breakerOpen(id) ? 'OPEN' : 'CLOSED',
      lastAttempt: last,
      okCount: oks.length,
      failCount: recs.length - oks.length,
      avgMs: oks.length > 0 ? Math.round(oks.reduce((a, r) => a + r.ms, 0) / oks.length) : null,
    } satisfies ProviderStatus;
  });
}

// ── LF-5. PROVIDER ADAPTERS (normalized chat) ─────────────────────

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

/** OpenAI-compatible chat (DeepSeek, OpenAI, OpenRouter, Ollama, custom). */
async function chatOpenAICompatible(c: ProviderConfig, messages: LLMMessage[], maxTokens: number, timeoutMs: number, modelOverride?: string): Promise<string> {
  if (!c.baseUrl) throw new Error('base URL non configurée');
  const body: Record<string, unknown> = { model: modelOverride ?? c.model, messages, max_tokens: maxTokens };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(c.extraHeaders ?? {}) };
  if (c.apiKey) headers.Authorization = `Bearer ${c.apiKey}`;
  const res = await fetchWithTimeout(`${c.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', headers, body: JSON.stringify(body),
  }, timeoutMs);
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? '';
  if (text === '') throw new Error('réponse vide');
  return text;
}

/** Anthropic native Messages API. */
async function chatAnthropic(c: ProviderConfig, messages: LLMMessage[], maxTokens: number, timeoutMs: number): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n') || undefined;
  const rest = messages.filter((m) => m.role !== 'system');
  const body: Record<string, unknown> = { model: c.model, max_tokens: maxTokens, messages: rest };
  if (system) body.system = system;
  const res = await fetchWithTimeout(`${c.baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.apiKey ?? '',
      ...(c.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  }, timeoutMs);
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (json.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  if (text === '') throw new Error('réponse vide');
  return text;
}

/** Built-in Z.ai SDK. System prompt is passed as first 'assistant' message (SDK convention). */
async function chatZai(messages: LLMMessage[], maxTokens: number, thinking: boolean): Promise<string> {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const zai = await ZAI.create();
  const sdkMessages = messages.map((m, i) => ({
    role: m.role === 'system' && i === 0 ? 'assistant' : m.role,
    content: m.content,
  }));
  const completion = await zai.chat.completions.create({
    messages: sdkMessages as never,
    ...(thinking ? { thinking: { type: 'enabled' } } : {}),
  });
  const text = completion.choices[0]?.message?.content ?? '';
  if (text === '') throw new Error('réponse vide');
  return text;
}

async function dispatch(c: ProviderConfig, req: LLMChatRequest, maxTokens: number, timeoutMs: number): Promise<string> {
  switch (c.kind) {
    case 'zai-sdk': return chatZai(req.messages, maxTokens, req.thinking ?? false);
    case 'anthropic': return chatAnthropic(c, req.messages, maxTokens, timeoutMs);
    default: return chatOpenAICompatible(c, req.messages, maxTokens, timeoutMs);
  }
}

// ── LF-6. THE SINGLE ROUTE (INV-212) — ordered fallback execution ──

export async function runLLMChat(req: LLMChatRequest): Promise<LLMChatResult> {
  const t0 = Date.now();
  const cfgs = providerConfigs();
  const maxTokens = req.maxTokens ?? 4096;
  const timeoutMs = req.timeoutMs ?? Number(env('YAHRIA_LLM_TIMEOUT_MS') ?? 90_000);

  const order: ProviderId[] = req.preferred
    ? [req.preferred]
    : effectiveOrder().filter((p) => isConfigured(cfgs[p]));

  const attempts: LLMAttempt[] = [];

  if (order.length === 0) {
    return {
      ok: false, text: '', provider: null, model: null, ms: Date.now() - t0, attempts,
      // INV-210: explicit, never silent
    };
  }

  let lastError = '';
  for (const id of order) {
    const c = cfgs[id];
    if (!isConfigured(c)) {
      attempts.push({ provider: id, ok: false, ms: 0, error: 'non configuré' });
      continue;
    }
    if (!req.preferred && breakerOpen(id)) {
      attempts.push({ provider: id, ok: false, ms: 0, error: `circuit OPEN (cooldown ${Math.round(BREAKER_COOLDOWN_MS / 1000)}s)` });
      continue;
    }
    const a0 = Date.now();
    try {
      const text = await dispatch(c, req, maxTokens, timeoutMs);
      const ms = Date.now() - a0;
      recordSuccess(id);
      recordTelemetry(id, { ok: true, ms, at: new Date().toISOString() });
      attempts.push({ provider: id, ok: true, ms });
      return { ok: true, text, provider: id, model: c.model, ms: Date.now() - t0, attempts };
    } catch (e) {
      const ms = Date.now() - a0;
      const msg = e instanceof Error ? (e.name === 'AbortError' ? `timeout après ${timeoutMs} ms` : e.message) : String(e);
      lastError = msg;
      recordFailure(id);
      recordTelemetry(id, { ok: false, ms, error: msg.slice(0, 200), at: new Date().toISOString() });
      attempts.push({ provider: id, ok: false, ms, error: msg.slice(0, 200) });
      // fallback continues → next provider in order
    }
  }

  return { ok: false, text: '', provider: null, model: null, ms: Date.now() - t0, attempts, ...({ lastError } as object) };
}

/** One-shot connectivity probe (used by API ping + health dashboards). */
export async function pingProvider(id: ProviderId, timeoutMs = 20_000): Promise<LLMChatResult> {
  return runLLMChat({
    messages: [{ role: 'user', content: 'Connectivity probe. Reply with exactly this token and nothing else: YAHRIA-LINK-OK' }],
    maxTokens: 64,
    timeoutMs,
    preferred: id,
  });
}
