'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA — Observability Panel (Domain 11, R13 / KRN-028)
// Index des traces, timeline assemblée multi-sources, replay
// LECTURE SEULE (INV-218), forensics (intégrité INV-110), drift
// contrat registre ↔ historique d'invocations.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity, AlertTriangle, History, Loader2, Radio, RefreshCw, ScanSearch, ShieldCheck, ShieldX,
} from 'lucide-react';

interface TraceRow {
  traceId: string; sources: string[];
  counts: { evidence: number; invocations: number; agentRuns: number; executions: number; policyDecisions: number };
  firstAt: string | null; lastAt: string | null;
}
interface TimelineEntry {
  ts: string; kind: string; ref: string; actor: string; summary: string; severity: string;
}
interface Timeline {
  ok: boolean; traceId: string; found: boolean; entries: TimelineEntry[];
  forensics: { total: number; byKind: Record<string, number>; denies: number; failures: number; window: { from: string | null; to: string | null } };
  chain: { checked: number; intact: number; tampered: { evidenceUid: string; reason: string }[] };
}
interface Replay {
  ok: boolean; traceId: string; replayedAt: string; entries: number; chainIntact: boolean;
  toolChecks: { invocationId: string; toolId: string; recordedVerdict: string; contractStillValid: boolean; contractErrors: string[] }[];
  driftCount: number; note: string;
}
interface DriftRow { toolId: string; invocations: number; drifted: number; sampleErrors: string[] }

const KIND_STYLE: Record<string, string> = {
  EVIDENCE: 'border-teal-500/40 text-teal-300',
  TOOL_INVOCATION: 'border-purple-500/40 text-purple-300',
  AGENT_RUN: 'border-amber-500/40 text-amber-300',
  EXECUTION: 'border-slate-500/40 text-slate-300',
  POLICY_DECISION: 'border-red-500/40 text-red-300',
  SYSTEM_EVENT: 'border-sky-500/40 text-sky-300',
};

export function ObservabilityPanel() {
  const [traces, setTraces] = useState<TraceRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [drift, setDrift] = useState<{ rows: DriftRow[]; scanned: number; drifted: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadTraces = useCallback(async () => {
    const res = await fetch('/api/yahria/observability');
    const json = await res.json();
    if (json.ok) setTraces(json.traces);
  }, []);
  useEffect(() => { loadTraces(); }, [loadTraces]);

  const openTrace = async (traceId: string) => {
    setBusy(traceId); setReplay(null);
    try {
      const res = await fetch(`/api/yahria/observability?traceId=${encodeURIComponent(traceId)}`);
      const json = await res.json();
      if (json.ok) { setTimeline(json.timeline); setSelected(traceId); }
    } finally { setBusy(null); }
  };

  const doReplay = async () => {
    if (!selected) return;
    setBusy('replay');
    try {
      const res = await fetch('/api/yahria/observability', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replay', traceId: selected }),
      });
      const json = await res.json();
      if (json.ok) setReplay(json.replay);
    } finally { setBusy(null); }
  };

  const doDrift = async () => {
    setBusy('drift');
    try {
      const res = await fetch('/api/yahria/observability', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drift' }),
      });
      const json = await res.json();
      if (json.ok) setDrift(json.report);
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-300" /> Observabilité d&apos;exécution — Domaine 11
              </CardTitle>
              <CardDescription className="text-[11px] mt-1">
                Traces assemblées multi-sources (preuves, invocations, agent runs, exécutions, décisions de politique). Replay <b>LECTURE SEULE</b> (INV-218), forensics d&apos;empreintes (INV-110), drift contrat (INV-190).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={loadTraces}><RefreshCw className="h-3 w-3 mr-1" />Traces</Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" disabled={busy === 'drift'} onClick={doDrift}>
                {busy === 'drift' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ScanSearch className="h-3 w-3 mr-1" />}Drift contrats
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* trace index */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-300">Index des traces — {traces?.length ?? '…'} trouvée(s)</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-44">
            <table className="w-full text-[10px] text-slate-400">
              <thead><tr className="text-left text-slate-500">
                <th className="py-1 pr-2">traceId</th><th className="pr-2">sources</th><th className="pr-2">preuves</th><th className="pr-2">outils</th><th className="pr-2">runs</th><th className="pr-2">exéc.</th><th className="pr-2">décisions</th><th>dernier événement</th>
              </tr></thead>
              <tbody className="font-mono">
                {(traces ?? []).map((t) => (
                  <tr key={t.traceId} className={`border-t border-slate-800/60 cursor-pointer hover:bg-slate-800/40 ${selected === t.traceId ? 'bg-teal-500/5' : ''}`}
                    onClick={() => openTrace(t.traceId)}>
                    <td className="py-1 pr-2 text-teal-300 truncate max-w-40">{t.traceId}</td>
                    <td className="pr-2 text-slate-500">{t.sources.length}</td>
                    <td className="pr-2">{t.counts.evidence}</td>
                    <td className="pr-2">{t.counts.invocations}</td>
                    <td className="pr-2">{t.counts.agentRuns}</td>
                    <td className="pr-2">{t.counts.executions}</td>
                    <td className="pr-2">{t.counts.policyDecisions}</td>
                    <td className="text-slate-500">{t.lastAt ? new Date(t.lastAt).toLocaleString('fr-FR') : '—'}</td>
                  </tr>
                ))}
                {traces && traces.length === 0 && (
                  <tr><td colSpan={8} className="py-3 text-center text-slate-600">aucune trace — lancez une mission agent ou une boucle cognitive</td></tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* timeline */}
      {timeline && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-xs text-slate-100 flex items-center gap-2"><History className="h-3.5 w-3.5 text-teal-300" /> Timeline {timeline.traceId}</CardTitle>
                <CardDescription className="text-[10.5px] mt-0.5">
                  {timeline.found ? `${timeline.forensics.total} entrées ordonnées · fenêtre ${timeline.forensics.window.from ? new Date(timeline.forensics.window.from).toLocaleTimeString('fr-FR') : '—'} → ${timeline.forensics.window.to ? new Date(timeline.forensics.window.to).toLocaleTimeString('fr-FR') : '—'}` : 'trace introuvable'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[10px] ${timeline.chain.tampered.length === 0 ? 'border-teal-500/50 text-teal-300' : 'border-red-500/50 text-red-300'}`}>
                  {timeline.chain.tampered.length === 0 ? <ShieldCheck className="h-3 w-3 mr-1" /> : <ShieldX className="h-3 w-3 mr-1" />}
                  chaîne {timeline.chain.intact}/{timeline.chain.checked}
                </Badge>
                <Button size="sm" variant="outline" className="h-7 text-[11px] border-purple-600/50 text-purple-300" disabled={busy === 'replay' || !timeline.found} onClick={doReplay}>
                  {busy === 'replay' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Radio className="h-3 w-3 mr-1" />}Replay
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {Object.entries(timeline.forensics.byKind).map(([k, n]) => (
                <Badge key={k} variant="outline" className={`text-[9px] ${KIND_STYLE[k] ?? 'border-slate-700 text-slate-400'}`}>{k} × {n}</Badge>
              ))}
              {(timeline.forensics.denies > 0 || timeline.forensics.failures > 0) && (
                <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{timeline.forensics.denies} refus · {timeline.forensics.failures} échecs</Badge>
              )}
            </div>
            {timeline.chain.tampered.length > 0 && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2.5 text-[10.5px] text-red-300">
                <b>FORENSICS — altération détectée :</b> {timeline.chain.tampered.map((t) => `${t.evidenceUid} (${t.reason})`).join(' ; ')}
              </div>
            )}
            <ScrollArea className="max-h-80">
              <div className="space-y-1 pr-3">
                {timeline.entries.map((e, i) => (
                  <div key={`${e.ref}-${i}`} className="flex items-start gap-2 text-[10.5px] border-l-2 border-slate-800 pl-2 py-0.5">
                    <span className="font-mono text-slate-600 w-20 shrink-0">{new Date(e.ts).toLocaleTimeString('fr-FR')}</span>
                    <Badge variant="outline" className={`text-[8.5px] px-1 py-0 shrink-0 ${KIND_STYLE[e.kind] ?? 'border-slate-700 text-slate-400'}`}>{e.kind}</Badge>
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-300">{e.summary}</span>
                      <span className="text-slate-600 ml-2 font-mono">{e.actor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* replay result */}
      {replay && (
        <Card className="border-purple-500/40 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-purple-200 flex items-center gap-2"><Radio className="h-3.5 w-3.5" /> Replay {replay.traceId} — reconstruction lecture seule</CardTitle>
            <CardDescription className="text-[10px]">{replay.note}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            <p className="text-[10.5px] text-slate-400">
              {replay.entries} entrées rejouées · chaîne d&apos;empreintes {replay.chainIntact ? 'INTACTE' : 'COMPROMISE'} · {replay.driftCount}/{replay.toolChecks.length} invocation(s) en drift de contrat
            </p>
            {replay.toolChecks.map((c) => (
              <div key={c.invocationId} className="flex items-center gap-2 text-[10px] font-mono">
                <Badge variant="outline" className={`text-[9px] ${c.contractStillValid ? 'border-teal-500/50 text-teal-300' : 'border-orange-500/50 text-orange-300'}`}>
                  {c.contractStillValid ? 'contrat OK' : 'DRIFT'}
                </Badge>
                <span className="text-slate-300">{c.toolId}</span>
                <span className="text-slate-600">enregistré : {c.recordedVerdict}</span>
                {!c.contractStillValid && <span className="text-orange-300">{c.contractErrors.join(' ; ')}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* drift report */}
      {drift && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-300">Drift contrat registre ↔ historique — {drift.drifted}/{drift.scanned} invocation(s) ne passeraient plus le contrat actuel</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {drift.rows.filter((r) => r.invocations > 0).map((r) => (
                <div key={r.toolId} className="flex items-center gap-2 text-[10px] font-mono">
                  <Badge variant="outline" className={`text-[9px] ${r.drifted === 0 ? 'border-teal-500/40 text-teal-300' : 'border-orange-500/50 text-orange-300'}`}>
                    {r.drifted}/{r.invocations}
                  </Badge>
                  <span className="text-slate-300">{r.toolId}</span>
                  {r.sampleErrors.length > 0 && <span className="text-orange-300/80 truncate">{r.sampleErrors.join(' ; ')}</span>}
                </div>
              ))}
              {drift.scanned === 0 && <p className="text-[10px] text-slate-600">aucune invocation ALLOW enregistrée — rien à comparer</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
