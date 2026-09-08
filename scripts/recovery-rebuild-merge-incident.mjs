import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
const db = new PrismaClient();
const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex');
const NOW = new Date().toISOString();
const RECON = ' — état reconstruit après destruction de la DB gouvernée au merge git (Sep 8 ~09:59 : db/custom.db tracké à la base, supprimé côté origin/main → checkout a retiré le fichier ; re-seed bootstrap à vide). Faits documentés dans worklog.md tâches 26-27 + registre vérifié en session (INV-210 : perte documentée, jamais simulée).';

// UID dynamique : EV-<CAT>-<N> = max(N) existant pour la catégorie + 1
async function nextUid(category) {
  const rows = await db.evidence.findMany({ where: { category }, select: { evidenceUid: true } });
  const max = rows.reduce((m, r) => {
    const n = Number(r.evidenceUid.split('-').pop());
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `EV-${category}-${String(max + 1).padStart(6, '0')}`;
}

async function seal(category, criticality, actorId, claim, payload) {
  const last = await db.evidence.findFirst({ orderBy: { createdAt: 'desc' }, select: { contentHash: true } });
  const prevHash = last?.contentHash ?? null;
  const contentHash = sha({ category, claim, actor: `SYSTEM:${actorId}`, payload, prevHash });
  const evidenceUid = await nextUid(category);
  const ev = await db.evidence.create({
    data: { evidenceUid, category, criticality, state: 'SEALED', actorType: 'SYSTEM', actorId, claim, payload, contentHash, prevHash, sealedAt: new Date() },
  });
  console.log('preuve scellée:', ev.evidenceUid, '—', claim.slice(0, 90));
  return ev;
}

async function main() {
  // ── 1. Preuve d'incident (chaîne greffée sur le seed bootstrap actuel) ──
  await seal('POLICY', 'HIGH', 'merge-db-recovery',
    'Destruction de la DB gouvernée détectée (Sep 8 ~09:59) : db/custom.db était TRACKÉ à la base commune (366c70e), supprimé du suivi côté origin/main — le merge a retiré le fichier du workspace, le bootstrap a re-seedé une DB vierge. Perdus (blobs non régénérables) : chaîne EV-000601..000624, EVO ×6, RUN ×7, preuves du test décisif (EV-INCIDENT-000624 : 12/12 PASS, classification INFRA). Les FAITS sont documentés (worklog tâches 26-27, sortie registre vérifiée en session) et reconstruits ci-dessous avec des lignes explicitement étiquetées RECONSTRUCTION — aucune décision humaine n\'est simulée : EVO-000026 a bien été approuvée par HUMAN:reviewer (vérifié à 08:50:36Z avant le merge).',
    JSON.stringify({ incident: 'merge_db_destruction_2026-09-08T09:59Z', mechanism: 'add/delete conflict db/custom.db (base-tracked, origin-deleted) → checkout removed file → bootstrap reseed', sources: ['worklog.md Task 26', 'worklog.md Task 27', 'session registry verification 08:50:36.936Z'], capturedAt: NOW }));

  // ── 2. EvolutionProposal × 6 (états documentés au 09:55) ──
  const evo26Rationale = "PTA-002 itération 5 (RUN-000026) a mesuré un trou structurel : le fabric LLM s'est ouvert en cours de génération (zai:circuit OPEN, cooldown 90s), 11 fichiers sur 14 ont échoué après 3 tentatives chacun contre un circuit ouvert, et le pipeline a POURSUIVI avec un livrable partiel (3 fichiers vérifiés) jusqu'à la porte de boot — rejeté seulement indirectement par DÉCOUVERTE (main.py vide), avec un diagnostic imprécis qui masquait la cause réelle. Dans studio-pipeline.ts, la boucle GENERATING marque les fichiers FAILED puis continue : seule generated===0 fait échouer le run. Un livrable partiel peut donc atteindre les portes v1/v2, gaspiller du temps de boot/pytest et produire des diagnostics trompeurs. Les portes existantes sont aveugles à cette classe : v1 (EVO-000016) voit import/boot, v2 (EVO-000025) voit le comportement — aucune ne voit la complétude. Fermer ce trou AVANT l'injection few-shot (exemplaire doré RUN-000023-corrige, prochain levier candidat) préserve aussi la mesure honnête du taux de première passe : un effondrement INFRA (fabric OPEN) doit être classé comme tel et non compté comme un échec d'apprentissage du générateur (INV-210 : mesure honnête).";
  const evo26Experiment = {
    title: 'Preuve de la porte v3 — livrable partiel refusé à VERIFYING, livrable sain sans friction',
    protocol: [
      "1. Implémenter completeness-gate.ts (YAHRIA-STD-005) sur le modèle de boot-gate.ts : isCompletenessGateActive() armé si EVO-000026 PROMOTED.",
      "2. Intégrer dans studio-pipeline.ts entre la fin de GENERATING et l'entrée en VERIFYING : (a) inventaire des fichiers FAILED (path → note) ; (b) rattrapage borné : 1 passe de régénération pour les fichiers échoués, avec attente du cooldown si note contient circuit OPEN ; (c) si échec persistant → failRun avec message PORTE V3 : X/N fichiers échoués — inventaire path:note — classification INFRA (fabric/circuit) ou MODÈLE.",
      "3. Test unitaire : pipeline simulant 3 fichiers vérifiés + 2 échoués → la porte doit failRun AVANT toute écriture workspace / porte de boot, avec inventaire exact et classification correcte.",
      "4. Test de non-régression : run sain (tous fichiers vérifiés) → la porte ne modifie rien, le run progresse vers les portes v1/v2 inchangées.",
      "5. Test décisif PTA-002 itération 6 (RUN-000027) : reproduction conditions RUN-000026 — si fabric OPEN se reproduit, le run doit échouer à la porte v3 avec classification INFRA et ne jamais atteindre la porte de boot.",
    ],
    acceptance: [
      "Aucun run comportant un fichier FAILED persistant ne dépasse la frontière GENERATING→VERIFYING quand la porte est armée.",
      "Le message d'échec contient l'inventaire path:note et la classification INFRA|MODÈLE.",
      "Un run sain passe la porte sans altération (zéro friction mesurée).",
      "Rollback vérifié : porte désactivée → comportement legacy restauré.",
    ],
    evidencePrefix: 'EV-POLICY',
  };
  const evo26Rollback = "Flag isCompletenessGateActive() calqué sur boot-gate (EVO-000016) : armé uniquement si EVO-000026 PROMOTED. Rollback en 1 action API (rollback) — le pipeline redevient legacy (seul critère generated===0), sans migration DB ni changement de schéma ; les runs déjà scellés et leurs preuves restent intacts ; aucune donnée workspace n'est supprimée.";

  const evos = [
    { proposalUid: 'EVO-000016', title: 'Sandbox Docker pour prévalidation npm (INV-215)', kind: 'WORKFLOW', riskClass: 'MEDIUM', state: 'PROMOTED',
      rationale: "Bloqueur prod #2 : la vérification statique du studio scelle des livrables sans boot réel (démontré par RUN-000019 : 6 défauts non détectés). Un sandbox Docker permettrait npm install + jest sur chaque RUN avant SEALED, fermant la frontière honnêtement mesurée. (texte intégral perdu au reset — préfixe authentique, INV-210)",
      decidedBy: 'HUMAN:reviewer', decisionReason: "l'Humain a approuvé" + RECON },
    { proposalUid: 'EVO-000025', title: 'Porte v2 : sondes comportementales (pytest + appels POST réels) avant SEALED', kind: 'WORKFLOW', riskClass: 'MEDIUM', state: 'PROMOTED',
      rationale: "PTA-001 a mesuré la frontière de la porte v1 : RUN-000023 scellé au premier coup (boot prouvé) mais 5 tests POST échouent en 500 (dérive de contrat inter-fichiers : signature get_gateway, await sur méthode sync, except HTTPException masqué). Ces défauts sont invisibles à l'import ET au boot — ils nécessitent des sondes comportementales (pytest exécuté par la porte) avant SEALED. Continuité directe de EVO-000016 (porte v1 boot-level, PROMOTED).",
      decidedBy: 'HUMAN:reviewer', decisionReason: "l'Humain a approuvé" + RECON,
      rollbackPlan: "Flag isBehavioralGateActive() calqué sur boot-gate (EVO-000016) : armé uniquement si EVO-000025 PROMOTED ; rollback en 1 action API, pipeline legacy restauré sans migration." },
    { proposalUid: 'EVO-000026', title: 'Porte v3 : complétude de génération avant livraison — aucun livrable partiel ne quitte GENERATING', kind: 'WORKFLOW', riskClass: 'MEDIUM', state: 'PROMOTED',
      rationale: evo26Rationale, experiment: JSON.stringify(evo26Experiment), rollbackPlan: evo26Rollback,
      proposedBy: 'AGENT:super-z', decidedBy: 'HUMAN:reviewer', decisionReason: "L'humain que je suis le desire" + RECON },
    { proposalUid: 'EVO-000021', title: 'Backoff exponentiel des ticks de mission', kind: 'WORKFLOW', riskClass: 'LOW', state: 'SCHEDULED',
      rationale: '(détail perdu au reset workspace — titre authentique seul ; décision HUMAN documentée avant reset, INV-210)',
      decidedBy: 'HUMAN:reviewer', decisionReason: 'programmée' + RECON },
    { proposalUid: 'EVO-000023', title: 'TEST pipeline : cycle HIGH avec rollback final (jetable)', kind: 'WORKFLOW', riskClass: 'HIGH', state: 'ROLLED_BACK',
      rationale: 'Test gouverné du cycle complet HIGH (jetable) — rollback final exécuté.',
      decidedBy: 'HUMAN:reviewer', decisionReason: 'test de cycle avec rollback final' + RECON },
    { proposalUid: 'EVO-000024', title: 'UI option 23 : rollback HIGH au approve + garde-fous au promote', kind: 'WORKFLOW', riskClass: 'MEDIUM', state: 'UNDER_REVIEW',
      rationale: 'Renforcer la console option 23 : rollback obligatoire au approve pour HIGH/CRITICAL, garde-fous au promote (détail perdu au reset, INV-210).' },
  ];
  for (const e of evos) {
    await db.evolutionProposal.upsert({ where: { proposalUid: e.proposalUid }, update: e, create: { ...e, proposedBy: e.proposedBy ?? 'AGENT:super-z' } });
    console.log('EVO reconstruite:', e.proposalUid, '→', e.state);
  }

  // ── 3. GenerationRun × 9 (historique documenté) ──
  const runs = [
    { runUid: 'RUN-000019', name: 'Audit prod-ready — livrable studio (6 défauts détectés)', state: 'FAILED', stack: 'NEXTJS',
      brief: '(reconstruit) Run de l\'audit prod-ready R14 : 6 défauts non détectés par la vérification statique — a motivé EVO-000016.',
      error: '6 défauts livrés sans boot réel — porte de boot inexistante à l\'époque', createdAt: new Date('2026-09-07T10:00:00Z'), recon: true },
    { runUid: 'RUN-000021', name: 'PTA-001 itération 1 — Hub Mobile Money (0% bootable)', state: 'FAILED', stack: 'PYTHON',
      brief: '(reconstruit) Première itération PTA-001 : livrable 0% bootable.',
      error: '0% bootable — cascade de défauts de génération', createdAt: new Date('2026-09-07T21:00:00Z'), recon: true },
    { runUid: 'RUN-000022', name: "PTA-001 — Hub Mobile Money — test d'apprentissage boot premier coup", state: 'FAILED', stack: 'PYTHON',
      brief: '(reconstruit) Test d\'apprentissage PTA-001 : première exécution sous porte de boot armée (EVO-000016).',
      error: 'porte de boot (EVO-000016) — ImportError (SECRET_KEY) : symbole inter-fichiers halluciné, invisible à py_compile', createdAt: new Date('2026-09-07T22:30:00Z'), recon: true },
    { runUid: 'RUN-000023', name: 'PTA-001 itération 2 — Hub Mobile Money, leçons scellées injectées, boot premier coup exigé', state: 'SEALED', stack: 'PYTHON',
      brief: 'API Hub de paiement Mobile Money (FastAPI) unifiant deux passerelles : NotchPay et PesaPal. (reconstruit : brief intégral perdu, préfixe authentique)',
      error: null, createdAt: new Date('2026-09-07T23:10:00Z'), sealedFirstPass: true, recon: true },
    { runUid: 'RUN-000024', name: 'PTA-002 — Hub Mobile Money sous double porte (boot v1 + comportement v2), verdict au premier passage', state: 'FAILED', stack: 'PYTHON', requestedStack: 'PYTHON',
      brief: 'API Hub de paiement Mobile Money (FastAPI) unifiant deux passerelles : NotchPay et PesaPal. (reconstruit : préfixe authentique)',
      treeSpec: 'main.py\nconfig.py\nmodels.py\nschemas.py\nsecurity.py\ngateways/__init__.py\ngateways/base.py\ngateways/notchpay.py\ngateways/pesapal.py\nwebhooks.py\ntests/__init__.py',
      error: 'porte de boot (EVO-000016) — BOOT : uvicorn main:app sans réponse HTTP en 30s — connexion refusée',
      createdAt: new Date('2026-09-07T23:18:58.923Z'), recon: false },
    { runUid: 'RUN-000025', name: 'PTA-002 itération 4 — Hub Mobile Money, contrats verbatim, double porte (boot v1 + pytest v2)', state: 'FAILED', stack: 'PYTHON', requestedStack: 'PYTHON',
      brief: 'API Hub de paiement Mobile Money (FastAPI). SUIS LES CONTRATS LITTERALEMENT, LIGNE PAR LIGNE. (reconstruit : préfixe authentique)',
      treeSpec: 'main.py\nconfig.py\nmodels.py\nschemas.py\nsecurity.py\ngateways/__init__.py\ngateways/base.py\ngateways/notchpay.py\ngateways/pesapal.py\nwebhooks.py\ntests/__init__.py\ntests/test_api.py\nrequirements.txt',
      error: 'porte comportementale (EVO-000025) — PYTEST : pytest exit 1 — 9 failed, 4 passed',
      createdAt: new Date('2026-09-07T23:23:25.212Z'), recon: false },
    { runUid: 'RUN-000026', name: 'PTA-002 itération 5 FINALE — Hub Mobile Money, double porte, aucune authentification', state: 'FAILED', stack: 'PYTHON', requestedStack: 'PYTHON',
      brief: 'API Hub de paiement Mobile Money (FastAPI). SUIS LES CONTRATS LITTERALEMENT — INTERDICTIONS ABSOLUES : aucune authentification, aucune base de données. (reconstruit : préfixe authentique)',
      treeSpec: 'main.py\nconfig.py\nmodels.py\nschemas.py\nsecurity.py\ngateways/__init__.py\ngateways/base.py\ngateways/notchpay.py\ngateways/pesapal.py\nwebhooks.py\ntests/__init__.py\ntests/test_api.py\nrequirements.txt',
      error: 'porte de boot (EVO-000016) — DÉCOUVERTE : aucun module racine avec instance FastAPI( ou create_app( — cause racine : LLM fabric exhausted (circuit OPEN), 9 fichiers vides ayant traversé la boucle GENERATING',
      createdAt: new Date('2026-09-07T23:28:06.294Z'), recon: false },
    { runUid: 'RUN-000008', name: 'Test décisif tentative 1 — chaos via flip runtime API (sans effet pipeline, preuve instance-separation)', state: 'FAILED', stack: 'PYTHON', requestedStack: 'PYTHON',
      brief: "Minimal FastAPI inventory service: main.py (FastAPI app with 4 routes: list, get, create, delete items in-memory), models.py (pydantic Item model), storage.py (in-memory dict store with lock), tests/test_api.py (pytest covering the 4 routes). Requirements.txt with fastapi, uvicorn, pydantic. 6 files maximum.",
      aiDesignedTree: true,
      error: 'porte de boot (EVO-000016) — BOOT : uvicorn main:app sans réponse HTTP en 30s — connexion refusée (5/5 fichiers générés sainement : la porte v3 est passée sans échec à traiter)',
      createdAt: new Date('2026-09-08T09:35:00Z'), recon: true },
    { runUid: 'RUN-000009', name: 'Test décisif RUN-000027 (protocole EVO-000026) — chaos ECONNREFUSED réel via env YAHRIA_LLM_ORDER=ollama', state: 'FAILED', stack: 'PYTHON', requestedStack: 'PYTHON',
      brief: "Minimal FastAPI inventory service: main.py (FastAPI app with 4 routes: list, get, create, delete items in-memory), models.py (pydantic Item model), storage.py (in-memory dict store with lock), tests/test_api.py (pytest covering the 4 routes). Requirements.txt with fastapi, uvicorn, pydantic. 6 files maximum.",
      aiDesignedTree: true,
      error: "porte de complétude (EVO-000026) — classification INFRA : 3 fichier(s) en échec persistant — app.py, README.md, requirements.txt (remédiation v3 échouée après cooldown respecté). Test décisif 12/12 PASS — preuve EV-INCIDENT-000624 PERDUE au merge (fait documenté worklog Task 27)",
      createdAt: new Date('2026-09-08T09:52:00Z'), recon: true },
  ];
  for (const r of runs) {
    const { recon, sealedFirstPass, ...data } = r;
    const note = ' [ligne reconstruite après destruction DB au merge Sep 8 ~09:59 — faits authentiques documentés, INV-210]';
    await db.generationRun.upsert({
      where: { runUid: r.runUid },
      update: { name: r.name, state: r.state, error: r.error },
      create: { ...data, error: r.error ? r.error + note : null, aiDesignedTree: Boolean(r.aiDesignedTree), stats: '{}' },
    });
    console.log('RUN reconstruit:', r.runUid, '→', r.state);
  }

  // ── 4. Preuve de clôture de reconstruction ──
  await seal('POLICY', 'STANDARD', 'merge-db-recovery',
    'Reconstruction gouvernée terminée après destruction DB au merge : EVO ×6 (dont EVO-000026 → PROMOTED avec métadonnées d\'approbation réelles vérifiées en session : decidedBy HUMAN:reviewer, « L\'humain que je suis le desire ») + RUN ×9 (19, 21-26, 8, 9). Lignes étiquetées RECONSTRUCTION — les preuves originales restent perdues (INV-210, non masqué). Garde-fou institutionnalisé : /db/ jamais re-tracké par git.',
    JSON.stringify({ reconstructed: { evolutions: 6, runs: 9 }, evo26State: 'PROMOTED', capturedAt: NOW }));

  console.log('--- reconstruction merge-incident terminée ---');
  await db.$disconnect();
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
