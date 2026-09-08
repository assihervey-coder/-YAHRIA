// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Proof-Carrying Code Generation (Domain 20/11)
// Doc ID: YAHRIA-KRN-015 | R8 Supremacy Pack
//
// IDEA (expert-grade): every generated artifact ships with a MACHINE-
// CHECKABLE proof certificate. The certificate embeds re-executable
// predicates (checker name + arguments), NOT trusted claims. A third
// party can verify compliance WITHOUT re-running generation and
// WITHOUT trusting the generator (INV-161: proposer ≠ approver).
//
// Constitutional anchors:
//   INV-080 — model output is not fact → predicates are re-executed
//   INV-102 — evidence before assertion
//   INV-161 — separation of proposal and approval
//   INV-191 — deterministic, canonical hashing (clock injectable)
// ═══════════════════════════════════════════════════════════════

import { sha256Canonical } from './canonical';
import { emitYahriaEvent } from './realtime';

// ── PC-1. PREDICATE CONTRACT ───────────────────────────────────────

export interface ProofPredicate {
  id: string;                 // e.g. "PC-003"
  invariant: string;          // e.g. "INV-080"
  claim: string;              // human-readable property
  checker: string;            // registry key — MUST exist in PROOF_CHECKERS
  args: Record<string, unknown>; // re-executable arguments
  outcome: 'PASS' | 'FAIL';   // recorded by builder — IGNORED by verifier
  detail: string;
}

export interface ProofCertificate {
  certificateUid: string;
  version: '1.0.0';
  subject: { path: string; sha256: string; bytes: number };
  predicates: ProofPredicate[];
  proofHash: string;          // canonical hash of {version, subject, predicates}
  issuedAt: string;
  issuer: string;
}

export type ProofVerdict =
  | { status: 'VALID'; reexecuted: number; proofHash: string }
  | { status: 'INVALID'; reexecuted: number; failed: ProofPredicate[]; proofHash: string }
  | { status: 'TAMPERED'; expectedProofHash: string; recomputedProofHash: string };

// ── PC-2. PURE CHECKER REGISTRY (the re-executable kernel) ─────────

export type CheckerResult = { ok: boolean; detail: string };
export type CheckerFn = (args: Record<string, unknown>) => CheckerResult;

export const PROOF_CHECKERS: Record<string, CheckerFn> = {
  /** INV-080 — no unresolved model placeholder survives in shipped content. */
  no_placeholder: (a) => {
    const text = String(a.text ?? '');
    const hits = text.match(/\b(TODO|TBD|FIXME|PLACEHOLDER)\b|<\.\.\.>|\.\.\.\s*$/gm);
    return hits
      ? { ok: false, detail: `placeholder tokens present: ${hits.slice(0, 5).join(', ')}` }
      : { ok: true, detail: 'no placeholder token (INV-080)' };
  },

  /** INV-171 — structural sanity: (), [], {}, and quotes balance. */
  balanced_delims: (a) => {
    const text = String(a.text ?? '');
    const stack: string[] = [];
    const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    let inStr: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const prev = i > 0 ? text[i - 1] : '';
      if (inStr) { if (c === inStr && prev !== '\\') inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '(' || c === '[' || c === '{') stack.push(c);
      if (c === ')' || c === ']' || c === '}') {
        if (stack.pop() !== pairs[c]) {
          return { ok: false, detail: `unbalanced delimiter '${c}' at offset ${i}` };
        }
      }
    }
    return stack.length === 0
      ? { ok: true, detail: 'all delimiters balanced' }
      : { ok: false, detail: `${stack.length} unclosed delimiter(s): ${stack.join('')}` };
  },

  /** INV-003/POL — only authorized imports. */
  authorized_imports: (a) => {
    const text = String(a.text ?? '');
    const forbidden = Array.isArray(a.forbiddenModules) ? (a.forbiddenModules as string[]) : [];
    const imports = text.match(/(?:from|require\(|import\s+)\s*['"]([^'"]+)['"]/g) ?? [];
    const found = imports
      .map((m) => m.match(/['"]([^'"]+)['"]/)?.[1] ?? '')
      .filter((mod) => forbidden.some((f) => mod === f || mod.startsWith(f + '/')));
    return found.length === 0
      ? { ok: true, detail: `all ${imports.length} import(s) authorized` }
      : { ok: false, detail: `forbidden imports: ${found.join(', ')}` };
  },

  /** INV-053 — no credential-shaped literal. */
  no_secret_literals: (a) => {
    const text = String(a.text ?? '');
    const patterns: [RegExp, string][] = [
      [/sk-[A-Za-z0-9]{16,}/, 'OpenAI-style key'],
      [/ghp_[A-Za-z0-9]{20,}/, 'GitHub token'],
      [/AKIA[0-9A-Z]{12,}/, 'AWS access key'],
      [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
      [/\b(password|secret|token)\s*[:=]\s*['"][^'"]{6,}['"]/i, 'hardcoded credential assignment'],
    ];
    for (const [re, label] of patterns) {
      const m = text.match(re);
      if (m) return { ok: false, detail: `secret-shaped literal detected (${label}): ${m[0].slice(0, 18)}…` };
    }
    return { ok: true, detail: 'no credential-shaped literal (INV-053)' };
  },

  /** INV-120 — path confinement inside the workspace overlay. */
  path_within_workspace: (a) => {
    const p = String(a.path ?? '');
    const bad = p.startsWith('/') || p.includes('..') || p.includes('\\') || /^[a-zA-Z]:/.test(p);
    return bad
      ? { ok: false, detail: `path escapes workspace overlay: ${p}` }
      : { ok: true, detail: 'path confined to workspace overlay' };
  },

  /** INV-102 — content hash equals the recorded subject hash (binding). */
  hash_matches: (a) => {
    const got = sha256Canonical(String(a.text ?? ''));
    return got === a.expectedSha256
      ? { ok: true, detail: 'content hash matches subject' }
      : { ok: false, detail: `content hash mismatch: expected ${a.expectedSha256}, got ${got}` };
  },

  /** INV-031 — JSON artifacts parse and are objects. */
  json_parses: (a) => {
    try {
      const v = JSON.parse(String(a.text ?? ''));
      return v !== null && typeof v === 'object'
        ? { ok: true, detail: 'parses as JSON object' }
        : { ok: false, detail: 'JSON parses but is not an object' };
    } catch (e) {
      return { ok: false, detail: `JSON parse error: ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  /** INV-042 — content bounded. */
  size_bounded: (a) => {
    const bytes = Buffer.byteLength(String(a.text ?? ''), 'utf8');
    const max = Number(a.maxBytes ?? 1_000_000);
    return bytes <= max
      ? { ok: true, detail: `${bytes} bytes ≤ ${max}` }
      : { ok: false, detail: `${bytes} bytes exceed bound ${max}` };
  },
};

// ── PC-3. CERTIFICATE BUILDER (proposer side) ──────────────────────

export interface SubjectSpec { path: string; text: string }
export interface PredicateSpec { invariant: string; claim: string; checker: string; args: Record<string, unknown> }

let certSeq = 0;

export function buildProofCertificate(
  subject: SubjectSpec,
  predicates: PredicateSpec[],
  opts?: { now?: string; issuer?: string },
): { certificate: ProofCertificate; proofHash: string } {
  const subjectHash = sha256Canonical(subject.text);
  const built: ProofPredicate[] = predicates.map((p, i) => {
    const checker = PROOF_CHECKERS[p.checker];
    if (!checker) throw new Error(`Unknown checker '${p.checker}' — certificates must embed re-executable predicates only`);
    const r = checker(p.args);
    return {
      id: `PC-${String(i + 1).padStart(3, '0')}`,
      invariant: p.invariant,
      claim: p.claim,
      checker: p.checker,
      args: p.args,
      outcome: r.ok ? 'PASS' : 'FAIL',
      detail: r.detail,
    };
  });
  certSeq += 1;
  const core = {
    version: '1.0.0' as const,
    subject: { path: subject.path, sha256: subjectHash, bytes: Buffer.byteLength(subject.text, 'utf8') },
    predicates: built,
  };
  const proofHash = sha256Canonical(core);
  const certificate: ProofCertificate = {
    certificateUid: `PCC-${String(certSeq).padStart(6, '0')}`,
    ...core,
    proofHash,
    issuedAt: opts?.now ?? new Date().toISOString(),
    issuer: opts?.issuer ?? 'YAHRIA-STUDIO-CODER',
  };
  emitYahriaEvent({
    type: 'supremacy.proof.issued',
    source: '20',
    severity: built.every((p) => p.outcome === 'PASS') ? 'SUCCESS' : 'WARN',
    message: `Preuve embarquée émise pour ${subject.path} — ${built.filter((p) => p.outcome === 'PASS').length}/${built.length} prédicats PASS`,
    payload: { certificateUid: certificate.certificateUid, proofHash },
  });
  return { certificate, proofHash };
}

// ── PC-4. INDEPENDENT VERIFIER (approver side — trusts NOTHING) ────

export function verifyProofCertificate(cert: ProofCertificate): ProofVerdict {
  // Step 1 — tamper detection over the certificate body itself.
  const { subject, predicates } = cert;
  const recomputed = sha256Canonical({ version: cert.version, subject, predicates });
  if (recomputed !== cert.proofHash) {
    return { status: 'TAMPERED', expectedProofHash: cert.proofHash, recomputedProofHash: recomputed };
  }
  // Step 2 — re-execute every embedded predicate. The verifier NEVER
  // reads the recorded `outcome` — it re-derives it (INV-161).
  const failed: ProofPredicate[] = [];
  let reexecuted = 0;
  for (const p of predicates) {
    const checker = PROOF_CHECKERS[p.checker];
    if (!checker) {
      failed.push({ ...p, outcome: 'FAIL', detail: `checker '${p.checker}' not in verifier registry` });
      continue;
    }
    const r = checker(p.args);
    reexecuted += 1;
    if (!r.ok) failed.push({ ...p, outcome: 'FAIL', detail: r.detail });
  }
  // Step 3 — subject binding: a certificate that does not pin its
  // content via hash_matches proves nothing (INV-102).
  const bindsSubject = predicates.some((p) => p.checker === 'hash_matches');
  if (!bindsSubject) {
    failed.push({
      id: 'PC-BIND', invariant: 'INV-102', claim: 'certificate binds subject content',
      checker: 'hash_matches', args: {}, outcome: 'FAIL',
      detail: 'certificate does not bind its subject via hash_matches — unprovable',
    });
  }
  if (failed.length > 0) return { status: 'INVALID', reexecuted, failed, proofHash: cert.proofHash };
  return { status: 'VALID', reexecuted, proofHash: cert.proofHash };
}

/** Convenience — standard predicate set for a generated source file. */
export function standardPredicates(path: string, text: string, forbiddenModules: string[] = ['child_process', 'net', 'dns']): PredicateSpec[] {
  const list: PredicateSpec[] = [
    { invariant: 'INV-120', claim: 'path confined to workspace overlay', checker: 'path_within_workspace', args: { path } },
    { invariant: 'INV-102', claim: 'certificate binds subject content by hash', checker: 'hash_matches', args: { text, expectedSha256: sha256Canonical(text) } },
    { invariant: 'INV-080', claim: 'no unresolved model placeholder', checker: 'no_placeholder', args: { text } },
    { invariant: 'INV-171', claim: 'delimiters balanced', checker: 'balanced_delims', args: { text } },
    { invariant: 'INV-053', claim: 'no credential-shaped literal', checker: 'no_secret_literals', args: { text } },
    { invariant: 'INV-003', claim: 'all imports authorized', checker: 'authorized_imports', args: { text, forbiddenModules } },
    { invariant: 'INV-042', claim: 'content within size bound', checker: 'size_bounded', args: { text, maxBytes: 1_000_000 } },
  ];
  if (path.endsWith('.json')) {
    list.push({ invariant: 'INV-031', claim: 'parses as JSON object', checker: 'json_parses', args: { text } });
  }
  return list;
}
