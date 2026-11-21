import type { DemoBeat, WsEvent } from "@/types/contracts";
import { dispatchWs } from "@/ws/dispatcher";
import { requestFallback } from "./directorApi";

/**
 * F του director. Πρώτα μέσω gateway (σωστό QR, αποθηκευμένη διαβούλευση, όλες οι οθόνες).
 * Μόνο αν ο gateway είναι κάτω παίζουμε τοπικά το public/demo/cache/{beat}.json.
 */
export async function playFallback(beat: DemoBeat): Promise<void> {
  if (await requestFallback(beat)) return;
  try {
    const res = await fetch(`/demo/cache/${beat.toLowerCase()}.json`);
    if (!res.ok) throw new Error(`cache for ${beat} not found`);
    const data = (await res.json()) as Array<{ atMs: number; event: WsEvent }>;
    const start = performance.now();
    for (const { atMs, event } of data) {
      // Οι ψήφοι είναι πάντα live: ποτέ ψεύτικο tally στην οθόνη
      if (event.type === "vote.tally") continue;
      const delay = Math.max(0, atMs - (performance.now() - start));
      await sleep(delay);
      dispatchWs(event);
    }
  } catch (err) {
    console.warn("[fallback] δεν υπάρχει cache για", beat, err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}
