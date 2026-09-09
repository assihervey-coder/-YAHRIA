/**
 * Task 44 — Canary fabric : UNE micro-appel LLM via la couche réelle (llm-fabric)
 * pour déterminer si zai est rétabli après la saturation totale (23:27Z→02:44Z).
 * Aucune écriture DB, aucune classification — diagnostic pur.
 */
import { runLLMChat, pingProvider, circuitCooldownSnapshot } from "../src/lib/yahria/llm-fabric";

const snap = circuitCooldownSnapshot();
console.log("Snapshot disjoncteurs:", JSON.stringify(snap).slice(0, 300));

const t0 = Date.now();
try {
  const r = await pingProvider("zai", 25000);
  const ok = r.attempts?.some((a) => a.ok);
  console.log(`CANARY zai ${ok ? "OK" : "ÉCHEC"} en ${Date.now() - t0} ms`);
  if (r.attempts?.length) {
    for (const a of r.attempts) console.log(`  provider=${a.provider} ok=${a.ok} ms=${a.ms}${a.error ? " err=" + String(a.error).slice(0, 120) : ""}`);
  }
} catch (e) {
  console.log(`CANARY ÉCHEC après ${Date.now() - t0} ms : ${(e as Error).message.slice(0, 300)}`);
}
