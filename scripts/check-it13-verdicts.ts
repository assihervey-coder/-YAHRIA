/**
 * Task 44 — Lecture DB seule (readonly) : état réel de la mesure it.13
 * Runs RUN-000059..RUN-000067 + evidences de mesure + chronologie fabric.
 * Lecture seule : bun:sqlite readonly, INV-210 (aucune reclassification ici).
 */
import { Database } from "bun:sqlite";

const db = new Database("/home/z/my-project/db/custom.db", { readonly: true });

const runs = db
  .prepare(
    `SELECT runUid, state, createdAt, updatedAt, error
     FROM GenerationRun
     WHERE runUid >= 'RUN-000059' AND runUid <= 'RUN-000069'
     ORDER BY runUid ASC`
  )
  .all() as any[];

console.log("=== RUNS it.13 (RUN-000059..069) ===");
for (const r of runs) {
  const created = new Date(Number(r.createdAt)).toISOString();
  const updated = new Date(Number(r.updatedAt)).toISOString();
  console.log(
    `${r.runUid} | ${r.state} | créé ${created} | màj ${updated}`
  );
  if (r.error) console.log(`   err: ${String(r.error).slice(0, 220)}`);
}

// Chronologie fabric : evidences OPERATIONS / incident liées au circuit pendant la fenêtre it.13
const first = Number(
  db.prepare(`SELECT MIN(createdAt) m FROM GenerationRun WHERE runUid >= 'RUN-000059'`).get()?.m ?? 0
);
const last = Number(
  db.prepare(`SELECT MAX(createdAt) m FROM GenerationRun WHERE runUid >= 'RUN-000059'`).get()?.m ?? 0
);
console.log(
  `\nFenêtre génération runs : ${new Date(first).toISOString()} → ${new Date(last).toISOString()}`
);

// Evidences produites pendant la fenêtre (catégories) pour voir l'activité réelle
const evs = db
  .prepare(
    `SELECT evidenceUid, category, createdAt, substr(payload,1,180) p
     FROM Evidence
     WHERE createdAt >= ? AND createdAt <= ?
     ORDER BY createdAt ASC`
  )
  .all(first - 60000, last + 3600000) as any[];
console.log(`\n=== EVIDENCES fenêtre it.13 (${evs.length}) ===`);
const byKind: Record<string, number> = {};
for (const e of evs) byKind[e.category] = (byKind[e.category] ?? 0) + 1;
console.log(JSON.stringify(byKind));

// Chercher les notes fabric exhausted / backoff dans les payloads de la fenêtre
const fab = db
  .prepare(
    `SELECT evidenceUid, category, createdAt, substr(payload,1,300) p
     FROM Evidence
     WHERE createdAt >= ? AND createdAt <= ?
       AND (payload LIKE '%fabric exhaust%' OR payload LIKE '%circuit OPEN%' OR payload LIKE '%backoff%' OR payload LIKE '%waitFabric%')
     ORDER BY createdAt ASC`
  )
  .all(first - 60000, last + 3600000) as any[];
console.log(`\n=== EVIDENCES mention fabric/backoff (${fab.length}) ===`);
for (const f of fab.slice(0, 12)) {
  console.log(
    `${f.evidenceUid} ${f.category} ${new Date(Number(f.createdAt)).toISOString()} :: ${String(f.p).replace(/\n/g, " ").slice(0, 200)}`
  );
}

// Dernière séquence d'evidence connue (pour sceller après)
const lastEv = db.prepare(`SELECT MAX(seq) s FROM Evidence`).get() as any;
console.log(`\nMax evidence seq: ${lastEv?.s}`);

// Nombre total de runs depuis it.10 pour le dossier fabric cumulé
const infraSinceIt10 = db
  .prepare(
    `SELECT COUNT(*) c FROM GenerationRun WHERE runUid >= 'RUN-000035' AND state = 'FAILED' AND error LIKE '%INFRA%'`
  )
  .get() as any;
const totalSince = db
  .prepare(`SELECT COUNT(*) c FROM GenerationRun WHERE runUid >= 'RUN-000035'`)
  .get() as any;
console.log(
  `Runs depuis it.10 (>= RUN-000035) : ${totalSince.c} dont ${infraSinceIt10.c} INFRA-classés`
);

db.close();
