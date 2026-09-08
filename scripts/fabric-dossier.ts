// ═══════════════════════════════════════════════════════════════════
// YAHRIA — DOSSIER FABRIC TRANSVERSE (Task 41, volet ②)
// Quantifie les rafales INFRA it.10/11/12 : runs classés INFRA, incidents
// fabric scellés par fenêtre, charge du harnais (appels/run) vs limitation zai.
// Lecture seule (db/custom.db) — aucun scellé ici (preuves scellées ensuite
// via evidence-store par le processus principal).
// ═══════════════════════════════════════════════════════════════════
import { Database } from 'bun:sqlite';

const db = new Database('db/custom.db', { readonly: true });

// 1) Runs depuis it.10 (RUN-000030) : classification INFRA vs MODÈLE
const runs = db.query(
  "SELECT runUid, state, error, createdAt FROM GenerationRun WHERE runUid >= 'RUN-000030' ORDER BY runUid"
).all() as { runUid: string; state: string; error: string | null; createdAt: string }[];

let infra = 0, modele = 0, autres = 0;
const infraList: string[] = [];
for (const r of runs) {
  const e = r.error ?? '';
  const isInfra = /fabric exhausted|circuit OPEN|econnrefused|classification INFRA|zai:circuit/i.test(e);
  if (r.state === 'FAILED' && isInfra) { infra++; infraList.push(r.runUid); }
  else if (r.state === 'FAILED') { modele++; }
  else { autres++; }
}
console.log(`runs >= RUN-000030 (it.10 → it.12) : ${runs.length} — FAILED type INFRA : ${infra} — FAILED type MODÈLE : ${modele} — autres états : ${autres}`);
console.log('runs INFRA :', infraList.join(', '));

// 2) Incidents fabric scellés (toute l'histoire) par fenêtre horaire
const evs = db.query(
  "SELECT evidenceUid, claim, createdAt FROM Evidence WHERE claim LIKE '%fabric exhausted%' OR claim LIKE '%circuit OPEN%' ORDER BY createdAt ASC"
).all() as { evidenceUid: string; claim: string; createdAt: string }[];
console.log(`\nincidents fabric scellés (total histoire) : ${evs.length}`);
const byHour: Record<string, number> = {};
for (const e of evs) {
  const created = String(e.createdAt ?? '');
  const h = created.slice(0, 16).replace('T', ' ');
  byHour[h] = (byHour[h] ?? 0) + 1;
}
for (const [h, n] of Object.entries(byHour).sort()) console.log(`  ${h} UTC → ${n}`);

// 3) Charge du harnais : tentatives de génération par run (stats JSON)
const sample = db.query(
  "SELECT runUid, stats FROM GenerationRun WHERE runUid IN ('RUN-000051','RUN-000052','RUN-000056') ORDER BY runUid"
).all() as { runUid: string; stats: string | null }[];
console.log('\ncharge par run (échantillon) :');
for (const s of sample) {
  if (!s.stats) { console.log(`  ${s.runUid} : stats absentes`); continue; }
  try {
    const st = JSON.parse(s.stats);
    const keys = Object.keys(st);
    const attempts = st.totalAttempts ?? st.attempts ?? null;
    console.log(`  ${s.runUid} : clés=${keys.slice(0, 10).join(',')} attempts=${attempts}`);
  } catch { console.log(`  ${s.runUid} : stats non JSON`); }
}

// 4) Durée des fenêtres de mesure (création du 1er run au dernier)
const it11 = db.query("SELECT MIN(createdAt) a, MAX(createdAt) b FROM GenerationRun WHERE runUid BETWEEN 'RUN-000042' AND 'RUN-000049'").get() as { a: string; b: string };
const it12 = db.query("SELECT MIN(createdAt) a, MAX(createdAt) b FROM GenerationRun WHERE runUid BETWEEN 'RUN-000050' AND 'RUN-000058'").get() as { a: string; b: string };
console.log(`\nfénêtre it.11 : ${it11.a} → ${it11.b}`);
console.log(`fenêtre it.12 : ${it12.a} → ${it12.b}`);

db.close();
