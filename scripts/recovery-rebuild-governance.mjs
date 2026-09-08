import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
const db = new PrismaClient();
const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex');
const NOW = new Date().toISOString();
const RECON = ' — état reconstruit après reset du workspace (Sep 8 07:26, INV-210 : perte documentée, restauration depuis instantané Sep 8 01:11 + journal de session)';

async function main() {
  // ── 1. Preuve d'incident — premier maillon de la nouvelle chaîne ──
  const last = await db.evidence.findFirst({ orderBy: { createdAt: 'desc' }, select: { contentHash: true } });
  const prevHash = last?.contentHash ?? null;
  const claim = "Reset du workspace détecté (Sep 8 07:26) : code source récent + DB gouvernée perdus. Restaurés depuis l'instantané /tmp/my-project (Sep 8 01:11) : 45 modules lib, 23 routes API, 13 panneaux UI, scripts PTA + preuves, schéma 29 modèles. DB recréée (29 tables) ; état gouverné reconstruit depuis le journal de session. Les preuves originales EV-* et la chaîne de hachage antérieure ne sont PAS régénérables — perte documentée, non masquée (INV-210).";
  const payload = JSON.stringify({
    incident: 'workspace_reset_2026-09-08T07:26Z',
    snapshotUsed: '/tmp/my-project (mtimes .initial_snapshot.json = 2026-09-08T01:11)',
    restored: { libFiles: 45, apiRoutes: 23, uiPanels: 13, prismaModels: 29, ptaScripts: true },
    lostForever: ['chaîne de preuves EV-000001..000604 (hash-chain)', 'worklog.md tâches 1-23', 'download/yahria-RUN-000023-*.zip (régénérables depuis upload/RUN-000023-corrige)', 'runs non documentés RUN-000001..000018/20'],
    reconstructed: ['EvolutionProposal x6', 'GenerationRun x7 (19, 21-26)'],
    capturedAt: NOW,
  });
  const contentHash = sha({ category: 'POLICY', claim, actor: 'SYSTEM:workspace-recovery', payload, prevHash });
  const ev = await db.evidence.upsert({
    where: { evidenceUid: 'EV-POLICY-000605' },
    update: { claim, payload, contentHash, prevHash, state: 'SEALED', sealedAt: new Date() },
    create: {
      evidenceUid: 'EV-POLICY-000605', category: 'POLICY', criticality: 'HIGH', state: 'SEALED',
      actorType: 'SYSTEM', actorId: 'workspace-recovery', claim, payload, contentHash, prevHash, sealedAt: new Date(),
    },
  });
  console.log('preuve reconstruction:', ev.evidenceUid);

  // ── 2. EvolutionProposal × 6 ──
  const evo26Experiment = {
    title: 'Preuve de la porte v3 — livrable partiel refusé à VERIFYING, livrable sain sans friction',
    protocol: [
      "1. Implémenter completeness-gate.ts (YAHRIA-STD-005) sur le modèle de boot-gate.ts : isCompletenessGateActive() armé si EVO-000026 PROMOTED.",
      "2. Intégrer dans studio-pipeline.ts entre la fin de GENERATING et l'entrée en VERIFYING : (a) inventaire des fichiers FAILED (path → note) ; (b) rattrapage borné : 1 passe de régénération pour les fichiers échoués, avec attente du cooldown si note contient circuit OPEN ; (c) si échec persistant → failRun avec message PORTE V3 : X/N fichiers échoués — inventaire path:note — classification INFRA (fabric/circuit) ou MODÈLE.",
      '3. Test unitaire : pipeline simulant 3 fichiers vérifiés + 2 échoués → la porte doit failRun AVANT toute écriture workspace / porte de boot, avec inventaire exact et classification correcte.',
      '4. Test de non-régression : run sain (tous fichiers vérifiés) → la porte ne modifie rien, le run progresse vers les portes v1/v2 inchangées.',
      '5. Test décisif PTA-002 itération 6 (RUN-000027) : reproduction conditions RUN-000026 — si fabric OPEN se reproduit, le run doit échouer à la porte v3 avec classification INFRA et ne jamais atteindre la porte de boot.',
    ],
    acceptance: [
      'Aucun run comportant un fichier FAILED persistant ne dépasse la frontière GENERATING→VERIFYING quand la porte est armée.',
      "Le message d'échec contient l'inventaire path:note et la classification INFRA|MODÈLE.",
      'Un run sain passe la porte sans altération (zéro friction mesurée).',
      'Rollback vérifié : porte désactivée → comportement legacy restauré.',
    ],
    evidencePrefix: 'EV-POLICY',
  };
  const evoRollback = "Flag isCompletenessGateActive() calqué sur boot-gate (EVO-000016) : armé uniquement si EVO-000026 PROMOTED. Rollback en 1 action API (rollback) — le pipeline redevient legacy (seul critère generated===0), sans migration DB ni changement de schéma ; les runs déjà scellés et leurs preuves restent intacts ; aucune donnée workspace n'est supprimée.";
  const evos = [
    {
      proposalUid: 'EVO-000016', title: 'Sandbox Docker pour prévalidation npm (INV-215)', kind: 'WORKFLOW', riskClass: 'MEDIUM', state: 'PROMOTED',
      rationale: "Bloqueur prod #2 : la vérification statique du studio scelle des livrables sans boot réel (démontré par RUN-000019 : 6 défauts non détectés). Un sandbox Docker permettrait npm install + jest sur chaque RUN avant SEALED, fermant la frontière honnêtement mesurée. (texte intégral perdu au reset — préfixe authentique, INV-210)",
      decidedBy: 'HUMAN:reviewer', decisionReason: 'l\'Humain a approuvé' + RECON,
    },
    {
      proposalUid: 'EVO-000025', title: 'Porte v2 : sondes comportementales (pytest + appels POST réels) avant SEALED', kind: 'WORKFLOW', riskClass: 'MEDIUM', state: 'PROMOTED',
      rationale: "PTA-001 a mesuré la frontière de la porte v1 : RUN-000023 scellé au premier coup (boot prouvé) mais 5 tests POST échouent en 500 (dérive de contrat inter-fichiers : signature get_gateway, await sur méthode sync, except HTTPException masqué). Ces défauts sont invisibles à l'import ET au boot — ils nécessitent des sondes comportementales (pytest exécuté par la porte) avant SEALED. Continuité directe de EVO-000016 (porte v1 boot-level, PROMOTED, preuve EV-POLICY-000556).",
      decidedBy: 'HUMAN:reviewer', decisionReason: "l'Humain a approuvé" + RECON,
      rollbackPlan: "Flag isBehavioralGateActive() calqué sur boot-gate (EVO-000016) : armé uniquement si EVO-000025 PROMOTED ; rollback en 1 action API, pipeline legacy restauré sans migration.",
    },
    {
      proposalUid: 'EVO-000026', title: 'Porte v3 : complétude de génération avant livraison — aucun livrable partiel ne quitte GENERATING', kind: 'WORKFLOW', riskClass: 'MEDIUM', state: 'UNDER_REVIEW',
      rationale: "PTA-002 itération 5 (RUN-000026) a mesuré un trou structurel : le fabric LLM s'est ouvert en cours de génération (zai:circuit OPEN, cooldown 90s), 11 fichiers sur 14 ont échoué après 3 tentatives chacun contre un circuit ouvert, et le pipeline a POURSUIVI avec un livrable partiel (3 fichiers vérifiés) jusqu'à la porte de boot — rejeté seulement indirectement par DÉCOUVERTE (main.py vide), avec un diagnostic imprécis qui masquait la cause réelle. Dans studio-pipeline.ts, la boucle GENERATING marque les fichiers FAILED puis continue : seule generated===0 fait échouer le run. Un livrable partiel peut donc atteindre les portes v1/v2, gaspiller du temps de boot/pytest et produire des diagnostics trompeurs. Les portes existantes sont aveugles à cette classe : v1 (EVO-000016) voit import/boot, v2 (EVO-000025) voit le comportement — aucune ne voit la complétude. Fermer ce trou AVANT l'injection few-shot (exemplaire doré RUN-000023-corrige, prochain levier candidat) préserve aussi la mesure honnête du taux de première passe : un effondrement INFRA (fabric OPEN) doit être classé comme tel et non compté comme un échec d'apprentissage du générateur (INV-210 : mesure honnête).",
      experiment: JSON.stringify(evo26Experiment),
      rollbackPlan: evoRollback,
    },
    { proposalUid: 'EVO-000021', title: 'Backoff exponentiel des ticks de mission', kind: 'WORKFLOW', riskClass: 'LOW', state: 'SCHEDULED', rationale: '(détail perdu au reset workspace — titre authentique seul ; décision HUMAN documentée avant reset, INV-210)', decidedBy: 'HUMAN:reviewer', decisionReason: 'programmée' + RECON },
    { proposalUid: 'EVO-000023', title: 'TEST pipeline : cycle HIGH avec rollback final (jetable)', kind: 'WORKFLOW', riskClass: 'HIGH', state: 'ROLLED_BACK', rationale: 'Test gouverné du cycle complet HIGH (jetable) — rollback final exécuté.', decidedBy: 'HUMAN:reviewer', decisionReason: 'test de cycle avec rollback final' + RECON },
    { proposalUid: 'EVO-000024', title: 'UI option 23 : rollback HIGH au approve + garde-fous au promote', kind: 'WORKFLOW', riskClass: 'MEDIUM', state: 'UNDER_REVIEW', rationale: 'Renforcer la console option 23 : rollback obligatoire au approve pour HIGH/CRITICAL, garde-fous au promote (détail perdu au reset, INV-210).' },
  ];
  for (const e of evos) {
    await db.evolutionProposal.upsert({
      where: { proposalUid: e.proposalUid },
      update: e,
      create: { ...e, proposedBy: 'AGENT:super-z' },
    });
    console.log('EVO restaurée:', e.proposalUid, '→', e.state);
  }

  // ── 3. GenerationRun × 7 (historique documenté) ──
  const runs = [
    {
      runUid: 'RUN-000019', name: 'Audit prod-ready — livrable studio (6 défauts détectés)', state: 'FAILED', stack: 'NEXTJS',
      brief: '(reconstruit) Run de l\'audit prod-ready R14 : 6 défauts non détectés par la vérification statique — a motivé EVO-000016.',
      error: '6 défauts livrés sans boot réel — porte de boot inexistante à l\'époque', createdAt: new Date('2026-09-07T10:00:00Z'),
      recon: true,
    },
    {
      runUid: 'RUN-000021', name: 'PTA-001 itération 1 — Hub Mobile Money (0% bootable)', state: 'FAILED', stack: 'PYTHON',
      brief: '(reconstruit) Première itération PTA-001 : livrable 0% bootable, cascade de échecs sur cinq niveaux — scellé honnêtement à l\'époque, a fondé la courbe d\'apprentissage.',
      error: '0% bootable — cascade de défauts de génération', createdAt: new Date('2026-09-07T21:00:00Z'),
      recon: true,
    },
    {
      runUid: 'RUN-000022', name: 'PTA-001 — Hub Mobile Money — test d\'apprentissage boot premier coup', state: 'FAILED', stack: 'PYTHON',
      brief: '(reconstruit) Test d\'apprentissage PTA-001 : première exécution sous porte de boot armée (EVO-000016).',
      error: 'porte de boot (EVO-000016) — ImportError (SECRET_KEY) : symbole inter-fichiers halluciné, invisible à py_compile', createdAt: new Date('2026-09-07T22:30:00Z'),
      recon: true,
    },
    {
      runUid: 'RUN-000023', name: 'PTA-001 itération 2 — Hub Mobile Money, leçons scellées injectées, boot premier coup exigé', state: 'SEALED', stack: 'PYTHON',
      brief: 'API Hub de paiement Mobile Money (FastAPI) unifiant deux passerelles : NotchPay et PesaPal. (reconstruit : brief intégral perdu, préfixe authentique)',
      error: null, createdAt: new Date('2026-09-07T23:10:00Z'), sealedFirstPass: true, recon: true,
    },
    {
      runUid: 'RUN-000024', name: 'PTA-002 — Hub Mobile Money sous double porte (boot v1 + comportement v2), verdict au premier passage', state: 'FAILED', stack: 'PYTHON', requestedStack: 'PYTHON',
      brief: 'API Hub de paiement Mobile Money (FastAPI) unifiant deux passerelles : NotchPay et PesaPal.\nENDPOINTS ET BOOT :\n- main.py : instance FastAPI nommée exactement « app » (app = FastAPI(title="Mobile Mone... (reconstruit : préfixe authentique)',
      treeSpec: 'main.py\nconfig.py\nmodels.py\nschemas.py\nsecurity.py\ngateways/__init__.py\ngateways/base.py\ngateways/notchpay.py\ngateways/pesapal.py\nwebhooks.py\ntests/__init__.py',
      error: 'porte de boot (EVO-000016) — BOOT : uvicorn main:app sans réponse HTTP en 30s — connexion refusée',
      createdAt: new Date('2026-09-07T23:18:58.923Z'),
    },
    {
      runUid: 'RUN-000025', name: 'PTA-002 itération 4 — Hub Mobile Money, contrats verbatim, double porte (boot v1 + pytest v2)', state: 'FAILED', stack: 'PYTHON', requestedStack: 'PYTHON',
      brief: 'API Hub de paiement Mobile Money (FastAPI). SUIS LES CONTRATS LITTERALEMENT, LIGNE PAR LIGNE — chaque import ci-dessous est OBLIGATOIRE et chaque symbole cité doit exister exactement sous ce nom. (reconstruit : préfixe authentique)',
      treeSpec: 'main.py\nconfig.py\nmodels.py\nschemas.py\nsecurity.py\ngateways/__init__.py\ngateways/base.py\ngateways/notchpay.py\ngateways/pesapal.py\nwebhooks.py\ntests/__init__.py\ntests/test_api.py\nrequirements.txt',
      error: 'porte comportementale (EVO-000025) — PYTEST : pytest exit 1 — 9 failed, 4 passed, 1 warning in 1.37s — FAILED tests/test_api.py::test_gateway_specific_error_handling - assert 401 =...',
      createdAt: new Date('2026-09-07T23:23:25.212Z'),
    },
    {
      runUid: 'RUN-000026', name: 'PTA-002 itération 5 FINALE — Hub Mobile Money, double porte, aucune authentification', state: 'FAILED', stack: 'PYTHON', requestedStack: 'PYTHON',
      brief: 'API Hub de paiement Mobile Money (FastAPI). SUIS LES CONTRATS LITTERALEMENT — chaque symbole cité doit exister exactement sous ce nom, chaque import est obligatoire. INTERDICTIONS ABSOLUES : aucune authentification (PAS de APIKeyHeader, PAS de Depends(get_api_key), PAS de header X-API-Key requis — tous les endpoints sont publics, mode sandbox), aucune base de données, aucun ORM. (reconstruit : préfixe authentique)',
      treeSpec: 'main.py\nconfig.py\nmodels.py\nschemas.py\nsecurity.py\ngateways/__init__.py\ngateways/base.py\ngateways/notchpay.py\ngateways/pesapal.py\nwebhooks.py\ntests/__init__.py\ntests/test_api.py\nrequirements.txt',
      error: 'porte de boot (EVO-000016) — DÉCOUVERTE : aucun module racine avec instance FastAPI( ou create_app( — cause racine : LLM fabric exhausted (circuit OPEN), 9 fichiers vides ayant traversé la boucle GENERATING',
      createdAt: new Date('2026-09-07T23:28:06.294Z'),
    },
  ];
  for (const r of runs) {
    const { recon, sealedFirstPass, ...data } = r;
    const note = recon ? ' [ligne reconstruite après reset workspace — données authentiques partielles, INV-210]' : ' [ligne reconstruite depuis lecture API authentique du matin]';
    await db.generationRun.upsert({
      where: { runUid: r.runUid },
      update: { name: r.name, state: r.state, error: r.error },
      create: { ...data, error: r.error ? r.error + note : null, aiDesignedTree: false, stats: '{}' },
    });
    console.log('RUN restauré:', r.runUid, '→', r.state);
  }
  console.log('--- reconstruction terminée ---');
  await db.$disconnect();
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
