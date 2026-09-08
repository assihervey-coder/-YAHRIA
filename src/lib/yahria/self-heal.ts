// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Bounded Self-Healing Loop (Domain 08/22)
// Doc ID: YAHRIA-KRN-021 | R8 Supremacy Pack
//
// When a generated artifact fails its proof predicates, the healer:
//   DETECTED → CLASSIFIED (defect taxonomy) → CONTAINING/CONTAINED
//   → ANALYZING → RECOVERY_SELECTED → RECOVERING → VERIFYING
//   → RECOVERED | UNRECOVERABLE
// following the FAILURE_MACHINE discipline — every phase logged,
// every repair DETERMINISTIC, the loop BOUNDED by maxAttempts
// (INV-092/INV-210: no unbounded guessing).
//
// Real repairs, not hand-waving:
//   PLACEHOLDER       → TODO/... markers replaced by an explicit
//                       REQUIRES_SPECIFICATION throw (honest, INV-210)
//   UNBALANCED_DELIMS → missing closing delimiters APPENDED (stack-computed)
//   FORBIDDEN_IMPORT  → import commented out with constitutional banner
//   SECRET_LITERAL    → credential-shaped literals REDACTED (INV-053)
//   EMPTY_FILE        → minimal scaffold by extension
//
// Constitutional anchors:
//   INV-210 — fail safely, never guess beyond budget
//   INV-211 — failure preserves evidence (timeline kept)
//   INV-092 — retry is governed (max attempts)
//   INV-161 — the healed artifact ships with a fresh proof certificate
// ═══════════════════════════════════════════════════════════════

import { PROOF_CHECKERS, buildProofCertificate, standardPredicates, type ProofCertificate } from './proof-carrying';
import { emitYahriaEvent } from './realtime';

// ── SH-1. DEFECT TAXONOMY ──────────────────────────────────────────

export type DefectKind =
  | 'PLACEHOLDER' | 'UNBALANCED_DELIMS' | 'FORBIDDEN_IMPORT'
  | 'SECRET_LITERAL' | 'EMPTY_FILE' | 'SIZE_OVERFLOW' | 'UNKNOWN';

export interface Defect {
  kind: DefectKind;
  invariant: string;
  detail: string;
  fatal: boolean; // true → no deterministic repair exists
}

export interface HealAttempt {
  attempt: number;
  phase: 'DETECTED' | 'CLASSIFYING' | 'CLASSIFIED' | 'CONTAINING' | 'CONTAINED' | 'ANALYZING' | 'RECOVERY_SELECTED' | 'RECOVERING' | 'VERIFYING' | 'RECOVERED' | 'UNRECOVERABLE';
  detail: string;
  bytesBefore: number;
  bytesAfter: number;
}

export interface HealResult {
  path: string;
  healed: boolean;
  attempts: number;
  initialDefects: Defect[];
  finalDefects: Defect[];
  content: string;                 // final content (healed or last state)
  timeline: HealAttempt[];         // INV-211: failure/success evidence preserved
  certificate: ProofCertificate | null;
  verdict: 'RECOVERED' | 'UNRECOVERABLE' | 'ALREADY_CLEAN';
}

// ── SH-2. DIAGNOSIS (uses the PROOF_CHECKERS registry — same law) ──

export function diagnose(path: string, content: string): Defect[] {
  const defects: Defect[] = [];
  if (content.trim().length === 0) {
    defects.push({ kind: 'EMPTY_FILE', invariant: 'INV-171', detail: 'fichier vide — aucun contenu à prouver', fatal: false });
    return defects;
  }
  const noPh = PROOF_CHECKERS.no_placeholder({ text: content });
  if (!noPh.ok) defects.push({ kind: 'PLACEHOLDER', invariant: 'INV-080', detail: noPh.detail, fatal: false });
  const bal = PROOF_CHECKERS.balanced_delims({ text: content });
  if (!bal.ok && /unclosed delimiter/.test(bal.detail)) {
    defects.push({ kind: 'UNBALANCED_DELIMS', invariant: 'INV-171', detail: bal.detail, fatal: false });
  }
  const imp = PROOF_CHECKERS.authorized_imports({ text: content, forbiddenModules: ['child_process', 'net', 'dns'] });
  if (!imp.ok) defects.push({ kind: 'FORBIDDEN_IMPORT', invariant: 'INV-003', detail: imp.detail, fatal: false });
  const sec = PROOF_CHECKERS.no_secret_literals({ text: content });
  if (!sec.ok) defects.push({ kind: 'SECRET_LITERAL', invariant: 'INV-053', detail: sec.detail, fatal: false });
  const size = PROOF_CHECKERS.size_bounded({ text: content, maxBytes: 1_000_000 });
  if (!size.ok) defects.push({ kind: 'SIZE_OVERFLOW', invariant: 'INV-042', detail: size.detail, fatal: true });
  return defects;
}

// ── SH-3. DETERMINISTIC REPAIRS ────────────────────────────────────

function repairPlaceholder(text: string): string {
  const throwBlock = 'throw new Error("REQUIRES_SPECIFICATION (INV-210): placeholder removed by YAHRIA self-heal — do not ship without a real specification");';
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(\/\/|#|\*)?\s*(TODO|TBD|FIXME)\b/i.test(line)) {
        const indent = line.match(/^\s*/)?.[0] ?? '';
        const isPython = /^\s*#/.test(line);
        return isPython
          ? `${indent}raise NotImplementedError("REQUIRES_SPECIFICATION (INV-210): placeholder removed by YAHRIA self-heal")`
          : `${indent}${throwBlock}`;
      }
      // trailing ellipsis inside function bodies → explicit honest failure
      if (/\.\.\.\s*$/.test(line) && !/import|from|\{|\[/.test(line)) {
        const indent = line.match(/^\s*/)?.[0] ?? '';
        const isPython = /^\s*(def|class)\b/.test(text) || /^\s*#/.test(line);
        return isPython ? `${indent}raise NotImplementedError("REQUIRES_SPECIFICATION (INV-210)")` : `${indent}${throwBlock}`;
      }
      return line;
    })
    .join('\n')
    .replace(/<\.\.\.>/g, 'REQUIRES_SPECIFICATION');
}

function repairUnbalanced(text: string): string {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const closers: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  let inStr: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const prev = i > 0 ? text[i - 1] : '';
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') stack.push(c);
    if (c === ')' || c === ']' || c === '}') {
      if (stack[stack.length - 1] === pairs[c]) stack.pop();
    }
  }
  const suffix = stack.reverse().map((op) => closers[op]).join('');
  const banner = suffix.length > 0
    ? `\n// YAHRIA SELF-HEAL: ${suffix.length} délimiteur(s) fermant(s) ajouté(s) (INV-171)\n`
    : '\n';
  return text.replace(/\n*$/, '') + banner + suffix + '\n';
}

function repairForbiddenImports(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const m = line.match(/^\s*(?:import\s+.*|.*\bfrom\s+|.*\brequire\()\s*['"](child_process|net|dns)(\/[^'"]*)?['"]/);
      if (m) {
        // NB: the banner MUST NOT echo the module path — the authorized_imports
        // checker scans comments too, echoing it would loop forever.
        return '// YAHRIA SELF-HEAL: import non autorisé désactivé (INV-003/§28)';
      }
      return line;
    })
    .join('\n');
}

function repairSecrets(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9]{16,}/g, '<REDACTED:INV-053>')
    .replace(/ghp_[A-Za-z0-9]{20,}/g, '<REDACTED:INV-053>')
    .replace(/AKIA[0-9A-Z]{12,}/g, '<REDACTED:INV-053>')
    .replace(/(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g, '$1 REDACTED (INV-053) $2')
    .replace(/\b(password|secret|token)(\s*[:=]\s*)['"][^'"]{6,}['"]/gi, '$1$2"<REDACTED:INV-053>"');
}

function repairEmpty(path: string): string {
  if (path.endsWith('.json')) return '{\n  "yahria": "scaffolded by self-heal (INV-210)"\n}\n';
  if (path.endsWith('.py')) return '# YAHRIA SELF-HEAL: scaffold minimal — module vide au diagnostic\n\npass\n';
  if (path.endsWith('.md')) return '# Module\n\n_Généré par YAHRIA self-heal — contenu à spécifier (INV-210)._\n';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return '// YAHRIA SELF-HEAL: scaffold minimal — module vide au diagnostic\nexport {};\n';
  if (path.endsWith('.js') || path.endsWith('.mjs')) return '// YAHRIA SELF-HEAL: scaffold minimal — module vide au diagnostic\nexport {};\n';
  return '';
}

// ── SH-4. HEALING LOOP (bounded, FAILURE_MACHINE discipline) ───────

export function selfHeal(
  path: string,
  content: string,
  opts?: { maxAttempts?: number; issuer?: string },
): HealResult {
  const maxAttempts = Math.min(opts?.maxAttempts ?? 3, 5);
  const timeline: HealAttempt[] = [];
  const push = (phase: HealAttempt['phase'], detail: string, b0: number, b1: number) => {
    timeline.push({ attempt: timeline.filter((t) => t.phase === 'CLASSIFIED').length + 1, phase, detail, bytesBefore: b0, bytesAfter: b1 });
  };

  let current = content;
  let defects = diagnose(path, current);
  const initialDefects = defects.map((d) => ({ ...d }));

  emitYahriaEvent({
    type: 'supremacy.selfheal.detected',
    source: '08',
    severity: defects.length === 0 ? 'INFO' : 'WARN',
    message: defects.length === 0
      ? `${path} : propre au diagnostic — aucune réparation nécessaire`
      : `${path} : ${defects.length} défaut(s) classifié(s) — boucle d'auto-réparation engagée (max ${maxAttempts})`,
    payload: { path, defects: defects.map((d) => d.kind) },
  });

  if (defects.length === 0) {
    const { certificate } = buildProofCertificate(
      { path, text: current },
      standardPredicates(path, current),
      { issuer: 'YAHRIA-SELF-HEAL' },
    );
    return {
      path, healed: false, attempts: 0, initialDefects: [], finalDefects: [],
      content: current, timeline, certificate, verdict: 'ALREADY_CLEAN',
    };
  }

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    const bytesBefore = Buffer.byteLength(current, 'utf8');
    push('CLASSIFIED', defects.map((d) => d.kind).join(', '), bytesBefore, bytesBefore);

    if (defects.some((d) => d.fatal)) {
      push('UNRECOVERABLE', `défaut non réparable déterministement (${defects.filter((d) => d.fatal).map((d) => d.kind).join(', ')}) — escalade humaine (INV-210)`, bytesBefore, bytesBefore);
      emitYahriaEvent({
        type: 'supremacy.selfheal.unrecoverable',
        source: '08', severity: 'CRITICAL',
        message: `${path} : UNRECOVERABLE après ${attempts} tentative(s) — défauts fatals présents`,
        payload: { path, defects: defects.map((d) => d.kind) },
      });
      return {
        path, healed: false, attempts, initialDefects,
        finalDefects: defects, content: current, timeline, certificate: null,
        verdict: 'UNRECOVERABLE',
      };
    }

    push('RECOVERY_SELECTED', 'stratégie: réparations déterministes par type de défaut', bytesBefore, bytesBefore);

    // Apply ALL applicable repairs this attempt (idempotent, order stable).
    let next = current;
    const applied: string[] = [];
    if (defects.some((d) => d.kind === 'EMPTY_FILE')) { next = repairEmpty(path) || next; applied.push('EMPTY_FILE→scaffold'); }
    if (defects.some((d) => d.kind === 'PLACEHOLDER')) { next = repairPlaceholder(next); applied.push('PLACEHOLDER→REQUIRES_SPECIFICATION'); }
    if (defects.some((d) => d.kind === 'SECRET_LITERAL')) { next = repairSecrets(next); applied.push('SECRET_LITERAL→REDACTED'); }
    if (defects.some((d) => d.kind === 'FORBIDDEN_IMPORT')) { next = repairForbiddenImports(next); applied.push('FORBIDDEN_IMPORT→disabled'); }
    if (defects.some((d) => d.kind === 'UNBALANCED_DELIMS')) { next = repairUnbalanced(next); applied.push('UNBALANCED→closed'); }
    const bytesAfter = Buffer.byteLength(next, 'utf8');
    push('RECOVERING', `réparations appliquées: ${applied.join(' · ')}`, bytesBefore, bytesAfter);

    current = next;
    defects = diagnose(path, current);
    push('VERIFYING', `re-diagnostic: ${defects.length} défaut(s) restant(s)`, bytesAfter, bytesAfter);

    if (defects.length === 0) {
      push('RECOVERED', `artifact réparé en ${attempts} tentative(s) — re-scellé par certificat de preuve`, bytesAfter, bytesAfter);
      const { certificate } = buildProofCertificate(
        { path, text: current },
        standardPredicates(path, current),
        { issuer: 'YAHRIA-SELF-HEAL' },
      );
      emitYahriaEvent({
        type: 'supremacy.selfheal.recovered',
        source: '08', severity: 'SUCCESS',
        message: `${path} : RÉPARÉ en ${attempts} tentative(s) — certificat ${certificate.certificateUid} émis`,
        payload: { path, attempts, certificateUid: certificate.certificateUid },
      });
      return {
        path, healed: true, attempts, initialDefects, finalDefects: [],
        content: current, timeline, certificate, verdict: 'RECOVERED',
      };
    }
  }

  push('UNRECOVERABLE', `budget de ${maxAttempts} tentatives épuisé — escalade (INV-092/INV-210)`, Buffer.byteLength(current, 'utf8'), Buffer.byteLength(current, 'utf8'));
  emitYahriaEvent({
    type: 'supremacy.selfheal.unrecoverable',
    source: '08', severity: 'CRITICAL',
    message: `${path} : UNRECOVERABLE — budget de ${maxAttempts} tentatives épuisé, défauts résiduels: ${defects.map((d) => d.kind).join(', ')}`,
    payload: { path, attempts, residual: defects.map((d) => d.kind) },
  });
  return {
    path, healed: false, attempts, initialDefects,
    finalDefects: defects, content: current, timeline, certificate: null,
    verdict: 'UNRECOVERABLE',
  };
}
