# YAHRIA — ARCHITECTURE DECISIONS (ADR)

> **Fichier reconstruit** — l'original était un doublon binaire défectueux de
> `STATE_TRANSITION_MANIFEST.md` (anomalie détectée lors de l'audit du corpus :
> 0 octet de différence, vérifié par `cmp`). Les vraies décisions
> d'architecture étaient absentes du corpus ; elles sont ici rédigées,
> dérivées fidèlement de la constitution, du contrat racine et de la
> transcription maîtresse (`la TOTAL YAHRIA.md`, V1.0 → V2.2.2-G).

Document ID: YAHRIA-ROOT-004
Status: CANONICAL
Authority: ARCHITECTURE DECISIONS (LEVEL 3 de la chaîne d'autorité)
Version: 1.0.0

Format : chaque ADR suit le canon — Statut / Contexte / Décision / Conséquences /
Alternatives rejetées / Invariants liés / Preuves requises.

---

## ADR-0001 — Autorité constitutionnelle à 9 niveaux

**Statut :** Accepté
**Contexte :** Un agent de codage autonome qui se lit lui-même comme seule
autorité finit par violer les principes qu'il est censé servir. Le corpus
exigeait une hiérarchie inviolable entre doctrine et code.
**Décision :** Toute l'architecture s'organise en une chaîne d'autorité
strictement ordonnée : `CONSTITUTION (L0) → ROOT CONTRACT (L1) → GLOBAL
INVARIANTS (L2) → ARCHITECTURE DECISIONS (L3) → CANONICAL INDEX (L4) →
DEPENDENCY GRAPH (L5) → DOMAIN SPECS (L6) → IMPLEMENTATION SPECS (L7) → CODE
(L8)`. Le code (L8) ne peut jamais contredire un niveau supérieur ; un
conflit se résout toujours en faveur du niveau le plus haut.
**Conséquences :** Chaque modification de haut niveau exige un amendement
versionné ; le bas niveau (code) est libre dans les limites du haut niveau.
**Alternatives rejetées :** Gouvernance par revue de code ad hoc (non
déterministe) ; conventions documentaires sans mécanisme d'autorité.
**Invariants liés :** INV-001 (UNKNOWN ≠ SUCCESS), INV-005 (constitution
prioritaire), INV-120 (précédence de politique).
**Preuves requises :** Classe `EVIDENCE-GOVERNANCE` — toute promotion de code
référence le niveau constitutionnel qu'il implémente.

## ADR-0002 — Quatre systèmes de vérité

**Statut :** Accepté
**Contexte :** Un agent autonome sans référentiel de vérité hallucine son
propre état. Il fallait des sources de vérité disjointes, chacune spécialisée.
**Décision :** Le système repose sur exactement quatre systèmes de vérité :
**Git** (code et historique), **PostgreSQL** (état transactionnel), **Object
Storage** (artefacts volumiques), **pgvector** (mémoire sémantique). Tout
autre stockage est dérivé, cache ou éphémère — jamais autoritaire.
**Conséquences :** Toute donnée doit déclarer son système de vérité ; les
duplications inter-systèmes doivent être réconciliables.
**Alternatives rejetées :** Stockage unique polyglotte (couplage) ; fichiers
plats comme vérité (non transactionnel).
**Invariants liés :** INV-030 (persistence déclarée), INV-033 (immutabilité
des preuves scellées).
**Preuves requises :** Classes `EVIDENCE-DATA`, `EVIDENCE-ARTIFACT`.

## ADR-0003 — Acceptance par preuves vérifiables

**Statut :** Accepté
**Contexte :** « A test exists to validate a claim » — un succès non prouvé
n'existe pas. Le corpus définissait 19 classes de preuves mais aucun modèle
d'acceptance sans elles.
**Décision :** Toute acceptation exige une preuve conforme au modèle :
`CLAIM + PROVENANCE + INTEGRITY + CONTEXT + TIME + LINEAGE = EVIDENCE
VÉRIFIABLE`. L'intégrité est garantie par SHA-256 et un chaînage
`prevHash` rendant l'historique inviolable ; le cycle de vie est
`DECLARED → … → SEALED (immuable) → … → DISPOSED`. Les IDs suivent
`EV-{CAT}-{DOMAIN}-{SEQ}`.
**Conséquences :** Un livrable sans preuve scellée ne peut franchir aucun
niveau d'acceptance ; la falsification devient détectable par recomputation
du hash (INV-110).
**Alternatives rejetées :** Auto-attestation de l'agent (cercle de confiance
clos) ; journalisation ordinaire (altérable).
**Invariants liés :** INV-033, INV-110 (intégrité recomputable).
**Preuves requises :** La preuve EST le livrable de cette ADR.

## ADR-0004 — Plan de politique transversal, deny-by-default

**Statut :** Accepté
**Contexte :** L'autonomie sans borne est une faille de sécurité. Le corpus
exige qu'aucune capacité n'existe sans politique explicite.
**Décision :** Le Policy Control Plane (domaine 12) est **transversal** :
toute action d'agent, d'outil, de modèle ou d'évolution passe une évaluation
`evaluatePolicy(request) → ALLOW | DENY`. L'effet par défaut en l'absence de
règle appariée est **DENY** (INV-052, INV-133) ; les règles seed
(POL-001…) sont versionnées et précédencées ; la politique prime sur
l'autonomie (`AUTONOMY < POLICY`).
**Conséquences :** Le système est sûr par construction, verbeux par
nécessité : chaque capacité requiert une règle explicite.
**Alternatives rejetées :** Allow-by-default (surface d'attaque) ;
politiques implicites dans le code (non auditable).
**Invariants liés :** INV-052, INV-120, INV-133.
**Preuves requises :** Classe `EVIDENCE-POLICY` — chaque décision est
journalisée avec règle, effet et raison.

## ADR-0005 — Raisonnement hybride à double voie (S1/S2/CASCADE)

**Statut :** Accepté
**Contexte :** « Hybrid Reasoning » est le nom du produit mais aucune
spécification n'existait dans le corpus (anomalie n°4 de l'audit). Le
système devait concilier latence déterministe et profondeur délibérative.
**Décision :** Un routeur hybride à trois chemins : **System 1** (voie
rapide, déterministe, gabarits et règles — millisecondes), **System 2**
(voie profonde, modèle LLM délibératif — secondes, fallback explicite si le
backend est indisponible), **CASCADE** (S1 d'abord ; escalade vers S2 si
l'incertitude résiduelle dépasse le seuil, avec vérification d'accord
S1/S2). L'arbitrage passe par le moteur d'incertitude (INV-081) ; un
verdict non soutenu par vérification demeure `UNKNOWN ≠ SUCCESS`.
Spécification canonique : `public/docs/HYBRID_REASONING_SPECIFICATION.md`
(V1.0.0, 16 sections).
**Conséquences :** Le coût de raisonnement est proportionnel à la
difficulté ; la traçabilité exige de journaliser chemin, signaux et
incertitude de chaque décision.
**Alternatives rejetées :** LLM seul (latence et non-déterminisme partout) ;
règles seules (plafond de compétence).
**Invariants liés :** INV-001, INV-080 (la sortie de modèle n'est pas un
fait), INV-081 (moteur d'incertitude).
**Preuves requises :** Classe `EVIDENCE-REASONING` — route, signaux,
verdicts S1/S2, accord, latences.

## ADR-0006 — Sandbox OverlayFS chaîné, hôte en lecture seule

**Statut :** Accepté
**Contexte :** L'exécution d'agents sur l'hôte est inacceptable. Le corpus
définissait une chaîne sandbox précise sans décision formelle associée.
**Décision :** Toute exécution passe par la chaîne obligatoire
`SNAPSHOT → LOWER-RO → OVERLAYFS → UPPER-RW → CONTAINER → DIFF → PATCH
VALIDATOR → REJECT/APPLY`. L'hôte est monté en lecture seule (LOWER-RO) ;
les mutations vivent dans l'upper layer ; seul un diff validé par le
Policy Engine peut être appliqué. Trois profils de sécurité (lecture,
exécution bornée, écriture contrôlée) bornent CPU/mémoire/disque/PID ;
`OrphanOverlayReaper` garbage-collecte les overlays orphelins.
**Conséquences :** Aucune mutation directe de l'hôte ; le coût d'une
exécution inclut snapshot + diff + validation.
**Alternatives rejetées :** Exécution directe conteneurisée sans overlay
(perte du diff auditable) ; VM lourde par tâche (coût prohibitif).
**Invariants liés :** INV-042 (exécutions bornées), INV-055 (hôte RO),
INV-060 (validation de patch).
**Preuves requises :** Classes `EVIDENCE-SANDBOX`, `EVIDENCE-EXECUTION`,
`EVIDENCE-DIFF`.

## ADR-0007 — PostgreSQL comme source de vérité étatique unique

**Statut :** Accepté
**Contexte :** 33+ tables, 13+ machines à états et l'isolation multi-tenant
exigeaient un socle transactionnel industriel.
**Décision :** PostgreSQL est la vérité étatique unique : SQLAlchemy 2.x
typé, migrations Alembic, RLS par `tenant_id`, UUIDv7 comme clés
temporellement ordonnables, JSONB pour payloads flexibles, partitionnement
des tables volumiques, enums PostgreSQL verrouillés par migration (série
V2.2.2-D.2).
**Conséquences :** Le schéma est une autorité versionnée ; tout enum ou
table nouveau exige une migration et un amendement de spec.
**Alternatives rejetées :** NoSQL premier (transactions faibles) ; schéma
non contraint (dérive).
**Invariants liés :** INV-030, INV-045 (isolation tenant), INV-091
(intégrité des dépendances).
**Preuves requises :** Classe `EVIDENCE-DATA` — migrations et contraintes
sont des preuves.

## ADR-0008 — Réconciliation de la numérotation D.x

**Statut :** Accepté
**Contexte :** L'audit a révélé deux namespaces « D.x » contradictoires
dans le corpus, jamais réconciliés — source de confusion pour tout lecteur
(et pour tout agent qui lirait la constitution).
**Décision :** Les deux numérotations sont **deux namespaces distincts et
légitimes**, régis par une règle de lecture :

1. **Série de livraison `V2.2.2-D.0 → D.17`** (préfixée par la version) —
   incréments d'implémentation de la pile Execution Fabric :

   | Incrément | Contenu | Statut corpus |
   |---|---|---|
   | D.0 | EXECUTION DOMAIN CONTRACTS | défini |
   | D.1 | Modèle PostgreSQL + SQLAlchemy 2.x (~50 tables) | défini |
   | D.2 | Migration Alembic initiale + DDL complet (enums, partitions) | défini |
   | D.3 | Tool Registry & Executor (Registry/Executor/Context/Policy/Validator) | défini |
   | D.4 | Sandbox Engine | défini |
   | D.5 | Integration Tests | défini |
   | D.6 | Observabilité & Evidence Engine — « Execution Truth, Evidence & Governance » (10 piliers D.6.1–D.6.11) | défini |
   | D.7 | Mémoire & Apprentissage (transformation de la vérité d'exécution en capacité d'apprentissage) | défini |
   | D.8 | Self-Evolution & Meta-Intelligence Plane | défini |
   | D.9–D.17 | Extensions ultérieures | mentionnés (D.2→D.16 « pourront être implémentés »), jamais définis |

2. **Plans architecturaux `D.6 / D.7 / D.8`** (utilisés sans préfixe) —
   triptyque structurel de l'intelligence d'exécution :
   `D.6 = vérité/gouvernance → D.7 = mémoire/apprentissage → D.8 =
   évolution contrôlée`, avec l'invariant structurel
   **« D.8 ne contrôle pas D.6 ; D.6.11 (gouvernance) gouverne D.8 »** —
   l'auto-amélioration ne peut jamais contourner la gouvernance.

   La cohérence profonde du corpus est réelle : les plans architecturaux
   D.6/D.7/D.8 correspondent exactement aux incréments de livraison D.6,
   D.7 et D.8. L'anomalie n'était donc pas une contradiction de fond mais
   un conflit de notation.

**Règle canonique retenue :** un D.x préfixé par une version (`V2.2.2-D.x`)
est un **livrable** ; un D.x nu parmi {D.6, D.7, D.8} est un **plan
architectural** ; tout autre D.x nu est proscrit. Tout nouveau namespace
exige un amendement architecturé versionné (ADR).
**Conséquences :** Les lecteurs humains et agents disposent d'une règle de
désambiguïsation déterministe ; la chaîne de gouvernance D.6>D.8 est
préservée sans réécriture du corpus.
**Alternatives rejetées :** Renuméroter un des deux namespaces (perte de
traçabilité avec le corpus historique) ; ignorer le conflit (ambiguïté
durable).
**Invariants liés :** INV-005 (constitution prioritaire), INV-073
(l'évolution est soumise à gouvernance).
**Preuves requises :** Classe `EVIDENCE-GOVERNANCE` — cette ADR est la
preuve de la réconciliation.

## ADR-0009 — Agent OS à 9 agents, capacité ≠ permission

**Statut :** Accepté
**Contexte :** Les agents du corpus (Orchestrator, Planner, Coder,
Verifier, Reviewer, Governor, Memory, Sandbox, Evolution) avaient des rôles
mais aucune frontière formelle de pouvoir.
**Décision :** Chaque agent possède une identité, un cycle de vie et des
**capacités** déclarées ; détenir une capacité n'accorde pas la permission
de l'exercer — chaque usage passe la porte de capacité
(`checkCapability`) puis le Policy Engine. L'agent Evolution (D.8) a ses
sorties systématiquement soumises à la gouvernance (D.6).
**Conséquences :** Un agent compromis reste confiné ; l'audit peut
reconstituer qui a demandé quoi, avec quelle règle.
**Alternatives rejetées :** Agents tout-puissants avec rotation de clés ;
micro-agents sans état (perte de mémoire procédurale).
**Invariants liés :** INV-020 (identité d'agent), INV-052, INV-073.
**Preuves requises :** Classes `EVIDENCE-AGENT`, `EVIDENCE-POLICY`.

## ADR-0010 — Constitution exécutable : implémentation de référence TypeScript

**Statut :** Accepté
**Contexte :** Le corpus spécifiait le noyau en Python (SQLAlchemy,
Alembic, Ollama) mais aucun code exécutable complet n'était livré. Il
fallait une implémentation de référence vérifiable de bout en bout.
**Décision :** L'implémentation de référence de ce dépôt traduit la
constitution en **TypeScript exécutable** (Next.js 16, Prisma, 13 modules
noyau dans `src/lib/yahria/`), avec la Mission Control comme console de
gouvernance. Écarts assumés et gouvernés : **SQLite (via Prisma) en
remplacement de PostgreSQL** pour l'exécution sandboxée locale
(l'invariant porté — intégrité, machines à états, preuves chaînées — est
préservé ; la cible PostgreSQL reste la vérité de production selon
ADR-0007), et le backend LLM passe par le SDK disponible avec **fallback
explicite** (ADR-0005).
**Conséquences :** La constitution devient testable ; chaque écart est
documenté plutôt que dissimulé.
**Alternatives rejetées :** Attendre le portage Python complet (aucune
boucle de vérification réelle) ; réécrire le corpus (perte d'autorité).
**Invariants liés :** INV-001, INV-110, INV-120.
**Preuves requises :** Le dépôt lui-même + tests + preuves scellées dans
Mission Control.

## ADR-0011 — Observabilité temps réel par WebSocket constitutionnel

**Statut :** Accepté (décision de ce dépôt)
**Contexte :** Le domaine 11 spécifie structured events, traces et audit,
mais la Mission Control ne rafraîchissait l'état que par polling manuel —
contradiction pratique avec « Execution Truth » en continu.
**Décision :** Le domaine 11 expose un flux temps réel **`/ws/yahria`**
(serveur personnalisé `server.mjs`, même process Node que Next.js) : un
bus d'événements constitutionnels (`src/lib/yahria/realtime.ts`) fan-out
vers tous les clients WebSocket ; les routes API émettent les événements
canoniques (boucle cognitive démarrée/terminée/échouée, tâches créées et
transitions gardées, preuves capturées/vérifiées/scellées/corrompues,
décisions de politique). Le client Mission Control (hook
`useYahriaRealtime`) maintient reconnexion exponentielle, snapshot des 200
derniers événements et compteurs par type. Handshake canonique :
`hello → snapshot → events`.
**Conséquences :** La vérité d'exécution est observable à la seconde ;
chaque événement reste également persisté (la diffusion ne remplace pas
les preuves).
**Alternatives rejetées :** Polling (latence + charge) ; SSE unidirectionnel
(pas de ping/pong d'agent) ; broker externe (dépendance supplémentaire).
**Invariants liés :** INV-070 (traçabilité continue), INV-110.
**Preuves requises :** Classe `EVIDENCE-EVENT` — le flux est lui-même
journalisé ; test de bout en bout `scripts/ws-test.mjs`.

## ADR-0012 — Bootstrap idempotent en 14 étapes et amorçage gouverné

**Statut :** Accepté
**Contexte :** Le ROOT ZIP CONTRACT impose une séquence d'amorçage
`00 → 13` (14 étapes) qui ne souffre aucun oubli ; le système doit
s'auto-installer sans jamais violer l'ordre des dépendances.
**Décision :** Le bootstrap est **idempotent** : chaque étape vérifie son
prérequis, s'exécute, et capture une preuve ; relancer le bootstrap sur un
système amorcé est un no-op sûr. L'ordre suit le DEPENDENCY_GRAPH :
constitution → invariants → domaines → politiques → agents → preuves →
tâches. Aucune étape ne peut être sautée ni réordonnée sans amendement.
**Conséquences :** Déploiements reproductibles ; le désamorçage partiel est
détectable par recomputation de la séquence.
**Alternatives rejetées :** Installation impérative à la main
(non reproductible) ; bootstrap paresseux par domaine (ordre non garanti).
**Invariants liés :** INV-005, INV-091, INV-120.
**Preuves requises :** Classe `EVIDENCE-GOVERNANCE` — une preuve par étape
d'amorçage.
