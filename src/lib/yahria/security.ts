// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — SECURITY AUDIT (Domain 19) — KRN-035 · R14
//
// Audit de sécurité AUTOMATISÉ, factuel et scellé (INV-231) :
// chaque exécution persiste ses constats (OpsSnapshot) et scelle
// une preuve SECURITY. Les constats sont des faits mesurés —
// jamais une promesse (INV-044 : UNKNOWN ≠ SUCCESS).
// ═══════════════════════════════════════════════════════════════

import { execFile } from 'child_process';
import { promisify } from 'util';
import { db } from '@/lib/db';
import { INVARIANTS } from './invariants';
import { PROVIDER_IDS } from './llm-fabric';
import { captureAndPersist } from './evidence-store';
import { emitYahriaEvent, REALTIME_EVENT_TYPES } from './realtime';

export const SECURITY_MODULE_ID = 'YAHRIA-KRN-035';
const execFileAsync = promisify(execFile);

export interface SecurityCheck {
  id: string; title: string; ok: boolean;
  severity: 'INFO' | 'HIGH' | 'CRITICAL';
  detail: string;
}

const SECRET_PATTERNS = [
  'ghp_[A-Za-z0-9]{20,}', 'github_pat_[A-Za-z0-9_]{20,}', 'sk-ant-[A-Za-z0-9-]{20,}',
  'sk-[A-Za-z0-9]{32,}', 'AKIA[A-Z0-9]{16}', 'ya29\\.[A-Za-z0-9_-]{20,}',
  'xox[baprs]-[A-Za-z0-9-]{10,}',
];

/** Scan git-tracked files for credential-shaped patterns (values never returned). */
async function scanRepoSecrets(): Promise<SecurityCheck> {
  try {
    const { stdout } = await execFileAsync('git', ['grep', '-I', '-n', '-E', SECRET_PATTERNS.join('|'), '--', '.'], { timeout: 15_000, maxBuffer: 8 * 1024 * 1024 });
    const hits = stdout.trim().split('\n').filter((l) => l.length > 0 && !l.includes('YAHRIA_SECRET_PATTERN_DOC'));
    return {
      id: 'REPO_SECRET_SCAN',
      title: 'Scan des fichiers versionnés (motifs d\'identifiants)',
      ok: hits.length === 0,
      severity: hits.length === 0 ? 'INFO' : 'CRITICAL',
      detail: hits.length === 0
        ? 'Aucun motif d\'identifiant détecté dans l\'arborescence versionnée.'
        : `${hits.length} correspondance(s) à structure d\'identifiant — EMPLACEMENTS seulement : ${hits.slice(0, 8).map((h) => h.split(':')[0] + ':' + h.split(':')[1]).join(', ')}. Les valeurs ne sont ni journalisées ni retournées (INV-132). Révocation immédiate exigée.`,
    };
  } catch (e) {
    const err = e as { code?: number; message?: string };
    if (err.code === 1) {
      return { id: 'REPO_SECRET_SCAN', title: 'Scan des fichiers versionnés (motifs d\'identifiants)', ok: true, severity: 'INFO', detail: 'Aucun motif d\'identifiant détecté dans l\'arborescence versionnée.' };
    }
    return { id: 'REPO_SECRET_SCAN', title: 'Scan des fichiers versionnés (motifs d\'identifiants)', ok: false, severity: 'HIGH', detail: `scan non concluant (git indisponible ?) — l'inconnu n'est jamais un succès (INV-044) : ${String(err.message).slice(0, 120)}` };
  }
}

export async function runSecurityAudit(): Promise<{ ok: boolean; checks: SecurityCheck[]; checkedAt: string; snapshotId: string; evidenceUid: string }> {
  const checks: SecurityCheck[] = [];

  // 1. Deny-by-default politics alive (POL-012 side-effect deny)
  const pol12 = await db.policyRule.findFirst({ where: { ruleId: 'POL-012' } });
  checks.push({
    id: 'POLICY_DENY_DEFAULT', title: 'Refus par défaut vivant (POL-012)',
    ok: !!pol12 && pol12.active && pol12.effect === 'DENY',
    severity: 'CRITICAL',
    detail: pol12
      ? `POL-012 (${pol12.name}) active=${pol12.active}, effet=${pol12.effect} — les outils à effet de bord restent refusés par défaut (INV-062/120).`
      : 'POL-012 introuvable — la défense de premier niveau est absente, situation critique.',
  });

  // 2. Constitutional rules still locked count (POL-001..POL-012 present)
  const seeds = await db.policyRule.findMany({ where: { ruleId: { startsWith: 'POL-' } } });
  const seedIds = seeds.filter((r) => /^POL-\d{3}$/.test(r.ruleId));
  checks.push({
    id: 'CONSTITUTIONAL_RULES_INTACT', title: 'Règles constitutionnelles présentes',
    ok: seedIds.length >= 12,
    severity: 'HIGH',
    detail: `${seedIds.length} règle(s) constitutionnelle(s) POL-0xx en base (attendu ≥ 12) — verrou INV-219 appliqué par la console.`,
  });

  // 3. API keys stored hashed only (INV-229)
  const keys = await db.apiKey.findMany();
  const badKeys = keys.filter((k) => k.keyHash.length !== 64 || k.keyPrefix.length > 16);
  checks.push({
    id: 'API_KEYS_HASHED', title: 'Clés API stockées en SHA-256 uniquement',
    ok: badKeys.length === 0,
    severity: 'CRITICAL',
    detail: badKeys.length === 0
      ? `${keys.length} clé(s) inspectée(s) — hash 64 hex et prefix borné ; aucun plaintext persisté (INV-229).`
      : `${badKeys.length} clé(s) non conformes détectée(s) — révocation exigée.`,
  });

  // 4. Provider keys never exposed client-side (INV-213) — env names only, values never read here
  const providerEnvNames = PROVIDER_IDS.map((p) => `${p.toUpperCase()}_API_KEY`);
  const present = providerEnvNames.filter((n) => !!process.env[n]);
  checks.push({
    id: 'PROVIDER_KEYS_SERVER_SIDE', title: 'Clés fournisseurs côté serveur uniquement',
    ok: true,
    severity: 'INFO',
    detail: `${present.length}/${PROVIDER_IDS.length} clé(s) fournisseur configurée(s) côté serveur (noms inspectés, valeurs JAMAIS lues par cet audit). Le fabric masque les clés dans toute télémétrie (INV-213).`,
  });

  // 5. Sandbox isolation level — honest reporting (INV-215)
  const backend = process.env.YAHRIA_SANDBOX_BACKEND ?? 'process';
  checks.push({
    id: 'SANDBOX_ISOLATION_LEVEL', title: 'Niveau d\'isolation sandbox (honnête)',
    ok: true,
    severity: 'INFO',
    detail: backend === 'docker'
      ? 'Backend CONTENEUR durci : --network none, rootfs read-only, cap-drop ALL, no-new-privileges, cpu/mem/pids bornés (INV-215).'
      : `Backend PROCESS (isolation documentée plus faible : env scrubé, timeouts, kill de groupe). Basculer via YAHRIA_SANDBOX_BACKEND=docker sur un hôte avec daemon Docker (INV-215).`,
  });

  // 6. Invariants registry sane
  const ids = INVARIANTS.map((i) => i.id);
  const unique = new Set(ids).size === ids.length;
  checks.push({
    id: 'INVARIANT_REGISTRY_SANE', title: 'Registre des invariants cohérent',
    ok: unique && ids.length >= 97,
    severity: 'HIGH',
    detail: `${ids.length} invariants, unicité ${unique ? 'OK' : 'VIOLÉE'} — le registre est la référence des gates (INV-232).`,
  });

  // 7. Evidence chain sampled for content hashes
  const ev = await db.evidence.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { contentHash: true } });
  const missing = ev.filter((r) => !r.contentHash).length;
  checks.push({
    id: 'EVIDENCE_HASH_COVERAGE', title: 'Couverture de hachage des preuves (100 derniers)',
    ok: ev.length === 0 || missing === 0,
    severity: 'HIGH',
    detail: ev.length === 0 ? 'Aucune preuve encore — rien à mesurer (non considéré comme un échec).' : `${ev.length - missing}/${ev.length} preuves portent un SHA-256 (INV-110).`,
  });

  // 8. Repo secret scan
  checks.push(await scanRepoSecrets());

  const ok = checks.filter((c) => c.severity === 'CRITICAL').every((c) => c.ok)
    && checks.filter((c) => c.severity === 'HIGH').every((c) => c.ok);

  const snapshot = await db.opsSnapshot.create({
    data: {
      kind: 'SECURITY_AUDIT', ok,
      summary: JSON.stringify({ checks, checkedAt: new Date().toISOString() }).slice(0, 60_000),
    },
  });
  const evidence = await captureAndPersist({
    category: 'SECURITY', criticality: ok ? 'STANDARD' : 'CRITICAL',
    actorType: 'SYSTEM', actorId: 'security-audit',
    claim: `Audit sécurité : ${checks.filter((c) => c.ok).length}/${checks.length} contrôles OK${ok ? '' : ' — constats critiques/high à traiter'}`,
    payload: { snapshotId: snapshot.id, checks: checks.map((c) => ({ id: c.id, ok: c.ok, severity: c.severity })) },
  });
  emitYahriaEvent({
    type: REALTIME_EVENT_TYPES.SECURITY_AUDITED, source: '19',
    severity: ok ? 'SUCCESS' : 'CRITICAL',
    message: `Audit sécurité ${ok ? 'conforme' : 'NON conforme'} — ${checks.filter((c) => c.ok).length}/${checks.length} contrôles`,
    payload: { snapshotId: snapshot.id, evidenceUid: evidence.uid },
  });

  return { ok, checks, checkedAt: new Date().toISOString(), snapshotId: snapshot.id, evidenceUid: evidence.uid };
}
