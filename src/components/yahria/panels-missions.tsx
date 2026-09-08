'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA MISSION CONTROL — Mission Graph (Domain 07, KRN-031)
// Orchestration multi-agents : DAG gouverné, tick par vague,
// verdicts honnêtes (COMPLETED/FAILED/BLOCKED/CANCELLED).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { stateColor } from '@/components/yahria/panels-core';
import { Network, Play, Plus, RefreshCw, Ban, Loader2, ArrowRight } from 'lucide-react';

interface MissionRow {
  missionUid: string; goal: string; state: string; strategy: string; traceId: string | null;
  taskCount: number; tasksCompleted: number; tasksFailed: number; createdAt: string;
}
interface MissionDetail {
  missionUid: string; goal: string; state: string; strategy: string; traceId: string | null; note: string | null;
  tasks: { id: string; seq: number; title: string; agentKey: string; toolId: string; state: string; dependsOn: number[]; retries: number; maxRetries: number; error: string | null }[];
}

export function MissionGraphPanel() {
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [goal, setGoal] = useState('');
  const [strategy, setStrategy] = useState<'DECOMPOSED' | 'MANUAL'>('DECOMPOSED');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/yahria/missions');
    const json = await res.json();
    if (json.ok) setMissions(json.missions ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (uid: string) => {
    const res = await fetch(`/api/yahria/missions?uid=${encodeURIComponent(uid)}`);
    const json = await res.json();
    if (json.ok) setDetail(json.mission);
  };

  const act = async (body: Record<string, unknown>, label: string) => {
    setBusy(label); setMsg(null);
    try {
      const res = await fetch('/api/yahria/missions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? (json.errors ?? []).join(' · ') ?? 'échec');
      setMsg({ kind: 'ok', text: json.report?.summary ?? json.mission?.missionUid ?? `${label} — fait` });
      if (body.action === 'create' && json.mission?.missionUid) await openDetail(json.mission.missionUid);
      if ((body.action === 'tick' || body.action === 'schedule') && (body.uid ?? detail?.missionUid)) await openDetail((body.uid as string) ?? detail!.missionUid);
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* création */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-teal-300" /> Mission multi-agents — graphe de tâches gouverné (D.07)
          </CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Chaque tâche = UN agent canonique × UN outil du registre (INV-224), DAG acyclique exigé (INV-223),
            exécution via capacité → politique (INV-216/062). Retry uniquement sur échec d&apos;exécution (INV-092).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="Objectif de mission (ex : « Fais un diagnostic complet du système »)"
              className="bg-slate-950/70 border-slate-800 text-sm text-slate-200"
            />
            <div className="flex gap-1.5 shrink-0">
              {(['DECOMPOSED', 'MANUAL'] as const).map((s) => (
                <button key={s} onClick={() => setStrategy(s)}
                  className={`text-[11px] rounded-md border px-2.5 py-1.5 transition-colors ${strategy === s ? 'border-teal-500/50 bg-teal-500/10 text-teal-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {s === 'DECOMPOSED' ? 'S1 auto' : 'JSON'}
                </button>
              ))}
            </div>
          </div>
          {strategy === 'MANUAL' && (
            <Textarea
              value={goal.startsWith('{') ? goal : ''}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={'{"goal":"…","tasks":[{"title":"Lire domaines","agentKey":"architect","toolId":"system.domains.list","dependsOn":[]},{"title":"Collecter preuves","agentKey":"explorer","toolId":"evidence.recent.list","dependsOn":[1]}]}'}
              className="bg-slate-950/70 border-slate-800 min-h-[90px] font-mono text-[11px] text-slate-300"
              disabled
            />
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => { const g = goal.trim(); if (!g) return; if (strategy === 'MANUAL' && g.startsWith('{')) { try { const o = JSON.parse(g); act({ action: 'create', goal: o.goal, strategy: 'MANUAL', tasks: o.tasks }, 'create'); return; } catch { setMsg({ kind: 'err', text: 'JSON invalide' }); return; } } act({ action: 'create', goal: g, strategy: 'DECOMPOSED' }, 'create'); }}
              disabled={!!busy || !goal.trim()}
              className="bg-teal-600 hover:bg-teal-500 text-white">
              {busy === 'create' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Créer la mission
            </Button>
            <Button variant="outline" onClick={load} className="border-slate-700 text-slate-300 hover:border-teal-500/50">
              <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
            </Button>
          </div>
          {msg && (
            <div className={`text-xs rounded-md border p-2.5 ${msg.kind === 'ok' ? 'border-teal-500/30 bg-teal-500/5 text-teal-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
              {msg.text}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* liste */}
        <Card className="bg-slate-900/60 border-slate-800 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Missions ({missions.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-1.5 pr-2">
                {missions.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">Aucune mission — créez-en une ci-dessus.</p>}
                {missions.map((m) => (
                  <button key={m.missionUid} onClick={() => openDetail(m.missionUid)}
                    className={`w-full text-left rounded-md border p-2.5 transition-colors ${detail?.missionUid === m.missionUid ? 'border-teal-500/50 bg-teal-500/5' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-teal-300">{m.missionUid}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${stateColor(m.state)}`}>{m.state}</Badge>
                    </div>
                    <div className="text-xs text-slate-300 mt-1 leading-tight line-clamp-2">{m.goal}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{m.tasksCompleted}/{m.taskCount} tâche(s) · {m.strategy} · {m.tasksFailed} échec(s)</div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* détail DAG */}
        <Card className="bg-slate-900/60 border-slate-800 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Graphe de la mission {detail ? `— ${detail.missionUid}` : ''}</CardTitle>
            {detail && (
              <CardDescription className="text-slate-500 text-xs font-mono">trace {detail.traceId ?? '—'} · stratégie {detail.strategy}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {!detail && <p className="text-xs text-slate-500 py-10 text-center">Sélectionnez une mission pour voir son DAG et l&apos;exécuter.</p>}
            {detail && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => act({ action: 'schedule', uid: detail.missionUid }, 'schedule')} disabled={!!busy}
                    className="bg-teal-600 hover:bg-teal-500 text-white">
                    {busy === 'schedule' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />} Programmer
                  </Button>
                  <Button size="sm" onClick={() => act({ action: 'tick', uid: detail.missionUid }, 'tick')} disabled={!!busy}
                    className="bg-amber-600 hover:bg-amber-500 text-white">
                    {busy === 'tick' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />} Tick (vague DAG)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const reason = window.prompt('Raison d\'annulation (≥ 10 caractères — INV-200) :');
                    if (reason && reason.trim().length >= 10) act({ action: 'cancel', uid: detail.missionUid, reason }, 'cancel');
                  }} disabled={!!busy} className="border-red-500/40 text-red-300 hover:border-red-500">
                    <Ban className="h-3.5 w-3.5 mr-1.5" /> Annuler
                  </Button>
                </div>
                <ScrollArea className="max-h-[340px]">
                  <div className="space-y-1.5 pr-2">
                    {detail.tasks.map((t) => (
                      <div key={t.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-slate-500">T{String(t.seq).padStart(2, '0')}</span>
                          <span className="text-xs font-medium text-slate-200 flex-1 min-w-0">{t.title}</span>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${stateColor(t.state)}`}>{t.state}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-slate-500">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">{t.agentKey}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-teal-400/80">{t.toolId}</span>
                          {t.dependsOn.length > 0 && <span>← dépend de {t.dependsOn.map((d) => `T${d}`).join(', ')}</span>}
                          {t.retries > 0 && <span className="text-amber-400">retries {t.retries}/{t.maxRetries}</span>}
                        </div>
                        {t.error && <div className="text-[10px] text-red-300/80 mt-1 leading-relaxed">{t.error}</div>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
