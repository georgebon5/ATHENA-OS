import type { DemoBeat, WsEvent } from "@/types/contracts";
import { dispatchWs } from "@/ws/dispatcher";

/**
 * Παίζει cached events από το demo/cache/{beat}.json όταν ο director
 * πατάει F. Αυτό είναι το «safety net» για το demo: αν κάτι αργεί
 * >8s ή αποτυγχάνει, κλείνουμε τον κύκλο με κάτι που μοιάζει live.
 */
export async function playFallback(beat: DemoBeat): Promise<void> {
  try {
    const res = await fetch(`/demo/cache/${beat.toLowerCase()}.json`);
    if (!res.ok) throw new Error(`cache for ${beat} not found`);
    const data = (await res.json()) as Array<{ atMs: number; event: WsEvent }>;
    const start = performance.now();
    for (const { atMs, event } of data) {
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
