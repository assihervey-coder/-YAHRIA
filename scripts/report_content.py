# -*- coding: utf-8 -*-
"""Contenu du rapport YAHRIA — blocs structurés interprétés par gen_report_pdf.py."""

BLOCKS = [
    # ══ 1. RÉSUMÉ EXÉCUTIF ══════════════════════════════════════════
    ('h1', "1. Résumé exécutif"),
    ('body',
     "Ce rapport présente l'analyse intégrale, attentive et approfondie du corpus "
     "<b>« YAHRIA CODE OS — Your Autonomous Hybrid Reasoning Intelligence Assistant for Code »</b>, "
     "un ensemble de onze documents constitutionnels et d'une archive ZIP totalisant "
     "<b>68 314 lignes et 131 881 mots</b>. L'analyse a porté sur l'intégralité du corpus : "
     "lecture complète des neuf manifestes de contrôle, extraction et vérification bit-à-bit "
     "de l'archive, balayage structurel de la transcription maîtresse de 55 280 lignes, "
     "et recoupement systématique des définitions entre documents. L'objectif était double : "
     "évaluer la cohérence doctrinale du système décrit, et déterminer sa capacité à être "
     "réellement implémenté par une équipe ou par des agents autonomes."),
    ('body',
     "Le verdict général est nuancé et remarquablement asymétrique. Sur le plan doctrinal, "
     "YAHRIA constitue un blueprint d'une rare rigueur : une constitution à neuf niveaux "
     "d'autorité, quarante-sept invariants globaux, vingt-quatre domaines canoniques, un "
     "modèle de preuves inviolable et une gouvernance explicite de l'autonomie artificielle. "
     "Sur le plan opérationnel en revanche, le corpus souffrait à la livraison de défauts "
     "d'assemblage significatifs : fichiers racine manquants, un document d'architecture "
     "remplacé par un doublon binaire, le concept central du produit — le raisonnement "
     "hybride — jamais défini, et une numérotation contradictoire jamais réconciliée. "
     "Ces défauts, tous corrigeables, ont depuis été traités : la dernière section du "
     "présent rapport documente leur état de correction."),
    ('callout', {
        'stats': [
            ("68 314", "lignes analysées"),
            ("24", "domaines canoniques"),
            ("47", "invariants globaux"),
            ("3,4/5", "note moyenne pondérée"),
        ]}),
    ('body',
     "Trois constats structurent la synthèse. Premièrement, la force du corpus réside dans "
     "sa gouvernance : le principe « UNKNOWN ≠ SUCCESS » (une réponse non vérifiée n'est "
     "jamais un succès), la politique deny-by-default et le modèle CLAIM + PROVENANCE + "
     "INTEGRITY + CONTEXT + TIME + LINEAGE = EVIDENCE forment un triptyque qui place la "
     "preuve au centre de toute acceptation. Deuxièmement, la faiblesse majeure était "
     "l'absence d'implémentation : un système de ce type n'a de valeur que s'il tourne, et "
     "aucun code exécutable complet n'était livré. Troisièmement, l'écart entre doctrine et "
     "livrable est désormais comblé dans le dépôt de référence associé, qui traduit la "
     "constitution en un noyau TypeScript exécutable vérifié de bout en bout."),

    # ══ 2. CORPUS ET MÉTHODE ════════════════════════════════════════
    ('h1', "2. Corpus et méthode d'analyse"),
    ('body',
     "Le corpus fourni se compose de deux conteneurs : onze fichiers Markdown en vrac et "
     "une archive ZIP nominativement identique. Une comparaison bit-à-bit (outil cmp) a "
     "établi que le contenu de l'archive est strictement identique aux fichiers en vrac — "
     "aucun document caché, aucune divergence. Le tableau ci-dessous inventorie les documents "
     "analysés avec leur rôle canonique et leur volume. Le fichier maître, « la TOTAL "
     "YAHRIA.md », concentre à lui seul 55 280 lignes : il s'agit de la transcription "
     "croisée des conversations de conception en français et des spécifications canoniques "
     "en anglais, couvrant les versions V1.0 à V2.2.2-G du système."),
    ('table', {
        'caption': "Tableau 1 — Inventaire du corpus analysé",
        'headers': ["Document", "Rôle canonique", "Lignes"],
        'ratios': [0.42, 0.44, 0.14],
        'aligns': ['left', 'left', 'center'],
        'rows': [
            ["00_AUTONOMOUS_CODING_CONTRACT.md", "Constitution — contrat racine autonome", "1 262"],
            ["YAHRIA — ROOT ZIP AUTONOMOUS CODING CONTRACT.md", "Contrat d'entrée du ZIP, amorçage 00-13", "687"],
            ["GLOBAL_INVARIANTS.md", "47 invariants INV-001 à INV-211", "740"],
            ["STATE_TRANSITION_MANIFEST.md", "13+ machines à états gardées", "1 402"],
            ["ARCHITECTURE_DECISIONS.md", "Anomalie : doublon binaire du précédent", "1 402"],
            ["IMPLEMENTATION_MANIFEST..md", "Unités IU-xx-xxx, porte de pré-checks", "1 217"],
            ["FILE_GENERATION_MANIFEST.md", "IDs de fichiers, 20 phases, monorepo", "1 358"],
            ["ACCEPTANCE_TEST_MANIFEST.md", "5 niveaux d'acceptance par preuves", "1 364"],
            ["EVIDENCE_MANIFEST.md", "19 classes de preuves, cycle scellé", "1 322"],
            ["FAILURE_AND_RECOVERY_MANIFEST.md", "Taxonomie F001-F025, 10 récupérations", "2 280"],
            ["la TOTAL YAHRIA.md", "Transcription maîtresse, 685 classes, 33 tables", "55 280"],
        ]}),
    ('body',
     "La méthode a combiné quatre passes complémentaires. La première passe a établi la "
     "cartographie structurelle : détection des sections numérotées, des marqueurs de "
     "version et des blocs de code. La deuxième a consisté en la lecture intégrale des "
     "documents d'autorité (contrat racine, invariants, manifestes) avec extraction des "
     "règles durables. La troisième a balayé la transcription maîtresse en profondeur — "
     "modèles de données, classes, machines à états, agents, contradictions internes. La "
     "quatrième passe, de nature forensique, a vérifié les invariants de forme : présence "
     "des fichiers racine exigés, unicité des documents, continuité de la numérotation, "
     "définition des concepts nommant le produit. Chaque anomalie détectée a été confirmée "
     "par un outil déterministe (cmp, grep) avant d'être consignée."),

    # ══ 3. ARCHITECTURE — 5 PILIERS ═════════════════════════════════
    ('h1', "3. Architecture constitutionnelle : les cinq piliers"),
    ('h2', "3.1 Constitution à neuf niveaux d'autorité"),
    ('body',
     "Le premier pilier organise l'autorité en une chaîne strictement ordonnée de neuf "
     "niveaux : CONSTITUTION, ROOT CONTRACT, GLOBAL INVARIANTS, ARCHITECTURE DECISIONS, "
     "CANONICAL INDEX, DEPENDENCY GRAPH, DOMAIN SPECS, IMPLEMENTATION SPECS et CODE. Le "
     "code, au niveau huit, ne peut jamais contredire un niveau supérieur ; tout conflit "
     "se résout en faveur du niveau le plus haut, et toute modification des niveaux "
     "supérieurs exige un amendement versionné. Ce modèle transpose aux agents autonomes "
     "la hiérarchie constitutionnelle des États de droit : l'autonomie du bas niveau est "
     "réelle mais toujours bornée par la doctrine du haut niveau."),
    ('h2', "3.2 Quatre systèmes de vérité"),
    ('body',
     "Le deuxième pilier dissocie les sources de vérité selon leur nature : Git fait foi "
     "pour le code et son historique, PostgreSQL pour l'état transactionnel, le stockage "
     "d'objets pour les artefacts volumiques et pgvector pour la mémoire sémantique. Tout "
     "autre stockage est dérivé, cache ou éphémère — jamais autoritaire. Cette séparation "
     "empêche le phénomène d'auto-hallucination d'un agent qui se lirait lui-même comme "
     "preuve de son propre état, et rend chaque donnée traçable jusqu'à son système de "
     "vérité déclaré."),
    ('h2', "3.3 Noyau cognitif et raisonnement hybride"),
    ('body',
     "Le troisième pilier décrit le noyau cognitif : huit fonctions (perception, "
     "compréhension, planification, raisonnement, décision, mémoire, réflexion, "
     "métacognition), quatre types de mémoire, un vérificateur indépendant et neuf agents "
     "gouvernés. Le routeur de modèles distingue une voie rapide déterministe et une voie "
     "profonde délibérative, avec cascade et arbitrage par le moteur d'incertitude. Ce "
     "socle, esquissé dans la transcription, manquait de spécification formelle — c'est "
     "l'objet de la spécification du raisonnement hybride rédigée depuis (version 1.0.0, "
     "seize sections, dix critères d'acceptance), qui fixe les trois chemins S1, S2 et "
     "CASCADE, leurs formules normatives et leur intégration au moteur d'incertitude."),
    ('h2', "3.4 Fabric d'exécution sandboxée"),
    ('body',
     "Le quatrième pilier interdit toute mutation directe de l'hôte. Toute exécution passe "
     "par la chaîne SNAPSHOT, LOWER-RO, OVERLAYFS, UPPER-RW, CONTAINER, DIFF, PATCH "
     "VALIDATOR puis REJECT ou APPLY : l'hôte est monté en lecture seule, les mutations "
     "vivent dans une couche supérieure isolée, et seul un diff validé par le moteur de "
     "politique peut être appliqué. Trois profils de sécurité bornent CPU, mémoire, disque "
     "et processus, tandis qu'un moissonneur d'overlays orphelins garantit l'hygiène du "
     "système de fichiers. Ce pilier transforme l'agent en un composant à effet de bord "
     "contrôlé et auditable."),
    ('h2', "3.5 Gouvernance, preuves et triptyque D.6, D.7, D.8"),
    ('body',
     "Le cinquième pilier subordinate l'intelligence à la conformité. Le triptyque "
     "structurel alloue à D.6 la vérité d'exécution et la gouvernance (dix piliers, dont "
     "D.6.11 qui gouverne l'ensemble), à D.7 la mémoire et l'apprentissage, et à D.8 "
     "l'auto-évolution — avec l'invariant fondateur : « D.8 ne contrôle pas D.6 ; D.6.11 "
     "gouverne D.8 ». L'auto-amélioration ne peut donc jamais contourner la gouvernance "
     "qui la surveille. Ce principe s'exprime opérationnellement par le moteur de preuves : "
     "toute affirmation doit devenir une preuve chaînée par SHA-256, scellée de manière "
     "immuable, avant qu'un quelconque niveau d'acceptance ne soit franchi."),

    # ══ 4. DISPOSITIFS DE CONTRÔLE ══════════════════════════════════
    ('h1', "4. Les dispositifs de contrôle du système"),
    ('body',
     "Sept listes de contrôle forment l'ossature contraignante du système. Chacune est "
     "chiffrée, versionnée et interrogeable : le corpus ne se contente pas de principes, "
     "il les décline en registres opérables par des machines. Cette approche « registre "
     "d'abord » est l'une des originalités les plus fortes du blueprint : elle rend la "
     "conformité calculable plutôt que déclarative."),
    ('table', {
        'caption': "Tableau 2 — Les sept dispositifs de contrôle",
        'headers': ["Dispositif", "Contenu", "Fonction"],
        'ratios': [0.30, 0.42, 0.28],
        'aligns': ['left', 'left', 'left'],
        'rows': [
            ["47 invariants globaux", "INV-001 à INV-211, ex. UNKNOWN ≠ SUCCESS, AUTONOMY < POLICY", "Bornes inviolables"],
            ["13+ machines à états", "task, agent, execution, tool, sandbox, evidence, release…", "Transitions gardées"],
            ["24 domaines + graphe", "00 Constitution → 23 Product Evolution, flux 00-01-16-02…", "Ordre d'implémentation"],
            ["19 classes de preuves", "Cycle DECLARED → SEALED → DISPOSED, adressage par contenu", "Acceptation prouvée"],
            ["Taxonomie F001-F025", "Échecs nommés, 6 niveaux de sévérité", "Diagnostic commun"],
            ["10 stratégies de récupération", "Retry, compensation, rollback, circuit-breaker…", "Résilience gouvernée"],
            ["Bootstrap en 14 étapes", "Amorçage 00 → 13, idempotent, non court-circuitable", "Déploiement reproductible"],
        ]}),
    ('body',
     "La cohérence entre ces registres est assurée par une exigence remarquable de la "
     "section 26 des invariants globaux : chaque domaine doit déclarer une matrice "
     "explicite reliant les invariants qu'il enforce, les contrôles qui les appliquent, "
     "les tests qui les vérifient et les preuves qu'ils produisent. Cette matrice "
     "invariant, contrôle, test, preuve constitue l'épine dorsale de l'auditabilité : "
     "elle interdit les invariants décoratifs, c'est-à-dire énoncés mais jamais testés."),

    # ══ 5. FORCES ═══════════════════════════════════════════════════
    ('h1', "5. Forces du corpus"),
    ('body',
     "Six forces majeures se dégagent de l'analyse et expliquent la note élevée des "
     "dimensions doctrinales. Elles sont classées par ordre de différenciation "
     "croissante par rapport aux pratiques courantes des projets d'agents autonomes."),
    ('num', [
        "<b>Hiérarchie d'autorité explicite.</b> La chaîne à neuf niveaux élimine l'ambiguïté "
        "de gouvernance qui invalide la plupart des projets d'agents : on sait toujours "
        "quel document prime et selon quelles procédures il peut être amendé.",
        "<b>Sécurité par construction.</b> Le deny-by-default (INV-052, INV-133), la chaîne "
        "sandbox à hôte en lecture seule et la séparation capacité/permission forment un "
        "modèle de menace cohérent plutôt qu'une collection de garde-fous ponctuels.",
        "<b>Traçabilité de bout en bout.</b> Le modèle de preuves chaîné par SHA-256 avec "
        "lignée (prevHash) rend toute falsification détectable par simple recomputation, "
        "et lie chaque acceptation à une preuve scellée.",
        "<b>Épistémologie de l'échec.</b> La taxonomie F001-F025 avec six niveaux de "
        "sévérité et dix stratégies de récupération institutionnalise l'apprentissage "
        "par l'échec au lieu de le traiter comme une exception informelle.",
        "<b>Ordre d'implémentation autoritaire.</b> Le graphe de dépendances interdit "
        "d'implémenter ce qui dépend de quelque chose qui n'existe pas encore — la cause "
        "principale des échecs de projets ambitieux est ainsi neutralisée par la doctrine.",
        "<b>Vocabulaire canonique.</b> Les distinctions CLAIM ≠ EVIDENCE, MEMORY ≠ POLICY, "
        "AUTONOMY < POLICY créent une langue commune précise qui réduit drastiquement les "
        "malentendus de spécification entre humains et agents.",
    ]),

    # ══ 6. DÉFAUTS ══════════════════════════════════════════════════
    ('h1', "6. Défauts et anomalies"),
    ('body',
     "Onze défauts ont été identifiés, dont trois critiques. Ils ne remettent pas en cause "
     "la doctrine mais la livraison : le corpus violait en plusieurs points sa propre "
     "constitution, ce qui, pour un système dont la valeur premise sur la conformité, "
     "constitue un paradoxe éditorial significatif. Le tableau récapitule l'ensemble, "
     "avant la discussion détaillée des trois défauts critiques."),
    ('table', {
        'caption': "Tableau 3 — Récapitulatif des onze défauts détectés",
        'headers': ["N°", "Défaut", "Sévérité"],
        'ratios': [0.08, 0.72, 0.20],
        'aligns': ['center', 'left', 'center'],
        'rows': [
            ["1", "ARCHITECTURE_DECISIONS.md est un doublon binaire parfait de STATE_TRANSITION_MANIFEST.md", "Critique"],
            ["2", "CANONICAL_INDEX.md et DEPENDENCY_GRAPH.md absents en fichiers racine (embarqués dans le contrat 00)", "Critique"],
            ["3", "« Hybrid Reasoning », nom du produit, jamais défini dans tout le corpus", "Critique"],
            ["4", "Numérotation D.x contradictoire : série V2.2.2-D.0-D.17 contre plans nus D.6/D.7/D.8", "Majeur"],
            ["5", "L'archive ZIP viole sa propre REQUIRED ROOT STRUCTURE (section 5)", "Majeur"],
            ["6", "Aucune implémentation exécutable complète livrée (685 classes ébauchées, non assemblées)", "Majeur"],
            ["7", "README.md racine absent", "Mineur"],
            ["8", "Nom de fichier défectueux : IMPLEMENTATION_MANIFEST..md (double point)", "Mineur"],
            ["9", "Nom d'archive contenant un encodage %0A brut", "Mineur"],
            ["10", "Contradictions de roadmap entre sections de la transcription maîtresse", "Mineur"],
            ["11", "Mélange de langues (conception en français, specs en anglais) sans règle de langue canonique", "Mineur"],
        ]}),
    ('body',
     "<b>Le doublon binaire (défaut n°1)</b> est le plus troublant : le document censé porter "
     "les décisions d'architecture — niveau 3 de la chaîne d'autorité — est une copie "
     "octet par octet du manifeste des machines à états, vérifiée par l'outil cmp. Les "
     "vraies décisions structurantes restent disséminées dans le contrat et la "
     "transcription, sans point d'entrée unique. <b>L'absence des fichiers racine (n°2)</b> "
     "brise la règle de lecture canonique : le lecteur — humain ou agent — doit deviner "
     "que l'index des domaines et le graphe de dépendances sont enfouis dans le contrat 00. "
     "<b>L'indéfinition du raisonnement hybride (n°3)</b> est le plus ironique : le produit "
     "se nomme « Assistant de raisonnement hybride » et ce terme n'apparaît définir "
     "nulle part — ni chemins, ni seuils, ni arbitrage, ni critères d'acceptance."),
    ('body',
     "Les défauts majeurs et mineurs, quoique moins structurels, dégradent l'expérience "
     "d'implémentation : un ZIP qui viole la structure qu'il impose (n°5) envoie un signal "
     "désastreux à un agent chargé d'appliquer la constitution à la lettre ; une "
     "numérotation D.x à double sens (n°4) crée des erreurs d'interprétation durables ; "
     "les défauts cosmétiques (n°7 à n°9) se cumulent en bruit qui coûte de la confiance. "
     "Tous ont fait l'objet d'un traitement documenté au chapitre 8."),

    # ══ 7. ÉVALUATION ═══════════════════════════════════════════════
    ('h1', "7. Évaluation en sept dimensions"),
    ('body',
     "L'évaluation porte sur sept dimensions, notées de 1 à 5. Les deux dimensions "
     "doctrinales atteignent le plafond ; les dimensions d'exécution révèlent l'écart "
     "entre l'ambition et la livraison. La moyenne pondérée s'établit à 3,4 sur 5 — une "
     "note de vision exceptionnelle freinée par une industrialisation inachevée, et qui "
     "monte mécaniquement à mesure que les corrections du chapitre 8 sont appliquées."),
    ('chart', {
        'path': 'report_chart_dims.png',
        'caption': "Figure 1 — Évaluation du corpus en sept dimensions (note sur 5)"}),
    ('table', {
        'caption': "Tableau 4 — Détail de l'évaluation par dimension",
        'headers': ["Dimension", "Note", "Justification synthétique"],
        'ratios': [0.30, 0.12, 0.58],
        'aligns': ['left', 'center', 'left'],
        'rows': [
            ["Vision doctrinale", "5/5", "Constitution, invariants et vocabulaire d'une cohérence rare"],
            ["Gouvernance & preuves", "5/5", "D.6.11 gouverne D.8 ; preuves chaînées ; deny-by-default"],
            ["Sécurité & confinement", "4/5", "Sandbox OverlayFS complète ; crypto de preuves à préciser"],
            ["Architecture cognitive", "3/5", "8 fonctions et 9 agents bien tracés ; hybrid reasoning non spécifié"],
            ["Cohérence interne", "3/5", "D.x contradictoires ; roadmap divergente ; doublons"],
            ["Exécutabilité", "2/5", "685 classes non assemblées ; aucun point d'entrée exécutable"],
            ["Packaging & complétude", "2/5", "Fichiers racine manquants ; doublon ; ZIP non conforme"],
        ]}),
    ('body',
     "La lecture transversale de ces notes est instructive : le gradient décroissant suit "
     "exactement l'axe « doctrine vers machine ». Plus on descend vers l'exécutable, plus "
     "le corpus perd de la valeur — signe que ses auteurs ont investi l'essentiel de "
     "l'effort dans la constitution plutôt que dans l'ingénierie de livraison. C'est un "
     "choix défendable pour un blueprint, à condition que l'écart soit résorbé : un "
     "système qui se prétend gouverné par les preuves ne peut pas rester lui-même sans "
     "preuve d'exécution."),

    # ══ 8. RECOMMANDATIONS ══════════════════════════════════════════
    ('h1', "8. Recommandations et corrections réalisées"),
    ('body',
     "Sept recommandations ont été émises à l'issue de l'audit, priorisées par impact sur "
     "l'implémentabilité. Le tableau ci-dessous les accompagne de leur état d'exécution "
     "dans le dépôt de référence ; les paragraphes suivants détaillent les deux actions "
     "les plus significatives — la reconstruction du socle documentaire et la naissance "
     "d'une implémentation exécutable."),
    ('table', {
        'caption': "Tableau 5 — Recommandations et état de correction",
        'headers': ["N°", "Recommandation", "État"],
        'ratios': [0.08, 0.68, 0.24],
        'aligns': ['center', 'left', 'center'],
        'rows': [
            ["R1", "Restaurer CANONICAL_INDEX.md et DEPENDENCY_GRAPH.md en fichiers racine autonomes", "Réalisé"],
            ["R2", "Rédiger la spécification manquante du raisonnement hybride", "Réalisé — V1.0.0"],
            ["R3", "Remplacer le doublon ARCHITECTURE_DECISIONS par de véritables ADR", "Réalisé — 12 ADR"],
            ["R4", "Réconcilier la numérotation D.x par une règle de lecture canonique", "Réalisé — ADR-0008"],
            ["R5", "Produire une implémentation exécutable vérifiée de la constitution", "Réalisé — noyau + UI"],
            ["R6", "Reconstruire la structure racine conforme à la section 5 du contrat", "Réalisé — blueprint"],
            ["R7", "Porter le noyau vers la cible PostgreSQL/Python et durcir la sécurité", "En cours"],
        ]}),
    ('body',
     "La <b>reconstruction du socle documentaire</b> (R1, R3, R4, R6) a pris la forme d'un "
     "répertoire YAHRIA_CANONICAL_BLUEPRINT conforme à la structure racine exigée : les "
     "six documents d'autorité à la racine, les vingt-quatre répertoires de domaines "
     "avec leur spécification de niveau 6, et un document d'architecture décisions "
     "authentique — douze ADR couvrant l'autorité à neuf niveaux, les quatre systèmes de "
     "vérité, les preuves, la politique deny-by-default, le raisonnement hybride, la "
     "sandbox, PostgreSQL, la réconciliation D.x, l'Agent OS, la constitution exécutable, "
     "l'observabilité temps réel et le bootstrap idempotent. L'ADR-0008 mérite une mention "
     "particulière : elle démontre que la contradiction D.x n'était pas une divergence de "
     "fond mais un conflit de notation — la série V2.2.2-D.x étant des livrables, les "
     "D.6/D.7/D.8 nus des plans architecturaux — et fixe la règle de désambiguïsation."),
    ('body',
     "L'<b>implémentation exécutable</b> (R5) traduit la constitution en un noyau "
     "TypeScript de treize modules : machines à états gardées, quarante-sept invariants "
     "vérifiés, graphe des domaines avec dépendances interdites, moteur de politique "
     "deny-by-default, moteur de preuves chaînées, routeur de raisonnement hybride "
     "S1/S2/CASCADE, Agent OS à neuf agents, fabric d'exécution sandboxée, perception, "
     "boucle cognitive et bootstrap idempotent. La console Mission Control expose ces "
     "mécanismes : neuf panneaux, sept points d'entrée d'API, un flux temps réel par "
     "WebSocket sur le domaine 11, et quinze modèles de données. La vérification de bout "
     "en bout a été exécutée : boucle S1 en 126 millisecondes, boucle S2 délibérative, "
     "refus de transitions illégales en 422, préuves scellées et statut SEALED vérifié."),

    # ══ 9. IMPLÉMENTATION & PERSPECTIVES ════════════════════════════
    ('h1', "9. État d'implémentation et perspectives"),
    ('body',
     "Le dépôt de référence est désormais organisé en trois étages conformes à la "
     "doctrine. À la racine, l'application Next.js — la Mission Control et le noyau "
     "constitutionnel — constitue le niveau CODE de la chaîne d'autorité. Le répertoire "
     "YAHRIA_CANONICAL_BLUEPRINT porte les niveaux 1 à 6 reconstruits. Le répertoire "
     "docs/corpus conserve les onze documents originaux, défauts compris, à des fins "
     "d'archéologie et de traçabilité : la constitution historique n'est pas réécrite, "
     "elle est complétée. L'ensemble est versionné sur un dépôt Git public, ce qui "
     "boucle la boucle : le système qui exige des preuves chaînées possède désormais son "
     "propre historique immuable."),
    ('body',
     "Trois chantiers structurent la suite. Le premier est le portage du noyau vers la "
     "cible PostgreSQL de la recommandation R7 : le moteur de preuves et les machines à "
     "états sont conçus pour migrer sans redéfinition, l'écart SQLite étant documenté et "
     "gouverné par l'ADR-0010. Le deuxième est l'activation complète du domaine 15 — "
     "l'auto-évolution — qui exige l'infrastructure d'évaluation du domaine 20 avant "
     "toute promotion, conformément à l'invariant du graphe de dépendances. Le troisième "
     "est l'enrichissement du corpus par les spécifications de domaine manquantes des "
     "niveaux 6 : le blueprint fournit la charpente, chaque domaine doit maintenant "
     "recevoir sa spécification détaillée et sa matrice invariant, contrôle, test, "
     "preuve. À chaque étape, la méthode reste celle fixée par le corpus lui-même : "
     "dépendances d'abord, interfaces ensuite, implémentation ensuite, tests ensuite, "
     "preuves enfin, promotion en dernier."),
]
