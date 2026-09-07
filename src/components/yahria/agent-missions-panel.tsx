'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA — Agent Missions Panel (Domain 05 × 09, R13 / KRN-027)
// Les agents canoniques invoquent de VRAIS outils gouvernés :
// passerelle capacité (INV-071) → politique (INV-062) → contrat S1
// → exécution bornée. Matrice de droits dérivée de la constitution.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Bot, CheckCircle2, Loader2, Play, ShieldAlert, ShieldCheck, XCircle, Wrench,
} from 'lucide-react';

interface AgentDef { key: string; name: string; role: string; capabilities: string[]; autonomy: string }
interface Step {
  toolId: string; gate: string; capability: string | null;
  verdict: string; ok: boolean; authEffect: string | null; authRule: string | null;
  ms: number; detail: string; invocationId: string | null; evidenceUid: string | null; result: unknown;
}
interface Mission {
  ok: boolean; traceId: string; runId: string | null; agent: string; mission: string;
  verdict: 'COMPLETED' | 'PARTIAL' | 'BLOCKED' | 'FAILED' | 'REJECTED';
  steps: Step[]; summary: string; ms: number;
}

const VERDICT_STYLE: Record<string, string> = {
  COMPLETED: 'border-teal-500/50 bg-teal-500/10 text-teal-300',
  PARTIAL: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  BLOCKED: 'border-red-500/50 bg-red-500/10 text-red-300',
  FAILED: 'border-red-500/50 bg-red-500/10 text-red-300',
  REJECTED: 'border-red-500/50 bg-red-500/10 text-red-300',
};

// Presets — missions réelles : les agents touchent de vrais handlers
const MISSION_PRESETS: { agent: string; mission: string; toolCalls: { toolId: string; input?: Record<string, unknown> }[]; label: string }[] = [
  {
    agent: 'architect', label: 'Architecte : état du système + toolchains',
    mission: "Avant de concevoir, dresse l'état réel : domaines actifs et toolchains disponibles sur l'hôte.",
    toolCalls: [{ toolId: 'system.domains.list' }, { toolId: 'sandbox.toolchains.detect' }],
  },
  {
    agent: 'tester', label: 'Tester : diagnostic sandbox (après autorisation)',
    mission: 'Exécute la sonde uname pour ancrer la campagne de tests sur une plateforme connue.',
    toolCalls: [{ toolId: 'sandbox.cli.run', input: { probe: 'uname' } }],
  },
  {
    agent: 'tester', label: 'Tester : outil hors capacité (mur INV-071)',
    mission: 'Tente de lire les preuves récentes — hors périmètre du tester, refus attendu AVANT la politique.',
    toolCalls: [{ toolId: 'evidence.recent.list' }],
  },
  {
    agent: 'security', label: 'Security : décisions de politique récentes',
    mission: "Audite les dernières décisions ALLOW/DENY du plan de contrôle pour détecter des dérives d'autorisation.",
    toolCalls: [{ toolId: 'policy.decisions.recent', input: { limit: 10 } }, { toolId: 'evidence.recent.list', input: { limit: 5 } }],
  },
  {
    agent: 'reviewer', label: 'Reviewer : invariants de la famille POLICY',
    mission: "Relis les invariants POLICY pour vérifier la conformité de la console de politiques.",
    toolCalls: [{ toolId: 'constitution.invariants.list', input: { family: 'POLICY', limit: 20 } }],
  },
];

export function AgentMissionsPanel() {
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [grants, setGrants] = useState<Record<string, string[]>>({});
  const [agent, setAgent] = useState('architect');
  const [mission, setMission] = useState(MISSION_PRESETS[0].mission);
  const [toolCalls, setToolCalls] = useState(MISSION_PRESETS[0].toolCalls);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Mission | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/yahria/agents');
    const json = await res.json();
    if (json.ok) {
      setAgents(json.canonical ?? []);
      setGrants(json.toolGrants ?? {});
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true); setResult(null);
    try {
      const res = await fetch('/api/yahria/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mission', agentKey: agent, mission, toolCalls }),
      });
      const json = await res.json();
      if (json.ok) setResult(json.mission);
    } finally { setRunning(false); }
  };

  const agentGrants = grants[agent] ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
            <Bot className="h-4 w-4 text-teal-300" /> Missions agents — outils réels gouvernés <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">KRN-027 · D.05×D.09</Badge>
          </CardTitle>
          <CardDescription className="text-[11px]">
            Deux portes dans l&apos;ordre (INV-216) : <b>capacité</b> (INV-071 — l&apos;outil doit mapper une capacité déclarée) puis <b>politique</b> (INV-062 — REGISTERED ≠ AUTHORIZED, réévaluée à chaque appel). Chaque mission = une trace rejouable (INV-217).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {agents.map((a) => (
              <button key={a.key}
                onClick={() => { setAgent(a.key); }}
                className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${agent === a.key ? 'border-teal-500/60 bg-teal-500/10 text-teal-300' : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-500'}`}>
                {a.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
            <Wrench className="h-3 w-3" /> outils autorisés pour <span className="font-mono text-teal-300">{agent}</span> :
            {agentGrants.length === 0
              ? <span className="text-red-400">aucun (mission honnêtement refusée)</span>
              : agentGrants.map((t) => <Badge key={t} variant="outline" className="text-[9px] border-teal-500/40 text-teal-300 font-mono">{t}</Badge>)}
          </div>
          <Textarea value={mission} onChange={(e) => setMission(e.target.value)}
            placeholder="Mission explicite de l'agent…"
            className="bg-slate-950/70 border-slate-800 min-h-[54px] text-sm text-slate-200 placeholder:text-slate-600" />
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="text-[10px] font-medium text-slate-400 mb-1.5">Appels d&apos;outils de la mission ({toolCalls.length}/5) :</div>
            <div className="space-y-1.5">
              {toolCalls.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="font-mono text-teal-300/90 flex-1 truncate">{c.toolId}</span>
                  {c.input && Object.keys(c.input).length > 0 && (
                    <span className="font-mono text-slate-500 truncate max-w-48">{JSON.stringify(c.input)}</span>
                  )}
                  <button className="text-slate-500 hover:text-red-400 text-[10px]"
                    onClick={() => setToolCalls((tc) => tc.filter((_, j) => j !== i))}>retirer</button>
                </div>
              ))}
              {toolCalls.length === 0 && <div className="text-[10px] text-slate-600">aucun appel — la mission échouera honnêtement</div>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={agent} onChange={(e) => setAgent(e.target.value)}
              className="h-8 text-[11px] rounded-md bg-slate-950/60 border border-slate-800 px-2 text-slate-200">
              {agents.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
            </select>
            <select value="" onChange={(e) => {
              const p = MISSION_PRESETS.find((x) => x.label === e.target.value);
              if (p) { setAgent(p.agent); setMission(p.mission); setToolCalls(p.toolCalls); }
            }} className="h-8 max-w-72 text-[11px] rounded-md bg-slate-950/60 border border-slate-800 px-2 text-slate-300">
              <option value="">— missions prédéfinies —</option>
              {MISSION_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
            <Button size="sm" className="h-8 text-[11px] bg-teal-600 hover:bg-teal-500" disabled={running}
              onClick={run}>
              {running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              {running ? 'Mission en cours…' : 'Exécuter la mission'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className={`border ${VERDICT_STYLE[result.verdict] ?? 'border-slate-800'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              {result.verdict === 'COMPLETED' ? <ShieldCheck className="h-4 w-4" />
                : result.verdict === 'REJECTED' || result.verdict === 'FAILED' ? <XCircle className="h-4 w-4" />
                : <ShieldAlert className="h-4 w-4" />}
              Mission {result.agent} → {result.verdict} <span className="font-normal text-slate-400">({result.ms} ms)</span>
            </CardTitle>
            <CardDescription className="text-[10.5px] font-mono">trace {result.traceId} · run {result.runId ?? '—'}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <p className="text-[11px] text-slate-300">{result.summary}</p>
            <ScrollArea className="max-h-72">
              <div className="space-y-1.5 pr-3">
                {result.steps.map((s, i) => (
                  <div key={i} className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-slate-200">{s.toolId}</span>
                      <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">porte : {s.gate}</Badge>
                      {s.capability && <Badge variant="outline" className="text-[9px] border-purple-500/40 text-purple-300">{s.capability}</Badge>}
                      <Badge variant="outline" className={`text-[9px] ${s.ok ? 'border-teal-500/50 text-teal-300' : 'border-red-500/50 text-red-300'}`}>
                        {s.ok ? '✓' : '✗'} {s.verdict}
                      </Badge>
                      {s.authEffect && <Badge variant="outline" className={`text-[9px] ${s.authEffect === 'ALLOW' ? 'border-teal-500/50 text-teal-300' : 'border-red-500/50 text-red-300'}`}>{s.authEffect} via {s.authRule ?? 'default-deny'}</Badge>}
                      <span className="text-[9px] text-slate-600 ml-auto">{s.ms} ms</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{s.detail}</p>
                    {s.result !== null && s.result !== undefined && (
                      <pre className="mt-1 text-[9.5px] text-slate-400 whitespace-pre-wrap break-all max-h-24 overflow-y-auto rounded bg-black/40 p-1.5">{JSON.stringify(s.result, null, 2).slice(0, 600)}</pre>
                    )}
                    {s.evidenceUid && <p className="text-[9px] text-teal-500/70 mt-0.5 font-mono">preuve scellée : {s.evidenceUid}</p>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function MissionSuccessInline({ traceId }: { traceId: string }) {
  return <span className="inline-flex items-center gap-1 text-teal-300"><CheckCircle2 className="h-3 w-3" />{traceId}</span>;
}
