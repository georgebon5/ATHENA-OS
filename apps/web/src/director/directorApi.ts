import type { DemoBeat, Report } from "@/types/contracts";

export const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000");

async function post(path: string, body?: unknown): Promise<Response> {
  return fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Ζητάει από τον gateway να πυροδοτήσει συγκεκριμένο beat του demo.
 * Αν ο gateway δεν απαντά, δεν πειράζει: ο director έχει fallback (F)
 * που παίζει τοπικά cached σενάριο.
 */
export async function triggerBeat(beat: DemoBeat): Promise<void> {
  try {
    await post(`/api/director/${beat}`);
  } catch (err) {
    console.warn("[director] gateway unreachable", err);
  }
}

export async function triggerText(text: string): Promise<void> {
  try {
    await post("/api/agent/prompt", { textEl: text });
  } catch (err) {
    console.warn("[director] agent prompt failed", err);
  }
}

/**
 * Fallback μέσω gateway: τα cached events περνούν από το hub (άρα τα βλέπουν όλες οι οθόνες),
 * η διαβούλευση αποθηκεύεται και το QR δείχνει στο πραγματικό citizen app.
 * false → ο gateway δεν απάντησε και ο caller παίζει το τοπικό cache.
 */
export async function requestFallback(beat: DemoBeat): Promise<boolean> {
  try {
    const r = await post(`/api/director/fallback/${beat}`);
    return r.ok;
  } catch {
    return false;
  }
}

/** Καθαρίζει τον gateway για νέα πρόβα· έρχεται πίσω state.reset σε όλες τις οθόνες. */
export async function resetGateway(): Promise<boolean> {
  try {
    return (await post("/api/director/reset")).ok;
  } catch {
    return false;
  }
}

/** Moderation: κρύβει ακατάλληλη φωτογραφία από όλες τις οθόνες (report.hidden). */
export async function hideReport(id: string): Promise<void> {
  try {
    await post(`/api/reports/${encodeURIComponent(id)}/hide`);
  } catch (err) {
    console.warn("[director] hide failed", err);
  }
}

export async function fetchReports(): Promise<Report[]> {
  try {
    const r = await fetch(`${GATEWAY_URL}/api/reports`);
    return r.ok ? ((await r.json()) as Report[]) : [];
  } catch {
    return [];
  }
}
