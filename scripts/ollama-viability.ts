/**
 * Task 45 — Viabilité ollama comme second fournisseur réel.
 * Mesure (1) latence triviale, (2) génération représentative (~fichier du
 * projet) vs timeout fabric 90 s, (3) RAM chargée. Décision par les nombres.
 */
const BASE = "http://127.0.0.1:11434";
const MODEL = "qwen2.5-coder:1.5b";

async function chat(prompt: string, maxTokens: number, label: string): Promise<{ ms: number; tokens: number; ok: boolean; err?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ms: Date.now() - t0, tokens: 0, ok: false, err: `HTTP ${res.status} : ${body.slice(0, 120)}` };
    }
    const j: any = await res.json();
    const tokens = j.usage?.completion_tokens ?? 0;
    return { ms: Date.now() - t0, tokens, ok: true };
  } catch (e) {
    return { ms: Date.now() - t0, tokens: 0, ok: false, err: String((e as Error).message).slice(0, 120) };
  } finally {
    console.log(`${label} : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
}

// (1) trivial — le pingProvider fabric envoie un mini prompt
const r1 = await chat("Réponds uniquement : OK", 8, "(1) latence triviale 8 tokens");
console.log(`   → ok=${r1.ok} tokens=${r1.tokens}${r1.err ? " err=" + r1.err : ""}`);

// (2) représentative — un petit module Python type du projet (~400-500 tokens générés)
const r2 = await chat(
  "Écris un module Python fastapi minimal : une classe Pydantic PaymentRequest (montant: float, devise: str, référence: str) et une route POST /initiate qui renvoie {status:'pending', reference:...}. Réponds UNIQUEMENT le code.",
  450,
  "(2) génération représentative ≤450 tokens"
);
console.log(`   → ok=${r2.ok} tokens=${r2.tokens} — vitesse ≈ ${r2.ok && r2.ms > 0 ? (r2.tokens / (r2.ms / 1000)).toFixed(1) : "?"} tokens/s${r2.err ? " err=" + r2.err : ""}`);

// (3) RAM du modèle chargé
const ps = await fetch(`${BASE}/api/ps`).then((r) => r.json()) as any;
for (const m of ps.models ?? []) {
  console.log(`(3) chargé : ${m.name} — VRRAM/RAM ${Math.round((m.size_vram ?? m.size ?? 0) / 1048576)} Mo`);
}
const TIMEOUT_FABRIC_MS = 90_000;
const verdict = r1.ok && r2.ok && r2.ms < TIMEOUT_FABRIC_MS
  ? `VIABLE en repli (génération ${r2.tokens} tokens en ${(r2.ms / 1000).toFixed(1)} s < 90 s)`
  : `NON VIABLE pour la charge de génération (r1.ok=${r1.ok} r2.ok=${r2.ok} r2.ms=${r2.ms} ms vs timeout 90 000 ms)`;
console.log("VERDICT :", verdict);
