import type { DemoBeat, WsEvent } from "@/types/contracts";
import { dispatchWs } from "@/ws/dispatcher";
import { requestFallback } from "./directorApi";

/**
 * Παίζει τοπικά cached events χωρίς να ρωτάει τον gateway.
 * Χρήσιμο όταν ξέρουμε ότι ο agent δεν απαντά.
 */
export async function playLocalFallback(beat: DemoBeat): Promise<void> {
  try {
    const res = await fetch(`/demo/cache/${beat.toLowerCase()}.json`);
    if (!res.ok) throw new Error(`cache for ${beat} not found`);
    const data = (await res.json()) as Array<{ atMs: number; event: WsEvent }>;
    const start = performance.now();
    for (const { atMs, event } of data) {
      if (event.type === "vote.tally") continue;
      const delay = Math.max(0, atMs - (performance.now() - start));
      await sleep(delay);
      dispatchWs(event);
    }
  } catch (err) {
    console.warn("[fallback] δεν υπάρχει cache για", beat, err);
  }
}

/**
 * F του director. Πρώτα μέσω gateway (σωστό QR, αποθηκευμένη διαβούλευση, όλες οι οθόνες).
 * Μόνο αν ο gateway είναι κάτω παίζουμε τοπικά το public/demo/cache/{beat}.json.
 */
export async function playFallback(beat: DemoBeat): Promise<void> {
  if (await requestFallback(beat)) return;
  await playLocalFallback(beat);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}
