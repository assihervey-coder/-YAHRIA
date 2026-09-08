'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA — Tool Registry Panel (Domain 09, YAHRIA-KRN-025)
// Registre gouverné des outils : contrats S1, matrice d'autorisation
// vivante (INV-062 REGISTERED ≠ AUTHORIZED), invocation bornée,
// démonstrateur autorisation/révocation side-effect.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Hammer, Loader2, Lock, LockOpen, RefreshCw, Search, ShieldAlert, XCircle } from 'lucide-react';

interface ToolContract {
  type: 'object';
  description?: string;
  properties: Record<string, { type: string; description?: string; enum?: string[]; minimum?: number; maximum?: number; maxLength?: number }>;
  required: string[];
}

interface ToolRow {
  toolId: string; name: string; version: string; description: string;
  ownerDomain: string; riskClass: 'READ_ONLY' | 'SIDE_EFFECT';
  contract: ToolContract; executable: boolean; active: boolean;
}

interface AuthRow { toolId: string; effect: string; matchedRule: string | null; reason: string; resource: string }

interface Invocation {
  id: string; toolId: string; toolVersion: string; callerType: string; callerId: string;
  authEffect: string; authRule: string | null; ok: boolean; ms: number; error: string | null; createdAt: string;
}

interface Outcome {
  toolId: string; version: string; authorized: boolean;
  auth: { effect: string; matchedRule: string | null; reason: string; precedence: string; resourceRequested: string };
  validated: boolean; validationErrors: string[]; ok: boolean;
  result: unknown; error: string | null; ms: number; invocationId: string | null; evidenceUid: string | null;
  verdict: 'INVOKED' | 'DENIED' | 'REQUIRE_APPROVAL' | 'VALIDATION_FAILED' | 'EXECUTION_FAILED';
}

const VERDICT_STYLE: Record<Outcome['verdict'], string> = {
  INVOKED: 'border-teal-500/50 bg-teal-500/10 text-teal-300',
  DENIED: 'border-red-500/50 bg-red-500/10 text-red-300',
  REQUIRE_APPROVAL: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  VALIDATION_FAILED: 'border-orange-500/50 bg-orange-500/10 text-orange-300',
  EXECUTION_FAILED: 'border-red-500/50 bg-red-500/10 text-red-300',
};

function authBadge(effect: string) {
  if (effect === 'ALLOW') return <Badge variant="outline" className="text-[10px] border-teal-500/50 text-teal-300">✓ {effect}</Badge>;
  if (effect === 'DENY') return <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-300">✗ {effect}</Badge>;
  return <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-300">⏳ {effect}</Badge>;
}

export function ToolRegistryPanel() {
  const [data, setData] = useState<{ registry: ToolRow[]; authorization: AuthRow[]; invocations: Invocation[]; counts: { tools: number; executable: number; invocations: number } } | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, Record<string, unknown>>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/yahria/tools');
    const json = await res.json();
    if (json.ok) setData(json);
  }, []);
  useEffect(() => { load(); }, [load]);

  const authOf = (toolId: string): AuthRow | undefined => data?.authorization.find((a) => a.toolId === toolId);

  const invoke = async (toolId: string, input: Record<string, unknown>, label: string) => {
    setBusy(label);
    setOutcome(null);
    try {
      const res = await fetch('/api/yahria/tools', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invoke', toolId, input, callerType: 'HUMAN', callerId: 'yahria-operator' }),
      });
      const json = await res.json();
      if (json.ok) setOutcome(json.outcome);
      load();
    } finally { setBusy(null); }
  };

  const authorize = async (toolId: string, allow: boolean) => {
    setBusy(`auth-${toolId}`);
    try {
      await fetch('/api/yahria/tools', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authorize', toolId, allow, reason: allow ? 'démonstration gouvernée INV-062 depuis le panneau' : 'révocation gouvernée' }),
      });
      load();
    } finally { setBusy(null); }
  };

  const filtered = (data?.registry ?? []).filter((t) =>
    !query || t.toolId.includes(query.toLowerCase()) || t.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* header */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                <Hammer className="h-4 w-4 text-teal-300" /> Registre des outils gouvernés — Domaine 09
              </CardTitle>
              <CardDescription className="text-[11px] mt-1">
                Quatre portes pour chaque invocation : <b>enregistrement</b> → <b>autorisation</b> (INV-062 : REGISTERED ≠ AUTHORIZED) → <b>contrat S1 strict</b> → <b>exécution bornée</b> (INV-042). Chaque décision est persistée (PolicyDecision) et scellée en preuve.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">{data?.counts.tools ?? '…'} outils</Badge>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">{data?.counts.executable ?? '…'} exécutables</Badge>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">{data?.counts.invocations ?? '…'} invocations</Badge>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={load}><RefreshCw className="h-3 w-3 mr-1" />Actualiser</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Découverte : toolId, nom, description…" className="h-8 text-xs bg-slate-950/60 border-slate-800" />
            {(data?.counts.tools ?? 0) > 0 && <span className="text-[10px] text-slate-500 shrink-0">{filtered.length}/{data?.counts.tools} affichés</span>}
          </div>
        </CardContent>
      </Card>

      {/* tools grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((t) => {
          const auth = authOf(t.toolId);
          const sideEffect = t.riskClass === 'SIDE_EFFECT';
          const current = inputs[t.toolId] ?? {};
          const busyKey = `inv-${t.toolId}`;
          return (
            <Card key={t.toolId} className={`border-slate-800 bg-slate-900/60 ${sideEffect ? 'border-l-2 border-l-amber-500/60' : 'border-l-2 border-l-teal-500/40'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-xs font-mono text-slate-100 truncate">{t.toolId}</CardTitle>
                    <CardDescription className="text-[10.5px] mt-0.5">{t.description}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className={`text-[9px] ${sideEffect ? 'border-amber-500/50 text-amber-300' : 'border-teal-500/50 text-teal-300'}`}>{t.riskClass}</Badge>
                    {auth && authBadge(auth.effect)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[9px] text-slate-500">
                  <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">v{t.version}</Badge>
                  <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">D.{t.ownerDomain}</Badge>
                  <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">{t.executable ? 'handler lié' : 'déclaratif'}</Badge>
                  {t.contract.required.length > 0 && <span className="text-slate-500">requis : {t.contract.required.join(', ')}</span>}
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {/* contract-driven auto-form */}
                {Object.entries(t.contract.properties).map(([key, spec]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 w-24 shrink-0 truncate" title={spec.description}>{key}</span>
                    {spec.enum ? (
                      <select
                        className="h-7 text-[11px] rounded-md bg-slate-950/60 border border-slate-800 px-2 text-slate-200 flex-1"
                        value={String(current[key] ?? spec.enum[0])}
                        onChange={(e) => setInputs((s) => ({ ...s, [t.toolId]: { ...s[t.toolId], [key]: e.target.value } }))}
                      >
                        {spec.enum.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : spec.type === 'boolean' ? (
                      <input type="checkbox" checked={Boolean(current[key])} onChange={(e) => setInputs((s) => ({ ...s, [t.toolId]: { ...s[t.toolId], [key]: e.target.checked } }))} className="accent-teal-400" />
                    ) : spec.type === 'number' ? (
                      <Input type="number" className="h-7 text-[11px] bg-slate-950/60 border-slate-800" value={current[key] === undefined ? '' : String(current[key])} onChange={(e) => setInputs((s) => ({ ...s, [t.toolId]: { ...s[t.toolId], [key]: Number(e.target.value) } }))} />
                    ) : (
                      <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800" placeholder={spec.type} value={current[key] === undefined ? '' : String(current[key])} onChange={(e) => setInputs((s) => ({ ...s, [t.toolId]: { ...s[t.toolId], [key]: e.target.value } }))} />
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" className="h-7 text-[11px] bg-teal-600/80 hover:bg-teal-600" disabled={busy === busyKey}
                    onClick={() => {
                      // contract defaults: enum selects display their first value — send it too
                      const defaults: Record<string, unknown> = {};
                      for (const [k, spec] of Object.entries(t.contract.properties)) {
                        if (current[k] === undefined && spec.enum) defaults[k] = spec.enum[0];
                      }
                      invoke(t.toolId, { ...defaults, ...current }, busyKey);
                    }}>
                    {busy === busyKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hammer className="h-3 w-3 mr-1" />}Invoquer
                  </Button>
                  {sideEffect && auth?.effect === 'DENY' && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px] border-teal-600/50 text-teal-300" disabled={busy === `auth-${t.toolId}`}
                      onClick={() => authorize(t.toolId, true)}>
                      {busy === `auth-${t.toolId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <LockOpen className="h-3 w-3 mr-1" />}Autoriser (gouverné)
                    </Button>
                  )}
                  {sideEffect && auth?.effect === 'ALLOW' && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px] border-red-600/50 text-red-300" disabled={busy === `auth-${t.toolId}`}
                      onClick={() => authorize(t.toolId, false)}>
                      <Lock className="h-3 w-3 mr-1" />Révoquer
                    </Button>
                  )}
                </div>
                {auth && <p className="text-[9px] text-slate-600 leading-relaxed">{auth.resource} → {auth.matchedRule ?? 'default-deny'} : {auth.reason}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* outcome */}
      {outcome && (
        <Card className={`border ${VERDICT_STYLE[outcome.verdict]}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              {outcome.verdict === 'INVOKED' ? <CheckCircle2 className="h-4 w-4" /> : outcome.verdict === 'DENIED' || outcome.verdict === 'EXECUTION_FAILED' ? <XCircle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {outcome.toolId} → {outcome.verdict} <span className="font-normal text-slate-400">({outcome.ms} ms)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            <p className="text-[10.5px] font-mono text-slate-400">
              auth: {outcome.auth.effect} via {outcome.auth.matchedRule ?? 'default-deny'} · ressource: {outcome.auth.resourceRequested} · contrat: {outcome.validated ? 'validé' : `violé (${outcome.validationErrors.length})`}
            </p>
            {outcome.validationErrors.length > 0 && (
              <p className="text-[10.5px] text-orange-300">{outcome.validationErrors.join(' ; ')}</p>
            )}
            {outcome.error && <p className="text-[10.5px] text-red-300">{outcome.error}</p>}
            {outcome.result !== null && outcome.result !== undefined && (
              <ScrollArea className="h-32 rounded border border-slate-800 bg-slate-950/80 p-2">
                <pre className="text-[10px] text-slate-300 whitespace-pre-wrap break-all">{JSON.stringify(outcome.result, null, 2)}</pre>
              </ScrollArea>
            )}
            <p className="text-[9px] text-slate-600">invocation {outcome.invocationId ?? '—'} · preuve {outcome.evidenceUid ?? '— (refus avant exécution : la trace d\u2019autorisation est enregistrée en PolicyDecision)'}</p>
          </CardContent>
        </Card>
      )}

      {/* recent invocations */}
      {data && data.invocations.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-300">Invocations récentes — journal gouverné</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-44">
              <table className="w-full text-[10px] text-slate-400">
                <thead><tr className="text-left text-slate-500"><th className="py-1 pr-2">outil</th><th className="pr-2">appelant</th><th className="pr-2">auth</th><th className="pr-2">ok</th><th className="pr-2">ms</th><th>à</th></tr></thead>
                <tbody className="font-mono">
                  {data.invocations.map((i) => (
                    <tr key={i.id} className="border-t border-slate-800/60">
                      <td className="py-1 pr-2 text-slate-300 truncate max-w-52">{i.toolId}</td>
                      <td className="pr-2">{i.callerType}:{i.callerId}</td>
                      <td className={`pr-2 ${i.authEffect === 'ALLOW' ? 'text-teal-400' : i.authEffect === 'DENY' ? 'text-red-400' : 'text-amber-400'}`}>{i.authEffect}</td>
                      <td className="pr-2">{i.ok ? '✓' : '✗'}</td>
                      <td className="pr-2">{i.ms}</td>
                      <td>{new Date(i.createdAt).toLocaleTimeString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
