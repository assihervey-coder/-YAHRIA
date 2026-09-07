'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA CODE OS — Mission Control (entry point)
// Single canonical route · dark industrial theme
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommandCenter, CognitiveConsole } from '@/components/yahria/panels-core';
import { AgentPanel, TaskPanel, ExecutionPanel, EvidencePanel, PolicyPanel, BlueprintPanel } from '@/components/yahria/panels-ops';
import { RealtimePanel } from '@/components/yahria/realtime-panel';
import { StudioPanel } from '@/components/yahria/studio-panel';
import { SupremacyPanel } from '@/components/yahria/supremacy-panel';
import { LlmConnectorsPanel } from '@/components/yahria/llm-connectors-panel';
import { ToolRegistryPanel } from '@/components/yahria/tool-registry-panel';
import { useYahriaRealtime } from '@/hooks/use-yahria-realtime';
import { Loader2, ShieldCheck } from 'lucide-react';

interface SystemData {
  ok: boolean;
  boot: { counts: Record<string, number> };
  machines: unknown;
  domains: { code: string; name: string; purpose: string; phase: number; isCore: boolean; status: string }[];
  governance: Record<string, { name: string; role: string }>;
  bootstrapSequence: { step: string; doc?: string; action?: string }[];
  agents: never[];
  tasks: never[];
  executions: never[];
  evidence: never[];
  failures: never[];
  policies: never[];
}

export default function Home() {
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const rt = useYahriaRealtime();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/yahria/system');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load, tick]);

  const refresh = () => setTick((t) => t + 1);

  return (
    <div className="min-h-screen flex flex-col">
      {/* header */}
      <header className="border-b border-slate-800/80 bg-[#0B1120]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-teal-500/10 border border-teal-500/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-teal-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-100 tracking-wide truncate">
                YAHRIA CODE OS <span className="text-slate-500 font-normal">— Mission Control</span>
              </h1>
              <p className="text-[10.5px] text-slate-500 truncate">
                Autonomous · Hybrid Reasoning · Evidence-Driven · Governed — V1.0.0 constitutionnel
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${
              rt.status === 'live' ? 'bg-teal-400 animate-pulse' :
              rt.status === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'
            }`} />
            KERNEL ONLINE · POLICY: DENY-BY-DEFAULT · WS: {rt.status.toUpperCase()}
          </div>
        </div>
      </header>

      {/* body */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 lg:px-6 py-5">
        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            Échec du bootstrap YAHRIA : {error}
          </div>
        )}
        {!data && !error && (
          <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
            <span className="text-sm">Bootstrap constitutionnel en cours — lecture du contrat racine…</span>
          </div>
        )}
        {data && (
          <Tabs defaultValue="command" className="w-full">
            <TabsList className="bg-slate-900/70 border border-slate-800 h-auto flex-wrap justify-start gap-0.5 p-1">
              {[
                ['studio', 'Studio autonome'],
                ['supremacy', 'Souveraineté R8'],
                ['llm', 'Connecteurs IA'],
                ['tools', 'Registre des outils'],
                ['command', 'Centre de commande'],
                ['cognitive', 'Raisonnement hybride'],
                ['agents', 'Agent OS'],
                ['tasks', 'Graphe de tâches'],
                ['executions', 'Exécutions'],
                ['evidence', 'Preuves'],
                ['policy', 'Politiques'],
                ['blueprint', 'Blueprint'],
                ['realtime', 'Temps réel'],
              ].map(([v, label]) => (
                <TabsTrigger key={v} value={v}
                  className="text-xs data-[state=active]:bg-teal-500/15 data-[state=active]:text-teal-300 text-slate-400 px-3 py-1.5">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="studio" className="mt-4"><StudioPanel events={rt.events} /></TabsContent>
            <TabsContent value="supremacy" className="mt-4"><SupremacyPanel /></TabsContent>
            <TabsContent value="llm" className="mt-4"><LlmConnectorsPanel /></TabsContent>
            <TabsContent value="tools" className="mt-4"><ToolRegistryPanel /></TabsContent>
            <TabsContent value="command" className="mt-4"><CommandCenter data={data} /></TabsContent>
            <TabsContent value="cognitive" className="mt-4"><CognitiveConsole /></TabsContent>
            <TabsContent value="agents" className="mt-4"><AgentPanel agents={data.agents} onChanged={refresh} /></TabsContent>
            <TabsContent value="tasks" className="mt-4">
              <TaskPanel tasks={data.tasks} machine={machineFallback(data)} onChanged={refresh} />
            </TabsContent>
            <TabsContent value="executions" className="mt-4"><ExecutionPanel executions={data.executions} onChanged={refresh} /></TabsContent>
            <TabsContent value="evidence" className="mt-4"><EvidencePanel evidence={data.evidence} onChanged={refresh} /></TabsContent>
            <TabsContent value="policy" className="mt-4"><PolicyPanel policies={seedPolicies(data)} onChanged={refresh} /></TabsContent>
            <TabsContent value="blueprint" className="mt-4"><BlueprintPanel /></TabsContent>
            <TabsContent value="realtime" className="mt-4">
              <RealtimePanel status={rt.status} events={rt.events} counters={rt.counters} total={rt.total} onClear={rt.clear} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* footer — sticky via flex layout */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#0B1120]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10.5px] text-slate-600">
          <span>YAHRIA — Your Autonomous Hybrid Reasoning Intelligence Assistant for Code</span>
          <span className="font-mono">READ · UNDERSTAND · DEPEND · IMPLEMENT · TEST · VERIFY · PROVE</span>
        </div>
      </footer>
    </div>
  );
}

// Minimal client fallbacks so panels can render before specialized endpoints load
function machineFallback(data: SystemData): { states: string[]; transitions: { from: string; to: string; guard: string; authority: string }[] } {
  const m = data.machines as { name?: string; states?: string[]; transitions?: { from: string; to: string; guard: string; authority: string }[] }[] | null;
  const task = Array.isArray(m) ? m.find((x) => x?.name === 'TASK') : null;
  return {
    states: task?.states ?? ['PENDING', 'READY', 'RUNNING', 'BLOCKED', 'FAILED', 'CANCELLED', 'COMPLETED'],
    transitions: task?.transitions ?? [],
  };
}

function seedPolicies(data: SystemData): { id: string; ruleId: string; name: string; effect: string; scope: string; condition: string; priority: number; version: string }[] {
  const list = (data as unknown as { policies?: { id: string; ruleId: string; name: string; effect: string; scope: string; condition: string; priority: number; version: string }[] }).policies;
  return list ?? [];
}
