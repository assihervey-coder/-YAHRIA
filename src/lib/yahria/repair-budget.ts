// ═══════════════════════════════════════════════════════════════════
// YAHRIA — GOUVERNANCE EVO-000030 — BUDGET DE RÉPARATION PAR PORTE +
// CONTRAT PYDANTIC V2 + CONTRAT COMPORTEMENTAL — YAHRIA-STD-008
//
// Motivation mesurée (PTA-002 it.9, preuve EV-POLICY scellée — EVO-000029
// PROMOTED, fidélité RC1/RC2/RC3 réelle) : 0/3 SEALED (AC1 FAIL), 84,6 %
// première passe (AC2 PASS), 3/3 boucles engagées, zéro INFRA. Causes
// REJOUÉES manuellement sur les workspaces et PROUVÉES :
//   RUN-000027 — le budget « 1 cycle par run » (EVO-000028) est consommé
//                par la PREMIÈRE porte fautive : security.py (syntaxe)
//                réparée, puis la re-porte boot révèle ImportError
//                (WebhookAck absent de models.py) — cycle déjà épuisé,
//                run mort avec un diagnostic précis mais SANS seconde
//                chance pour cette porte ;
//   RUN-000028 — réparations main.py + tests/test_api.py AVEC contrats
//                frères correctement injectés, mais CONNAISSANCE pydantic
//                v2 absente : GatewaySchema.from_orm() lève
//                PydanticUserError (API v1 morte en v2) et les payloads
//                test↔handler divergent (422≠201, 400≠200) — ni le
//                few-shot ni les contrats frères ne portent ces pièges.
//
// Protocole signé EVO-000030 (décision HUMAN:reviewer, INV-227) :
//   1. ARMEMENT     — isBudgetPerGateActive() : l'extension n'est active
//                     QUE si EVO-000030 est PROMOTED (registre =
//                     interrupteur ; registre indisponible ou
//                     ROLLED_BACK → budget legacy EVO-000028 restauré
//                     SANS redéploiement).
//   2. BUDGET PAR PORTE — repairUsedBoot / repairUsedBehavioral
//                     (≤1 cycle CHACUN, run total ≤2 cycles au lieu de
//                     1) ; ordre de passage des portes INCHANGÉ ; chaque
//                     cycle garde le budget EVO-000028 (≤3 fichiers,
//                     1 tentative/fichier) ; classification INV-210
//                     intouchable ; attempts honnêtes inchangés.
//   3. CONTRAT PYDANTIC V2 — STACK_HINTS PYTHON enrichi UNIQUEMENT si
//                     PROMOTED : model_validate(obj) au lieu de
//                     from_orm()/parse_obj() ; model_config =
//                     ConfigDict(from_attributes=True) sur les schémas
//                     lisant des ORM/objets ; model_dump() au lieu de
//                     .dict() — AUCUN autre changement du prompt système.
//   4. CONTRAT COMPORTEMENTAL — le contract distillé du few-shot
//                     (golden-exemplar.ts, même garde PROMOTED) gagne une
//                     ligne : le fichier pytest EST le contrat
//                     comportemental (payloads et status codes exacts).
//   5. HONNÊTETÉ    — chaque cycle scellé en preuve (bilan
//                     ARTIFACT/INCIDENT) ; re-portes inchangées ;
//                     failRun avec l'historique complet.
// ═══════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

export const REPAIR_BUDGET_EVO_UID = 'EVO-000030';

// ── RB-1. ARMEMENT GOUVERNÉ — le registre EST l'interrupteur ────────

let activeCache: { value: boolean; at: number } | null = null;
const ACTIVE_TTL_MS = 5_000;

export async function isBudgetPerGateActive(): Promise<boolean> {
  if (activeCache && Date.now() - activeCache.at < ACTIVE_TTL_MS) return activeCache.value;
  let value = false;
  try {
    const p = await db.evolutionProposal.findUnique({ where: { proposalUid: REPAIR_BUDGET_EVO_UID } });
    value = p?.state === 'PROMOTED';
  } catch {
    value = false; // registre indisponible → budget legacy (jamais actif par accident)
  }
  activeCache = { value, at: Date.now() };
  return value;
}

/** Invalidation forcée du cache d'armement (tests, rollback drill). */
export function resetBudgetPerGateCache(): void {
  activeCache = null;
}

// ── RB-2. BUDGET DE RÉPARATION (fonctions PURES — testables sans DB) ─

/**
 * État du budget de réparation d'UN run. Mode PER-GATE (EVO-000030
 * PROMOTED) : ≤1 cycle par porte, ≤2 cycles/run. Mode LEGACY (EVO-000028
 * seul, ou EVO-000030 ROLLED_BACK — rollback drill sans redéploiement) :
 * 1 cycle/run TOTAL, toutes portes confondues.
 */
export interface RepairBudgetState {
  perGate: boolean;
  bootUsed: boolean;
  behavioralUsed: boolean;
  legacyUsed: boolean;
}

export function newRepairBudget(perGate: boolean): RepairBudgetState {
  return { perGate, bootUsed: false, behavioralUsed: false, legacyUsed: false };
}

/** Le budget de la porte est-il disponible ? (jamais muté ici) */
export function repairBudgetAvailable(s: RepairBudgetState, gateKind: 'BOOT' | 'BEHAVIORAL'): boolean {
  return s.perGate
    ? (gateKind === 'BOOT' ? !s.bootUsed : !s.behavioralUsed)
    : !s.legacyUsed;
}

/** Consomme le budget d'une porte — UNIQUEMENT après un cycle AGI (attempted). */
export function consumeRepairBudget(s: RepairBudgetState, gateKind: 'BOOT' | 'BEHAVIORAL'): void {
  if (s.perGate) {
    if (gateKind === 'BOOT') s.bootUsed = true;
    else s.behavioralUsed = true;
  } else {
    s.legacyUsed = true;
  }
}

/** Nombre de cycles de réparation réellement consommés par le run (0|1|2). */
export function repairCyclesUsed(s: RepairBudgetState): number {
  return s.perGate
    ? (s.bootUsed ? 1 : 0) + (s.behavioralUsed ? 1 : 0)
    : (s.legacyUsed ? 1 : 0);
}

// ── RB-3. CONTRAT PYDANTIC V2 (point 3 du protocole — texte gouverné) ─

/**
 * Enrichissement STACK_HINTS PYTHON — injecté par studio.ts dans le
 * prompt système du coder agent UNIQUEMENT si EVO-000030 est PROMOTED.
 * Exemples one-line, AUCUN autre changement du prompt système.
 * (Fonction PURE : la gouvernance est décidée par l'appelant — testable.)
 */
export function pydanticV2StackAddendum(active: boolean, stack: string): string {
  if (!active || stack !== 'PYTHON') return '';
  return ' PYDANTIC V2 CONTRACT (pydantic 2.x installed — the v1 APIs are REMOVED and raise PydanticUserError): parse objects with Model.model_validate(obj) — NEVER Model.from_orm(obj), Model.parse_obj(obj) or Model.parse_raw(); to read ORM/attribute objects declare model_config = ConfigDict(from_attributes=True) on the schema first; serialize with model.model_dump() / model.model_dump_json() — NEVER .dict() / .json(); validators use @field_validator / @model_validator(mode=...) — NEVER @validator / @root_validator.';
}

// ── RB-4. CONTRAT COMPORTEMENTAL (point 4 du protocole — une ligne) ──

/**
 * Ligne ajoutée au contract distillé du few-shot (golden-exemplar.ts,
 * même garde PROMOTED) : le fichier pytest est le CONTRAT
 * COMPORTEMENTAL — payloads et status codes exacts (cause prouvée
 * RUN-000028 : payloads test↔handler divergents, 422≠201 / 400≠200).
 * (Fonction PURE — pytest est un outil PYTHON : inerte hors PYTHON.)
 */
export const BEHAVIORAL_CONTRACT_LINE =
  '- The pytest file is the BEHAVIORAL contract: read the exact request payloads and status codes it sends and expects (e.g. client.post("/route", json={...}) then assert response.status_code == 201), and make every route handler accept and return EXACTLY those shapes.';

export function behavioralContractExtra(active: boolean, stack: string): string {
  if (!active || stack !== 'PYTHON') return '';
  return `\n${BEHAVIORAL_CONTRACT_LINE}`;
}
