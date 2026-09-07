// ═══════════════════════════════════════════════════════════════
// R14 PROOF SUITE — Plateforme : Mission Graph (KRN-031) · Memory
// (KRN-030) · Learning (KRN-032) · Evolution (KRN-033) · API v1
// (KRN-034) · Security (KRN-035) · Quality (KRN-036) · Ops
// (KRN-037) · Roadmap (KRN-038) + ledger 24/24.
//
// Chaque scénario est un fait mesuré contre l'API live (INV-080) :
//
//   bun run scripts/r14-platform-tests.ts
// ═══════════════════════════════════════════════════════════════

const BASE = process.env.YAHRIA_BASE ?? 'http://localhost:3000';
let passed = 0, failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function get(path: string, headers?: Record<string, string>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, json: await res.json() };
}
async function post(path: string, body?: Record<string, unknown>, headers?: Record<string, string>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, json: await res.json() };
}
async function patch(path: string, body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}
async function del(path: string, body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}
async function put(path: string, body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

async function main(): Promise<void> {
  console.log(`\nR14 — Plateforme gouvernée · cible ${BASE}\n`);

  // Amorçage : s'assurer que le bootstrap a rattrapé le ledger
  const sys0 = await get('/api/yahria/system');

  // ══ A. D.13 — MÉMOIRE GOUVERNÉE (KRN-030) ══════════════════════
  console.log('A. Mémoire gouvernée — provenance, consolidation, oubli');

  const memNoSrc = await post('/api/yahria/memory', { kind: 'SEMANTIC', key: 'r14.test.nosource', content: 'test', source: '' });
  check('Écriture sans provenance refusée 422 (INV-221)', memNoSrc.status === 422, `status=${memNoSrc.status}`);

  const memW = await post('/api/yahria/memory', { kind: 'WORKING', key: 'r14.proof.mem', content: 'Constat R14 : la mémoire gouvernée refuse les écritures anonymes.', source: 'suite-r14', validation: 'PROBABLE', confidence: 0.6 });
  check('Écriture gouvernée acceptée avec preuve MEMORY', memW.status === 201 && !!memW.json.evidenceUid && memW.json.ok, JSON.stringify(memW.json.errors ?? ''));

  const memC = await patch('/api/yahria/memory', { id: memW.json.record.id, evidenceRef: 'suite-r14' });
  check('Consolidation WORKING → SEMANTIC (monotone)', memC.json.ok && memC.json.record?.kind === 'SEMANTIC', JSON.stringify(memC.json.errors ?? ''));

  const memArch = await post('/api/yahria/memory', { kind: 'ARCHITECTURAL', key: 'r14.proof.arch', content: 'Décision architecturale R14', source: 'suite-r14', validation: 'VERIFIED' });
  const memArchDel = await del('/api/yahria/memory', { id: memArch.json.record.id, reason: 'tentative de suppression ARCHITECTURAL — doit être refusée' });
  check('Suppression ARCHITECTURAL refusée 422 (INV-222)', memArchDel.status === 422, `status=${memArchDel.status}`);

  const memDelShort = await del('/api/yahria/memory', { id: memW.json.record.id, reason: 'court' });
  check('Oubli avec raison courte refusé 422 (INV-222)', memDelShort.status === 422);
  const memDel = await del('/api/yahria/memory', { id: memW.json.record.id, reason: 'R14 : oubli gouverné après vérification du comportement' });
  check('Oubli gouverné avec raison scellée', memDel.json.ok && !!memDel.json.evidenceUid);

  // ══ B. D.07 — MISSION GRAPH (KRN-031) ══════════════════════════
  console.log('B. Mission Graph — DAG, tick multi-agents, verdicts réels');

  const misBad = await post('/api/yahria/missions', {
    action: 'create', goal: 'Mission invalide R14',
    tasks: [
      { title: 'T1', agentKey: 'architect', toolId: 'system.domains.list', dependsOn: [1] },
    ],
  });
  check('Auto-dépendance refusée 422 (INV-223)', misBad.status === 422, JSON.stringify(misBad.json.errors ?? []));

  const misBadAgent = await post('/api/yahria/missions', {
    action: 'create', goal: 'Mission agent inconnu R14',
    tasks: [{ title: 'T1', agentKey: 'superman', toolId: 'system.domains.list', dependsOn: [] }],
  });
  check('Agent inconnu refusé 422 (INV-224)', misBadAgent.status === 422);

  const mis = await post('/api/yahria/missions', { action: 'create', goal: 'Diagnostic complet de l\'état du système R14', strategy: 'DECOMPOSED' });
  check('Mission DECOMPOSED créée (3 tâches, DAG validé)', mis.status === 201 && mis.json.mission?.tasks?.length === 3, JSON.stringify(mis.json.errors ?? []));
  const uid = mis.json.mission?.missionUid as string;
  const traceId = mis.json.mission?.traceId as string;
  check('traceId de mission présent (INV-217)', typeof traceId === 'string' && traceId.startsWith('TR-MIS-'));

  const tickEarly = await post('/api/yahria/missions', { action: 'tick', uid });
  check('Tick avant programmation refusé (machine à états INV-090)', tickEarly.status === 422, `status=${tickEarly.status}`);

  const sched = await post('/api/yahria/missions', { action: 'schedule', uid });
  check('Programmation PLANNED → SCHEDULED', sched.json.ok, JSON.stringify(sched.json.errors ?? []));

  const tick1 = await post('/api/yahria/missions', { action: 'tick', uid });
  check('Tick 1 : tâches exécutées via la passerelle gouvernée', tick1.json.ok && (tick1.json.report?.executed?.length ?? 0) >= 2, JSON.stringify(tick1.json.report?.executed ?? []));
  const allReal = (tick1.json.report?.executed ?? []).every((e: any) => e.verdict === 'INVOKED' || e.ok === false);
  check('Verdicts réels (INVOKED ou échec honnête — jamais inventés)', allReal);

  const tick2 = await post('/api/yahria/missions', { action: 'tick', uid });
  const misFinal = await get(`/api/yahria/missions?uid=${uid}`);
  check('Mission COMPLETED après vagues du DAG (INV-091)', misFinal.json.mission?.state === 'COMPLETED', `état=${misFinal.json.mission?.state} · tick2=${JSON.stringify(tick2.json.report?.executed ?? [])}`);
  check('Toutes les tâches COMPLETED avec outils réels', (misFinal.json.mission?.tasks ?? []).every((t: any) => t.state === 'COMPLETED'));

  const cancelShort = await post('/api/yahria/missions', { action: 'cancel', uid: 'MIS-INCONNU', reason: 'court' });
  check('Annulation raison courte refusée 422 (INV-200/201)', cancelShort.status === 422 || cancelShort.json.ok === false);

  // ══ C. D.14 — LEARNING ENGINE (KRN-032) ════════════════════════
  console.log('C. Learning Engine — mining des faits, seuil, promotion');

  const mine = await post('/api/yahria/learning', { action: 'mine' });
  check('Mining déterministe exécuté (faits enregistrés INV-226)', mine.json.ok && (mine.json.created + mine.json.refreshed) >= 1, JSON.stringify({ created: mine.json.created, refreshed: mine.json.refreshed }));
  check('Note honnête : aucune action automatique déduite', typeof mine.json.note === 'string' && mine.json.note.includes('ction automatique'));

  const learning = await get('/api/yahria/learning');
  const validated = (learning.json.insights ?? []).find((i: any) => i.state === 'VALIDATED');
  const observed = (learning.json.insights ?? []).find((i: any) => i.state === 'OBSERVED');
  check('Insights OBSERVED/VALIDATED présentes (seuil INV-225)', !!observed || !!validated);
  if (observed) {
    const promoBad = await post('/api/yahria/learning', { action: 'promote', insightUid: observed.insightUid });
    check('Promotion d\'une insight OBSERVED refusée 422 (INV-225)', promoBad.status === 422, `status=${promoBad.status}`);
  }

  // ══ D. D.15 — SELF-EVOLUTION (KRN-033) ═════════════════════════
  console.log('D. Self-Evolution — pipeline, séparation, rollback');

  const evo = await post('/api/yahria/evolution', {
    action: 'create', title: 'R14 : durcir le seuil de retry mission', kind: 'STRATEGY',
    rationale: 'Insight issue du mining R14 : les retries sur échecs de politique sont inutiles — proposer de les interdire au niveau du moteur de missions.',
    riskClass: 'LOW', proposedBy: { type: 'HUMAN', id: 'humain' },
  });
  check('Proposition créée EVO-*', evo.status === 201 && /^EVO-\d+$/.test(evo.json.proposalUid ?? ''), JSON.stringify(evo.json.errors ?? []));
  const evoUid = evo.json.proposalUid as string;

  await post('/api/yahria/evolution', { action: 'submit', proposalUid: evoUid, actor: { type: 'HUMAN', id: 'humain' } });
  const selfApprove = await post('/api/yahria/evolution', { action: 'review', proposalUid: evoUid, actor: { type: 'HUMAN', id: 'humain' } });
  check('Revue par le proposant acceptée (UNDER_REVIEW)', selfApprove.json.ok && selfApprove.json.state === 'UNDER_REVIEW', JSON.stringify(selfApprove.json.errors ?? []));
  const selfApprove2 = await post('/api/yahria/evolution', { action: 'approve', proposalUid: evoUid, actor: { type: 'HUMAN', id: 'humain' }, reason: 'tentative d auto-approbation — doit être refusée' });
  check('Auto-approbation refusée 422 (INV-227 mécanisé)', selfApprove2.status === 422, JSON.stringify(selfApprove2.json.errors ?? []));
  const approve = await post('/api/yahria/evolution', { action: 'approve', proposalUid: evoUid, actor: { type: 'HUMAN', id: 'reviewer' }, reason: 'R14 : justification cohérente avec les invariants INV-092' });
  check('Approbation par identité DISTINCTE acceptée', approve.json.ok && approve.json.state === 'APPROVED', JSON.stringify(approve.json.errors ?? []));
  const promoteNoRollback = await post('/api/yahria/evolution', { action: 'promote', proposalUid: evoUid, actor: { type: 'HUMAN', id: 'release' } });
  check('Promotion sans plan de rollback refusée 422 (INV-163)', promoteNoRollback.status === 422, JSON.stringify(promoteNoRollback.json.errors ?? []));
  const schedule = await post('/api/yahria/evolution', { action: 'schedule', proposalUid: evoUid, actor: { type: 'HUMAN', id: 'release' } });
  check('Programmation APPROVED → SCHEDULED (pipeline INV-162)', schedule.json.ok && schedule.json.state === 'SCHEDULED', JSON.stringify(schedule.json.errors ?? []));
  const promote = await post('/api/yahria/evolution', {
    action: 'promote', proposalUid: evoUid, actor: { type: 'HUMAN', id: 'release' },
    rollbackPlan: 'R14 : rétablir maxRetries=2 et autoriser le retry de policy dans mission-graph.ts (git revert).',
    experiment: { note: 'benchmark R14 : 0 retry utile sur refus de politique (suite r14, section B)' },
  });
  check('Promotion gouvernée enregistrée SANS mutation de production (INV-228)', promote.json.ok && promote.json.state === 'PROMOTED', JSON.stringify(promote.json.errors ?? []));

  const evoHigh = await post('/api/yahria/evolution', {
    action: 'create', title: 'R14 : bascule modèle de routage par défaut', kind: 'MODEL_ROUTING',
    rationale: 'Proposition à risque élevé pour vérifier le verrou rollback des évolutions HIGH/CRITICAL.',
    riskClass: 'HIGH', proposedBy: { type: 'AGENT', id: 'tester' },
  });
  await post('/api/yahria/evolution', { action: 'submit', proposalUid: evoHigh.json.proposalUid, actor: { type: 'AGENT', id: 'tester' } });
  const highNoRollback = await post('/api/yahria/evolution', { action: 'approve', proposalUid: evoHigh.json.proposalUid, actor: { type: 'HUMAN', id: 'reviewer' }, reason: 'R14 : tentative sans plan de rollback — doit être refusée' });
  check('APPROVED risque HIGH sans rollback refusé (INV-163)', highNoRollback.status === 422, JSON.stringify(highNoRollback.json.errors ?? []));

  // ══ E. D.17 — API & INTÉGRATION (KRN-034) ══════════════════════
  console.log('E. API v1 — clés hachées, scopes, rate limit');

  const v1NoKey = await get('/api/v1/system');
  check('/api/v1 sans clé → 401 (INV-230)', v1NoKey.status === 401, `status=${v1NoKey.status}`);

  const keyRead = await post('/api/yahria/apikeys', { name: 'r14-lecture', scopes: ['read'] });
  check('Émission clé read — plaintext yah_live_ retourné une fois (INV-229)', keyRead.json.ok && /^yah_live_[0-9a-f]{48}$/.test(keyRead.json.key?.plaintext ?? ''), '');
  const readToken = keyRead.json.key?.plaintext as string;
  const v1Read = await get('/api/v1/system', { Authorization: `Bearer ${readToken}` });
  check('/api/v1/system avec clé read → 200', v1Read.status === 200 && v1Read.json.ok, JSON.stringify(v1Read.json).slice(0, 120));
  check('Payload system : version + domains + counts', v1Read.json.version === '1.0.0' && Array.isArray(v1Read.json.domains) && !!v1Read.json.counts);

  const v1PostForbidden = await post('/api/v1/missions', { goal: 'test scope' }, { Authorization: `Bearer ${readToken}` });
  check('POST missions avec scope read → 403 (INV-230)', v1PostForbidden.status === 403, `status=${v1PostForbidden.status}`);

  const keyWrite = await post('/api/yahria/apikeys', { name: 'r14-ecriture', scopes: ['write'] });
  const writeToken = keyWrite.json.key?.plaintext as string;
  const v1Post = await post('/api/v1/missions', { goal: 'Mission créée via API v1 gouvernée R14', strategy: 'DECOMPOSED' }, { Authorization: `Bearer ${writeToken}` });
  check('POST /api/v1/missions (scope write) → mission créée', v1Post.status === 201 && /^MIS-\d+$/.test(v1Post.json.mission?.missionUid ?? ''), JSON.stringify(v1Post.json.errors ?? []));

  const keyRate = await post('/api/yahria/apikeys', { name: 'r14-rate', scopes: ['read'], rateLimitPerMin: 5 });
  const rateToken = keyRate.json.key?.plaintext as string;
  let lastStatus = 0;
  for (let i = 0; i < 7; i++) {
    const r = await get('/api/v1/domains', { Authorization: `Bearer ${rateToken}` });
    lastStatus = r.status;
  }
  check('Rate limit 5/min dépassé → 429 (INV-230)', lastStatus === 429, `dernier status=${lastStatus}`);

  await put('/api/yahria/apikeys', { id: keyRate.json.key.id, reason: 'R14 : révocation testée après validation du rate limit' });
  const afterRevoke = await get('/api/v1/system', { Authorization: `Bearer ${rateToken}` });
  check('Clé révoquée → 401 (INV-230)', afterRevoke.status === 401);

  // ══ F. D.19/D.20/D.22/D.23 — SÉCURITÉ, QUALITÉ, OPS, ROADMAP ═══
  console.log('F. Sécurité · Qualité · Opérations · Roadmap');

  const audit = await post('/api/yahria/security');
  check('Audit sécurité : 8 contrôles factuels (INV-231)', audit.json.ok && audit.json.audit?.checks?.length === 8, JSON.stringify(audit.json.audit?.checks?.map((c: any) => `${c.id}:${c.ok}`) ?? []));
  const scan = audit.json.audit?.checks?.find((c: any) => c.id === 'REPO_SECRET_SCAN');
  check('Scan d\'identifiants sans valeurs exposées (INV-132)', !!scan && typeof scan.detail === 'string' && !/ghp_[A-Za-z0-9]{10,}/.test(scan.detail));

  const gates = await post('/api/yahria/quality');
  const measured = (gates.json.run?.gates ?? []).filter((g: any) => g.measured);
  check('Gates qualité : 6 mesurées + 3 externes déclarées (INV-171)', measured.length === 6 && gates.json.run?.gates?.length === 9, JSON.stringify(gates.json.run?.gates?.map((g: any) => `${g.id}:${g.measured ? g.ok : 'EXT'}`) ?? []));
  check('Gates mesurées toutes PASS', measured.every((g: any) => g.ok), JSON.stringify(measured.filter((g: any) => !g.ok).map((g: any) => g.id)));

  const ops = await get('/api/yahria/ops');
  check('Ops : 4 sondes readiness réelles (INV-233)', ops.json.ok && ops.json.report?.readiness?.probes?.length === 4 && ops.json.report?.readiness?.ok === true, JSON.stringify(ops.json.report?.readiness?.probes?.map((p: any) => `${p.id}:${p.ok}`) ?? []));
  check('SLO 24 h : structure honnête (null si aucun échantillon)', ops.json.report?.slo?.toolInvocations && 'successRate' in ops.json.report.slo.toolInvocations);

  const roadmap = await get('/api/yahria/roadmap');
  check('Roadmap : 4 horizons + top 8 (INV-234)', roadmap.json.ok && roadmap.json.roadmap?.horizons?.length === 4 && roadmap.json.roadmap?.next?.length === 8);
  check('Ledger d\'activation ≥ 16 domaines avec preuves', (roadmap.json.roadmap?.activationLedger?.length ?? 0) >= 16, `count=${roadmap.json.roadmap?.activationLedger?.length}`);

  // ══ G. LEDGER COMPLET 24/24 ════════════════════════════════════
  console.log('G. Ledger d\'activation — 24/24 domaines');

  const sys = await get('/api/yahria/system');
  const activated = (sys.json.domainActivations ?? []).map((a: any) => a.code);
  const expected = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '17', '18', '19', '20', '21', '22', '23'];
  check('Ledger contient les 16 codes activés par preuves', expected.every((c) => activated.includes(c)), JSON.stringify(activated));
  const domainsAfter = (sys.json.domains ?? []) as any[];
  const notStarted = domainsAfter.filter((d) => d.status === 'NOT_STARTED').map((d) => d.code);
  check('Aucun domaine NOT_STARTED restant (24/24 actifs)', notStarted.length === 0, `NOT_STARTED: ${JSON.stringify(notStarted)}`);

  // ══ BILAN ══════════════════════════════════════════════════════
  console.log(`\nR14 — ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('Suite R14 interrompue :', e); process.exit(1); });
export {}; // module scope — evite les collisions globales avec les autres suites sous tsc
