// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — PRODUCT EVOLUTION & ROADMAP (Domain 23)
// KRN-038 · R14
//
// Roadmap DÉRIVÉE du ledger d'activation (INV-234) : aucune
// priorité manuelle, aucun statut édité à la main. Score
// déterministe = poids de phase + poids cœur + bonus de statut,
// enrichi des métriques vivantes (fiabilité des outils).
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { DOMAINS, DOMAIN_ACTIVATIONS } from './domains';

export const ROADMAP_MODULE_ID = 'YAHRIA-KRN-038';

export type Horizon = 'MVP' | 'ALPHA' | 'BETA' | 'ENTERPRISE';

/** Mapping canonique phase → horizon produit (documenté, stable). */
export function horizonOf(phase: number): Horizon {
  if (phase <= 8) return 'MVP';
  if (phase <= 13) return 'ALPHA';
  if (phase <= 18) return 'BETA';
  return 'ENTERPRISE';
}

export interface RoadmapRow {
  code: string; name: string; phase: number; status: string; isCore: boolean;
  horizon: Horizon; score: number; why: string;
}

export async function computeRoadmap(): Promise<{
  horizons: { horizon: Horizon; domains: { code: string; name: string; status: string }[] }[];
  next: RoadmapRow[];
  activationLedger: { code: string; since: string; evidenceCount: number }[];
  basis: string;
}> {
  const dbDomains = await db.domain.findMany({ select: { code: true, status: true } });
  const statusByCode = new Map(dbDomains.map((d) => [d.code, d.status]));
  const activeCodes = new Set(DOMAIN_ACTIVATIONS.map((a) => a.code));

  const rows: RoadmapRow[] = DOMAINS.map((d) => {
    const status = statusByCode.get(d.code) ?? 'NOT_STARTED';
    // Score déterministe (INV-234) — plus le score est haut, plus c'est prioritaire.
    let score = (24 - d.phase) * 10;
    if (d.isCore) score += 50;
    if (status === 'NOT_STARTED' && !activeCodes.has(d.code)) score += 30;
    else if (status === 'IMPLEMENTING') score += 10;
    else if (status === 'VERIFIED') score += 0;
    const why = status === 'IMPLEMENTING' || activeCodes.has(d.code)
      ? `Actif (preuve archivée, ${DOMAIN_ACTIVATIONS.find((a) => a.code === d.code)?.evidence.length ?? 0} élément(s) de preuve) — poursuite de consolidation.`
      : status === 'NOT_STARTED'
        ? `Non démarré, phase ${d.phase} — la priorité vient de l'ordre canonique du graphe de dépendances${d.isCore ? ' + domaine transverse' : ''}.`
        : `Statut ${status} — décision gouvernée requise pour toute clôture (jamais automatique).`;
    return { code: d.code, name: d.name, phase: d.phase, status, isCore: d.isCore, horizon: horizonOf(d.phase), score, why };
  });

  const next = rows.slice().sort((a, b) => b.score - a.score).slice(0, 8);

  const horizons: RoadmapReport['horizons'] = (['MVP', 'ALPHA', 'BETA', 'ENTERPRISE'] as Horizon[]).map((h) => ({
    horizon: h,
    domains: rows.filter((r) => r.horizon === h).map((r) => ({ code: r.code, name: r.name, status: r.status })),
  }));

  return {
    horizons,
    next,
    activationLedger: DOMAIN_ACTIVATIONS.map((a) => ({ code: a.code, since: a.since, evidenceCount: a.evidence.length })),
    basis: `Score = (24 − phase)×10 + 50 si transverse + bonus statut (30 NOT_STARTED non activé, 10 IMPLEMENTING, 0 VERIFIED) — dérivé intégralement du ledger DOMAIN_ACTIVATIONS et des statuts DB (INV-234). Aucun champ éditable à la main.`,
  };
}

export interface RoadmapReport {
  horizons: { horizon: Horizon; domains: { code: string; name: string; status: string }[] }[];
  next: RoadmapRow[];
  activationLedger: { code: string; since: string; evidenceCount: number }[];
  basis: string;
}
