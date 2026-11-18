import type { DemoBeat } from "@/types/contracts";

const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000");

/**
 * Ζητάει από τον gateway να πυροδοτήσει συγκεκριμένο beat του demo.
 * Αν ο gateway δεν απαντά, δεν πειράζει: ο director έχει fallback (F)
 * που παίζει τοπικά cached σενάριο.
 */
export async function triggerBeat(beat: DemoBeat): Promise<void> {
  try {
    await fetch(`${GATEWAY_URL}/api/director/${beat}`, { method: "POST" });
  } catch (err) {
    console.warn("[director] gateway unreachable", err);
  }
}

export async function triggerText(text: string): Promise<void> {
  try {
    await fetch(`${GATEWAY_URL}/api/agent/prompt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ textEl: text }),
    });
  } catch (err) {
    console.warn("[director] agent prompt failed", err);
  }
}
