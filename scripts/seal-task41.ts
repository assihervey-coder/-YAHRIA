// ═══════════════════════════════════════════════════════════════════
// YAHRIA — TASK 41 : scellé des preuves de diagnostic post-it.12
// (1) reproduction vivante RUN-000051 — divergence de contrat inter-co-générés
//     + réparations tuées par circuit OPEN ;
// (2) reproduction vivante RUN-000052 — mismatch latent PesaPal vs
//     PesaPalGateway exposé par la réparation ; scellé payload tronqué 600 car. ;
// (3) dossier fabric transverse — 19/29 runs INFRA (65 %) depuis it.10,
//     charge harnais ~55-57 appels/run en ~3 min.
// ═══════════════════════════════════════════════════════════════════
import { captureAndPersist } from '../src/lib/yahria/evidence-store.ts';

const TRACE = 'TRACE-TASK41-DIAG-IT12';

const results: string[] = [];

// ── Preuve 1 : RUN-000051 (slot 1 it.12) ─────────────────────────────
const r1 = await captureAndPersist({
  category: 'FORENSIC', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'super-z-task41',
  claim: 'Reproduction vivante workspace RUN-000051 : pytest 5 failed — divergence de contrat INTER-CO-GÉNÉRÉS prouvée : (1) test_health attend la clé « name », main.py renvoie « service » ; (2) tests postent /webhook/NotchPay et /webhook/PesaPal (singulier), main.py définit /webhooks/{gateway} (pluriel) → 404 ; (3) test_get_gateways ValidationError pydantic ; (4) test_initiate_payment 500≠201 — le contrat test↔implémentation est invisible au contrat de réparation DANS LES DEUX SENS : main.py n\'importe pas tests/test_api.py (fermeture EVO-000031 inapplicable) et extractPythonContracts capture les SIGNATURES des tests (def test_health()) sans les assertions (routes, clés de réponse) ; les réparations du cycle BEHAVIORAL (config.py, main.py, tests/test_api.py) n\'ont JAMAIS invoqué le LLM — preuves EV-INCIDENT-000730/000734/000735 « LLM fabric exhausted — zai:circuit OPEN (cooldown 90s) » → l\'efficacité EVO-000031/032 sur ce run est NON EXERCÉE (confondu par fabric, INV-210)',
  payload: {
    runUid: 'RUN-000051', pytest: '5 failed in 1.24s (vivant 22:4xZ)',
    divergences: [
      'test_health: attend "name" — /health renvoie {"service": HUB_NAME} (main.py:15)',
      'test_webhook_notchpay/pesapal: POST /webhook/<G> — route réelle /webhooks/{gateway} (main.py:53)',
      'test_get_gateways: ValidationError pydantic',
      'test_initiate_payment: 500 ≠ 201',
    ],
    repairKilledBy: 'zai:circuit OPEN — EV-INCIDENT-000730/000734/000735',
    implication: 'divergence co-générés test↔impl : classe transverse nouvelle, invisible génération ET réparation',
  },
  traceId: TRACE,
});
results.push(r1.uid);

// ── Preuve 2 : RUN-000052 (slot 2 it.12) ─────────────────────────────
const r2 = await captureAndPersist({
  category: 'FORENSIC', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'super-z-task41',
  claim: 'Reproduction vivante workspace RUN-000052 : ImportError cannot import name PesaPalGateway from gateways.pesapal — gateways/pesapal.py:7 définit class PesaPal(BaseGateway) tandis que gateways/__init__.py importe PesaPalGateway (mismatch de nom INTER-CO-GÉNÉRÉS, latent dès la première passe — les DEUX fichiers jamais ciblés par la réparation) ; chronologie prouvée : 1re porte boot FAIL sur ImportError PaymentInitResponse (schemas.py) → 1 cycle EVO-000028 répare main.py/schemas.py/config.py → le main.py RÉPARÉ importe gateways (main.py:6) → re-porte FAIL sur le mismatch latent EXPOSÉ par la réparation ; échec immédiat par signature (1 cycle par PORTE, EVO-000028 — le budget ≤2 cycles/run = BOOT+BEHAVIORAL, pas un bug) ; le ciblage a vu les frames BF-2 complètes (objet live studio-pipeline.ts:349) MAIS le scellé du payload de porte TRONQUE chaque detail à 600 car. (boot-gate.ts:321 slice(0,600)) → la preuve scellée ne contient que la tête site-packages (uvicorn/click), les frames workspace (main.py:6 → __init__.py:3) sont perdues du TRACÉ (défaut de fidélité du scellé, pas du ciblage)',
  payload: {
    runUid: 'RUN-000052',
    workspaceProof: 'python -c "import main" → ImportError PesaPalGateway (vivant) ; class PesaPal(BaseGateway) pesapal.py:7 vs from .pesapal import PesaPalGateway __init__.py:3',
    chronology: 'boot FAIL(PaymentInitResponse) → 1 cycle BOOT (main,schemas,config) → re-boot FAIL(PesaPalGateway latent) → failRun',
    sealedPayloadDefect: 'boot-gate.ts:321 detail.slice(0,600) — note BF-2 2000+ car. réduite à 600 (tête site-packages uniquement), EV-INCIDENT-000754/000759 stages BOOT len=600',
    targetingOk: 'le loop consomme l\'objet live (failStages) — ciblage cycle 1 correct (schemas.py ImportError résolu)',
  },
  traceId: TRACE,
});
results.push(r2.uid);

// ── Preuve 3 : dossier fabric transverse ────────────────────────────
const r3 = await captureAndPersist({
  category: 'METRIC', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'super-z-task41',
  claim: 'Dossier fabric transverse (it.10 → it.12) : 19/29 runs (65 %) classés INFRA depuis RUN-000030 (liste RUN-000030/033/034/036-039/043/045-048/050/053-058) — la fabric est le CONFOUNDEUR DOMINANT de 3 itérations consécutives ; charge de mesure quantifiée : RUN-000051 = 57 tentatives de génération pour 13 fichiers, RUN-000052 = 55 (verdicts scellés it.12) en fenêtres ~3 min → ~19 appels LLM/minute soutenus + appels de réparation → déclenche la limitation zai → circuit OPEN (cooldown 90s) → tentatives suivantes « LLM fabric exhausted » → boucle de réessais = cercle vicieux rafales ; fenêtres de mesure : it.11 18:17→18:42 UTC (26 min), it.12 19:22→22:21 UTC (3 h incluant crash harnais + rejeu) ; it.9 (84,6 % première passe) reste la seule baseline fabric pleinement saine — TOUTE lecture AC2 des it.10/11/12 est non comparable',
  payload: {
    window: 'it.10 → it.12 (RUN-000030..058)',
    infraRuns: 19, totalRuns: 29,
    loadPerRun: { 'RUN-000051': 57, 'RUN-000052': 55, unit: 'tentatives génération / 13 fichiers / ~3 min' },
    burstRate: '~19 appels LLM/min soutenus + réparations → limitation zai → circuit OPEN cooldown 90s',
    windows: { it11: '18:17→18:42 (26 min)', it12: '19:22→22:21 (3 h, crash + rejeu)' },
    consequence: 'AC2 non comparable 3 itérations de suite ; effet EVO-000031/032 sur réparations non exercé (slot 1) / partiellement (slot 2 cycle 1)',
  },
  traceId: TRACE,
});
results.push(r3.uid);

console.log('PREUVES SCELLÉES :', results.join(', '));
