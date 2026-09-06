'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA STUDIO — Générateur autonome de code (Domain 03/04 UI)
// Soumission d'arborescence → pipeline gouverné → livraison ZIP
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Code2, Globe, TerminalSquare } from 'lucide-react';
import type { YahriaEvent } from '@/lib/yahria/realtime';
import {
  Bot, CheckCircle2, Clock, Download, FileCode2, FileSearch2,
  Loader2, PencilLine, Play, Sparkles, TriangleAlert, Wand2, XCircle,
} from 'lucide-react';

// ── Types locaux ─────────────────────────────────────────────────

/** Choix de langage — miroir client de STUDIO_STACKS (le choix humain gouverne, INV-081). */
const STACK_CHOICES: { value: string; label: string }[] = [
  { value: 'AUTO', label: 'Détection automatique' },
  { value: 'NEXTJS', label: 'Next.js / React — site web' },
  { value: 'NODE', label: 'Node.js — Express / API / CLI' },
  { value: 'PYTHON', label: 'Python — FastAPI / Flask / CLI' },
  { value: 'STATIC_WEB', label: 'HTML/CSS/JS — site statique' },
  { value: 'GO', label: 'Go — service / CLI' },
  { value: 'RUST', label: 'Rust — binaire / service' },
  { value: 'JAVA', label: 'Java — Spring / Maven' },
];

interface ParsedTree {
  stack: string;
  files: { path: string; role: string }[];
  warnings: string[];
  rejections: { path: string; reason: string }[];
  aiDesigned: boolean;
}

interface GenFile {
  id: string; path: string; role: string; state: string;
  content: string | null; bytes: number; sha256: string | null;
  attempts: number; genMs: number; revision: number; note: string | null; order: number;
}

interface RunDetail {
  id: string; runUid: string; name: string; brief: string; stack: string; requestedStack?: string; state: string;
  aiDesignedTree: boolean; stats: string; error: string | null; traceId: string | null;
  files: GenFile[];
  createdAt: string;
}

interface RunSummary {
  id: string; runUid: string; name: string; stack: string; requestedStack?: string; state: string;
  stats: string; error: string | null; createdAt: string; _count: { files: number };
}

interface StatsShape { files?: number; generated?: number; failed?: number; retries?: number; bytes?: number; genMs?: number }

// ── Templates de mission ─────────────────────────────────────────

const TEMPLATES: { label: string; stack: string; name: string; brief: string; tree: string }[] = [
  {
    label: 'Site web Next.js',
    stack: 'NEXTJS',
    name: 'Site vitrine Next.js — agence de voyage',
    brief: 'Site web vitrine Next.js (App Router) pour une agence de voyage : page d\'accueil avec hero et destinations populaires, page destinations avec cartes filtrables, page contact avec formulaire, navigation responsive, design moderne avec Tailwind CSS. Prêt à lancer avec npm install && npm run dev.',
    tree: `package.json
next.config.mjs
tailwind.config.ts
postcss.config.mjs
src/app/
├── layout.tsx
├── page.tsx
├── globals.css
├── destinations/page.tsx
└── contact/page.tsx
src/components/
├── navbar.tsx
├── destination-card.tsx
└── contact-form.tsx
README.md`,
  },
  {
    label: 'API FastAPI (Python)',
    stack: 'PYTHON',
    name: 'API bibliothèque FastAPI',
    brief: 'API REST FastAPI de gestion de bibliothèque : CRUD livres et emprunts, validation Pydantic, persistance SQLite, documentation OpenAPI automatique, endpoint de santé. Prête à lancer avec uvicorn.',
    tree: `requirements.txt
app/
├── __init__.py
├── main.py
├── database.py
├── models.py
├── schemas.py
└── routers/
    ├── books.py
    └── loans.py
tests/test_api.py
README.md`,
  },
  {
    label: 'API de tâches (Node/Express)',
    stack: 'NODE',
    name: 'API de gestion de tâches',
    brief: 'API REST de gestion de tâches : CRUD complet, validation des entrées, persistance fichier JSON, gestion des erreurs, endpoint de santé. Code commenté et prêt à exécuter avec npm start.',
    tree: `package.json
src/
├── server.js
├── app.js
├── routes/tasks.js
├── middleware/errorHandler.js
├── store/jsonStore.js
└── validation/taskSchema.js
tests/tasks.test.js
README.md`,
  },
  {
    label: 'Analyseur de texte (Python)',
    stack: 'PYTHON',
    name: 'Analyseur de texte CLI',
    brief: 'Outil CLI Python qui analyse un fichier texte : nombre de mots, fréquence des termes, lectureibilité approximative, export du rapport en JSON. Utilise uniquement la bibliothèque standard.',
    tree: `pyproject.toml
README.md
src/textanalyzer/
├── __init__.py
├── __main__.py
├── cli.py
├── analysis.py
└── report.py
tests/test_analysis.py`,
  },
  {
    label: 'Site vitrine statique',
    stack: 'STATIC_WEB',
    name: 'Site vitrine boulangerie',
    brief: 'Site vitrine statique pour une boulangerie artisanale : accueil avec hero, section produits avec cartes, section horaires et contact, formulaire de contact stylé, design responsive et moderne.',
    tree: `index.html
css/style.css
css/responsive.css
js/menu.js
js/contact-form.js
assets/logo.svg
README.md`,
  },
];

// ── Helpers d'affichage ──────────────────────────────────────────

const STUDIO_PIPELINE = ['SUBMITTED', 'PERCEIVED', 'PLANNED', 'GENERATING', 'VERIFYING', 'SEALED'];

function stateBadge(s: string): string {
  switch (s) {
    case 'SEALED': return 'bg-teal-500/15 text-teal-300 border-teal-500/40';
    case 'VERIFIED': case 'SUCCEEDED': return 'bg-teal-500/15 text-teal-300 border-teal-500/40';
    case 'GENERATING': return 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse';
    case 'FAILED': return 'bg-red-500/15 text-red-300 border-red-500/40';
    case 'PLANNED': return 'bg-violet-500/15 text-violet-300 border-violet-500/40';
    case 'PERCEIVED': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
    case 'VERIFYING': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/40';
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function fmtMs(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n} ms`;
}

// ═════════════════════════════════════════════════════════════════

export function StudioPanel({ events }: { events: YahriaEvent[] }) {
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [treeSpec, setTreeSpec] = useState('');
  const [stack, setStack] = useState('AUTO');
  const [aiDesigned, setAiDesigned] = useState(false);
  const [preview, setPreview] = useState<ParsedTree | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [history, setHistory] = useState<RunSummary[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const [editPath, setEditPath] = useState('');
  const [editInstruction, setEditInstruction] = useState('');
  const [editing, setEditing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/yahria/studio/runs');
      const json = await res.json();
      if (json.ok) setHistory(json.runs);
    } catch { /* silencieux — l'historique est non critique */ }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/yahria/studio/runs/${id}`);
      const json = await res.json();
      if (json.ok) setDetail(json.run);
    } catch { /* polling — retentera */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Polling du run actif tant qu'il n'est pas terminal
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeRunId) return;
    loadDetail(activeRunId);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/yahria/studio/runs/${activeRunId}`).catch(() => null);
      if (!res) return;
      const json = await res.json().catch(() => null);
      if (!json?.ok) return;
      setDetail(json.run);
      if (['SEALED', 'FAILED', 'CANCELLED'].includes(json.run.state)) {
        if (pollRef.current) clearInterval(pollRef.current);
        loadHistory();
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRunId, loadDetail, loadHistory]);

  const validateS1 = async () => {
    setFormError(null);
    setPreview(null);
    if (!treeSpec.trim()) { setFormError('Collez ou saisissez d’abord une arborescence.'); return; }
    try {
      const res = await fetch('/api/yahria/studio/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treeSpec }),
      });
      const json = await res.json();
      if (!json.ok) { setFormError(json.error); return; }
      setPreview(json.parsed);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const launch = async () => {
    setFormError(null);
    setSubmitting(true);
    setPreview(null);
    setDetail(null);
    setSelectedPath(null);
    try {
      const res = await fetch('/api/yahria/studio/runs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, brief, treeSpec, aiDesignedTree: aiDesigned, requestedStack: stack }),
      });
      const json = await res.json();
      if (!json.ok) { setFormError(json.error); return; }
      setActiveRunId(json.run.id);
      loadHistory();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!detail || !editPath || editInstruction.trim().length < 5) return;
    setEditing(true);
    try {
      const res = await fetch(`/api/yahria/studio/runs/${detail.id}/edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: editPath, instruction: editInstruction }),
      });
      const json = await res.json();
      if (!json.ok) setFormError(json.error);
      else { setEditInstruction(''); loadDetail(detail.id); }
    } finally {
      setEditing(false);
    }
  };

  // Journal temps réel filtré sur le run actif (events WS, source Domain 11)
  const runEvents = useMemo(() => {
    if (!detail) return [];
    return events
      .filter((e) => (e.payload as { runUid?: string } | null)?.runUid === detail.runUid)
      .slice(-30).reverse();
  }, [events, detail]);

  const stats: StatsShape = useMemo(() => {
    try { return detail ? JSON.parse(detail.stats) as StatsShape : {}; } catch { return {}; }
  }, [detail]);

  const selectedFile = detail?.files.find((f) => f.path === selectedPath) ?? null;
  const terminal = detail ? ['SEALED', 'FAILED', 'CANCELLED'].includes(detail.state) : false;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* ── Colonne soumission ─────────────────────────────────── */}
      <div className="lg:col-span-5 space-y-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-teal-300" />
              Soumission de mission — Studio autonome
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="studio-name" className="text-xs text-slate-400">Nom de la mission</Label>
              <Input id="studio-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ex : API de gestion de tâches" className="bg-slate-950 border-slate-800 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studio-stack" className="text-xs text-slate-400 flex items-center gap-1.5">
                <Code2 className="h-3 w-3 text-teal-300" /> Langage / Stack — votre choix gouverne la génération
              </Label>
              <Select value={stack} onValueChange={setStack}>
                <SelectTrigger id="studio-stack" className="bg-slate-950 border-slate-800 text-sm">
                  <SelectValue placeholder="Choisir le langage" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800">
                  {STACK_CHOICES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-sm text-slate-200">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studio-brief" className="text-xs text-slate-400">Brief de mission — ce que l’application doit faire</Label>
              <Textarea id="studio-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={4}
                placeholder="Décrire les fonctionnalités attendues, la stack, les contraintes…"
                className="bg-slate-950 border-slate-800 text-sm" />
            </div>

            <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 text-violet-300 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-300">L’IA conçoit l’arborescence</p>
                  <p className="text-[10px] text-slate-500 truncate">S2 architecte propose les fichiers à partir du brief</p>
                </div>
              </div>
              <Switch checked={aiDesigned} onCheckedChange={setAiDesigned} />
            </div>

            {!aiDesigned && (
              <div className="space-y-1.5">
                <Label htmlFor="studio-tree" className="text-xs text-slate-400">Arborescence soumise (sortie `tree`, chemins, ou JSON)</Label>
                <Textarea id="studio-tree" value={treeSpec} onChange={(e) => setTreeSpec(e.target.value)} rows={8}
                  placeholder={'package.json\nsrc/\n├── index.ts\n└── app.js\nREADME.md'}
                  className="bg-slate-950 border-slate-800 text-xs font-mono" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {TEMPLATES.map((t) => (
                    <Button key={t.label} type="button" variant="outline" size="sm"
                      className="h-7 text-[10.5px] border-slate-700 text-slate-300 hover:bg-slate-800"
                      onClick={() => { setName(t.name); setBrief(t.brief); setTreeSpec(t.tree); setStack(t.stack); setPreview(null); }}>
                      {t.label === 'Site web Next.js' ? <Globe className="h-3 w-3 mr-1" />
                        : t.label === 'API FastAPI (Python)' ? <TerminalSquare className="h-3 w-3 mr-1" />
                        : t.label === 'Site vitrine statique' ? <Globe className="h-3 w-3 mr-1" />
                        : <FileCode2 className="h-3 w-3 mr-1" />}
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {formError && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-start gap-2">
                <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {formError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {!aiDesigned && (
                <Button variant="outline" size="sm" onClick={validateS1}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <FileSearch2 className="h-3.5 w-3.5 mr-1.5" /> Vérifier (S1)
                </Button>
              )}
              <Button size="sm" onClick={launch} disabled={submitting}
                className="bg-teal-600 hover:bg-teal-500 text-white ml-auto">
                {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                Lancer la génération
              </Button>
            </div>

            {preview && (
              <div className="rounded-md border border-slate-800 bg-slate-950/80 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <Badge className={stateBadge('PERCEIVED')}>stack : {preview.stack}</Badge>
                  <Badge variant="outline" className="text-slate-400 border-slate-700">{preview.files.length} fichiers</Badge>
                  {preview.rejections.length > 0 && (
                    <Badge className="bg-red-500/15 text-red-300 border-red-500/40">{preview.rejections.length} refus (INV-120)</Badge>
                  )}
                </div>
                {preview.rejections.length > 0 && (
                  <div className="text-[10.5px] text-red-300/90 font-mono leading-relaxed">
                    {preview.rejections.slice(0, 5).map((r, i) => <div key={i}>✕ {r.path} — {r.reason}</div>)}
                  </div>
                )}
                {preview.warnings.length > 0 && (
                  <div className="text-[10.5px] text-amber-300/90 font-mono leading-relaxed">
                    {preview.warnings.slice(0, 4).map((w, i) => <div key={i}>⚠ {w}</div>)}
                  </div>
                )}
                <div className="text-[10.5px] text-slate-500 font-mono">
                  {preview.files.slice(0, 12).map((f) => <div key={f.path}>{f.path} <span className="text-slate-600">({f.role})</span></div>)}
                  {preview.files.length > 12 && <div>… +{preview.files.length - 12}</div>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200">Historique des missions</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">Aucune mission pour l’instant — lancez votre première génération.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <div className="space-y-1.5 pr-2">
                  {history.map((r) => (
                    <button key={r.id} type="button"
                      onClick={() => { setActiveRunId(r.id); setSelectedPath(null); }}
                      className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                        r.id === activeRunId ? 'border-teal-500/50 bg-teal-500/5' : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/40'
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-200 truncate">{r.name}</span>
                        <Badge className={`text-[9.5px] ${stateBadge(r.state)}`}>{r.state}</Badge>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {r.runUid} · {r.stack}{r.requestedStack && r.requestedStack !== 'AUTO' ? ` (imposé : ${r.requestedStack})` : ''} · {r._count.files} fichiers · {new Date(r.createdAt).toLocaleTimeString('fr-FR')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Colonne pipeline & livraison ───────────────────────── */}
      <div className="lg:col-span-7 space-y-4">
        {!detail ? (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="py-14 flex flex-col items-center justify-center gap-3 text-center">
              <Bot className="h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">Aucun run actif</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Soumettez une arborescence (ou laissez l’architecte S2 la concevoir) puis lancez la génération :
                YAHRIA planifie, code et vérifie chaque fichier, puis livre un ZIP scellé par des preuves.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pipeline — machine à états */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-teal-300" />
                    {detail.runUid} — {detail.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {detail.state === 'SEALED' && (
                      <a href={`/api/yahria/studio/runs/${detail.id}/download`}>
                        <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-white h-7 text-[11px]">
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Télécharger le ZIP
                        </Button>
                      </a>
                    )}
                    <Badge className={`text-[10px] ${stateBadge(detail.state)}`}>{detail.state}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-1 flex-wrap">
                  {STUDIO_PIPELINE.map((s, i) => {
                    const idx = STUDIO_PIPELINE.indexOf(detail.state);
                    const done = terminal && detail.state === 'SEALED' ? true : i < idx;
                    const active = s === detail.state && !terminal;
                    return (
                      <div key={s} className="flex items-center gap-1">
                        {i > 0 && <span className="text-slate-600 text-[10px]">→</span>}
                        <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
                          active ? stateBadge(s) : done ? 'border-teal-700/50 text-teal-500/80 bg-teal-500/5' : 'border-slate-800 text-slate-600'
                        }`}>{s}</span>
                      </div>
                    );
                  })}
                  {detail.state === 'FAILED' && <span className="text-[10px] font-mono px-2 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-300">FAILED</span>}
                </div>

                {detail.state === 'GENERATING' && (
                  <div className="flex items-center gap-2 text-xs text-amber-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Génération en cours — {detail.files.filter((f) => f.state === 'VERIFIED').length}/{detail.files.length} fichiers vérifiés…
                  </div>
                )}

                {Object.keys(stats).length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    {[
                      ['fichiers', stats.files ?? 0], ['vérifiés', stats.generated ?? 0], ['échoués', stats.failed ?? 0],
                      ['retries', stats.retries ?? 0], ['code', fmtBytes(stats.bytes ?? 0)], ['LLM', fmtMs(stats.genMs ?? 0)],
                    ].map(([label, v]) => (
                      <div key={String(label)} className="rounded border border-slate-800 bg-slate-950/60 py-1.5">
                        <div className="text-xs text-slate-200 font-mono">{String(v)}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wide">{String(label)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {detail.error && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {detail.error}
                  </div>
                )}
                <p className="text-[10px] text-slate-600 font-mono">trace : {detail.traceId} · brief : {detail.brief.slice(0, 120)}{detail.brief.length > 120 ? '…' : ''}</p>
              </CardContent>
            </Card>

            {/* Journal temps réel */}
            {runEvents.length > 0 && (
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-slate-300 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-teal-300" /> Journal temps réel (WS — Domain 11)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-40 overflow-y-auto">
                    <div className="space-y-0.5 font-mono text-[10.5px]">
                      {runEvents.map((e) => (
                        <div key={e.id} className="flex gap-2">
                          <span className="text-slate-600 shrink-0">{new Date(e.ts).toLocaleTimeString('fr-FR')}</span>
                          <span className={
                            e.severity === 'SUCCESS' ? 'text-teal-300' :
                            e.severity === 'WARN' ? 'text-amber-300' :
                            e.severity === 'CRITICAL' ? 'text-red-300' : 'text-slate-400'
                          }>{e.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fichiers générés */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-teal-300" />
                  Fichiers ({detail.files.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto">
                  <div className="space-y-1">
                    {detail.files.map((f) => (
                      <button key={f.id} type="button"
                        onClick={() => { setSelectedPath(f.path); setEditPath(f.path); }}
                        className={`w-full text-left rounded border px-3 py-1.5 transition-colors ${
                          selectedPath === f.path ? 'border-teal-500/50 bg-teal-500/5' : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/40'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-slate-200 truncate">{f.path}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {f.state === 'VERIFIED' && <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />}
                            {f.state === 'GENERATING' && <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />}
                            {f.state === 'FAILED' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                            {f.state === 'PLANNED' && <Clock className="h-3.5 w-3.5 text-slate-500" />}
                            <Badge className={`text-[9px] ${stateBadge(f.state)}`}>{f.state}</Badge>
                          </div>
                        </div>
                        <div className="text-[9.5px] text-slate-500 font-mono mt-0.5 truncate">
                          {f.role} · {f.bytes > 0 ? `${fmtBytes(f.bytes)} · ` : ''}rév. {f.revision} · {f.attempts} tentative(s)
                          {f.note ? ` · ${f.note.slice(0, 90)}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator className="my-3 bg-slate-800" />

                {/* Aperçu du fichier sélectionné + éditeur IA */}
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-mono text-teal-300">{selectedFile.path}</span>
                      {selectedFile.sha256 && <span className="text-[9.5px] text-slate-600 font-mono">sha256 : {selectedFile.sha256.slice(0, 24)}…</span>}
                    </div>
                    <pre className="max-h-96 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-[11px] font-mono text-slate-300 whitespace-pre">
{selectedFile.content ?? selectedFile.note ?? '(en attente de génération…)'}
                    </pre>
                    {detail.state === 'SEALED' && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input value={editPath} onChange={(e) => setEditPath(e.target.value)} readOnly
                          className="bg-slate-950 border-slate-800 text-[11px] font-mono flex-1" />
                        <Input value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)}
                          placeholder="Instruction d’édition (ex : ajoute la route DELETE /tasks/:id)"
                          className="bg-slate-950 border-slate-800 text-xs flex-[2]" />
                        <Button size="sm" onClick={submitEdit} disabled={editing || editInstruction.trim().length < 5}
                          className="bg-violet-600 hover:bg-violet-500 text-white h-9 shrink-0">
                          {editing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PencilLine className="h-3.5 w-3.5 mr-1.5" />}
                          Régénérer
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Sélectionnez un fichier pour afficher son contenu et l’éditer via l’agent coder.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
