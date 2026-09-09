/**
 * Task 45 — Canaries finales via la couche fabric réelle (llm-fabric).
 * 1) pingProvider('ollama') — le second fournisseur répond-il via LF-6 ?
 * 2) runLLMChat chaîne complète — zai en tête (état réel), trace complète.
 */
import { pingProvider, runLLMChat, providerStatuses } from "../src/lib/yahria/llm-fabric";

const ollama = await pingProvider("ollama", 30000);
const okO = ollama.attempts.some((a) => a.ok);
console.log(`CANARY ollama : ${okO ? "OK" : "ÉCHEC"} en ${ollama.ms} ms — ${ollama.attempts.map((a) => `${a.provider}:${a.ok ? "ok" : String(a.error ?? "?").slice(0, 60)}`).join(" | ")}`);

const chain = await runLLMChat({
  messages: [{ role: "user", content: "Réponds uniquement par le mot : OK" }],
});
console.log(`CHAîne complète : ok=${chain.ok} via ${chain.provider ?? "aucun"} en ${chain.ms} ms — trace : ${chain.attempts.map((a) => `${a.provider}:${a.ok ? "ok" : "échec"}`).join(" → ")}`);

const statuses = providerStatuses();
console.log(statuses.map((s) => `${s.id}:${s.configured ? "configuré" : "non-config"}:${s.breaker}`).join(" · "));
