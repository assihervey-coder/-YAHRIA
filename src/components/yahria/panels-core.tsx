'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA MISSION CONTROL — Core panels
// Command Center + Cognitive (Hybrid Reasoning) Console
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck, Brain, Boxes, Cpu, FileCheck2, GitBranch,
  Play, Loader2, Scale, ShieldAlert, CheckCircle2, XCircle, Eye, Landmark,
} from 'lucide-react';

// ── shared helpers ────────────────────────────────────────────────

export const stateColor = (s: string): string => {
  if (['SUCCEEDED', 'COMPLETED', 'PASS', 'SEALED', 'VERIFIED', 'RECOVERED', 'ACCEPTED', 'ALLOW', 'PROMOTED', 'ACTIVE'].includes(s)) return 'bg-teal-500/15 text-teal-300 border-teal-500/40';
  if (['FAILED', 'FAIL', 'DENY', 'BLOCKED', 'REJECTED', 'UNRECOVERABLE', 'QUARANTINED', 'CORRUPTED', 'TIMED_OUT', 'INVALID'].includes(s)) return 'bg-red-500/15 text-red-300 border-red-500/40';
  if (['RUNNING', 'IMPLEMENTING', 'REASONING', 'RECOVERING', 'VERIFYING', 'CLASSIFIED', 'REQUIRE_APPROVAL', 'PROBABLE'].includes(s)) return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/40';
};

export const pathColor = (p: string): string => {
  if (p === 'SYSTEM_1') return 'bg-teal-500/15 text-teal-300 border-teal-500/40';
  if (p === 'SYSTEM_2') return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
  if (p === 'CASCADE') return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
  return 'bg-red-500/15 text-red-300 border-red-500/40';
};

export const pathLabel = (p: string): string =>
  ({ SYSTEM_1: 'SYSTÈME 1 · rapide', SYSTEM_2: 'SYSTÈME 2 · profond', CASCADE: 'CASCADE S1→S2', BLOCKED: 'BLOQUÉ' }[p] ?? p);

export function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct <= 30 ? 'bg-teal-400' : pct <= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-300">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type SystemData = {
  boot: { counts: Record<string, number> };
  domains: { code: string; name: string; purpose: string; phase: number; isCore: boolean; status: string }[];
  agents: { id: string; key: string; name: string; role: string; autonomy: string; status: string; capabilities: string; runs: unknown[] }[];
  evidence: unknown[];
  tasks: unknown[];
  executions: unknown[];
  failures: unknown[];
  traces: unknown[];
  memories: unknown[];
  bootstrapSequence: { step: string; doc?: string; action?: string }[];
  governance: Record<string, { name: string; role: string }>;
};

// ── COMMAND CENTER ────────────────────────────────────────────────

export function CommandCenter({ data }: { data: SystemData }) {
  const stats = [
    { icon: Landmark, label: 'Domaines canoniques', value: data.boot?.counts?.domains ?? 24, note: 'D.00 → D.23' },
    { icon: Boxes, label: 'Agents gouvernés', value: data.boot?.counts?.agents ?? 9, note: 'autonomie < politique' },
    { icon: Scale, label: 'Politiques seed', value: data.boot?.counts?.policies ?? 10, note: 'deny-by-default' },
    { icon: FileCheck2, label: 'Preuves chaînées', value: Array.isArray(data.evidence) ? data.evidence.length : 0, note: 'SHA-256 + lignée' },
  ];
  const triptych = Object.values(data.governance ?? {});

  return (
    <div className="space-y-5">
      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
                <s.icon className="h-5 w-5 text-teal-300" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold tabular-nums text-slate-100">{s.value}</div>
                <div className="text-xs text-slate-400 truncate">{s.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{s.note}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* governance triptych */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-300" /> Triptyque de gouvernance — D.6 gouverne D.8
          </CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            La boucle constitutionnelle : savoir ce qui est vrai → apprendre de ce qui est vrai → évoluer à partir de ce qui a été démontré.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          {triptych.map((g, i) => (
            <div key={g.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <Badge variant="outline" className={i === 0 ? 'border-teal-500/40 text-teal-300' : i === 1 ? 'border-amber-500/40 text-amber-300' : 'border-purple-500/40 text-purple-300'}>
                {g.name.split('—')[0].trim()}
              </Badge>
              <div className="mt-2 text-sm font-medium text-slate-200">{g.name.split('—')[1]?.trim()}</div>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">{g.role}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 24 domains grid */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-teal-300" /> Carte des 24 domaines canoniques — ordre du graphe de dépendances
          </CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Chaque composant appartient à un domaine déclaré (INV-001). Les domaines cœur (transverses) sont marqués d&apos;un point plein.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {(data.domains ?? []).slice().sort((a, b) => a.phase - b.phase).map((d) => (
              <div key={d.code} className="rounded-md border border-slate-800 bg-slate-950/50 p-2.5 hover:border-slate-600 transition-colors" title={d.purpose}>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs text-teal-300">D.{d.code}</span>
                  <div className="flex items-center gap-1.5">
                    {d.isCore && <span className="h-1.5 w-1.5 rounded-full bg-teal-400" title="domaine transverse" />}
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${stateColor(d.status)}`}>{d.status}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-xs font-medium text-slate-300 leading-tight">{d.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">phase {d.phase}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* bootstrap sequence */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-teal-300" /> Séquence de bootstrap (contrat racine §3)
          </CardTitle>
          <CardDescription className="text-slate-500 text-xs">Aucune étape ne peut être omise silencieusement — « NEVER GUESS. NEVER BYPASS. NEVER SILENTLY DRIFT. »</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {data.bootstrapSequence?.map((s) => (
              <div key={s.step} className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1">
                <span className="font-mono text-[10px] text-teal-400">{s.step}</span>
                <span className="text-[11px] text-slate-300">{s.doc ?? s.action}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── COGNITIVE / HYBRID REASONING CONSOLE ─────────────────────────

interface LoopResult {
  traceId: string;
  route: { path: string; complexity: number; uncertainty: number; rationale: string; escalationReason: string | null; signals: { keywordMatches: string[] } };
  plan: { index: number; action: string; detail: string; owner: string; requiresApproval: boolean }[];
  steps: { step: string; detail: string; ms: number }[];
  verdict: string;
  reflection: string | null;
  finalAnswer: string;
  evidenceUids: string[];
  durationMs: number;
}

const PRESETS = [
  'Quel est le statut du système ?',
  'Montre-moi la liste des exécutions',
  'Explique la séparation entre proposition et approbation',
  "Implémente un module d'authentification puis déploie-le en production",
  'Construis un pipeline de migration, puis teste-le, puis génère la documentation',
];

export function CognitiveConsole() {
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LoopResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (g: string) => {
    if (!g.trim() || running) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/yahria/cognitive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: g }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Échec de la boucle cognitive');
      setResult(json.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-teal-300" /> Console de raisonnement hybride
          </CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Le routeur classifie chaque objectif (Système 1 déterministe / Système 2 délibératif / Cascade), puis le plan passe par politique → exécution sandbox → vérification indépendante → preuve scellée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Exprimez un objectif… (ex : « Implémente l'export PDF du rapport d'exécution, puis vérifie-le »)"
            className="bg-slate-950/70 border-slate-800 min-h-[70px] text-sm text-slate-200 placeholder:text-slate-600"
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => { setGoal(p); run(p); }}
                disabled={running}
                className="text-[11px] rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-slate-400 hover:border-teal-500/50 hover:text-teal-300 transition-colors disabled:opacity-40"
              >
                {p.length > 58 ? p.slice(0, 58) + '…' : p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => run(goal)} disabled={running || !goal.trim()} className="bg-teal-600 hover:bg-teal-500 text-white">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {running ? 'Boucle cognitive en cours…' : 'Exécuter la boucle cognitive'}
            </Button>
            {result && <span className="text-xs text-slate-500">trace {result.traceId} · {result.durationMs} ms</span>}
          </div>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="grid lg:grid-cols-5 gap-4">
          {/* routing */}
          <Card className="bg-slate-900/60 border-slate-800 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Décision du routeur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className={`border ${pathColor(result.route.path)}`}>{pathLabel(result.route.path)}</Badge>
                <Badge variant="outline" className={result.verdict === 'PASS' ? 'border-teal-500/40 text-teal-300' : 'border-red-500/40 text-red-300'}>
                  {result.verdict === 'PASS' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {result.verdict === 'FAIL' && <XCircle className="h-3 w-3 mr-1" />}
                  {result.verdict}
                </Badge>
              </div>
              <Meter label="Complexité" value={result.route.complexity} />
              <Meter label="Incertitude (INV-081)" value={result.route.uncertainty} />
              <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-slate-700 pl-3">{result.route.rationale}</p>
              {result.route.escalationReason && (
                <p className="text-[11px] text-amber-300/80">↳ escalade : {result.route.escalationReason}</p>
              )}
              {result.route.signals?.keywordMatches?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.route.signals.keywordMatches.slice(0, 8).map((k) => (
                    <span key={k} className="text-[10px] rounded bg-slate-800 px-1.5 py-0.5 text-slate-400 font-mono">{k}</span>
                  ))}
                </div>
              )}
              <Separator className="bg-slate-800" />
              <div>
                <div className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1"><Eye className="h-3 w-3" /> Réponse</div>
                <p className="text-xs text-slate-400 leading-relaxed">{result.finalAnswer}</p>
              </div>
              {result.reflection && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-xs font-medium text-amber-300 mb-1">Réflexion structurée (pas de patch aveugle)</div>
                  <p className="text-[11px] text-amber-200/70 leading-relaxed">{result.reflection}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* plan + loop steps */}
          <Card className="bg-slate-900/60 border-slate-800 lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Plan gouverné ({result.plan.length} étapes) & boucle d&apos;exécution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="max-h-56">
                <div className="space-y-1.5 pr-3">
                  {result.plan.map((p) => (
                    <div key={p.index} className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-2">
                      <span className="font-mono text-[10px] text-teal-400 mt-1 w-5 shrink-0">{String(p.index).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-slate-200">{p.action}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 text-slate-400 border-slate-700">{p.owner}</Badge>
                          {p.requiresApproval && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-300">APPROBATION</Badge>}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{p.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Separator className="bg-slate-800" />
              <div className="space-y-1">
                {result.steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="font-mono text-slate-600 w-14 shrink-0 text-right">{s.ms} ms</span>
                    <span className="font-mono text-teal-400/80 w-36 shrink-0 truncate" title={s.step}>{s.step}</span>
                    <span className="text-slate-400 min-w-0">{s.detail.length > 140 ? s.detail.slice(0, 140) + '…' : s.detail}</span>
                  </div>
                ))}
              </div>
              <Separator className="bg-slate-800" />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-1">Preuves :</span>
                {result.evidenceUids.map((u) => (
                  <span key={u} className="font-mono text-[10px] rounded bg-teal-500/10 border border-teal-500/30 px-1.5 py-0.5 text-teal-300">{u}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
