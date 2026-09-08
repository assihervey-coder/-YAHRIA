'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA MISSION CONTROL — Platform panels (R14)
//   ApiPanel        — D.17 API & Integration (KRN-034)
//   SecurityPanel   — D.19 Security (KRN-035)
//   QualityPanel    — D.20 Quality Engineering (KRN-036)
//   DevOpsPanel     — D.21 DevOps & Delivery
//   OpsPanel        — D.22 Operations (KRN-037)
//   RoadmapPanel    — D.23 Product Evolution & Roadmap (KRN-038)
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { stateColor } from '@/components/yahria/panels-core';
import {
  KeyRound, ShieldCheck, FlaskConical, Rocket, Activity, Map, Loader2,
  RefreshCw, CheckCircle2, XCircle, MinusCircle, Terminal, Copy,
} from 'lucide-react';

// ── D.17 — API KEYS ───────────────────────────────────────────────

interface ApiKeyRow { id: string; name: string; keyPrefix: string; scopes: string[]; rateLimitPerMin: number; revoked: boolean; lastUsedAt: string | null; createdAt: string }

export function ApiPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('read');
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/yahria/apikeys');
    const json = await res.json();
    if (json.ok) setKeys(json.keys ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const issue = async () => {
    setBusy('issue'); setErr(null); setIssued(null); setCopied(false);
    try {
      const res = await fetch('/api/yahria/apikeys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scopes: scopes.split(',').map((s) => s.trim()).filter(Boolean) }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error((json.errors ?? []).join(' · ') || json.error || 'échec');
      setIssued(json.key.plaintext);
      setName('');
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  const revoke = async (id: string) => {
    const reason = window.prompt('Raison de révocation (≥ 10 caractères — INV-201) :');
    if (!reason || reason.trim().length < 10) return;
    await fetch('/api/yahria/apikeys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reason }) });
    await load();
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-teal-300" /> API & Intégration (D.17) — surface /api/v1 gouvernée</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Clés stockées en SHA-256 uniquement (INV-229) · scopes read &lt; write &lt; admin · rate limit par clé ·
            401 clé inconnue/révoquée, 403 hors scope, 429 rate limit (INV-230).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la clé (ex : intégration-CI)" className="bg-slate-950/70 border-slate-800 text-xs text-slate-200" />
            <select value={scopes} onChange={(e) => setScopes(e.target.value)} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300">
              {['read', 'read,write', 'admin'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <Button onClick={issue} disabled={!!busy || name.trim().length < 3} className="bg-teal-600 hover:bg-teal-500 text-white text-xs shrink-0">
              {busy === 'issue' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1.5" />} Émettre
            </Button>
          </div>
          {issued && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
              <p className="text-[11px] text-amber-300 font-medium">Copiez la clé MAINTENANT — elle ne sera plus jamais affichée (INV-229) :</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-teal-300 break-all">{issued}</code>
                <Button size="sm" variant="outline" className="h-7 border-slate-700 text-slate-300"
                  onClick={() => { navigator.clipboard?.writeText(issued); setCopied(true); }}>
                  <Copy className="h-3 w-3 mr-1" /> {copied ? 'Copié' : 'Copier'}
                </Button>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">usage : curl -H &quot;Authorization: Bearer yah_live_…&quot; {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/system</p>
            </div>
          )}
          {err && <div className="text-xs rounded-md border border-red-500/40 bg-red-500/10 p-2.5 text-red-300">{err}</div>}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Clés ({keys.length})</span>
            <Button size="sm" variant="outline" onClick={load} className="border-slate-700 text-slate-300 h-7"><RefreshCw className="h-3 w-3 mr-1" /> Actualiser</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-1.5 pr-2">
              {keys.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">Aucune clé émise.</p>}
              {keys.map((k) => (
                <div key={k.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-slate-300">{k.keyPrefix}…</span>
                  <span className="text-xs text-slate-200">{k.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700 text-slate-400">{k.scopes.join(', ')}</Badge>
                  <span className="text-[10px] text-slate-500">{k.rateLimitPerMin}/min</span>
                  {k.revoked ? <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-500/40 text-red-300">RÉVOQUÉE</Badge>
                    : <Badge variant="outline" className="text-[9px] px-1 py-0 border-teal-500/40 text-teal-300">ACTIVE</Badge>}
                  <div className="flex-1" />
                  {!k.revoked && <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-red-500/40 text-red-300" onClick={() => revoke(k.id)}>Révoquer</Button>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ── D.19 — SECURITY AUDIT ─────────────────────────────────────────

interface SecCheck { id: string; title: string; ok: boolean; severity: string; detail: string }

export function SecurityPanel() {
  const [checks, setChecks] = useState<SecCheck[] | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/yahria/security', { method: 'POST' });
      const json = await res.json();
      if (json.ok) { setChecks(json.audit.checks); setOk(json.audit.ok); setCheckedAt(json.audit.checkedAt); }
    } finally { setBusy(false); }
  };
  useEffect(() => { run(); }, []);

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-300" /> Audit sécurité (D.19) — constats scellés (INV-231)</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Contrôles factuels : refus par défaut, règles constitutionnelles, hachage des clés, secrets côté serveur,
            isolation sandbox, registre d&apos;invariants, chaîne de preuves, scan d&apos;identifiants versionnés.
            Les valeurs des secrets ne sont JAMAIS retournées (INV-132).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={busy} className="bg-teal-600 hover:bg-teal-500 text-white">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />} Ré-auditer maintenant
            </Button>
            {ok !== null && (
              <Badge variant="outline" className={ok ? 'border-teal-500/40 text-teal-300' : 'border-red-500/40 text-red-300'}>
                {ok ? 'CONFORME' : 'NON CONFORME'}{checkedAt ? ` · ${new Date(checkedAt).toLocaleTimeString()}` : ''}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-3">
        {(checks ?? []).map((c) => (
          <Card key={c.id} className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                {c.ok ? <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                <span className="text-xs font-medium text-slate-200 flex-1">{c.title}</span>
                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${c.severity === 'CRITICAL' ? 'border-red-500/40 text-red-300' : c.severity === 'HIGH' ? 'border-amber-500/40 text-amber-300' : 'border-slate-700 text-slate-400'}`}>{c.severity}</Badge>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed pl-6">{c.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── D.20 — QUALITY GATES ──────────────────────────────────────────

interface QGate { id: string; title: string; kind: string; ok: boolean; measured: boolean; detail: string }

export function QualityPanel() {
  const [gates, setGates] = useState<QGate[] | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/yahria/quality', { method: 'POST' });
      const json = await res.json();
      if (json.ok) { setGates(json.run.gates); setOk(json.run.ok); }
    } finally { setBusy(false); }
  };
  useEffect(() => { run(); }, []);

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FlaskConical className="h-4 w-4 text-teal-300" /> Gates qualité (D.20) — mesurées, pas affirmées</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Gates IN PROCESS exécutées maintenant · gates EXTERNES (tsc, eslint, pytest) exécutées par CI
            (.github/workflows/ci.yml) et <span className="font-mono">scripts/quality-gates.mjs</span> — jamais simulées ici (INV-171).
            Un gate qui échoue interdit toute déclaration DONE (INV-232).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Button onClick={run} disabled={busy} className="bg-teal-600 hover:bg-teal-500 text-white">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-2" />} Ré-exécuter les gates
          </Button>
          {ok !== null && <Badge variant="outline" className={ok ? 'border-teal-500/40 text-teal-300' : 'border-red-500/40 text-red-300'}>{ok ? 'MESURÉES PASS' : 'ÉCHEC DÉTECTÉ'}</Badge>}
        </CardContent>
      </Card>
      <div className="space-y-1.5">
        {(gates ?? []).map((g) => (
          <div key={g.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              {g.measured ? (g.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />) : <MinusCircle className="h-3.5 w-3.5 text-slate-500" />}
              <span className="font-mono text-[10px] text-teal-300">{g.id}</span>
              <span className="text-xs font-medium text-slate-200 flex-1 min-w-0">{g.title}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700 text-slate-500">{g.kind}</Badge>
              {!g.measured && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-300">EXTERNE — CI</Badge>}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-1 pl-6">{g.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── D.21 — DEVOPS & DELIVERY ──────────────────────────────────────

export function DevOpsPanel() {
  const assets = [
    { icon: Terminal, file: '.github/workflows/ci.yml', desc: 'CI constitutionnelle : tsc, eslint, pytest parité, scan d\'identifiants (INV-231), registre invariants ≥ 97, build de production.' },
    { icon: Terminal, file: 'scripts/quality-gates.mjs', desc: 'Gates externes locales : tsc + eslint + unicité invariants + parité Python — échec honnête si l\'environnement manque.' },
    { icon: Terminal, file: 'scripts/release.mjs', desc: 'Release gouvernée : semver monotone (INV-190), refus si working tree sale (INV-180), CHANGELOG journalisé.' },
    { icon: Terminal, file: 'Dockerfile + docker-compose.yml', desc: 'Livraison conteneurisée : app Next.js + PostgreSQL + image sandbox durcie (INV-215, 12 toolchains).' },
    { icon: Terminal, file: 'scripts/db-provider.mjs', desc: 'Bascule Prisma sqlite ⇄ PostgreSQL prouvée jusqu\'à l\'API (R7.2).' },
  ];
  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4 text-teal-300" /> DevOps & Delivery (D.21)</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Pipeline de livraison gouverné — chaque étape est un artefact versionné dans le dépôt, exécutable localement et en CI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {assets.map((a) => (
            <div key={a.file} className="rounded-md border border-slate-800 bg-slate-950/50 p-3 flex items-start gap-3">
              <a.icon className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-mono text-xs text-teal-300">{a.file}</div>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{a.desc}</p>
              </div>
            </div>
          ))}
          <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
            <div className="text-xs text-slate-300 font-medium mb-1">Commandes canoniques</div>
            <pre className="text-[10.5px] font-mono text-slate-400 leading-relaxed overflow-x-auto">{`bun install                # dépendances verrouillées (bun.lock)
bun run lint               # gate ESLint
bunx tsc --noEmit          # gate TypeScript (0 erreur exigé)
bun run db:push            # schéma Prisma → base
bun scripts/quality-gates.mjs   # gates externes locales
bun scripts/release.mjs --version x.y.z --note "…"  # release gouvernée`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── D.22 — OPERATIONS ─────────────────────────────────────────────

interface OpsReportShape {
  liveness: { ok: boolean; pid: number; uptimeSec: number; rssMb: number; at: string };
  readiness: { ok: boolean; probes: { id: string; ok: boolean; detail: string; ms: number }[] };
  slo: { toolInvocations: { total: number; successRate: number | null; p50Ms: number | null; p95Ms: number | null }; agentRuns: { total: number; completedRate: number | null }; failures: number };
  version: { node: string; sandboxBackend: string; providers: number };
}

export function OpsPanel() {
  const [report, setReport] = useState<OpsReportShape | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/yahria/ops');
      const json = await res.json();
      if (json.ok) setReport(json.report);
    } finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-teal-300" /> Opérations (D.22) — santé mesurée, jamais supposée (INV-233)</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Readiness = sondes réelles (base, bus, sandbox, fabric) · SLO 24 h dérivé des faits enregistrés ·
            runbook : <span className="font-mono">public/docs/OPERATIONS_RUNBOOK.md</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Button onClick={load} disabled={busy} className="bg-teal-600 hover:bg-teal-500 text-white">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Re-sonder
          </Button>
          {report && (
            <Badge variant="outline" className={report.readiness.ok ? 'border-teal-500/40 text-teal-300' : 'border-red-500/40 text-red-300'}>
              READY {report.readiness.ok ? 'OK' : 'DÉGRADÉ'} · pid {report.liveness.pid} · {report.liveness.uptimeSec}s · {report.liveness.rssMb} Mo
            </Badge>
          )}
        </CardContent>
      </Card>
      {report && (
        <div className="grid md:grid-cols-2 gap-3">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Sondes readiness</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {report.readiness.probes.map((p) => (
                <div key={p.id} className="flex items-start gap-2">
                  {p.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] text-teal-300">{p.id}</span>
                    <span className="text-[11px] text-slate-400 ml-2">{p.detail}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-sm">SLO (fenêtre 24 h, faits enregistrés)</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-[11px] text-slate-400">
              <div className="flex justify-between"><span>Invocations d&apos;outils</span><span className="font-mono text-slate-300">{report.slo.toolInvocations.total}</span></div>
              <div className="flex justify-between"><span>Taux de succès</span><span className="font-mono text-slate-300">{report.slo.toolInvocations.successRate === null ? '— (aucun échantillon)' : `${Math.round(report.slo.toolInvocations.successRate * 100)}%`}</span></div>
              <div className="flex justify-between"><span>Latence p50 / p95</span><span className="font-mono text-slate-300">{report.slo.toolInvocations.p50Ms ?? '—'} / {report.slo.toolInvocations.p95Ms ?? '—'} ms</span></div>
              <div className="flex justify-between"><span>Runs d&apos;agents (complétion)</span><span className="font-mono text-slate-300">{report.slo.agentRuns.total}{report.slo.agentRuns.completedRate !== null ? ` · ${Math.round(report.slo.agentRuns.completedRate * 100)}%` : ''}</span></div>
              <div className="flex justify-between"><span>Événements d&apos;échec</span><span className="font-mono text-slate-300">{report.slo.failures}</span></div>
              <div className="flex justify-between"><span>Sandbox backend</span><span className="font-mono text-slate-300">{report.version.sandboxBackend}</span></div>
              <div className="flex justify-between"><span>Node / fournisseurs LLM</span><span className="font-mono text-slate-300">{report.version.node} · {report.version.providers}</span></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── D.23 — ROADMAP ────────────────────────────────────────────────

interface RoadmapData {
  horizons: { horizon: string; domains: { code: string; name: string; status: string }[] }[];
  next: { code: string; name: string; phase: number; status: string; score: number; why: string; horizon: string }[];
  activationLedger: { code: string; since: string; evidenceCount: number }[];
  basis: string;
}

export function RoadmapPanel() {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/yahria/roadmap');
      const json = await res.json();
      if (json.ok) setRoadmap(json.roadmap);
    } finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Map className="h-4 w-4 text-teal-300" /> Roadmap produit (D.23) — dérivée du ledger (INV-234)</CardTitle>
          <CardDescription className="text-slate-500 text-xs">{roadmap?.basis ?? 'Score déterministe calculé depuis DOMAIN_ACTIVATIONS et les statuts DB — aucun statut éditable à la main.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Button onClick={load} disabled={busy} className="bg-teal-600 hover:bg-teal-500 text-white">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Recalculer
          </Button>
        </CardContent>
      </Card>

      {roadmap && (
        <>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Prochaines priorités (top 8 par score)</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {roadmap.next.map((n) => (
                <div key={n.code} className="rounded-md border border-slate-800 bg-slate-950/50 p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-teal-300">D.{n.code}</span>
                    <span className="text-xs font-medium text-slate-200 flex-1 min-w-0">{n.name}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${stateColor(n.status)}`}>{n.status}</Badge>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700 text-slate-400">{n.horizon}</Badge>
                    <span className="font-mono text-[10px] text-slate-500">score {n.score}</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed">{n.why}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-4 gap-3">
            {roadmap.horizons.map((h) => (
              <Card key={h.horizon} className="bg-slate-900/60 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-teal-300">{h.horizon} <span className="text-slate-500 font-normal">({h.domains.length} domaines)</span></CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-40">
                    <div className="space-y-1 pr-2">
                      {h.domains.map((d) => (
                        <div key={d.code} className="flex items-center gap-1.5 text-[10px]">
                          <span className="font-mono text-slate-500">D.{d.code}</span>
                          <span className="text-slate-400 truncate flex-1">{d.name}</span>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${d.status === 'NOT_STARTED' ? 'bg-slate-600' : 'bg-teal-400'}`} title={d.status} />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ledger d&apos;activation ({roadmap.activationLedger.length} domaines avec preuves archivées)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {roadmap.activationLedger.map((a) => (
                  <span key={a.code} className="rounded-md border border-teal-500/30 bg-teal-500/5 px-2 py-1 text-[10px] font-mono text-teal-300">
                    D.{a.code} · {a.since} · {a.evidenceCount} preuve(s)
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}