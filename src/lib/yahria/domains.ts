// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Canonical Domain Map & Dependency Graph
// Doc ID: YAHRIA-KRN-003 | Source: CANONICAL_INDEX.md + DEPENDENCY_GRAPH.md
// ═══════════════════════════════════════════════════════════════

export interface DomainDef {
  code: string;
  name: string;
  purpose: string;
  phase: number;          // canonical implementation order (DEPENDENCY_GRAPH)
  isCore: boolean;        // cross-cutting authority
  subdomains: string[];
}

export const DOMAINS: DomainDef[] = [
  { code: '00', name: 'Initialization & Constitution', purpose: 'Identity and immutable architectural principles of YAHRIA', phase: 0, isCore: true, subdomains: ['Vision', 'Mission', 'Product Principles', 'Constitution', 'Global Invariants', 'Architectural Principles', 'Security Principles', 'Definition of Done', 'Canonical Vocabulary'] },
  { code: '01', name: 'Foundation & Platform Core', purpose: 'Common technical foundation for all other domains', phase: 1, isCore: false, subdomains: ['Monorepo', 'Backend Foundation', 'Frontend Foundation', 'Database Foundation', 'Configuration', 'Dependencies', 'Environments', 'Feature Flags', 'Shared Libraries'] },
  { code: '16', name: 'Data & Persistence', purpose: 'PostgreSQL architecture, schema strategy, RLS, tenant isolation', phase: 2, isCore: true, subdomains: ['PostgreSQL', 'Schema Strategy', 'SQLAlchemy', 'Alembic', 'RLS', 'Tenant Isolation', 'Index Strategy', 'Partitioning', 'JSONB', 'Vector Storage', 'Graph Storage', 'Backup'] },
  { code: '02', name: 'Identity & Organization', purpose: 'Identities, authorization boundaries, organizational ownership', phase: 3, isCore: false, subdomains: ['Identity', 'Authentication', 'Authorization', 'RBAC', 'ABAC', 'Organizations', 'Tenants', 'Teams', 'Memberships', 'Audit Identity'] },
  { code: '03', name: 'Project & Workspace', purpose: 'Projects, repositories, workspaces, source providers', phase: 4, isCore: false, subdomains: ['Projects', 'Repositories', 'Workspaces', 'Branches', 'Environments', 'Source Providers', 'Sync'] },
  { code: '04', name: 'Code Genome & Knowledge Graph', purpose: 'Code ingestion, symbols, graphs, embeddings, semantic retrieval', phase: 5, isCore: false, subdomains: ['Ingestion', 'File Intelligence', 'Symbols', 'Dependency Graph', 'Call Graph', 'Type Graph', 'Knowledge Graph', 'Impact Analysis', 'Embeddings', 'Semantic Retrieval'] },
  { code: '05', name: 'Agent Operating System', purpose: 'Agent identity, registry, lifecycle, coordination, governance', phase: 6, isCore: false, subdomains: ['Identity', 'Registry', 'Capabilities', 'Lifecycle', 'Communication', 'Context', 'State', 'Coordination', 'Scheduling', 'Routing', 'Evaluation', 'Governance'] },
  { code: '06', name: 'Cognitive Core', purpose: 'Intent, planning, reasoning, uncertainty, reflection, decisions', phase: 7, isCore: false, subdomains: ['Intent Understanding', 'Goal Modeling', 'World State', 'Context Assembly', 'Reasoning Interface', 'Planning Engine', 'Strategy Selection', 'Uncertainty Engine', 'Verification Planning', 'Reflection', 'Cognitive Routing', 'Decision Engine', 'Cognitive Safety'] },
  { code: '07', name: 'Task Graph & Orchestration', purpose: 'Goal decomposition, DAG engine, scheduling, compensation', phase: 8, isCore: false, subdomains: ['Task Model', 'Goal Decomposition', 'Task Graph', 'DAG Engine', 'Dependency Resolution', 'Scheduling', 'State Machine', 'Retry', 'Compensation', 'Cancellation', 'Governance'] },
  { code: '08', name: 'Execution Fabric', purpose: 'Execution lifecycle, context, persistence, workers, recovery', phase: 9, isCore: false, subdomains: ['Orchestrator', 'State Machine', 'Context', 'Persistence', 'Queue', 'Worker', 'Retry', 'Timeout', 'Cancellation', 'Recovery'] },
  { code: '09', name: 'Tool Registry Engine', purpose: 'Tool definitions, contracts, capabilities, authorization', phase: 10, isCore: false, subdomains: ['Registry', 'Definition', 'Versioning', 'Discovery', 'Capability', 'Contract', 'Schema', 'Validator', 'Authorization', 'Executor', 'Governance'] },
  { code: '10', name: 'Sandbox Engine', purpose: 'Isolation: filesystem overlay, network, resources, process control', phase: 11, isCore: false, subdomains: ['Contract', 'Security Profile', 'Runtime Adapter', 'Container', 'Podman', 'FS Overlay', 'Workspace Isolation', 'Network Isolation', 'Egress Policy', 'DNS Policy', 'Resource Controller', 'Limits', 'Timeout'] },
  { code: '11', name: 'Execution Observability', purpose: 'Events, traces, metrics, evidence, replay, audit, forensics', phase: 12, isCore: true, subdomains: ['Events', 'Traces', 'Metrics', 'Telemetry', 'Logs', 'Artifacts', 'Evidence Engine', 'Lineage Graph', 'Replay', 'Audit', 'Forensics', 'Retention'] },
  { code: '12', name: 'Policy & Governance Control Plane', purpose: 'Unified RBAC/ABAC, policy DSL, deterministic rules, enforcement', phase: 13, isCore: true, subdomains: ['RBAC', 'ABAC', 'Policy Model', 'Policy DSL', 'Rule Engine', 'Simulator', 'Policy-as-Code', 'Versioning', 'Signatures', 'Propagation', 'Decision', 'Enforcement', 'Cognitive Integration'] },
  { code: '13', name: 'Memory System', purpose: 'Working, episodic, semantic, procedural, architectural memory', phase: 14, isCore: false, subdomains: ['Architecture', 'Working', 'Episodic', 'Semantic', 'Procedural', 'Architectural', 'Candidates', 'Validation', 'Consolidation', 'Graph', 'Retrieval', 'Governance', 'Forgetting'] },
  { code: '14', name: 'Learning Engine', purpose: 'Reflection, pattern mining, failure/success intelligence', phase: 15, isCore: false, subdomains: ['Extraction', 'Reflection', 'Pattern Mining', 'Failure Intelligence', 'Success Intelligence', 'Strategy Learning', 'Validation', 'Evidence'] },
  { code: '15', name: 'Self-Evolution & Meta-Intelligence', purpose: 'Controlled self-improvement under D.6.11 governance', phase: 16, isCore: false, subdomains: ['Meta-Intelligence', 'Self-Assessment', 'Strategy Optimization', 'Agent Genome', 'Workflow Evolution', 'Prompt Evolution', 'Model Routing Optimization', 'Experimentation', 'Benchmark', 'Evolution Sandbox', 'Governance', 'Rollout', 'Rollback'] },
  { code: '17', name: 'API & Integration', purpose: 'API gateway, REST, WebSocket, events, plugins, SDK', phase: 17, isCore: false, subdomains: ['Gateway', 'REST', 'WebSocket', 'Internal API', 'Event Bus', 'Webhooks', 'Plugins', 'External Tools', 'SDK'] },
  { code: '18', name: 'Frontend & User Experience', purpose: 'Web app, IDE interface, dashboards, consoles', phase: 18, isCore: false, subdomains: ['Web App', 'IDE Interface', 'Code Editor', 'AI Chat', 'Agent Dashboard', 'Task Graph Visualization', 'Execution Console', 'Evidence Viewer', 'Memory Explorer', 'Policy Console', 'Evolution Dashboard', 'Administration'] },
  { code: '19', name: 'Security', purpose: 'Threat model, zero trust, secrets, supply chain, incidents', phase: 19, isCore: true, subdomains: ['Threat Model', 'Zero Trust', 'Secrets', 'Encryption', 'Key Management', 'Supply Chain', 'Sandbox Security', 'Network Security', 'Audit', 'Incident Response'] },
  { code: '20', name: 'Quality Engineering', purpose: 'Test strategy, unit/integration/E2E, chaos, benchmarks', phase: 20, isCore: true, subdomains: ['Test Strategy', 'Unit', 'Integration', 'Contract Tests', 'E2E', 'Security Tests', 'Performance', 'Chaos', 'Regression', 'Benchmarks', 'Test Evidence'] },
  { code: '21', name: 'DevOps & Delivery', purpose: 'CI/CD, containers, artifacts, infrastructure, rollback', phase: 21, isCore: false, subdomains: ['Local Dev', 'Docker', 'Podman', 'CI', 'CD', 'Build Pipeline', 'Registry', 'IaC', 'Staging', 'Production', 'Rollback'] },
  { code: '22', name: 'Operations', purpose: 'Monitoring, alerting, incidents, SLO, capacity, DR', phase: 22, isCore: false, subdomains: ['Monitoring', 'Alerting', 'Incidents', 'SLO/SLA', 'Capacity', 'Cost', 'Backup Ops', 'Disaster Recovery', 'Runbooks'] },
  { code: '23', name: 'Product Evolution & Roadmap', purpose: 'MVP → Alpha → Beta → Enterprise progression', phase: 23, isCore: false, subdomains: ['MVP', 'Alpha', 'Beta', 'Enterprise', 'Scaling', 'Plugin Ecosystem', 'API Ecosystem', 'Marketplace', 'Long-Term Evolution'] },
];

// ── ACTIVATION LEDGER — statuts fondés sur PREUVES (UNKNOWN ≠ SUCCESS) ──
// Un domaine entre ici UNIQUEMENT lorsque son implémentation existe dans le
// noyau ET qu'une preuve vérifiable est archivée (tests, runs LIVE_PROVED,
// parité, spécification publiée). Le bootstrap applique l'activation de façon
// MONOTONE : NOT_STARTED → IMPLEMENTING, jamais l'inverse (rétrogradation ou
// clôture DONE exigent une décision gouvernée D.6 avec preuves).
export interface DomainActivation {
  code: string;
  since: string;      // date d'activation (preuve archivée)
  evidence: string[]; // artefacts de preuve : modules noyau, runs, specs
}

export const DOMAIN_ACTIVATIONS: DomainActivation[] = [
  {
    code: '08',
    since: '2026-09-07',
    evidence: [
      'sandbox-executor.ts (YAHRIA-KRN-024) — install → syntaxe → build → launch → sondes HTTP, recettes fixes 12 stacks (INV-042, INV-190)',
      'live-proof.ts — boucle gouvernée SEALED → LIVE_PROVED, budget 3 tentatives / 15 min, diagnostic du fichier fautif + self-heal borné (INV-210, INV-211)',
      'Preuves LIVE archivées : RUN-000009 FastAPI HTTP 200 réel ; RUN-000013 (C), RUN-000014 (C++), RUN-000015 (Fortran), RUN-000017 (C#) — LIVE_PROVED, marqueur YAHRIA-LINK-OK',
      'Spec publique : public/docs/SANDBOX_EXECUTION_SPECIFICATION.md v1.1.0',
    ],
  },
  {
    code: '09',
    since: '2026-09-07',
    evidence: [
      'tool-registry.ts (YAHRIA-KRN-025) — registre versionné (semver monotone, downgrades refusés INV-190), contrats JSON stricts validés S1 (champs non déclarés rejetés)',
      'Grille d\u2019autorisation vivante (INV-062) : POL-011 ALLOW readonly.*, POL-012 DENY sideeffect.*, POL-006 REQUIRE_APPROVAL unregistered.* ; autorisations gouvernées POL-AUTH-* révocables',
      'tool-executor.ts (YAHRIA-KRN-026) — exécuteur borné outils (INV-042 timeout, INV-213 env scrubé, argv whitelisté uniquement)',
      'Suite de preuves scripts/r12-tool-registry-tests.ts : 22/22 PASS — refus tracés (PolicyDecision), preuves TOOL scellées (chaîne SHA-256), pas de faux succès (INV-210)',
      'API /api/yahria/tools (register/discover/invoke/authorize) + panneau UI « Registre des outils » (13e onglet) avec démonstrateur INV-062',
    ],
  },
  {
    code: '10',
    since: '2026-09-07',
    evidence: [
      'Backend process : env enfant scrubé (INV-213), timeouts par étape (INV-042), ports bornés 3910+, kill de groupe SIGTERM→SIGKILL, cwd confinement workspace',
      'Backend conteneur durci (INV-215) : --network none, rootfs read-only, cap-drop ALL, no-new-privileges, cpu/mem/pids bornés — YAHRIA_SANDBOX_BACKEND=docker',
      'Assets conteneur : docker/sandbox.Dockerfile (Ubuntu 24.04 non-root, 12 toolchains : gcc/g++/gfortran/python3/node/bun/go/rust/java/dotnet/mono)',
      'Frontière honnête (INV-210) : démon Docker absent sur l hôte de preuve — backend conteneur branché et gardé, exécution conteneur non démontrée ici',
    ],
  },
  {
    code: '11',
    since: '2026-09-07',
    evidence: [
      'observability.ts (YAHRIA-KRN-028) — index des traces multi-sources, timeline ordonnée assemblée depuis Evidence/ToolInvocation/AgentRun/Execution/PolicyDecision/SystemEvent',
      'Replay LECTURE SEULE prouvé (INV-218) : reconstruction des faits + re-validation S1 des inputs enregistrés contre les contrats ACTUELS (détection de drift), zéro mutation mesurée',
      'Forensics (INV-110) : recomputation des empreintes SHA-256 des preuves d une trace — altérations signalées ; rapport de drift registre ↔ historique',
      'Socle événementiel : bus realtime (fan-out WS), journal SystemEvent, chaîne de preuves hash-chaînée — préexistant et désormais rejouable',
      'Suite R13 : timeline mission agent réelle (sortie uname vérifiée), replay 0 mutation mesurée, chaîne intègre, 0 drift',
      'API /api/yahria/observability + panneau UI « Observabilité » (index, timeline, replay, drift)',
    ],
  },
  {
    code: '12',
    since: '2026-09-07',
    evidence: [
      'policy-console.ts (YAHRIA-KRN-029) — gestion gouvernée : règles POL-C-* avec portée acteur (actorType/actorId — RBAC fin), mutations justifiées et scellées en preuves POLICY (INV-121)',
      'Verrou constitutionnel prouvé (INV-219) : POL-001..POL-012 intouchables depuis la console (refus testé) ; seules POL-C-*/POL-AUTH-* sont mutables',
      'Simulateur sans effet de bord prouvé (INV-220) : ALLOW/DENY simulés par acteur, 0 décision persistée (comptage avant/après vérifié)',
      'Analyse d\u2019impact avant création : bascules d\u2019autorisation simulées outil par outil (brouillon jamais persisté — vérifié)',
      'RBAC fin prouvé : règle POL-C- Allow sideeffect.sandbox.cli.run pour AGENT:tester seul — humain reste DENY (POL-012), tester exécute réellement ; toggle off → re-DENY',
      'evaluatePolicy étendu (rétrocompatible) : portée acteur optionnelle par règle ; API /api/yahria/policy-console + panneau UI « Console politiques »',
    ],
  },
  {
    code: '07',
    since: '2026-09-07',
    evidence: [
      'mission-graph.ts (YAHRIA-KRN-031) — orchestration multi-agents : Mission/MissionTask, DAG acyclique validé à la création (INV-223), une tâche = un agent canonique × un outil du registre (INV-224)',
      'Moteur DAG par vagues (tick) : promotion PENDING→READY quand dépendances COMPLETED (INV-091), retry gouverné UNIQUEMENT sur échec d\u2019exécution — refus politique/capacité finaux (INV-092)',
      'Décomposition S1 déterministe par patrons (DIAGNOSTIC/GOUVERNANCE/OBSERVATION) — stratégie DECOMPOSED, aucune invention d\u2019agent ou d\u2019outil (INV-191)',
      'Exécution exclusivement via la passerelle gouvernée runAgentMission (INV-216/062/217) — preuves TASK scellées à chaque création et clôture',
      'Machines à états gardées MISSION/TASK (transitions illégales → 422) + annulation par autorité humaine avec raison (INV-200/201)',
      'API /api/yahria/missions + panneau UI « Orchestration missions » (graphe, tick, annulation) — suite de preuves R14 : mission DIAGEC créée, schedulée, ticks exécutés avec outils réels',
    ],
  },
  {
    code: '13',
    since: '2026-09-07',
    evidence: [
      'memory.ts (YAHRIA-KRN-030) — écriture gouvernée : provenance OBLIGATOIRE (INV-221 mécanisée), validation INV-081 portée par chaque enregistrement (INV-140)',
      'Oubli gouverné (INV-222) : raison ≥ 10 caractères exigée, preuve MEMORY scellée, ARCHITECTURAL non supprimable (refus testé)',
      'Consolidation monotone WORKING/EPISODIC → SEMANTIC avec preuve adossée ; mémoire FALSE non consolidable (refus testé)',
      'Récupération S1 (filtre kind/validation/recherche, rangée confiance+récence) — la validation voyage avec le souvenir',
      'API /api/yahria/memory (GET/POST/PATCH/DELETE) + panneau UI « Mémoire » — suite R14 : écriture, consolidation, oubli gouverné, refus sans provenance',
    ],
  },
  {
    code: '14',
    since: '2026-09-07',
    evidence: [
      'learning.ts (YAHRIA-KRN-032) — mining déterministe des faits enregistrés uniquement : ToolInvocation, AgentRun, FailureEvent (INV-226 — zéro auto-rapport de modèle)',
      'Insights TOOL_RELIABILITY / AGENT_PERFORMANCE / FAILURE_PATTERN : upsert par (kind, subject), états OBSERVED→VALIDATED au seuil 3 échantillons (INV-225), PROMOTED/RETIRED intouchés par le mining',
      'Confiance dérivée des échantillons (fonction pure learningConfidence) — jamais auto-proclamée (INV-150)',
      'Promotion gouvernée insight VALIDATED → mémoire SEMANTIC (pont D.14→D.13), réversible (INV-151), preuves MODEL scellées',
      'API /api/yahria/learning (mine/promote) + panneau UI « Apprentissage » — suite R14 : mining réel sur historique, promotion testée',
    ],
  },
  {
    code: '15',
    since: '2026-09-07',
    evidence: [
      'evolution.ts (YAHRIA-KRN-033) — pipeline gouverné DRAFTED→SUBMITTED→UNDER_REVIEW→APPROVED→SCHEDULED→PROMOTED→ROLLED_BACK (INV-162), transitions illégales → 422',
      'Séparation proposition/approbation MÉCANISÉE (INV-227) : refus testé quand l\u2019identité décisionnaire = proposant (HUMAN ou AGENT:key)',
      'Plan de rollback obligatoire pour risque HIGH/CRITICAL avant APPROVED (INV-163) ; expérimentation documentée exigée avant PROMOTED (INV-162)',
      'PROMOTED n\u2019exécute AUCUNE mutation de production (INV-228, graphe des dépendances interdites) — la promotion enregistre la décision gouvernée',
      'Lignée D.14 → D.15 : sourceInsightUid obligatoirement existant (INV-034) ; preuves POLICY scellées à chaque décision',
      'API /api/yahria/evolution + panneau UI « Auto-évolution » — suite R14 : création, refus auto-approbation, approbation par identité distincte',
    ],
  },
  {
    code: '17',
    since: '2026-09-07',
    evidence: [
      'api-gateway.ts (YAHRIA-KRN-034) — clés API stockées en SHA-256 uniquement, plaintext retourné UNE fois à l\u2019émission (INV-229, refus de relecture)',
      'Surface versionnée /api/v1/* : system, domains, missions, tools, memory, evidence, ops, roadmap (lecture) + POST missions (écriture, scope write)',
      'Gouvernance des appels (INV-230) : clé absente/inconnue → 401, révoquée → 401, hors scope → 403, rate limit dépassé → 429 ; chaque appel journalisé (événement API_V1_CALL)',
      'Rate limit par clé — fenêtre glissante 60 s, bornes 5..600/min ; scopes hiérarchiques read < write < admin',
      'API /api/yahria/apikeys (émission/liste/révocation gouvernée) + panneau UI « API & Intégration » — suite R14 : émission, appel v1 authentifié, 401 sans clé, révocation, re-401',
    ],
  },
  {
    code: '18',
    since: '2026-09-07',
    evidence: [
      'Mission Control — 26 onglets couvrant les plans studio/missions/mémoire/apprentissage/évolution/outils/politiques/observabilité/API/sécurité/qualité/DevOps/opérations/roadmap/cognition/preuves/temps réel',
      'Nouveaux panneaux R14 : Orchestration missions (DAG + tick), Mémoire, Apprentissage, Auto-évolution, API & Intégration, Sécurité, Qualité, DevOps, Opérations, Roadmap — tous branchés sur leurs API gouvernées',
      'UX responsive (grilles md/lg, wrap d\u2019onglets, cibles tactiles), thème industriel sombre cohérent, temps réel WebSocket (fan-out bus), verdicts honnêtes affichés (aucun succès inventé)',
      'Accessibilité : sémantique (header/main/footer), focus states natifs shadcn/ui, badges d\u2019état standardisés (stateColor partagé)',
    ],
  },
  {
    code: '19',
    since: '2026-09-07',
    evidence: [
      'security.ts (YAHRIA-KRN-035) — audit automatisé à 8 contrôles factuels : refus par défaut POL-012 vivant, règles constitutionnelles présentes, clés API hachées, clés fournisseurs côté serveur (noms seulement — valeurs jamais lues, INV-213/132)',
      'Scan des identifiants versionnés (motifs ghp_/github_pat_/sk-ant-/AKIA/…) — emplacements signalés, valeurs jamais journalisées',
      'Niveau d\u2019isolation sandbox rapporté honnêtement (process documenté plus faible vs docker durci INV-215)',
      'Chaque audit persiste un OpsSnapshot et scelle une preuve SECURITY (INV-231) — constats jamais mutés après coup',
      'Invariants de sécurité new : INV-229/230/231 ; API /api/yahria/security + panneau UI « Sécurité » — suite R14 : audit réel exécuté avec constats mesurés',
    ],
  },
  {
    code: '20',
    since: '2026-09-07',
    evidence: [
      'quality.ts (YAHRIA-KRN-036) — 6 gates IN PROCESS mesurées (invariants unicité ≥ 97, contrats outils S1, parité registre DB↔noyau, machines à états, logique apprentissage pure, chaîne de preuves)',
      '3 gates EXTERNES déclarées honnêtement (tsc/eslint/pytest) — exécutées par CI et scripts/quality-gates.mjs, jamais simulées in-process (INV-171)',
      'scripts/quality-gates.mjs — runner des gates externes avec échec honnête ; .github/workflows/ci.yml exécute tsc, lint, pytest, scan secrets, seuil invariants, build',
      'Chaque run persiste un OpsSnapshot QUALITY_GATES et scelle une preuve TEST (INV-232 : un gate qui échoue interdit toute déclaration DONE)',
      'Suite de preuves cumulées : r8 (suprématie), r12 (registre 22/22), r13 (agents/obs/politique 46/46), r14 (plateforme) — régression protégée (INV-172)',
    ],
  },
  {
    code: '21',
    since: '2026-09-07',
    evidence: [
      '.github/workflows/ci.yml — CI constitutionnelle : install verrouillé, tsc 0 erreur, eslint, pytest parité Python, scan d\u2019identifiants (INV-231), registre ≥ 97 invariants, build de production',
      'scripts/release.mjs — release gouvernée : semver monotone refusant downgrade (INV-190), working tree propre exigé (INV-180), CHANGELOG journalisé',
      'Livraison conteneurisée existante : Dockerfile app, docker-compose.yml (app + PostgreSQL), image sandbox durcie 12 toolchains (INV-215)',
      'scripts/db-provider.mjs — bascule sqlite ⇄ PostgreSQL prouvée jusqu\u2019à l\u2019API (R7.2) ; scripts/quality-gates.mjs — gates externes locales',
    ],
  },
  {
    code: '22',
    since: '2026-09-07',
    evidence: [
      'ops.ts (YAHRIA-KRN-037) — santé MESURÉE jamais supposée (INV-233) : liveness (pid/uptime/RSS), readiness avec sondes réelles (base lue, bus temps réel, sandbox backend, fabric LLM)',
      'SLO 24 h dérivé des faits enregistrés : invocations d\u2019outils (taux de succès, p50/p95), runs d\u2019agents (complétion), événements d\u2019échec — « — (aucun échantillon) » quand vide, jamais de faux vert',
      'API /api/yahria/ops + panneau UI « Opérations » ; runbook public/docs/OPERATIONS_RUNBOOK.md (procédures de diagnostic, incident, sauvegarde, escalade)',
      'Frontière honnête (INV-210) : pas d\u2019alerting externe ni de collecte multi-hôte sur l\u2019hôte de preuve — les métriques portent sur le système lui-même, mesurables et rejouables',
    ],
  },
  {
    code: '23',
    since: '2026-09-07',
    evidence: [
      'roadmap.ts (YAHRIA-KRN-038) — priorisation DÉRIVÉE du ledger (INV-234) : score déterministe (24−phase)×10 + 50 transverse + bonus statut, enrichi des statuts DB réels',
      'Horizons produits canoniques : MVP (phases 0-8) / ALPHA (9-13) / BETA (14-18) / ENTERPRISE (19-23) — mapping documenté et stable',
      'Top 8 prochaines priorités avec justification factuelle par domaine ; ledger d\u2019activation exposé avec dates et compteurs de preuves',
      'API /api/yahria/roadmap + panneau UI « Roadmap » — aucun champ éditable à la main : la roadmap est un calcul, pas une opinion',
    ],
  },
];

// Dependency graph — FORBIDDEN dependencies (DEPENDENCY_GRAPH.md §28)
export const FORBIDDEN_DEPENDENCIES: { from: string; to: string; reason: string }[] = [
  { from: 'Frontend', to: 'Database', reason: 'UI MUST NOT contain critical domain logic' },
  { from: 'Agent', to: 'Sandbox internals', reason: 'Agents consume sandbox contract only' },
  { from: 'Cognitive Core', to: 'specific LLM provider', reason: 'Model-agnostic reasoning interface' },
  { from: 'Memory', to: 'direct production mutation', reason: 'Memory is not automatic truth (INV-140)' },
  { from: 'Self-Evolution', to: 'direct production modification', reason: 'D.8 is governed by D.6.11' },
  { from: 'Tool', to: 'bypass Policy Engine', reason: 'REGISTERED ≠ AUTHORIZED (INV-062)' },
  { from: 'Sandbox', to: 'host trust', reason: 'Host protection (INV-050)' },
];

// Governance triptych
export const GOVERNANCE_PLANES = {
  D6: { name: 'D.6 — Truth & Governance', role: 'Establishes what is TRUE: observability, evidence, policy enforcement. GOVERNS D.8.' },
  D7: { name: 'D.7 — Memory & Learning', role: 'Transforms verified experience into memory and learning. MEMORY ≠ POLICY.' },
  D8: { name: 'D.8 — Self-Evolution', role: 'Proposes how to improve. NEVER self-modifies without D.6.11 approval.' },
};
