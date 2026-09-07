'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA — Policy Console Panel (Domain 12, R13 / KRN-029)
// Gestion fine RBAC des outils : règles gouvernées (POL-C-*),
// verrou constitutionnel (INV-219), simulateur sans effet de bord
// (INV-220), analyse d'impact avant création, décisions récentes.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FlaskConical, Loader2, Lock, Plus, RefreshCw, Scale, ShieldCheck, Trash2, Unlock,
} from 'lucide-react';

interface RuleRow {
  id: string; ruleId: string; name: string; effect: string; scope: string;
  condition: { action: string; resource: string; actorType?: string; actorId?: string };
  priority: number; version: string; active: boolean; constitutional: boolean; createdAt: string;
}
interface Decision { id: string; ruleId: string | null; effect: string; reason: string; decidedBy: string; createdAt: string }
interface SimResult { effect: string; matchedRule: string | null; reason: string; precedence: string; note: string }
interface ImpactFlip { toolId: string; riskClass: string; before: string; after: string; flips: boolean }

const effectBadge = (e: string) =>
  e === 'ALLOW' ? 'border-teal-500/50 text-teal-300'
  : e === 'DENY' ? 'border-red-500/50 text-red-300'
  : 'border-amber-500/50 text-amber-300';

const DRAFT_DEFAULT = {
  name: '', effect: 'ALLOW', scope: 'TOOL', action: 'tool.execute',
  resource: 'sideeffect.sandbox.cli.run', priority: 4, actorType: 'AGENT', actorId: 'tester', reason: '',
};

export function PolicyConsolePanel() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // simulator
  const [sim, setSim] = useState({ actorType: 'AGENT', actorId: 'tester', action: 'tool.execute', resource: 'sideeffect.sandbox.cli.run' });
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  // draft + impact
  const [draft, setDraft] = useState(DRAFT_DEFAULT);
  const [impact, setImpact] = useState<{ flips: ImpactFlip[]; wouldFlip: number; note: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/yahria/policy-console');
    const json = await res.json();
    if (json.ok) { setRules(json.rules); setDecisions(json.decisions); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (payload: Record<string, unknown>, key: string, onOk?: (json: Record<string, unknown>) => void) => {
    setBusy(key); setMsg(null);
    try {
      const res = await fetch('/api/yahria/policy-console', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json() as Record<string, unknown>;
      if (res.status === 200) {
        onOk?.(json);
        load();
      } else {
        const errors = Array.isArray(json.errors) ? (json.errors as string[]).join(' ; ') : String(json.error ?? 'échec');
        setMsg({ kind: 'err', text: errors });
      }
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                <Scale className="h-4 w-4 text-teal-300" /> Console de politiques — Domaine 12
              </CardTitle>
              <CardDescription className="text-[11px] mt-1">
                RBAC fin sur les outils : règles gouvernées <b>POL-C-*</b> avec portée acteur (actorType/actorId). Règles constitutionnelles <b>verrouillées</b> (INV-219), simulateur et analyse d&apos;impact <b>sans effet de bord</b> (INV-220), toute mutation justifiée et scellée (INV-121).
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[11px] shrink-0" onClick={load}><RefreshCw className="h-3 w-3 mr-1" />Actualiser</Button>
          </div>
        </CardHeader>
      </Card>

      {msg && (
        <div className={`rounded-md border p-3 text-xs ${msg.kind === 'ok' ? 'border-teal-500/40 bg-teal-500/10 text-teal-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* rules table */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-300">Base de règles — {rules.filter((r) => r.constitutional).length} constitutionnelles (verrouillées) + {rules.filter((r) => !r.constitutional).length} gouvernées</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-72">
            <table className="w-full text-[10px] text-slate-400">
              <thead><tr className="text-left text-slate-500">
                <th className="py-1 pr-2">ruleId</th><th className="pr-2">effet</th><th className="pr-2">scope</th><th className="pr-2">action</th><th className="pr-2">resource</th><th className="pr-2">acteur</th><th className="pr-2">prio</th><th className="pr-2">état</th><th>mutation</th>
              </tr></thead>
              <tbody className="font-mono">
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800/60">
                    <td className="py-1 pr-2 text-slate-300" title={r.name}>{r.ruleId}{r.constitutional && <Lock className="inline h-2.5 w-2.5 ml-1 text-slate-500" />}</td>
                    <td className={`pr-2 ${r.effect === 'ALLOW' ? 'text-teal-400' : r.effect === 'DENY' ? 'text-red-400' : 'text-amber-400'}`}>{r.effect}</td>
                    <td className="pr-2">{r.scope}</td>
                    <td className="pr-2 truncate max-w-28">{r.condition.action}</td>
                    <td className="pr-2 truncate max-w-44" title={r.condition.resource}>{r.condition.resource}</td>
                    <td className="pr-2">{r.condition.actorType ? `${r.condition.actorType}:${r.condition.actorId ?? '*'}` : '—'}</td>
                    <td className="pr-2">{r.priority}</td>
                    <td className={`pr-2 ${r.active ? 'text-teal-400' : 'text-slate-600'}`}>{r.active ? 'ACTIVE' : 'INACTIVE'}</td>
                    <td className="pr-1">
                      {!r.constitutional && (r.ruleId.startsWith('POL-C-') || r.ruleId.startsWith('POL-AUTH-')) && (
                        <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5"
                          disabled={busy === `toggle-${r.ruleId}`}
                          onClick={() => post({ action: 'toggle', ruleId: r.ruleId, active: !r.active, reason: r.active ? `désactivation gouvernée de ${r.ruleId} depuis la console` : `réactivation gouvernée de ${r.ruleId} depuis la console` }, `toggle-${r.ruleId}`)}>
                          {busy === `toggle-${r.ruleId}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : r.active ? <Trash2 className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                          {r.active ? 'désactiver' : 'activer'}
                        </Button>
                      )}
                      {r.constitutional && <span className="text-slate-600 text-[9px]">verrouillée</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* simulator */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-100 flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5 text-purple-300" /> Simulateur — dry-run INV-220</CardTitle>
            <CardDescription className="text-[10px]">Évalue la base ACTIVE contre un appel simulé. Ne persiste rien, ne modifie rien.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="grid grid-cols-2 gap-2">
              <select value={sim.actorType} onChange={(e) => setSim({ ...sim, actorType: e.target.value })} className="h-7 text-[11px] rounded-md bg-slate-950/60 border border-slate-800 px-2 text-slate-200">
                {['HUMAN', 'AGENT', 'SYSTEM'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800" placeholder="actorId (ex. tester)" value={sim.actorId} onChange={(e) => setSim({ ...sim, actorId: e.target.value })} />
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800" placeholder="action (ex. tool.execute)" value={sim.action} onChange={(e) => setSim({ ...sim, action: e.target.value })} />
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800" placeholder="resource" value={sim.resource} onChange={(e) => setSim({ ...sim, resource: e.target.value })} />
            </div>
            <Button size="sm" className="h-7 text-[11px] bg-purple-600/80 hover:bg-purple-600" disabled={busy === 'sim'}
              onClick={() => post({ action: 'simulate', ruleAction: sim.action, actorType: sim.actorType, actorId: sim.actorId, resource: sim.resource }, 'sim', (json) => setSimResult(json as unknown as SimResult))}>
              {busy === 'sim' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FlaskConical className="h-3 w-3 mr-1" />}Simuler
            </Button>
            {simResult && (
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${effectBadge(simResult.effect)}`}>{simResult.effect}</Badge>
                  <span className="font-mono text-[10px] text-slate-400">{simResult.matchedRule ?? 'default-deny'}</span>
                </div>
                <p className="text-[10px] text-slate-500">{simResult.reason}</p>
                <p className="text-[9px] text-slate-600 font-mono">{simResult.precedence}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* create + impact */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-100 flex items-center gap-2"><Plus className="h-3.5 w-3.5 text-teal-300" /> Créer une règle gouvernée (POL-C-*)</CardTitle>
            <CardDescription className="text-[10px]">Analysez l&apos;impact AVANT création : les bascules d&apos;autorisation sont simulées outil par outil (aucune persistance).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="grid grid-cols-2 gap-2">
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800 col-span-2" placeholder="nom de la règle" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <select value={draft.effect} onChange={(e) => setDraft({ ...draft, effect: e.target.value })} className="h-7 text-[11px] rounded-md bg-slate-950/60 border border-slate-800 px-2 text-slate-200">
                {['ALLOW', 'DENY', 'REQUIRE_APPROVAL'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} className="h-7 text-[11px] rounded-md bg-slate-950/60 border border-slate-800 px-2 text-slate-200">
                {['TOOL', 'EXECUTION', 'FILESYSTEM', 'NETWORK', 'EVOLUTION', 'MODEL'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800" placeholder="action" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800" placeholder="resource" value={draft.resource} onChange={(e) => setDraft({ ...draft, resource: e.target.value })} />
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800" type="number" min={1} max={100} placeholder="priorité" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
              <select value={draft.actorType} onChange={(e) => setDraft({ ...draft, actorType: e.target.value })} className="h-7 text-[11px] rounded-md bg-slate-950/60 border border-slate-800 px-2 text-slate-200">
                <option value="">— tous acteurs —</option>
                {['HUMAN', 'AGENT', 'SYSTEM'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800" placeholder="actorId (optionnel)" value={draft.actorId} onChange={(e) => setDraft({ ...draft, actorId: e.target.value })} />
              <Input className="h-7 text-[11px] bg-slate-950/60 border-slate-800 col-span-2" placeholder="raison gouvernée obligatoire (≥ 10 caractères)" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px] border-purple-600/50 text-purple-300" disabled={busy === 'impact'}
                onClick={() => post({ action: 'impact', draft }, 'impact', (json) => setImpact(json as unknown as { flips: ImpactFlip[]; wouldFlip: number; note: string }))}>
                {busy === 'impact' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FlaskConical className="h-3 w-3 mr-1" />}Analyser l&apos;impact
              </Button>
              <Button size="sm" className="h-7 text-[11px] bg-teal-600/80 hover:bg-teal-600" disabled={busy === 'create'}
                onClick={() => post({ action: 'create', name: draft.name, effect: draft.effect, scope: draft.scope, ruleAction: draft.action, resource: draft.resource, priority: draft.priority, actorType: draft.actorType || undefined, actorId: draft.actorId || undefined, reason: draft.reason }, 'create', () => {
                  setMsg({ kind: 'ok', text: `Règle créée et scellée — la matrice d'autorisation du registre d'outils est immédiatement affectée (INV-062).` });
                  setDraft({ ...DRAFT_DEFAULT, reason: '' });
                  setImpact(null);
                })}>
                {busy === 'create' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}Créer
              </Button>
            </div>
            {impact && (
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5 space-y-1">
                <p className="text-[10px] text-slate-400">{impact.note}</p>
                <p className="text-[10.5px] font-medium text-slate-300">{impact.wouldFlip} outil(s) basculeraient d&apos;autorisation :</p>
                {impact.flips.map((f) => (
                  <div key={f.toolId} className="flex items-center gap-2 text-[10px] font-mono">
                    <Badge variant="outline" className={`text-[9px] ${f.flips ? 'border-amber-500/50 text-amber-300' : 'border-slate-700 text-slate-500'}`}>{f.flips ? 'BASCULE' : 'inchangé'}</Badge>
                    <span className="text-slate-300">{f.toolId}</span>
                    <span className={`text-slate-500`}>{f.before} → <b className={f.after === 'ALLOW' ? 'text-teal-400' : f.after === 'DENY' ? 'text-red-400' : 'text-amber-400'}>{f.after}</b></span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* recent decisions */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-slate-300 flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-teal-300" /> Décisions récentes du plan de contrôle (journal INV-123)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-48">
            <div className="space-y-1">
              {decisions.map((d) => (
                <div key={d.id} className="flex items-start gap-2 text-[10px] border-l-2 border-slate-800 pl-2">
                  <span className="font-mono text-slate-600 w-20 shrink-0">{new Date(d.createdAt).toLocaleTimeString('fr-FR')}</span>
                  <Badge variant="outline" className={`text-[8.5px] px-1 py-0 shrink-0 ${effectBadge(d.effect)}`}>{d.effect}</Badge>
                  <span className="font-mono text-slate-500 w-24 shrink-0 truncate">{d.ruleId ?? 'default-deny'}</span>
                  <span className="text-slate-400 min-w-0">{d.reason.length > 120 ? d.reason.slice(0, 120) + '…' : d.reason}</span>
                </div>
              ))}
              {decisions.length === 0 && <p className="text-[10px] text-slate-600">aucune décision enregistrée</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
