// ═══════════════════════════════════════════════════════════════
// R12 PROOF SUITE — Tool Registry Engine (Domain 09, KRN-025)
// Exécution réelle contre l'API live : chaque scénario est un fait
// mesuré, pas une supposition (INV-080).
//
//   bun run scripts/r12-tool-registry-tests.ts
// ═══════════════════════════════════════════════════════════════

const BASE = process.env.YAHRIA_BASE ?? 'http://localhost:3000';
let passed = 0, failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function post(body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}/api/yahria/tools`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}
async function get(): Promise<any> {
  const res = await fetch(`${BASE}/api/yahria/tools`);
  return res.json();
}

async function main(): Promise<void> {
  console.log(`\nR12 — Tool Registry Engine · cible ${BASE}\n`);

  // 1. Registre initial — ≥ 5 outils built-in (le registre croît par releases gouvernées), matrice d'autorisation vivante
  let g = await get();
  check('registre initial : ≥ 5 outils built-in', g.ok && g.counts.tools >= 5, `obtenu ${g.counts?.tools}`);
  check('matrice INV-062 : une autorisation évaluée par outil', g.authorization?.length === g.counts?.tools && g.counts?.tools >= 5);
  const readonlyAllowed = g.authorization.filter((a: any) => a.effect === 'ALLOW').length;
  check('lecture seule ALLOW par POL-011 (tous les READ_ONLY)', readonlyAllowed === g.counts?.tools - 1, `obtenu ${readonlyAllowed} / ${g.counts?.tools} (1 side-effect refusé)`);
  const cliAuth = g.authorization.find((a: any) => a.toolId === 'sandbox.cli.run');
  check('sandbox.cli.run DENY par défaut (POL-012)', cliAuth?.effect === 'DENY' && cliAuth?.matchedRule === 'POL-012');

  // 2. Découverte
  const disc = await post({ action: 'discover', query: 'studio' });
  check('discover "studio" : ≥1 correspondance', disc.json.ok && disc.json.matched >= 1);

  // 3. Registration — nouvelle outil déclaratif
  const reg = await post({
    action: 'register', toolId: 'tools.demo.echo', name: 'Démo écho', version: '1.0.0',
    description: 'Outil déclaratif de démonstration (aucun handler lié)', riskClass: 'READ_ONLY',
    contract: { type: 'object', properties: { message: { type: 'string', maxLength: 100 } }, required: ['message'] },
  });
  check('register tools.demo.echo v1.0.0 (idempotent : created OU refus 422 « déjà enregistrée » INV-190)', (reg.status === 200 && reg.json.created === true) || (reg.status === 422 && String(reg.json.errors ?? '').includes('déjà enregistrée')), JSON.stringify(reg.json));

  // 4. Versions immuables — même version refusée
  const reReg = await post({
    action: 'register', toolId: 'tools.demo.echo', name: 'Démo écho', version: '1.0.0',
    description: 'doublon', riskClass: 'READ_ONLY',
    contract: { type: 'object', properties: {}, required: [] },
  });
  check('re-register même version → 422 (versions immuables, INV-190)', reReg.status === 422);

  // 5. Downgrade refusé
  const down = await post({
    action: 'register', toolId: 'tools.demo.echo', name: 'Démo écho', version: '0.9.0',
    description: 'downgrade', riskClass: 'READ_ONLY',
    contract: { type: 'object', properties: {}, required: [] },
  });
  check('downgrade 1.0.0 → 0.9.0 refusé (INV-190)', down.status === 422);

  // 6. Outil inconnu → REQUIRE_APPROVAL via POL-006 (unregistered.*)
  const ghost = await post({ action: 'invoke', toolId: 'ghost.tool.call', input: {} });
  check('outil non registré → REQUIRE_APPROVAL (POL-006)',
    ghost.json.outcome?.verdict === 'REQUIRE_APPROVAL' && ghost.json.outcome?.auth?.matchedRule === 'POL-006');

  // 7. Invocation READ_ONLY réelle — détection toolchains (INV-190)
  const detect = await post({ action: 'invoke', toolId: 'sandbox.toolchains.detect', input: {}, callerType: 'AGENT', callerId: 'tester' });
  check('sandbox.toolchains.detect → INVOKED (POL-011)',
    detect.json.outcome?.verdict === 'INVOKED' && detect.json.outcome?.auth?.matchedRule === 'POL-011');
  check('résultat réel : gcc présent', String(detect.json.outcome?.result?.gcc ?? '').includes('gcc'));
  check('preuve TOOL scellée (evidenceUid)', typeof detect.json.outcome?.evidenceUid === 'string' && detect.json.outcome.evidenceUid.startsWith('EV-'));

  // 8. Violation de contrat — zéro exécution (S1 strict)
  const bad = await post({ action: 'invoke', toolId: 'studio.runs.list', input: { limit: 500 } });
  check('contrat violé (limit 500 > max 20) → VALIDATION_FAILED',
    bad.json.outcome?.verdict === 'VALIDATION_FAILED' && bad.json.outcome?.validationErrors?.length > 0);

  // 9. Champ non déclaré rejeté (strict)
  const extra = await post({ action: 'invoke', toolId: 'studio.runs.list', input: { evil: 'x' } });
  check('champ non déclaré rejeté strictement', extra.json.outcome?.verdict === 'VALIDATION_FAILED');

  // 10. INV-062 — SIDE_EFFECT refusé malgré l'enregistrement
  const denied = await post({ action: 'invoke', toolId: 'sandbox.cli.run', input: { probe: 'uname' } });
  check('INV-062 : REGISTERED mais DENIED (POL-012)',
    denied.json.outcome?.verdict === 'DENIED' && denied.json.outcome?.auth?.matchedRule === 'POL-012');
  check('refus enregistré (invocationId + PolicyDecision)', typeof denied.json.outcome?.invocationId === 'string');

  // 11. Autorisation gouvernée explicite
  const auth = await post({ action: 'authorize', toolId: 'sandbox.cli.run', allow: true, reason: 'suite de preuves R12' });
  check('authorize → règle POL-AUTH-SANDBOX-CLI-RUN créée', auth.json.ok && auth.json.ruleId === 'POL-AUTH-SANDBOX-CLI-RUN');

  // 12. Ré-invocation → ALLOW + résultat réel
  const allowed = await post({ action: 'invoke', toolId: 'sandbox.cli.run', input: { probe: 'uname' } });
  check('après autorisation → INVOKED (priorité 4 > DENY 5)',
    allowed.json.outcome?.verdict === 'INVOKED', JSON.stringify(allowed.json.outcome?.auth));
  check('résultat réel : sortie Linux de uname', String(allowed.json.outcome?.result?.out ?? '').includes('Linux'));

  // 13. Handler honnête — outil déclaratif sans handler → pas de fausse réussite (INV-210)
  const decl = await post({ action: 'invoke', toolId: 'tools.demo.echo', input: { message: 'coucou' } });
  check('outil déclaratif → EXECUTION_FAILED honnête (INV-210, pas de faux succès)',
    decl.json.outcome?.verdict === 'EXECUTION_FAILED' && String(decl.json.outcome?.error ?? '').includes('INV-210'));

  // 14. Révocation — retour au refus constitutionnel
  const rev = await post({ action: 'authorize', toolId: 'sandbox.cli.run', allow: false, reason: 'retour au deny par défaut' });
  const deniedAgain = await post({ action: 'invoke', toolId: 'sandbox.cli.run', input: { probe: 'uname' } });
  check('révocation puis re-DENY (monotonie du gouverné)', rev.json.ok && deniedAgain.json.outcome?.verdict === 'DENIED');

  // 15. Persistance — le journal d'invocations a grandi (7 attendues :
  // detect + 2 validations refusées + 2 refus cli.run + 1 autorisée + 1 déclaratif ;
  // l'outil fantôme est refusé AVANT enregistrement — seule la PolicyDecision trace)
  g = await get();
  check('journal persisté : invocations tracées (croissance monotone)', g.counts.invocations >= 7, `obtenu ${g.counts.invocations}`);

  console.log(`\n══════════════════════════════════════`);
  console.log(`R12 : ${passed} PASS / ${failed} FAIL sur ${passed + failed} vérifications\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('SUITE ERROR', e); process.exit(1); });
export {}; // module scope — evite les collisions globales avec les autres suites sous tsc
