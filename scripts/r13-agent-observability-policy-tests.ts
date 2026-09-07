// ═══════════════════════════════════════════════════════════════
// R13 PROOF SUITE — Agents↔Registry (KRN-027) + Observability
// (KRN-028) + Policy Console (KRN-029)
// Exécution réelle contre l'API live : chaque scénario est un fait
// mesuré, pas une supposition (INV-080).
//
//   bun run scripts/r13-agent-observability-policy-tests.ts
// ═══════════════════════════════════════════════════════════════

const BASE = process.env.YAHRIA_BASE ?? 'http://localhost:3000';
let passed = 0, failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}
async function post(path: string, body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function main(): Promise<void> {
  console.log(`\nR13 — Agents↔Registre · Observabilité · Console de politiques · cible ${BASE}\n`);

  // Assainissement initial : retour au défaut constitutionnel — aucune règle
  // héritée ne doit masquer les scénarios refus attendus (idempotent).
  await post('/api/yahria/tools', { action: 'authorize', toolId: 'sandbox.cli.run', allow: false, reason: 'R13 : reset initial au défaut constitutionnel POL-012' });
  const pcInit = await get('/api/yahria/policy-console');
  for (const r of (pcInit.rules ?? []) as any[]) {
    if (!r.constitutional && r.ruleId.startsWith('POL-C-') && r.active && r.condition?.resource === 'sideeffect.sandbox.cli.run') {
      await post('/api/yahria/policy-console', { action: 'toggle', ruleId: r.ruleId, active: false, reason: 'R13 : assainissement initial des règles héritées' });
    }
  }

  // ══ A. PASSERELLE AGENTS ↔ REGISTRE (KRN-027) ══════════════════
  console.log('A. Missions agents — les agents canoniques invoquent de vrais outils');

  const agents0 = await get('/api/yahria/agents');
  check('GET agents : matrice toolGrants exposée', agents0.ok && !!agents0.toolGrants);
  check('tester autorisé uniquement sur sandbox.cli.run',
    JSON.stringify(agents0.toolGrants?.tester) === JSON.stringify(['sandbox.cli.run']),
    JSON.stringify(agents0.toolGrants?.tester));
  check('architecte autorisé sur domains.list + toolchains.detect',
    JSON.stringify([...(agents0.toolGrants?.architect ?? [])].sort()) === JSON.stringify(['sandbox.toolchains.detect', 'system.domains.list']));
  check('planner : aucun outil (honnêteté — capacités task.*)',
    Array.isArray(agents0.toolGrants?.planner) && agents0.toolGrants.planner.length === 0);

  // Mission architecte — outils READ_ONLY réels (POL-011)
  const misArch = await post('/api/yahria/agents', {
    action: 'mission', agentKey: 'architect',
    mission: "Dresser l'état du système avant conception : domaines actifs + toolchains hôte.",
    toolCalls: [{ toolId: 'system.domains.list' }, { toolId: 'sandbox.toolchains.detect' }],
  });
  check('mission architecte exécutée', misArch.json.ok && misArch.json.mission.verdict === 'COMPLETED',
    JSON.stringify(misArch.json.mission?.verdict));
  const archSteps = misArch.json.mission?.steps ?? [];
  check('2 appels outils passés par les DEUX portes (capacité + politique)',
    archSteps.length === 2 && archSteps.every((s: any) => s.gate === 'EXECUTION' && s.authEffect === 'ALLOW' && s.authRule === 'POL-011'));
  const domainsResult = archSteps[0]?.result;
  check('outil RÉEL : system.domains.list retourne 24 domaines', Array.isArray(domainsResult) && domainsResult.length === 24);
  const toolchains = archSteps[1]?.result;
  check('outil RÉEL : toolchains hôte détectés (gcc + g++ + node présents)',
    typeof toolchains === 'object' && toolchains !== null && !Array.isArray(toolchains)
    && typeof toolchains.gcc === 'string' && toolchains.gcc.includes('gcc')
    && typeof toolchains['g++'] === 'string' && typeof toolchains.node === 'string',
    JSON.stringify(toolchains).slice(0, 120));
  const archTrace = misArch.json.mission?.traceId as string;
  check('trace de mission unique émise (INV-217)', typeof archTrace === 'string' && archTrace.startsWith('TR-M-'));

  // Mur de capacité — tester tente un outil hors périmètre (INV-071 AVANT INV-062)
  const misWall = await post('/api/yahria/agents', {
    action: 'mission', agentKey: 'tester',
    mission: 'Tenter de lire les preuves récentes — hors périmètre tester.',
    toolCalls: [{ toolId: 'evidence.recent.list' }],
  });
  const wallStep = misWall.json.mission?.steps?.[0];
  check('mur de capacité : CAPABILITY_DENIED, porte CAPABILITY', wallStep?.verdict === 'CAPABILITY_DENIED' && wallStep?.gate === 'CAPABILITY');
  check('mur de capacité : aucune invocation créée (jamais arrivé au plan politique)', wallStep?.invocationId === null);
  check('verdict mission honnête FAILED (pas de faux succès — INV-210)', misWall.json.mission?.verdict === 'FAILED');

  // Mission tester sur outil SIDE_EFFECT refusé par défaut (INV-062)
  const misDeny = await post('/api/yahria/agents', {
    action: 'mission', agentKey: 'tester',
    mission: 'Sonde uname — sandbox.cli.run est SIDE_EFFECT, DENY par défaut attendu.',
    toolCalls: [{ toolId: 'sandbox.cli.run', input: { probe: 'uname' } }],
  });
  const denyStep = misDeny.json.mission?.steps?.[0];
  check('tester : capacité OK mais politique DENY (POL-012)', denyStep?.verdict === 'DENIED' && denyStep?.authRule === 'POL-012');
  check('verdict mission BLOCKED (gouverné, pas une erreur HTTP)', misDeny.json.mission?.verdict === 'BLOCKED' && misDeny.status === 200);
  const denyTrace = misDeny.json.mission?.traceId as string;

  // Agent inconnu — INV-001
  const misGhost = await post('/api/yahria/agents', {
    action: 'mission', agentKey: 'super-agent-inventé', mission: 'mission fantôme', toolCalls: [],
  });
  check('agent inventé REJETÉ (INV-001 — jamais inventer)', misGhost.json.mission?.verdict === 'REJECTED');

  // Autorisation gouvernée de sandbox.cli.run → mission tester RÉELLE
  const authUp = await post('/api/yahria/tools', { action: 'authorize', toolId: 'sandbox.cli.run', allow: true, reason: 'R13 : mission tester — sonde uname gouvernée' });
  check('autorisation gouvernée sandbox.cli.run (POL-AUTH-*)', authUp.json.ok === true && authUp.json.ruleId?.startsWith('POL-AUTH-'));
  const misReal = await post('/api/yahria/agents', {
    action: 'mission', agentKey: 'tester',
    mission: 'Sonde uname autorisée — exécution CLI réelle attendue.',
    toolCalls: [{ toolId: 'sandbox.cli.run', input: { probe: 'uname' } }],
  });
  const realStep = misReal.json.mission?.steps?.[0];
  check('tester INVOCQUE un vrai outil : exit 0 + sortie Linux réelle',
    realStep?.verdict === 'INVOKED' && String(realStep?.result?.out ?? '').includes('Linux'),
    JSON.stringify(realStep?.result).slice(0, 120));
  check('preuve TOOL scellée pour l appel agent', typeof realStep?.evidenceUid === 'string' && realStep.evidenceUid.startsWith('EV-'));
  const realTrace = misReal.json.mission?.traceId as string;

  // ══ B. RBAC FIN — console de politiques (KRN-029) ══════════════
  console.log('\nB. Console de politiques — RBAC fin, verrous, simulation, impact');

  // Révocation par défaut d'abord
  await post('/api/yahria/tools', { action: 'authorize', toolId: 'sandbox.cli.run', allow: false, reason: 'R13 : retour au défaut constitutionnel POL-012' });
  // Assainissement idempotent : désactiver les règles POL-C héritées des exécutions précédentes
  const pcCleanup = await get('/api/yahria/policy-console');
  for (const r of (pcCleanup.rules ?? []) as any[]) {
    if (!r.constitutional && r.ruleId.startsWith('POL-C-') && r.active && r.condition?.resource === 'sideeffect.sandbox.cli.run') {
      await post('/api/yahria/policy-console', { action: 'toggle', ruleId: r.ruleId, active: false, reason: 'R13 : assainissement idempotent avant le scénario RBAC' });
    }
  }
  const pc0 = await get('/api/yahria/policy-console');
  check('état console : règles + verrou constitutionnel flaggé', pc0.ok && pc0.rules.filter((r: any) => r.constitutional).length >= 12);

  // Création d'une règle RBAC fine : ALLOW sideeffect.sandbox.cli.run pour AGENT:tester SEULEMENT
  const ruleCreate = await post('/api/yahria/policy-console', {
    action: 'create', name: 'Tester seul : sonde uname', effect: 'ALLOW', scope: 'TOOL',
    ruleAction: 'tool.execute', resource: 'sideeffect.sandbox.cli.run', priority: 4,
    actorType: 'AGENT', actorId: 'tester', reason: 'R13 RBAC fin : le tester peut sonder uname, nul autre',
  });
  check('création règle gouvernée POL-C-* (RBAC acteur)', ruleCreate.status === 200 && ruleCreate.json.rule?.ruleId?.startsWith('POL-C-'), JSON.stringify(ruleCreate.json));
  const rbacRuleId = ruleCreate.json.rule?.ruleId as string;

  // HUMAIN → toujours DENY (la règle ne matche que AGENT:tester)
  const humanInvoke = await post('/api/yahria/tools', { action: 'invoke', toolId: 'sandbox.cli.run', input: { probe: 'uname' }, callerType: 'HUMAN', callerId: 'yahria-operator' });
  check('RBAC fin : humain reste DENY (POL-012)', humanInvoke.json.outcome?.auth?.effect === 'DENY' && humanInvoke.json.outcome?.auth?.matchedRule === 'POL-012');
  // AGENT tester → ALLOW via la règle POL-C
  const testerInvoke = await post('/api/yahria/tools', { action: 'invoke', toolId: 'sandbox.cli.run', input: { probe: 'uname' }, callerType: 'AGENT', callerId: 'tester' });
  check('RBAC fin : AGENT:tester ALLOW via POL-C-*', testerInvoke.json.outcome?.auth?.effect === 'ALLOW' && testerInvoke.json.outcome?.auth?.matchedRule === rbacRuleId);
  check('RBAC fin : exécution réelle par le tester (sortie Linux)', String(testerInvoke.json.outcome?.result?.out ?? '').includes('Linux'));

  // Toggle off → le tester retombe sous POL-012
  const toggleOff = await post('/api/yahria/policy-console', { action: 'toggle', ruleId: rbacRuleId, active: false, reason: 'R13 : désactivation gouvernée de la règle RBAC de test' });
  const testerReInvoke = await post('/api/yahria/tools', { action: 'invoke', toolId: 'sandbox.cli.run', input: { probe: 'uname' }, callerType: 'AGENT', callerId: 'tester' });
  check('toggle off → tester re-DENY (POL-012 reprend)', toggleOff.json.ok && testerReInvoke.json.outcome?.auth?.effect === 'DENY');
  // Réactivation pour la suite
  await post('/api/yahria/policy-console', { action: 'toggle', ruleId: rbacRuleId, active: true, reason: 'R13 : réactivation gouvernée pour la suite de preuves' });

  // Verrou constitutionnel (INV-219)
  const lockTry = await post('/api/yahria/policy-console', { action: 'toggle', ruleId: 'POL-001', active: false, reason: 'tentative de désactivation constitutionnelle — doit refuser' });
  check('verrou constitutionnel : POL-001 intouchable (INV-219)', lockTry.status === 422 && String(lockTry.json.errors?.[0] ?? '').includes('INV-219'));

  // Validation 422
  const badRule = await post('/api/yahria/policy-console', { action: 'create', name: 'x', effect: 'MAYBE', scope: 'NOWHERE', ruleAction: 'Bad Action!', resource: '!!', priority: 500, reason: 'court' });
  check('validation 422 : effet/scope/priorité/raison refusés', badRule.status === 422 && Array.isArray(badRule.json.errors) && badRule.json.errors.length >= 4);

  // Simulation sans effet de bord (INV-220)
  const decCountBefore = (await get('/api/yahria/policy-console')).decisions.length;
  const sim1 = await post('/api/yahria/policy-console', { action: 'simulate', ruleAction: 'tool.execute', actorType: 'AGENT', actorId: 'tester', resource: 'sideeffect.sandbox.cli.run' });
  const sim2 = await post('/api/yahria/policy-console', { action: 'simulate', ruleAction: 'tool.execute', actorType: 'HUMAN', actorId: 'yahria-operator', resource: 'sideeffect.sandbox.cli.run' });
  const decCountAfter = (await get('/api/yahria/policy-console')).decisions.length;
  check('simulateur : tester → ALLOW (règle RBAC fine)', sim1.json.effect === 'ALLOW' && sim1.json.matchedRule === rbacRuleId);
  check('simulateur : humain → DENY (POL-012)', sim2.json.effect === 'DENY');
  check('simulateur : AUCUNE décision persistée (INV-220)', decCountAfter === decCountBefore, `${decCountBefore} → ${decCountAfter}`);

  // Analyse d'impact — un DENY global readonly.* basculerait tous les READ_ONLY
  const impact = await post('/api/yahria/policy-console', {
    action: 'impact',
    draft: { name: 'Fermèture lecture seule', effect: 'DENY', scope: 'TOOL', ruleAction: 'tool.execute', resource: 'readonly.*', priority: 1, reason: 'R13 : brouillon analyse impact — jamais persisté' },
  });
  const readOnlyFlips = (impact.json.flips as any[]).filter((f) => f.riskClass === 'READ_ONLY' && f.flips && f.after === 'DENY');
  check(`analyse d'impact : ${impact.json.wouldFlip} bascule(s) simulée(s), toutes les READ_ONLY passent en DENY`, impact.status === 200 && readOnlyFlips.length >= 6);
  const impactPersistCheck = (await get('/api/yahria/policy-console')).rules.filter((r: any) => r.name === 'Fermèture lecture seule').length;
  check('analyse d impact : le brouillon n a PAS été créé (INV-220)', impactPersistCheck === 0);

  // ══ C. OBSERVABILITÉ — traces, replay, forensics (KRN-028) ═════
  console.log('\nC. Observabilité — timeline, replay lecture seule, forensics, drift');

  const obsIdx = await get('/api/yahria/observability');
  check('index des traces : les traces de missions sont trouvées', obsIdx.ok && obsIdx.traces.some((t: any) => t.traceId === realTrace));
  const realRow = obsIdx.traces.find((t: any) => t.traceId === realTrace);
  check('trace mission réelle : multi-sources (preuves + invocations + runs + décisions)',
    realRow && realRow.sources.includes('evidence') && realRow.sources.includes('toolInvocations')
    && realRow.sources.includes('agentRuns') && realRow.sources.includes('policyDecisions'),
    JSON.stringify(realRow?.sources));

  const tl = await get(`/api/yahria/observability?traceId=${encodeURIComponent(realTrace)}`);
  const timeline = tl.timeline;
  check('timeline assemblée : ≥ 5 entrées ordonnées chronologiquement', timeline.found && timeline.entries.length >= 5 &&
    timeline.entries.every((e: any, i: number, a: any[]) => i === 0 || a[i - 1].ts <= e.ts));
  check('timeline contient la sortie uname réelle', JSON.stringify(timeline.entries).includes('Linux'));
  check('forensics : intégrité de la chaîne de preuves de la trace (0 altération)', timeline.chain.checked >= 2 && timeline.chain.tampered.length === 0);

  // Replay LECTURE SEULE (INV-218) — aucun état ne doit bouger
  const countsBefore = {
    invocations: (await get('/api/yahria/tools')).counts.invocations,
  };
  const rp = await post('/api/yahria/observability', { action: 'replay', traceId: denyTrace });
  const replay = rp.json.replay;
  check('replay exécuté sur la trace DENY', rp.json.ok && replay.ok);
  check('replay : invocation refusée ne devient PAS valide rétroactivement', replay.toolChecks.every((c: any) => c.contractStillValid || c.recordedVerdict === 'DENIED'));
  const countsAfter = { invocations: (await get('/api/yahria/tools')).counts.invocations };
  check('replay LECTURE SEULE : 0 nouvelle invocation (INV-218)', countsAfter.invocations === countsBefore.invocations, `${countsBefore.invocations} → ${countsAfter.invocations}`);

  const rp2 = await post('/api/yahria/observability', { action: 'replay', traceId: realTrace });
  check('replay trace réelle : contrat toujours valide (pas de drift)', rp2.json.replay.toolChecks.every((c: any) => c.contractStillValid));

  // Drift registre ↔ historique
  const drift = await post('/api/yahria/observability', { action: 'drift' });
  check('rapport drift : 0 dérive sur les contrats actuels', drift.json.ok && drift.json.report.drifted === 0, JSON.stringify(drift.json.report?.drifted));

  // ══ D. CONSTITUTION ════════════════════════════════════════════
  console.log('\nD. Constitution & événements');
  const invList = await post('/api/yahria/tools', { action: 'invoke', toolId: 'constitution.invariants.list', input: { family: 'POLICY', limit: 30 }, callerType: 'HUMAN', callerId: 'yahria-operator' });
  const invIds = (invList.json.outcome?.result ?? []).map((i: any) => i.id);
  check('nouvel outil : invariants POLICY lisibles par les agents (inclut INV-219/220)', Array.isArray(invList.json.outcome?.result) && invIds.includes('INV-219') && invIds.includes('INV-220'));
  const polDec = await post('/api/yahria/tools', { action: 'invoke', toolId: 'policy.decisions.recent', input: { limit: 10 }, callerType: 'HUMAN', callerId: 'yahria-operator' });
  check('nouvel outil : décisions de politique récentes exposées', Array.isArray(polDec.json.outcome?.result) && polDec.json.outcome.result.length >= 1);

  const sys = await get('/api/yahria/system');
  const doms = sys.domains ?? [];
  check('domaines : 14/24 actifs (D.11 + D.12 activés sur preuves)', doms.filter((d: any) => d.status !== 'NOT_STARTED').length === 14,
    `obtenu ${doms.filter((d: any) => d.status !== 'NOT_STARTED').length}`);
  const d11 = doms.find((d: any) => d.code === '11');
  const d12 = doms.find((d: any) => d.code === '12');
  check('D.11 Observabilité → IMPLEMENTING', d11?.status === 'IMPLEMENTING');
  check('D.12 Policy Console → IMPLEMENTING', d12?.status === 'IMPLEMENTING');

  console.log(`\n════════════════════════════════════`);
  console.log(`R13 : ${passed} PASS / ${failed} FAIL`);

  // Remise au défaut constitutionnel — l'état final du système reste DENY par défaut
  await post('/api/yahria/tools', { action: 'authorize', toolId: 'sandbox.cli.run', allow: false, reason: 'R13 : clôture — retour au défaut constitutionnel POL-012' });
  const pcEnd = await get('/api/yahria/policy-console');
  for (const r of (pcEnd.rules ?? []) as any[]) {
    if (!r.constitutional && r.ruleId.startsWith('POL-C-') && r.active && r.condition?.resource === 'sideeffect.sandbox.cli.run') {
      await post('/api/yahria/policy-console', { action: 'toggle', ruleId: r.ruleId, active: false, reason: 'R13 : clôture — désactivation de la règle de preuve' });
    }
  }
  console.log('Clôture : sandbox.cli.run rendu au défaut constitutionnel (POL-012), règles de preuve désactivées.');

  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('ERREUR SUITE :', e); process.exit(1); });
export {}; // module scope — evite les collisions globales avec les autres suites sous tsc
