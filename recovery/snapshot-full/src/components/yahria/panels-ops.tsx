'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA MISSION CONTROL — Ops panels
// Agent OS · Tasks · Executions · Evidence · Policy · Blueprint
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Boxes, ListChecks, Terminal, FileCheck2, Scale, BookOpenCheck, Loader2,
  ArrowRight, Lock, ShieldAlert, Download, ImageIcon, FileText,
} from 'lucide-react';
import { stateColor, pathColor, pathLabel } from './panels-core';

const api = async (url: string, body?: unknown, method = 'GET') => {
  const res = await fetch(url, body ? {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : { method });
  return res.json();
};

// ── AGENT OS ──────────────────────────────────────────────────────

interface AgentRow {
  id: string; key: string; name: string; role: string; autonomy: string; status: string;
  capabilities: string;
  runs: { id: string; state: string; startedAt: string; output: string | null }[];
}

export function AgentPanel({ agents, onChanged }: { agents: AgentRow[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { flow: string[]; evidenceUid: string; run: { state: string } }>>({});

  const runAgent = async (key: string) => {
    setBusy(key);
    const json = await api('/api/yahria/agents', { agentKey: key, capability: 'genome.query' }, 'POST');
    if (json.ok) {
      setResults((r) => ({ ...r, [key]: json }));
      onChanged();
    }
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4 text-teal-300" /> Agent Operating System — 9 agents canoniques</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Flux obligatoire par exécution : INTENTION → VÉRIF. CAPACITÉ (INV-071) → VÉRIF. POLITIQUE (INV-120) → EXÉCUTION → PREUVE.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {agents.map((a) => {
              const caps: string[] = (() => { try { return JSON.parse(a.capabilities); } catch { return []; } })();
              const r = results[a.key];
              const allowed = r?.run?.state === 'COMPLETED';
              return (
                <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-100">{a.name}</div>
                    <Badge variant="outline" className={`text-[10px] ${stateColor(a.status)}`}>{a.status}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug min-h-[30px]">{a.role}</p>
                  <div className="flex flex-wrap gap-1">
                    {caps.map((c) => (
                      <span key={c} className="text-[9.5px] font-mono rounded bg-slate-800/80 px-1.5 py-0.5 text-slate-400">{c}</span>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500">autonomie : <span className="text-slate-400">{a.autonomy}</span></div>
                  <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-teal-300 h-7 text-xs"
                    disabled={busy === a.key} onClick={() => runAgent(a.key)}>
                    {busy === a.key ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Lock className="h-3 w-3 mr-1" />}
                    Tester la porte capacités+politique
                  </Button>
                  {r && (
                    <div className={`text-[10px] rounded p-2 border ${allowed ? 'border-teal-500/30 bg-teal-500/5 text-teal-300' : 'border-red-500/30 bg-red-500/5 text-red-300'}`}>
                      {r.flow.map((f, i) => (
                        <span key={i}>
                          {f}
                          {i < r.flow.length - 1 && <ArrowRight className="inline h-2.5 w-2.5 mx-1 opacity-60" />}
                        </span>
                      ))}
                      <div className="mt-1 opacity-70 font-mono">{r.evidenceUid}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── TASK GRAPH ────────────────────────────────────────────────────

interface TaskRow {
  id: string; title: string; kind: string; state: string; priority: number;
  dependsOn: string; result: string | null;
}

export function TaskPanel({ tasks, machine, onChanged }: {
  tasks: TaskRow[];
  machine: { states: string[]; transitions: { from: string; to: string; guard: string; authority: string }[] };
  onChanged: () => void;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true); setError(null);
    const json = await api('/api/yahria/tasks', { title }, 'POST');
    if (!json.ok) setError(json.error);
    else { setTitle(''); onChanged(); }
    setBusy(false);
  };

  const transition = async (id: string, to: string) => {
    setError(null);
    const json = await api('/api/yahria/tasks', { id, to }, 'PATCH');
    if (!json.ok) setError(json.error);
    else onChanged();
  };

  const allowedFrom = (state: string) => machine?.transitions?.filter((t) => t.from === state) ?? [];

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4 text-teal-300" /> Graphe de tâches — machine à états gardée</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Transitions interdites = refus HTTP 422 avec la règle violée. Une tâche ne peut pas passer RUNNING avant que ses dépendances soient COMPLETED (INV-091).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle tâche…"
              className="bg-slate-950/70 border-slate-800 text-sm text-slate-200" onKeyDown={(e) => e.key === 'Enter' && create()} />
            <Button onClick={create} disabled={busy || !title.trim()} className="bg-teal-600 hover:bg-teal-500 text-white shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
            </Button>
          </div>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300 flex gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5 pr-3">
              {tasks.map((t) => (
                <div key={t.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-slate-200 truncate">{t.title}</span>
                      <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500">{t.kind}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${stateColor(t.state)}`}>{t.state}</Badge>
                      {allowedFrom(t.state).map((tr) => (
                        <button key={tr.to} onClick={() => transition(t.id, tr.to)}
                          title={`garde : ${tr.guard} (autorité ${tr.authority})`}
                          className="text-[9.5px] rounded border border-slate-700 px-1.5 py-0.5 text-slate-400 hover:border-teal-500/50 hover:text-teal-300 transition-colors">
                          → {tr.to}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && <div className="text-xs text-slate-600 text-center py-8">Aucune tâche — créez-en une pour voir la machine à états agir.</div>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ── EXECUTION FABRIC ──────────────────────────────────────────────

interface ExecRow {
  id: string; state: string; sandboxProfile: string; exitCode: number | null;
  durationMs: number; stdout: string | null; policyDecision: string | null; traceId: string | null;
}

interface ExecTrace {
  executionId: string;
  transitions: { from: string; to: string; guard: string }[];
  policyDecision: { effect: string; matchedRule: string | null; reason: string };
  sandbox: { profile: string; network: string; fs: string; limits: Record<string, number> };
  stdout: string;
  finalState: string;
}

export function ExecutionPanel({ executions, onChanged }: { executions: ExecRow[]; onChanged: () => void }) {
  const [command, setCommand] = useState('yahria run --plan=export-pdf');
  const [profile, setProfile] = useState('RESTRICTED');
  const [action, setAction] = useState('filesystem.write');
  const [resource, setResource] = useState('workspace.overlay');
  const [simFail, setSimFail] = useState(false);
  const [simTimeout, setSimTimeout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState<ExecTrace | null>(null);

  const run = async () => {
    setBusy(true); setTrace(null);
    const json = await api('/api/yahria/executions', { command, profile, action, resource, simulateFailure: simFail, simulateTimeout: simTimeout }, 'POST');
    if (json.ok) { setTrace(json.trace); onChanged(); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Terminal className="h-4 w-4 text-teal-300" /> Execution Fabric — chemin obligatoire</CardTitle>
            <CardDescription className="text-slate-500 text-xs">TÂCHE → FABRIC → POLITIQUE → OUTILS → SANDBOX → EXÉCUTION → OBSERVABILITÉ → PREUVE</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={command} onChange={(e) => setCommand(e.target.value)}
              className="bg-slate-950/70 border-slate-800 font-mono text-xs text-slate-200" />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Profil sandbox</label>
                <Select value={profile} onValueChange={setProfile}>
                  <SelectTrigger className="bg-slate-950/70 border-slate-800 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {['STANDARD', 'RESTRICTED', 'PARANOID'].map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Action</label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger className="bg-slate-950/70 border-slate-800 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {['filesystem.write', 'filesystem.read', 'network.egress', 'execution.run', 'tool.execute'].map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Ressource</label>
                <Select value={resource} onValueChange={setResource}>
                  <SelectTrigger className="bg-slate-950/70 border-slate-800 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {['workspace.overlay', 'workspace.snapshot', 'host.workspace', 'host.secrets', 'production', 'sandbox.tool-runtime'].map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={simFail} onCheckedChange={(v) => setSimFail(Boolean(v))} className="border-slate-700" />
                simuler échec vérification (F013)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={simTimeout} onCheckedChange={(v) => setSimTimeout(Boolean(v))} className="border-slate-700" />
                simuler timeout (INV-043)
              </label>
            </div>
            <Button onClick={run} disabled={busy} className="bg-teal-600 hover:bg-teal-500 text-white w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayIcon />}
              Exécuter dans la sandbox gouvernée
            </Button>
            {trace && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {trace.transitions.map((t, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className={`text-[10px] rounded px-1.5 py-0.5 border font-mono ${stateColor(t.to)}`}>{t.to}</span>
                      {i < trace.transitions.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-slate-600" />}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  <div><span className="text-slate-500">politique :</span> <Badge variant="outline" className={`text-[9px] ${trace.policyDecision.effect === 'DENY' ? 'border-red-500/40 text-red-300' : 'border-teal-500/40 text-teal-300'}`}>{trace.policyDecision.effect}</Badge> {trace.policyDecision.matchedRule ?? 'default-deny'} — {trace.policyDecision.reason}</div>
                  <div className="mt-1"><span className="text-slate-500">sandbox :</span> {trace.sandbox.fs}</div>
                  <div><span className="text-slate-500">réseau :</span> {trace.sandbox.network}</div>
                </div>
                <pre className="rounded-md bg-slate-950 border border-slate-800 p-3 text-[10.5px] font-mono text-slate-400 whitespace-pre-wrap max-h-40 overflow-y-auto">{trace.stdout}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Historique des exécutions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[430px]">
              <div className="space-y-1.5 pr-3">
                {executions.map((e) => (
                  <div key={e.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[10.5px] text-slate-300 truncate">{e.traceId ?? e.id}</div>
                      <div className="text-[10px] text-slate-500">{e.sandboxProfile} · exit {e.exitCode ?? '—'} · {e.durationMs} ms</div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${stateColor(e.state)}`}>{e.state}</Badge>
                  </div>
                ))}
                {executions.length === 0 && <div className="text-xs text-slate-600 text-center py-8">Aucune exécution.</div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlayIcon() { return <ArrowRight className="h-4 w-4 mr-2" />; }

// ── EVIDENCE VAULT ────────────────────────────────────────────────

interface EvidenceRow {
  id: string; evidenceUid: string; category: string; criticality: string; state: string;
  actorType: string; actorId: string; claim: string; contentHash: string | null; prevHash: string | null;
  createdAt: string;
}

export function EvidencePanel({ evidence, onChanged }: { evidence: EvidenceRow[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, string>>({});

  const act = async (id: string, action: 'verify' | 'seal') => {
    setBusy(id + action);
    const json = await api('/api/yahria/evidence', { id, action }, 'POST');
    if (json.ok) {
      setVerdicts((v) => ({ ...v, [id]: json.verdict.reason }));
      onChanged();
    }
    setBusy(null);
  };

  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-teal-300" /> Evidence Vault — CLAIM ≠ EVIDENCE</CardTitle>
        <CardDescription className="text-slate-500 text-xs">
          Cycle : DECLARED → CAPTURED → NORMALIZED → HASHED → LINKED → VERIFIED → SEALED. Chaque preuve est hachée (SHA-256) et chaînée à la précédente. Une preuve scellée ne peut plus être modifiée (INV-033).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[460px]">
          <div className="space-y-1.5 pr-3">
            {evidence.map((e) => (
              <div key={e.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-teal-300 shrink-0">{e.evidenceUid}</span>
                    <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">{e.category}</Badge>
                    {['CRITICAL', 'HIGH'].includes(e.criticality) && (
                      <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-300">{e.criticality}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] ${stateColor(e.state)}`}>{e.state}</Badge>
                    <button onClick={() => act(e.id, 'verify')} disabled={busy === e.id + 'verify'}
                      className="text-[9.5px] rounded border border-slate-700 px-1.5 py-0.5 text-slate-400 hover:border-teal-500/50 hover:text-teal-300">
                      vérifier
                    </button>
                    <button onClick={() => act(e.id, 'seal')} disabled={busy === e.id + 'seal'}
                      className="text-[9.5px] rounded border border-slate-700 px-1.5 py-0.5 text-slate-400 hover:border-teal-500/50 hover:text-teal-300">
                      sceller
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{e.claim}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-mono text-[9px] text-slate-600">{e.actorType}:{e.actorId}</span>
                  <span className="font-mono text-[9px] text-slate-600 truncate max-w-60" title={e.contentHash ?? ''}># {e.contentHash?.slice(0, 24)}…</span>
                  {e.prevHash && <span className="font-mono text-[9px] text-slate-700">← {e.prevHash.slice(0, 12)}…</span>}
                </div>
                {verdicts[e.id] && <div className="text-[10px] text-slate-500 mt-1">↳ {verdicts[e.id]}</div>}
              </div>
            ))}
            {evidence.length === 0 && <div className="text-xs text-slate-600 text-center py-8">Aucune preuve — exécutez une boucle cognitive.</div>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── POLICY CONTROL PLANE ──────────────────────────────────────────

interface PolicyRule {
  id: string; ruleId: string; name: string; effect: string; scope: string;
  condition: string; priority: number; version: string;
}

export function PolicyPanel({ policies, onChanged }: { policies: PolicyRule[]; onChanged: () => void }) {
  const [action, setAction] = useState('filesystem.read');
  const [resource, setResource] = useState('host.secrets');
  const [actor, setActor] = useState('coder');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ effect: string; matchedRule: string | null; reason: string; precedence: string } | null>(null);

  const evaluate = async () => {
    setBusy(true);
    const json = await api('/api/yahria/policy', { actorType: 'AGENT', actorId: actor, action, resource }, 'POST');
    if (json.ok) { setResult(json.evaluation); onChanged(); }
    setBusy(false);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4 text-teal-300" /> Policy Control Plane — deny-by-default</CardTitle>
          <CardDescription className="text-slate-500 text-xs">POLICY DENY &gt; MODEL &gt; AGENT &gt; TOOL &gt; CONVENANCE LOCALE (INV-120)</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-64">
            <div className="space-y-1.5 pr-3">
              {policies.map((p) => (
                <div key={p.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-300">{p.name}</div>
                    <div className="font-mono text-[9.5px] text-slate-600">{p.ruleId} v{p.version} · {p.scope} · priorité {p.priority}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${p.effect === 'DENY' ? 'border-red-500/40 text-red-300' : p.effect === 'ALLOW' ? 'border-teal-500/40 text-teal-300' : 'border-amber-500/40 text-amber-300'}`}>{p.effect}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Simulateur de décision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Acteur</label>
              <Select value={actor} onValueChange={setActor}>
                <SelectTrigger className="bg-slate-950/70 border-slate-800 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {['explorer', 'planner', 'coder', 'security', 'verifier'].map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Action</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="bg-slate-950/70 border-slate-800 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {['filesystem.write', 'filesystem.read', 'network.egress', 'evolution.promote', 'constitution.amend', 'execution.run'].map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Ressource</label>
              <Select value={resource} onValueChange={setResource}>
                <SelectTrigger className="bg-slate-950/70 border-slate-800 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {['host.secrets', 'host.workspace', 'workspace.overlay', 'workspace.snapshot', 'production', 'sandbox.tool-runtime'].map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={evaluate} disabled={busy} variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-teal-300">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Scale className="h-4 w-4 mr-2" />}
            Évaluer la politique
          </Button>
          {result && (
            <div className={`rounded-md border p-3 text-xs leading-relaxed ${result.effect === 'DENY' ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-teal-500/40 bg-teal-500/10 text-teal-300'}`}>
              <div className="flex items-center gap-2 font-semibold">
                {result.effect === 'DENY' ? <ShieldAlert className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {result.effect} {result.matchedRule && <span className="font-mono text-[10px] opacity-70">{result.matchedRule}</span>}
              </div>
              <p className="mt-1 opacity-80">{result.reason}</p>
              <p className="mt-1 font-mono text-[10px] opacity-60">{result.precedence}</p>
            </div>
          )}
          <Separator className="bg-slate-800" />
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Essayez : <span className="font-mono text-slate-500">filesystem.read / host.secrets</span> (deny, INV-053) vs
            <span className="font-mono text-slate-500"> filesystem.write / workspace.overlay</span> (allow) vs
            <span className="font-mono text-slate-500"> evolution.promote / production</span> (deny, D.6 gouverne D.8).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── BLUEPRINT (the two deliverables) ─────────────────────────────

export function BlueprintPanel() {
  const [spec, setSpec] = useState<string>('');

  useEffect(() => {
    fetch('/docs/HYBRID_REASONING_SPECIFICATION.md')
      .then((r) => r.text())
      .then(setSpec)
      .catch(() => setSpec('Spec indisponible.'));
  }, []);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4 text-teal-300" /> Carte d&apos;architecture YAHRIA</CardTitle>
          <CardDescription className="text-slate-500 text-xs">Vue d&apos;ensemble bilatérale : 8 sous-systèmes, 34 mécanismes clés.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          
          <img src="/docs/YAHRIA_CARTE_ARCHITECTURE.png" alt="Carte d'architecture YAHRIA" className="rounded-md border border-slate-800 w-full h-auto" />
          <a href="/docs/YAHRIA_CARTE_ARCHITECTURE.png" download="YAHRIA_CARTE_ARCHITECTURE.png"
            className="inline-flex items-center gap-1.5 text-xs text-teal-300 hover:text-teal-200">
            <Download className="h-3.5 w-3.5" /> Télécharger le PNG (haute résolution)
          </a>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-teal-300" /> HYBRID_REASONING_SPECIFICATION.md</CardTitle>
          <CardDescription className="text-slate-500 text-xs">Document ID YAHRIA-ROOT-COGNITIVE-001 — la spécification canonique qui manquait.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScrollArea className="max-h-[480px] rounded-md border border-slate-800">
            <pre className="p-4 text-[10.5px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">{spec}</pre>
          </ScrollArea>
          <a href="/docs/HYBRID_REASONING_SPECIFICATION.md" download="HYBRID_REASONING_SPECIFICATION.md"
            className="inline-flex items-center gap-1.5 text-xs text-teal-300 hover:text-teal-200">
            <BookOpenCheck className="h-3.5 w-3.5" /> Télécharger la spécification (.md)
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
