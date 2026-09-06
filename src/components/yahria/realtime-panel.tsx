'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA — Realtime Panel (Domain 11 — Execution Observability)
// Live constitutional event feed over WebSocket /ws/yahria.
// ═══════════════════════════════════════════════════════════════

import type { YahriaEvent, YahriaSeverity } from '@/lib/yahria/realtime';
import type { RealtimeStatus } from '@/hooks/use-yahria-realtime';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Radio, Trash2 } from 'lucide-react';

interface RealtimePanelProps {
  status: RealtimeStatus;
  events: YahriaEvent[];
  counters: Record<string, number>;
  total: number;
  onClear: () => void;
}

const SEVERITY_STYLE: Record<YahriaSeverity, { dot: string; badge: string; label: string }> = {
  INFO: { dot: 'bg-sky-400', badge: 'bg-sky-500/10 text-sky-300 border-sky-500/30', label: 'INFO' },
  SUCCESS: { dot: 'bg-teal-400', badge: 'bg-teal-500/10 text-teal-300 border-teal-500/30', label: 'OK' },
  WARN: { dot: 'bg-amber-400', badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30', label: 'WARN' },
  CRITICAL: { dot: 'bg-red-400', badge: 'bg-red-500/10 text-red-300 border-red-500/30', label: 'CRIT' },
};

const STATUS_STYLE: Record<RealtimeStatus, { dot: string; text: string; label: string }> = {
  live: { dot: 'bg-teal-400 animate-pulse', text: 'text-teal-300', label: 'LIVE — WebSocket connecté' },
  connecting: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300', label: 'CONNEXION…' },
  offline: { dot: 'bg-red-500', text: 'text-red-300', label: 'HORS LIGNE — reconnexion auto' },
};

function timeOf(ts: string): string {
  try { return new Date(ts).toLocaleTimeString('fr-FR', { hour12: false }); } catch { return ts; }
}

function payloadSummary(e: YahriaEvent): string {
  if (!e.payload) return '';
  try {
    const keys = Object.keys(e.payload);
    if (keys.length === 0) return '';
    return keys.map((k) => {
      const v = (e.payload as Record<string, unknown>)[k];
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}=${s !== undefined && s !== null && String(s).length <= 42 ? String(s) : '…'}`;
    }).join(' · ');
  } catch { return ''; }
}

export function RealtimePanel({ status, events, counters, total, onClear }: RealtimePanelProps) {
  const st = STATUS_STYLE[status];
  const counterEntries = Object.entries(counters).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* status banner */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${st.dot}`} />
          <div className="min-w-0">
            <p className={`text-sm font-semibold font-mono ${st.text}`}>{st.label}</p>
            <p className="text-[10.5px] text-slate-500 font-mono truncate">
              ws://…/ws/yahria · domaine 11 — Execution Observability · {total} événement{total > 1 ? 's' : ''} reçu{total > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onClear}
          className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Vider
        </Button>
      </div>

      {/* counters by type */}
      <div className="flex flex-wrap gap-1.5">
        {counterEntries.length === 0 && (
          <span className="text-xs text-slate-600 font-mono">
            Aucun événement reçu — lancez une boucle cognitive ou une transition de tâche.
          </span>
        )}
        {counterEntries.map(([type, n]) => (
          <Badge key={type} variant="outline" className="font-mono text-[10px] border-slate-700 text-slate-400">
            <Activity className="h-3 w-3 mr-1 text-teal-400" />{type} × {n}
          </Badge>
        ))}
      </div>

      {/* live feed */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-teal-400" />
          <span className="text-xs font-semibold text-slate-300 font-mono tracking-wide">FLUX CONSTITUTIONNEL TEMPS RÉEL</span>
          <span className="ml-auto text-[10px] text-slate-600 font-mono">{events.length}/{200}</span>
        </div>
        <ScrollArea className="h-[420px]">
          <div className="divide-y divide-slate-800/60">
            {events.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-slate-600 font-mono">
                En attente d&apos;événements constitutionnels…
              </div>
            )}
            {[...events].reverse().map((e) => {
              const sev = SEVERITY_STYLE[e.severity] ?? SEVERITY_STYLE.INFO;
              const summary = payloadSummary(e);
              return (
                <div key={e.id} className="px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-600">{timeOf(e.ts)}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                    <Badge variant="outline" className={`font-mono text-[9.5px] px-1.5 py-0 ${sev.badge}`}>{sev.label}</Badge>
                    <span className="font-mono text-[11px] text-slate-300">{e.type}</span>
                    <span className="font-mono text-[9.5px] text-slate-600">DOM {e.source}</span>
                    <span className="ml-auto font-mono text-[9.5px] text-slate-700">{e.id}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-400 mt-1 leading-relaxed">{e.message}</p>
                  {summary && (
                    <p className="text-[9.5px] text-slate-600 font-mono mt-0.5 truncate">{summary}</p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
