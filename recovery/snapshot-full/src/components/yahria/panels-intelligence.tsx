'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA MISSION CONTROL — Intelligence panels (R14)
//   MemoryPanel      — D.13 Memory System gouverné (KRN-030)
//   LearningPanel    — D.14 Learning Engine (KRN-032)
//   EvolutionPanel   — D.15 Self-Evolution gouvernée (KRN-033)
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { stateColor } from '@/components/yahria/panels-core';
import { Brain, Database, Sparkles, Loader2, RefreshCw, Trash2, Layers, GitFork, ChevronRight } from 'lucide-react';

// ── D.13 — MEMORY SYSTEM ──────────────────────────────────────────

interface MemRecord { id: string; kind: string; key: string; content: string; confidence: number; validation: string; source: string; updatedAt: string }

export function MemoryPanel() {
  const [records, setRecords] = useState<MemRecord[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ kind: 'SEMANTIC', key: '', content: '', source: '', validation: 'PROBABLE' });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async (query = '') => {
    const res = await fetch(`/api/yahria/memory${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    const json = await res.json();
    if (json.ok) { setRecords(json.records ?? []); setStats(json.stats ?? {}); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const call = async (method: string, body: Record<string, unknown>, label: string) => {
    setBusy(label); setMsg(null);
    try {
      const res = await fetch('/api/yahria/memory', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error((json.errors ?? []).join(' · ') || json.error || 'échec');
      setMsg({ kind: 'ok', text: `${label} — preuve ${json.evidenceUid ?? 'scellée'}` });
      await load(q);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-teal-300" /> Mémoire gouvernée (D.13)</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            INV-221 : écriture sans provenance refusée · INV-222 : oubli gouverné avec raison scellée ·
            INV-140 : la mémoire porte toujours sa validation — elle n&apos;est jamais une vérité automatique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300">
              {['WORKING', 'EPISODIC', 'SEMANTIC', 'ARCHITECTURAL'].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="clé (ex : architecture.kernel)" className="bg-slate-950/70 border-slate-800 text-xs text-slate-200" />
            <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="provenance OBLIGATOIRE (INV-221)" className="bg-slate-950/70 border-slate-800 text-xs text-slate-200" />
            <select value={form.validation} onChange={(e) => setForm({ ...form, validation: e.target.value })}
              className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300">
              {['VERIFIED', 'PROBABLE', 'UNCERTAIN', 'UNKNOWN', 'FALSE'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <Button onClick={() => call('POST', form, 'Écriture mémoire')} disabled={!!busy || !form.key || !form.content || !form.source}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs">
              {busy === 'Écriture mémoire' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus16 />} Écrire
            </Button>
          </div>
          <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Contenu du souvenir…" className="bg-slate-950/70 border-slate-800 min-h-[60px] text-xs text-slate-200" />
          <div className="flex flex-wrap items-center gap-2">
            <Input value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} placeholder="Recherche (key/content)…" className="bg-slate-950/70 border-slate-800 max-w-xs text-xs text-slate-200" />
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">total {stats.total ?? 0}</Badge>
            {Object.entries(stats).filter(([k]) => k.startsWith('kind_')).map(([k, v]) => (
              <Badge key={k} variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{k.slice(5)} {v}</Badge>
            ))}
          </div>
          {msg && <div className={`text-xs rounded-md border p-2.5 ${msg.kind === 'ok' ? 'border-teal-500/30 bg-teal-500/5 text-teal-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>{msg.text}</div>}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Enregistrements ({records.length})</span>
            <Button size="sm" variant="outline" onClick={() => load(q)} className="border-slate-700 text-slate-300 h-7"><RefreshCw className="h-3 w-3 mr-1" /> Actualiser</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[380px]">
            <div className="space-y-1.5 pr-2">
              {records.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">Aucun souvenir — écrivez le premier au-dessus.</p>}
              {records.map((r) => (
                <div key={r.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-teal-300">{r.key}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700 text-slate-400">{r.kind}</Badge>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${stateColor(r.validation)}`}>{r.validation}</Badge>
                    <span className="text-[10px] text-slate-500">confiance {Math.round(r.confidence * 100)}%</span>
                    <div className="flex-1" />
                    {['WORKING', 'EPISODIC'].includes(r.kind) && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-teal-500/40 text-teal-300"
                        onClick={() => call('PATCH', { id: r.id }, 'Consolidation')} disabled={!!busy}>
                        <Layers className="h-3 w-3 mr-1" /> Consolider
                      </Button>
                    )}
                    {r.kind !== 'ARCHITECTURAL' && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-red-500/40 text-red-300"
                        onClick={() => {
                          const reason = window.prompt('Raison de l\'oubli (≥ 10 caractères — INV-222) :');
                          if (reason && reason.trim().length >= 10) call('DELETE', { id: r.id, reason }, 'Oubli gouverné');
                        }} disabled={!!busy}>
                        <Trash2 className="h-3 w-3 mr-1" /> Oublier
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">{r.content}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5 font-mono">source : {r.source}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function Plus16() { return <span className="mr-1.5">+</span>; }

// ── D.14 — LEARNING ENGINE ────────────────────────────────────────

interface Insight { insightUid: string; kind: string; subject: string; metric: Record<string, unknown>; confidence: number; state: string; recommendation: string; evidenceCount: number }

export function LearningPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/yahria/learning');
    const json = await res.json();
    if (json.ok) { setInsights(json.insights ?? []); setThreshold(json.threshold ?? 3); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (body: Record<string, unknown>, label: string) => {
    setBusy(label); setMsg(null);
    try {
      const res = await fetch('/api/yahria/learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error((json.errors ?? []).join(' · ') || json.error || 'échec');
      setMsg(label === 'mine'
        ? `Mining : ${json.created} créé(s), ${json.refreshed} rafraîchi(s) — faits enregistrés uniquement (INV-226).`
        : `Promotion faite — insight ${body.insightUid} → mémoire sémantique (réversible, INV-151).`);
      await load();
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-teal-300" /> Learning Engine (D.14) — intelligence fondée sur les faits</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Mining déterministe des invocations d&apos;outils, runs d&apos;agents et échecs enregistrés (INV-226).
            Seuil VALIDATED = {threshold} échantillons (INV-225) — promotion vers la mémoire = décision gouvernée (INV-150/151).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Button onClick={() => act({ action: 'mine' }, 'mine')} disabled={!!busy} className="bg-teal-600 hover:bg-teal-500 text-white">
              {busy === 'mine' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />} Miner les faits enregistrés
            </Button>
            <Button size="sm" variant="outline" onClick={load} className="border-slate-700 text-slate-300"><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Actualiser</Button>
          </div>
          {msg && <div className="text-xs rounded-md border border-slate-700 bg-slate-950/60 p-2.5 text-slate-300">{msg}</div>}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        {insights.length === 0 && (
          <Card className="bg-slate-900/60 border-slate-800 md:col-span-2">
            <CardContent className="py-10 text-center text-xs text-slate-500">Aucun insight — lancez le mining.</CardContent>
          </Card>
        )}
        {insights.map((i) => (
          <Card key={i.insightUid} className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-teal-300">{i.insightUid}</span>
                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${stateColor(i.state === 'VALIDATED' ? 'VERIFIED' : i.state === 'PROMOTED' ? 'SEALED' : i.state === 'RETIRED' ? 'CANCELLED' : 'PENDING')}`}>{i.state}</Badge>
              </div>
              <CardTitle className="text-sm">{i.kind} · {i.subject}</CardTitle>
              <CardDescription className="text-[10px] text-slate-500 font-mono">{JSON.stringify(i.metric)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed">{i.recommendation}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">confiance {Math.round(i.confidence * 100)}% · {i.evidenceCount} référence(s) de preuve</span>
                {i.state === 'VALIDATED' && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-teal-500/40 text-teal-300"
                    onClick={() => act({ action: 'promote', insightUid: i.insightUid }, 'promote')} disabled={!!busy}>
                    <ChevronRight className="h-3 w-3 mr-1" /> Promouvoir en mémoire
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── D.15 — SELF-EVOLUTION ─────────────────────────────────────────

interface Proposal { proposalUid: string; title: string; kind: string; rationale: string; riskClass: string; state: string; proposedBy: string; decidedBy: string | null; hasExperiment: boolean; hasRollbackPlan: boolean }

const EVO_COLOR: Record<string, string> = {
  DRAFTED: '', SUBMITTED: '', UNDER_REVIEW: '', APPROVED: 'VERIFIED', SCHEDULED: 'READY',
  PROMOTED: 'SEALED', REJECTED: 'CANCELLED', ROLLED_BACK: 'CANCELLED',
};

export function EvolutionPanel() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [form, setForm] = useState({ title: '', kind: 'PROMPT', rationale: '', riskClass: 'LOW' });
  const [actor, setActor] = useState('HUMAN');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // Formulaire de décision inline — remplace window.prompt (modales non fiables en iframe/webview :
  // prompt() y renvoie null silencieusement → bouton « mort » sans feedback, défaut mesuré sur EVO-000026)
  const [decision, setDecision] = useState<{ p: Proposal; action: 'approve' | 'reject' } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [rollbackText, setRollbackText] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/yahria/evolution');
    const json = await res.json();
    if (json.ok) setProposals(json.proposals ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (body: Record<string, unknown>, label: string) => {
    setBusy(label); setMsg(null);
    try {
      const res = await fetch('/api/yahria/evolution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error((json.errors ?? []).join(' · ') || json.error || 'échec');
      setMsg({ kind: 'ok', text: `${label} — état : ${json.state ?? json.proposalUid ?? 'fait'} · preuve ${json.evidenceUid ?? 'scellée'}` });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(null); }
  };

  const openDecision = (p: Proposal, action: 'approve' | 'reject') => {
    setDecision({ p, action }); setReasonText(''); setRollbackText(''); setMsg(null);
  };

  const confirmDecision = () => {
    if (!decision) return;
    const reason = reasonText.trim();
    if (reason.length < 10) { setMsg({ kind: 'err', text: 'INV-121 : raison gouvernée obligatoire (≥ 10 caractères). 1ʳᵉ ligne = identité décisionnelle (ex : HUMAN ou AGENT:reviewer).' }); return; }
    const idLine = reason.split('\n')[0].trim();
    const decider = idLine.startsWith('AGENT:') ? { type: 'AGENT', id: idLine.slice(6) } : { type: 'HUMAN', id: 'reviewer' };
    let rollbackPlan: string | undefined;
    if (decision.action === 'approve' && ['HIGH', 'CRITICAL'].includes(decision.p.riskClass)) {
      rollbackPlan = rollbackText.trim();
      if (rollbackPlan.length < 15) { setMsg({ kind: 'err', text: `INV-163 : risque ${decision.p.riskClass} — plan de rollback obligatoire (≥ 15 caractères) avant APPROVED.` }); return; }
    }
    act({ action: decision.action, proposalUid: decision.p.proposalUid, actor: decider, reason, rollbackPlan }, decision.action);
    setDecision(null);
  };

  const nextAction = (p: Proposal): { action: string; label: string } | null => {
    switch (p.state) {
      case 'DRAFTED': return { action: 'submit', label: 'Soumettre' };
      case 'SUBMITTED': return { action: 'review', label: 'Passer en revue' };
      case 'UNDER_REVIEW': return { action: 'approve', label: 'Approuver' };
      case 'APPROVED': return { action: 'schedule', label: 'Programmer' };
      case 'SCHEDULED': return { action: 'promote', label: 'Promouvoir' };
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><GitFork className="h-4 w-4 text-teal-300" /> Auto-évolution gouvernée (D.15)</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            DRAFTED → SUBMITTED → UNDER_REVIEW → APPROVED → SCHEDULED → PROMOTED (INV-162).
            Séparation proposition/approbation exigée PAR LE SYSTÈME (INV-227) — PROMOTED n&apos;exécute aucune mutation de production (INV-228).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre de la proposition" className="bg-slate-950/70 border-slate-800 text-xs text-slate-200" />
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300">
              {['PROMPT', 'STRATEGY', 'MODEL_ROUTING', 'WORKFLOW', 'AGENT_GENOME'].map((k) => <option key={k}>{k}</option>)}
            </select>
            <select value={form.riskClass} onChange={(e) => setForm({ ...form, riskClass: e.target.value })} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300">
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((k) => <option key={k}>{k}</option>)}
            </select>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300">
              <option value="HUMAN">proposé par HUMAN</option>
              <option value="AGENT:tester">proposé par AGENT:tester</option>
              <option value="AGENT:architect">proposé par AGENT:architect</option>
            </select>
          </div>
          <Textarea value={form.rationale} onChange={(e) => setForm({ ...form, rationale: e.target.value })} placeholder="Rationale (≥ 20 caractères — une évolution sans justification n'entre pas dans le pipeline)" className="bg-slate-950/70 border-slate-800 min-h-[56px] text-xs text-slate-200" />
          <div className="flex items-center gap-2">
            <Button onClick={() => act({ action: 'create', ...form, proposedBy: actor.startsWith('AGENT') ? { type: 'AGENT', id: actor.slice(6) } : { type: 'HUMAN', id: 'humain' } }, 'create')}
              disabled={!!busy || !form.title || form.rationale.length < 20} className="bg-teal-600 hover:bg-teal-500 text-white">
              {busy === 'create' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus16 />} Créer la proposition
            </Button>
            <Button size="sm" variant="outline" onClick={load} className="border-slate-700 text-slate-300"><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Actualiser</Button>
          </div>
          {msg && <div className={`text-xs rounded-md border p-2.5 ${msg.kind === 'ok' ? 'border-teal-500/30 bg-teal-500/5 text-teal-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>{msg.text}</div>}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {proposals.length === 0 && (
          <Card className="bg-slate-900/60 border-slate-800"><CardContent className="py-10 text-center text-xs text-slate-500">Aucune proposition d&apos;évolution.</CardContent></Card>
        )}
        {proposals.map((p) => {
          const na = nextAction(p);
          return (
            <Card key={p.proposalUid} className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] text-teal-300">{p.proposalUid}</span>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${stateColor(EVO_COLOR[p.state] ?? 'PENDING')}`}>{p.state}</Badge>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700 text-slate-400">{p.kind}</Badge>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${p.riskClass === 'CRITICAL' || p.riskClass === 'HIGH' ? 'border-amber-500/40 text-amber-300' : 'border-slate-700 text-slate-400'}`}>risque {p.riskClass}</Badge>
                  <div className="flex-1" />
                  {decision && decision.p.proposalUid === p.proposalUid && (
                    <div className="w-full rounded-md border border-teal-700/50 bg-slate-900/80 p-3 space-y-2">
                      <div className="text-[11px] font-mono text-teal-300">
                        {decision.action.toUpperCase()} — {p.proposalUid} · risque {p.riskClass}
                        {decision.action === 'approve' && ['HIGH', 'CRITICAL'].includes(p.riskClass) ? ' · INV-163 : rollback obligatoire' : ''}
                      </div>
                      <Input
                        className="h-8 text-[11px] bg-slate-950 border-slate-700"
                        placeholder="Raison gouvernée (≥ 10 caractères) — 1ʳᵉ ligne = identité (ex : HUMAN ou AGENT:reviewer)"
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                      />
                      {decision.action === 'approve' && ['HIGH', 'CRITICAL'].includes(p.riskClass) && (
                        <Input
                          className="h-8 text-[11px] bg-slate-950 border-slate-700"
                          placeholder={`Plan de rollback (≥ 15 caractères — INV-163, risque ${p.riskClass})`}
                          value={rollbackText}
                          onChange={(e) => setRollbackText(e.target.value)}
                        />
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-[11px] bg-teal-600 hover:bg-teal-500 text-white" onClick={confirmDecision} disabled={busy === decision.action}>
                          {busy === decision.action ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ChevronRight className="h-3 w-3 mr-1" />} Confirmer la décision
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDecision(null)}>Annuler</Button>
                      </div>
                    </div>
                  )}
                  {na && (
                    <Button size="sm" className="h-7 text-[11px] bg-teal-600 hover:bg-teal-500 text-white"
                      onClick={() => {
                        const isDecision = ['approve', 'reject'].includes(na.action);
                        if (isDecision) {
                          // Décision HUMAN inline (INV-227) — sans window.prompt, non fiable en iframe
                          openDecision(p, na.action as 'approve' | 'reject');
                        } else if (na.action === 'promote') {
                          // INV-163 : rollback requis pour PROMOTED s'il n'a pas été scellé à l'approbation
                          let rollbackPlan: string | undefined;
                          if (!p.hasRollbackPlan) {
                            rollbackPlan = window.prompt('INV-163 — plan de rollback obligatoire pour PROMOTED (≥ 15 caractères) :') || '';
                            if (rollbackPlan.trim().length < 15) return;
                          }
                          // INV-162 : résultat d'expérimentation requis s'il n'existe pas
                          let experiment: Record<string, unknown> | undefined;
                          if (!p.hasExperiment) {
                            const exp = window.prompt(`INV-162 — résultat d'expérimentation documenté (≥ 20 caractères) :`) || '';
                            if (exp.trim().length < 20) return;
                            experiment = { note: exp.trim() };
                          }
                          act({ action: 'promote', proposalUid: p.proposalUid, actor: { type: 'HUMAN', id: 'release' }, rollbackPlan, experiment }, 'promote');
                        } else {
                          act({ action: na.action, proposalUid: p.proposalUid, actor: { type: 'HUMAN', id: 'pipeline' } }, na.action);
                        }
                      }} disabled={!!busy}>
                      {busy === na.action ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ChevronRight className="h-3 w-3 mr-1" />} {na.label}
                    </Button>
                  )}
                </div>
                <div className="text-sm font-medium text-slate-200">{p.title}</div>
                <p className="text-xs text-slate-400 leading-relaxed">{p.rationale}</p>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span>proposé par <span className="font-mono text-slate-400">{p.proposedBy}</span></span>
                  {p.decidedBy && <span>· décidé par <span className="font-mono text-slate-400">{p.decidedBy}</span></span>}
                  <span>· expérimentation {p.hasExperiment ? 'enregistrée' : 'absente'}</span>
                  <span>· rollback {p.hasRollbackPlan ? 'documenté' : 'absent'}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
