'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA — Connecteurs IA Panel (LLM Fabric, YAHRIA-KRN-023)
// Real-time provider registry: status, breaker, probe, fallback order.
// INV-212 single route · INV-213 masked credentials only.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowDown, ArrowUp, CheckCircle2, Loader2, PlugZap, RefreshCw, XCircle } from 'lucide-react';

interface ProviderStatus {
  id: string;
  label: string;
  kind: string;
  configured: boolean;
  apiKeyMask: string | null;
  baseUrl: string | null;
  model: string;
  breaker: 'CLOSED' | 'OPEN';
  lastAttempt: { ok: boolean; ms: number; error?: string; at: string } | null;
  okCount: number;
  failCount: number;
  avgMs: number | null;
}

interface LlmData {
  ok: boolean;
  order: string[];
  providers: ProviderStatus[];
  summary: { configured: number; total: number; openBreakers: string[] };
}

interface PingResult {
  ok: boolean;
  provider: string | null;
  model: string | null;
  ms: number;
  attempts: { provider: string; ok: boolean; ms: number; error?: string }[];
  excerpt: string | null;
  error: string | null;
}

async function llmPost(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/yahria/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function LlmConnectorsPanel() {
  const [data, setData] = useState<LlmData | null>(null);
  const [pinging, setPinging] = useState<string | null>(null);
  const [result, setResult] = useState<PingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/yahria/llm');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ping = async (provider?: string) => {
    setPinging(provider ?? 'chain');
    setResult(null);
    try {
      const r = (await llmPost({ action: 'ping', provider })) as unknown as PingResult;
      setResult(r);
      await load();
    } finally {
      setPinging(null);
    }
  };

  const move = async (id: string, dir: -1 | 1) => {
    if (!data) return;
    const order = [...data.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    await llmPost({ action: 'order', order });
    await load();
  };

  if (error) {
    return <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">Fabric LLM indisponible : {error}</div>;
  }
  if (!data) {
    return <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-teal-400" /> Lecture du registre des connecteurs…</div>;
  }

  const byId = Object.fromEntries(data.providers.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      {/* en-tête chaîne */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-teal-300" />
                Fabric LLM — route unique (INV-212)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {data.summary.configured}/{data.summary.total} connecteurs configurés · repli en ordre déclaré · clés masquées côté serveur (INV-213)
                {data.summary.openBreakers.length > 0 && (
                  <span className="text-amber-300"> · breakers OPEN : {data.summary.openBreakers.join(', ')}</span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 border-slate-700 text-slate-300" onClick={() => load()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rafraîchir
              </Button>
              <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-500 text-white" onClick={() => ping()} disabled={pinging !== null}>
                {pinging === 'chain' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 mr-1" />}
                Tester la chaîne
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-1.5">
            <span className="text-slate-600">ordre effectif :</span>
            {data.order.map((id, i) => (
              <span key={id} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-600">→</span>}
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] ${byId[id]?.configured
                    ? 'border-teal-500/40 text-teal-300 bg-teal-500/5'
                    : 'border-slate-700 text-slate-600'}`}
                >
                  {id}
                </Badge>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* grille fournisseurs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.providers.map((p) => (
          <Card key={p.id} className={`bg-slate-900/60 border ${p.configured ? 'border-slate-800' : 'border-slate-800/40 opacity-70'}`}>
            <CardHeader className="pb-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-xs text-slate-100 truncate">{p.label}</CardTitle>
                  <CardDescription className="text-[10px] font-mono text-slate-500">
                    {p.kind} · {p.baseUrl ?? 'SDK intégré'}
                  </CardDescription>
                </div>
                <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${p.configured ? (p.breaker === 'OPEN' ? 'bg-amber-400' : 'bg-teal-400') : 'bg-slate-600'}`} />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="text-[10.5px] font-mono text-slate-400 space-y-0.5">
                <div>modèle : <span className="text-slate-300">{p.model}</span></div>
                <div>clé : <span className="text-slate-300">{p.apiKeyMask ?? (p.id === 'zai' || p.id === 'ollama' ? '—' : 'non configurée')}</span></div>
                <div>
                  breaker : <span className={p.breaker === 'OPEN' ? 'text-amber-300' : 'text-teal-300'}>{p.breaker}</span>
                  {' · '}appels : <span className="text-teal-300">{p.okCount}✓</span>/<span className="text-red-300">{p.failCount}✗</span>
                  {p.avgMs !== null && <> · moy. <span className="text-slate-300">{p.avgMs} ms</span></>}
                </div>
                {p.lastAttempt && (
                  <div className={`truncate ${p.lastAttempt.ok ? 'text-teal-400/80' : 'text-red-400/80'}`}>
                    dernier : {p.lastAttempt.ok ? `OK ${p.lastAttempt.ms} ms` : `échec — ${p.lastAttempt.error?.slice(0, 60)}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <Button size="sm" variant="outline" className="h-7 text-[11px] border-slate-700 text-slate-300" onClick={() => ping(p.id)} disabled={pinging !== null}>
                  {pinging === p.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <PlugZap className="h-3 w-3 mr-1" />}
                  Tester
                </Button>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500" onClick={() => move(p.id, -1)} disabled={data.order.indexOf(p.id) <= 0} aria-label={`Monter ${p.id}`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500" onClick={() => move(p.id, 1)} disabled={data.order.indexOf(p.id) >= data.order.length - 1} aria-label={`Descendre ${p.id}`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* résultat de sonde */}
      {result && (
        <Card className={`border ${result.ok ? 'border-teal-500/40 bg-teal-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs flex items-center gap-2 text-slate-100">
              {result.ok ? <CheckCircle2 className="h-4 w-4 text-teal-300" /> : <XCircle className="h-4 w-4 text-red-300" />}
              Sonde {result.ok ? 'réussie' : 'en échec'} — {result.ok ? `${result.provider} (${result.model}, ${result.ms} ms)` : `chaîne épuisée (${result.ms} ms)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[11px] font-mono text-slate-400 space-y-1">
              {result.attempts.map((a, i) => (
                <div key={i} className={a.ok ? 'text-teal-300' : 'text-slate-500'}>
                  {a.provider} → {a.ok ? `OK (${a.ms} ms)` : `échec : ${a.error}`}
                </div>
              ))}
              {result.excerpt && <div className="text-slate-300 pt-1">réponse : « {result.excerpt} »</div>}
            </div>
          </CardContent>
        </Card>
      )}

      <ScrollArea className="max-h-24">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Configuration : définir les clés dans <span className="font-mono">.env</span> (DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY,
          OPENROUTER_API_KEY, OLLAMA_BASE_URL, YAHRIA_LLM_CUSTOM_BASE_URL…) et l'ordre via <span className="font-mono">YAHRIA_LLM_ORDER</span>.
          Chaque appel S2 / Studio passe par cette fabric : si le fournisseur principal échoue (timeout, 429, 5xx, breaker OPEN),
          le suivant configuré est essayé, et la trace complète des tentatives est journalisée (INV-210 : échec explicite, jamais silencieux).
        </p>
      </ScrollArea>
    </div>
  );
}
