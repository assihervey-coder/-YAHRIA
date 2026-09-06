// ═══════════════════════════════════════════════════════════════
// YAHRIA API — Supremacy Pack Control Surface (R8)
// One canonical route, twelve constitutional capabilities:
//
//   POST /api/yahria/supremacy
//   { action: 'proof.build' | 'proof.verify'
//           | 'merkle.seal' | 'merkle.audit'
//           | 'blast-radius' | 'debate'
//           | 'replay' | 'fuzz'
//           | 'self-heal'
//           | 'attest.build' | 'attest.verify' | 'attest.diff' }
//
// GET returns the capability catalog (machine-readable).
// Every action emits Domain-11 events on the realtime bus.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { buildProofCertificate, verifyProofCertificate, standardPredicates, type ProofCertificate } from '@/lib/yahria/proof-carrying';
import { sealEvidenceBundle, auditEvidenceBundle, merkleInclusionProof, verifyInclusionProof } from '@/lib/yahria/merkle-evidence';
import { analyzeBlastRadius, type BlastGraph } from '@/lib/yahria/blast-radius';
import { runDebate } from '@/lib/yahria/debate-arbiter';
import { recordTimeline, replayTimeline } from '@/lib/yahria/time-travel';
import { fuzzConstitution } from '@/lib/yahria/fuzz-constitution';
import { selfHeal } from '@/lib/yahria/self-heal';
import { buildAttestation, verifyAttestation, diffAttestations, type Attestation } from '@/lib/yahria/attestation';

export const dynamic = 'force-dynamic';

const CATALOG = {
  ok: true,
  pack: 'R8 — Souveraineté Constitutionnelle',
  version: '1.0.0',
  capabilities: [
    { action: 'proof.build', title: 'Preuve embarquée (Proof-Carrying Code)', desc: 'Certificat de preuve machine-vérifiable: prédicats ré-exécutables scellés par hash canonique.', invariants: ['INV-080', 'INV-102', 'INV-161'] },
    { action: 'proof.verify', title: 'Vérificateur indépendant', desc: 'Ré-exécute chaque prédicat, ne lit jamais le verdict enregistré, détecte la falsification du certificat.', invariants: ['INV-161', 'INV-102'] },
    { action: 'merkle.seal', title: 'Scellement Merkle des preuves', desc: 'Arbre de Merkle sur le faisceau de preuves: racine unique + preuves d\'inclusion O(log n).', invariants: ['INV-033', 'INV-110'] },
    { action: 'merkle.audit', title: 'Audit avec localisation', desc: 'Nomme le slot, l\'uid et le type exact de falsification (altéré / supprimé / injecté / sceau cassé).', invariants: ['INV-033', 'INV-110'] },
    { action: 'blast-radius', title: 'Rayon d\'impact sémantique', desc: 'Fermeture transitive inverse + domaines constitutionnels + auto-DENY (cycle, §28, noyau D.6).', invariants: ['INV-181', 'INV-004', 'INV-180'] },
    { action: 'debate', title: 'Débat multi-agents adversarial', desc: 'PROPOSER → CHALLENGER/SECURITY → révision → JUGE (rubrique publiée), dissensus enregistré.', invariants: ['INV-081', 'INV-080', 'INV-161'] },
    { action: 'replay', title: 'Rejeu déterministe (time-travel)', desc: 'Chronologie hash-chaînée, rejeu bit-à-bit, première divergence + champs dérivés localisés.', invariants: ['INV-112', 'INV-172', 'INV-191'] },
    { action: 'fuzz', title: 'Fuzzing constitutionnel', desc: '6 propriétés attaquées par PRNG semé: marches légales, terminaux absorbants, deny-by-default, inviolabilité des preuves.', invariants: ['INV-191', 'INV-052', 'INV-033'] },
    { action: 'self-heal', title: 'Auto-réparation bornée', desc: 'Diagnostic → réparations déterministes → re-vérification → re-scellement; budget max, escalade honnête.', invariants: ['INV-210', 'INV-211', 'INV-092'] },
    { action: 'attest.build', title: 'Attestation workspace', desc: 'Manifeste type SLSA/in-toto: sujet par fichier, racine Merkle, provenance, signature HMAC.', invariants: ['INV-190', 'INV-102'] },
    { action: 'attest.verify', title: 'Vérification d\'attestation', desc: 'Signature + racine + contenu recomputés indépendamment; divergences nommées par chemin.', invariants: ['INV-190'] },
    { action: 'attest.diff', title: 'Diff d\'attestations (garde anti-régression)', desc: 'added/removed/modified entre deux états scellés — aucune capacité validée ne régresse en silence (INV-172).', invariants: ['INV-172'] },
  ],
};

export async function GET() {
  return NextResponse.json(CATALOG);
}

interface FileIn { path: string; content: string }

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Corps JSON invalide' }, { status: 400 });
  }
  const action = String(body.action ?? '');

  try {
    switch (action) {
      // ── Proof-Carrying Code ────────────────────────────────────
      case 'proof.build': {
        const { path, content } = body as { path?: string; content?: string };
        if (!path || typeof content !== 'string') {
          return NextResponse.json({ ok: false, error: 'path et content requis' }, { status: 400 });
        }
        const { certificate, proofHash } = buildProofCertificate(
          { path, text: content },
          standardPredicates(path, content),
        );
        const verdict = verifyProofCertificate(certificate);
        return NextResponse.json({ ok: true, proofHash, certificate, verdict });
      }
      case 'proof.verify': {
        const cert = body.certificate as ProofCertificate | undefined;
        if (!cert) return NextResponse.json({ ok: false, error: 'certificate requis' }, { status: 400 });
        return NextResponse.json({ ok: true, verdict: verifyProofCertificate(cert) });
      }

      // ── Merkle evidence ────────────────────────────────────────
      case 'merkle.seal': {
        const records = (body.records as { evidenceUid: string; contentHash: string }[] | undefined) ?? [];
        const { bundle, tree } = sealEvidenceBundle(records);
        const proofs = records.map((_, i) => {
          const p = merkleInclusionProof(tree, i);
          return { evidenceUid: records[i].evidenceUid, index: i, valid: verifyInclusionProof(p.leafHash, p, bundle.root), pathLen: p.path.length };
        });
        return NextResponse.json({ ok: true, bundle, proofs });
      }
      case 'merkle.audit': {
        const records = (body.records as { evidenceUid: string; contentHash: string }[] | undefined) ?? [];
        const bundle = body.bundle as ReturnType<typeof sealEvidenceBundle>['bundle'] | undefined;
        if (!bundle) return NextResponse.json({ ok: false, error: 'bundle requis' }, { status: 400 });
        return NextResponse.json({ ok: true, audit: auditEvidenceBundle(records, bundle) });
      }

      // ── Blast radius ───────────────────────────────────────────
      case 'blast-radius': {
        const { graph, target, changeType, approved } = body as { graph?: BlastGraph; target?: string; changeType?: 'modify' | 'delete' | 'rename'; approved?: boolean };
        if (!graph || !target) return NextResponse.json({ ok: false, error: 'graph et target requis' }, { status: 400 });
        return NextResponse.json({ ok: true, report: analyzeBlastRadius(graph, target, { changeType, approved }) });
      }

      // ── Debate arbiter ─────────────────────────────────────────
      case 'debate': {
        const { goal, maxRounds, baseUncertainty } = body as { goal?: string; maxRounds?: number; baseUncertainty?: number };
        if (!goal) return NextResponse.json({ ok: false, error: 'goal requis' }, { status: 400 });
        return NextResponse.json({ ok: true, verdict: runDebate({ goal, maxRounds, baseUncertainty }) });
      }

      // ── Time travel ────────────────────────────────────────────
      case 'replay': {
        const steps = body.steps as { name: string; input: Record<string, unknown>; output: Record<string, unknown> }[] | undefined;
        if (!steps || steps.length === 0) return NextResponse.json({ ok: false, error: 'steps requis' }, { status: 400 });
        const timeline = recordTimeline(String(body.runUid ?? 'RUN-REPLAY'), steps);
        // Identity replayer: recomputes each output as recorded — proves
        // reproducibility; any tampered recorded step yields CHAIN_BROKEN.
        const report = replayTimeline(timeline, (name, input) => {
          const rec = steps.find((s) => s.name === name && JSON.stringify(s.input) === JSON.stringify(input));
          return rec ? rec.output : { diverged: true, name, input };
        });
        return NextResponse.json({ ok: true, timelineHash: timeline.timelineHash, report });
      }

      // ── Constitutional fuzzer ──────────────────────────────────
      case 'fuzz': {
        const iterations = Number(body.iterations ?? 2000);
        const seed = Number(body.seed ?? 20260907);
        return NextResponse.json({ ok: true, report: fuzzConstitution({ iterations, seed }) });
      }

      // ── Self-heal ──────────────────────────────────────────────
      case 'self-heal': {
        const { path, content, maxAttempts } = body as { path?: string; content?: string; maxAttempts?: number };
        if (!path || typeof content !== 'string') {
          return NextResponse.json({ ok: false, error: 'path et content requis' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, result: selfHeal(path, content, { maxAttempts }) });
      }

      // ── Workspace attestation ──────────────────────────────────
      case 'attest.build': {
        const files = (body.files as FileIn[] | undefined) ?? [];
        const raw = (body.meta as { generator?: string; missionUid?: string; runUid?: string; note?: string } | undefined) ?? {};
        const meta = {
          generator: raw.generator ?? 'YAHRIA-STUDIO',
          missionUid: raw.missionUid,
          runUid: raw.runUid,
          note: raw.note,
        };
        return NextResponse.json({ ok: true, attestation: buildAttestation(files, meta) });
      }
      case 'attest.verify': {
        const att = body.attestation as Attestation | undefined;
        const files = (body.files as FileIn[] | undefined) ?? [];
        if (!att) return NextResponse.json({ ok: false, error: 'attestation requise' }, { status: 400 });
        return NextResponse.json({ ok: true, verdict: verifyAttestation(att, files) });
      }
      case 'attest.diff': {
        const a = body.before as Attestation | undefined;
        const b = body.after as Attestation | undefined;
        if (!a || !b) return NextResponse.json({ ok: false, error: 'before et after requis' }, { status: 400 });
        return NextResponse.json({ ok: true, diff: diffAttestations(a, b) });
      }

      default:
        return NextResponse.json({ ok: false, error: `Action inconnue: ${action}`, catalog: CATALOG.capabilities.map((c) => c.action) }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      hint: 'Toute erreur est une erreur constitutionnelle: la surface supremacy ne masque jamais les échecs (INV-044).',
    }, { status: 422 });
  }
}
