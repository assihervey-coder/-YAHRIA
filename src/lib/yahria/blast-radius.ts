// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Semantic Blast-Radius Analyzer (Domain 04.8)
// Doc ID: YAHRIA-KRN-017 | R8 Supremacy Pack
//
// Before any edit is applied, compute its TRANSITIVE reverse-dependency
// closure, map it onto constitutional domains, and gate the change:
//   DENY             — forbidden dependency edge, cycle creation, or
//                      governance-core hit without approval (D.6 > D.8)
//   REQUIRE_APPROVAL — risk score ≥ 0.50 or core-domain hit
//   ALLOW            — bounded, low-risk, tested dependents
//
// Risk model (documented, deterministic — INV-191):
//   risk = 0.10·min(|affected|/20, 1)
//        + 0.15·min(maxDepth/4, 1)
//        + 0.30·coreHitRatio
//        + 0.20·untestedRatio
//        + 0.45·forbiddenEdge?     (binary, also forces DENY)
//        + 0.60·cycleCreated?      (binary, also forces DENY)
//
// Constitutional anchors:
//   INV-181 — impact analysis before critical change
//   INV-004 — dependency graph must remain acyclic
//   INV-180 — no silent architectural change
//   D.6.11  — self-evolution governed (Self-Evolution domain edits)
// ═══════════════════════════════════════════════════════════════

import { DOMAINS, FORBIDDEN_DEPENDENCIES } from './domains';
import { emitYahriaEvent } from './realtime';

// ── BR-1. GRAPH MODEL ──────────────────────────────────────────────

export interface BlastNode { path: string; domain?: string; tested?: boolean; role?: string }
export interface BlastEdge { from: string; to: string } // from imports/depends on to
export interface BlastGraph { nodes: BlastNode[]; edges: BlastEdge[] }

export type ChangeType = 'modify' | 'delete' | 'rename';
export type BlastVerdict = 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY';

export interface InvariantHit { id: string; why: string }

export interface BlastReport {
  target: string;
  targetDomain: string | null;
  changeType: ChangeType;
  affected: { path: string; depth: number; domain: string | null }[];
  affectedCount: number;
  maxDepth: number;
  coreDomainsHit: string[];
  governanceCoreHit: boolean;
  forbiddenEdges: { from: string; to: string; reason: string }[];
  cycles: string[][];
  untestedDependents: number;
  riskScore: number;
  verdict: BlastVerdict;
  invariantsHit: InvariantHit[];
  reasons: string[];
}

// ── BR-2. DOMAIN INFERENCE (heuristic, INV-081-labeled) ────────────

const DOMAIN_PATH_RULES: { test: RegExp; domain: string }[] = [
  { test: /(^|\/)(constitution|docs?\/corpus|invariants|policy)/i, domain: '00' },
  { test: /(^|\/)(lib|kernel|core|reasoning|cognitive)\//i, domain: '06' },
  { test: /(^|\/)(agent|agents)\//i, domain: '05' },
  { test: /(^|\/)tasks?\//i, domain: '07' },
  { test: /(^|\/)(execution|workers?|queue)\//i, domain: '08' },
  { test: /(^|\/)tools?\//i, domain: '09' },
  { test: /(^|\/)(sandbox|overlay)\//i, domain: '10' },
  { test: /(^|\/)(evidence|observab|telemetry|trace)/i, domain: '11' },
  { test: /(^|\/)(policies?|governance)\//i, domain: '12' },
  { test: /(^|\/)(memory|learning)\//i, domain: '13' },
  { test: /(^|\/)(evolution|genome)\//i, domain: '15' },
  { test: /(^|\/)api\//i, domain: '17' },
  { test: /(^|\/)(components?|ui|pages?|app|views?)\//i, domain: '18' },
  { test: /(^|\/)(security|secrets?|auth)\//i, domain: '19' },
  { test: /(^|\/)(tests?|__tests__|spec|e2e)\//i, domain: '20' },
  { test: /(^|\/)(ci|cd|docker|deploy|infra)\//i, domain: '21' },
  { test: /(^|\/)(db|database|schema|prisma|migrations?)\//i, domain: '16' },
];

const GOVERNANCE_CORE = new Set(['00', '11', '12', '19']); // D.6 plane + security

export function inferDomain(path: string): string | null {
  for (const r of DOMAIN_PATH_RULES) if (r.test.test(path)) return r.domain;
  return null;
}

function domainName(code: string | null): string | null {
  if (!code) return null;
  return DOMAINS.find((d) => d.code === code)?.name ?? code;
}

// ── BR-3. CORE ANALYSIS ────────────────────────────────────────────

export function analyzeBlastRadius(
  graph: BlastGraph,
  target: string,
  opts?: { changeType?: ChangeType; approved?: boolean },
): BlastReport {
  const changeType = opts?.changeType ?? 'modify';
  const approved = opts?.approved ?? false;
  const reasons: string[] = [];
  const invariantsHit: InvariantHit[] = [];

  const nodeByPath = new Map(graph.nodes.map((n) => [n.path, n]));
  if (!nodeByPath.has(target)) {
    throw new Error(`Target '${target}' is not a declared node of the graph — refusing to analyze unknown subjects (INV-181)`);
  }

  // Reverse dependency closure (who transitively depends on target).
  const dependents = new Map<string, string[]>(); // file → files that import it
  for (const e of graph.edges) {
    if (!dependents.has(e.to)) dependents.set(e.to, []);
    dependents.get(e.to)!.push(e.from);
  }
  const affected: { path: string; depth: number; domain: string | null }[] = [];
  const seen = new Set<string>([target]);
  let frontier = [target];
  let depth = 0;
  while (frontier.length > 0 && depth < 16) {
    depth += 1;
    const next: string[] = [];
    for (const f of frontier) {
      for (const d of dependents.get(f) ?? []) {
        if (seen.has(d)) continue;
        seen.add(d);
        affected.push({ path: d, depth, domain: nodeByPath.get(d)?.domain ?? inferDomain(d) });
        next.push(d);
      }
    }
    frontier = next;
  }
  const maxDepth = affected.reduce((m, a) => Math.max(m, a.depth), 0);

  // Domain mapping for the target itself.
  const targetDomain = nodeByPath.get(target)?.domain ?? inferDomain(target);
  const hitCodes = new Set<string>(affected.map((a) => a.domain).filter(Boolean) as string[]);
  if (targetDomain) hitCodes.add(targetDomain);
  const coreDomainsHit = [...hitCodes].filter((c) => DOMAINS.find((d) => d.code === c)?.isCore || GOVERNANCE_CORE.has(c));
  const governanceCoreHit = coreDomainsHit.some((c) => GOVERNANCE_CORE.has(c));

  // Cycle detection (DFS over the full graph) — INV-004.
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const cycles: string[][] = [];
  const color = new Map<string, 0 | 1 | 2>(); // white/gray/black
  const stack: string[] = [];
  const dfs = (u: string) => {
    color.set(u, 1);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      if ((color.get(v) ?? 0) === 0) dfs(v);
      else if (color.get(v) === 1) {
        const at = stack.indexOf(v);
        if (at >= 0) cycles.push([...stack.slice(at), v]);
      }
    }
    stack.pop();
    color.set(u, 2);
  };
  for (const n of graph.nodes) if ((color.get(n.path) ?? 0) === 0) dfs(n.path);
  if (cycles.length > 0) {
    invariantsHit.push({ id: 'INV-004', why: `cycle(s) détecté(s) dans le graphe de dépendances: ${cycles[0].join(' → ')}` });
    reasons.push('INV-004: le graphe contient un cycle — dépendance circulaire interdite');
  }

  // Forbidden dependency edges (§28, mapped to domain pairs).
  const forbiddenEdges: { from: string; to: string; reason: string }[] = [];
  for (const e of graph.edges) {
    const dFrom = nodeByPath.get(e.from)?.domain ?? inferDomain(e.from);
    const dTo = nodeByPath.get(e.to)?.domain ?? inferDomain(e.to);
    const nFrom = domainName(dFrom);
    const nTo = domainName(dTo);
    if (!nFrom || !nTo) continue;
    for (const f of FORBIDDEN_DEPENDENCIES) {
      const matchFrom = nFrom.toLowerCase().includes(f.from.toLowerCase().split(' ')[0]);
      const matchTo = nTo.toLowerCase().includes(f.to.toLowerCase().split(' ')[0]);
      if (matchFrom && matchTo) {
        forbiddenEdges.push({ from: e.from, to: e.to, reason: f.reason });
      }
    }
  }
  if (forbiddenEdges.length > 0) {
    invariantsHit.push({ id: 'INV-003', why: `${forbiddenEdges.length} arête(s) interdite(s) §28 dans le rayon d'impact` });
    reasons.push(`Dépendance interdite: ${forbiddenEdges[0].from} → ${forbiddenEdges[0].to} (${forbiddenEdges[0].reason})`);
  }

  // Untested dependents — changes flowing into untested code amplify risk.
  const untestedDependents = affected.filter((a) => nodeByPath.get(a.path)?.tested === false).length;

  // Risk model (weights documented above — deterministic).
  const coreHitRatio = hitCodes.size === 0 ? 0 : coreDomainsHit.length / Math.max(hitCodes.size, 1);
  const untestedRatio = affected.length === 0 ? 0 : untestedDependents / affected.length;
  let risk = 0.10 * Math.min(affected.length / 20, 1)
    + 0.15 * Math.min(maxDepth / 4, 1)
    + 0.30 * coreHitRatio
    + 0.20 * untestedRatio
    + (forbiddenEdges.length > 0 ? 0.45 : 0)
    + (cycles.length > 0 ? 0.60 : 0);
  risk = Math.max(0, Math.min(1, Number(risk.toFixed(4))));

  // Governance gates.
  if (governanceCoreHit) {
    invariantsHit.push({ id: 'INV-180', why: `le changement touche le noyau de gouvernance (domaines ${coreDomainsHit.join(', ')})` });
    reasons.push(`Noyau de gouvernance touché (${coreDomainsHit.map((c) => domainName(c)).join(', ')}) — D.6 gouverne toute mutation`);
  }
  if (affected.length > 0) {
    invariantsHit.push({ id: 'INV-181', why: `${affected.length} fichier(s) transitivement impacté(s), profondeur ${maxDepth}` });
  }
  if (untestedDependents > 0) {
    invariantsHit.push({ id: 'INV-172', why: `${untestedDependents} dépendant(s) sans couverture de test — risque de régression silencieuse` });
  }

  let verdict: BlastVerdict;
  if (forbiddenEdges.length > 0 || cycles.length > 0) {
    verdict = 'DENY';
    reasons.push('Verdict DENY: violation structurelle (§28 ou INV-004) — la politique prime sur l’intention (INV-120)');
  } else if (governanceCoreHit && !approved) {
    verdict = 'DENY';
    reasons.push('Verdict DENY: mutation du noyau de gouvernance sans approbation explicite (INV-161: proposer ≠ approveur)');
  } else if (governanceCoreHit || risk >= 0.50) {
    verdict = 'REQUIRE_APPROVAL';
    reasons.push(`Verdict REQUIRE_APPROVAL: risk=${risk.toFixed(2)} ≥ 0.50 ou noyau touché — validation humaine requise (INV-200)`);
  } else {
    verdict = 'ALLOW';
    reasons.push(`Verdict ALLOW: rayon borné (${affected.length} fichier(s), profondeur ${maxDepth}, risk=${risk.toFixed(2)})`);
  }

  const report: BlastReport = {
    target,
    targetDomain,
    changeType,
    affected,
    affectedCount: affected.length,
    maxDepth,
    coreDomainsHit,
    governanceCoreHit,
    forbiddenEdges,
    cycles,
    untestedDependents,
    riskScore: risk,
    verdict,
    invariantsHit,
    reasons,
  };
  emitYahriaEvent({
    type: 'supremacy.blast.analyzed',
    source: '04',
    severity: verdict === 'ALLOW' ? 'INFO' : verdict === 'REQUIRE_APPROVAL' ? 'WARN' : 'CRITICAL',
    message: `Blast radius de ${target} (${changeType}) : ${verdict} — ${affected.length} impacté(s), risk=${risk.toFixed(2)}`,
    payload: { target, verdict, riskScore: risk, affectedCount: affected.length },
  });
  return report;
}
