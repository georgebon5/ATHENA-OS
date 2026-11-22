import type { WsEvent, Report } from "@/types/contracts";
import { dispatchWs } from "@/ws/dispatcher";
import { playLocalFallback } from "@/director/fallback";
import { cameraController } from "@/cesium/cameraShots";
import { useStore } from "@/store/useStore";
import * as Cesium from "cesium";

export interface AgentResponse {
  text: string;
  action: "simulate" | "thermal" | "sense" | "reports" | "impact" | "chat";
  mood: "neutral" | "alert" | "proud";
}

/** Builds a context string from current store state for the LLM */
function buildContext(): string {
  const s = useStore.getState();
  const reports = Object.values(s.reports);
  if (reports.length === 0) return "Δεν υπάρχουν αναφορές αυτή τη στιγμή.";

  const classified = reports.filter((r) => r.classification);
  const bySeverity = classified.reduce((acc, r) => {
    const sev = r.classification!.severity;
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const byCategory = classified.reduce((acc, r) => {
    const cat = r.classification!.category;
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const parts = [
    `${reports.length} αναφορές στον χάρτη`,
    `${s.buses.length} ενεργά λεωφορεία`,
  ];
  if (Object.keys(bySeverity).length > 0) {
    const sevStr = Object.entries(bySeverity)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([s, n]) => `σοβαρότητα ${s}: ${n}`)
      .join(", ");
    parts.push(sevStr);
  }
  if (Object.keys(byCategory).length > 0) {
    const catStr = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([c, n]) => `${c}: ${n}`)
      .join(", ");
    parts.push(`κατηγορίες: ${catStr}`);
  }
  return parts.join(". ");
}

/** Returns the most urgent report (highest severity) */
export function getMostUrgentReport(): Report | null {
  const reports = Object.values(useStore.getState().reports);
  const classified = reports.filter((r) => r.classification);
  if (classified.length === 0) return null;
  return classified.sort((a, b) => (b.classification!.severity - a.classification!.severity))[0];
}

/** Fly camera to a report and open its popup */
export function flyToReport(report: Report): void {
  const [lng, lat] = report.location;
  const pos = Cesium.Cartesian3.fromDegrees(lng, lat, 3);
  cameraController.closeUp(pos, 200);
  useStore.getState().setPickedReportId(report.id);
  useStore.getState().setPickedProjectId(null);
}

/**
 * Στέλνει το ερώτημα του χρήστη στο LLM (Claude) μέσω του Vite server proxy.
 * Αν αποτύχει (δεν υπάρχει key ή API error), επιστρέφει null.
 */
async function callLLM(userText: string): Promise<AgentResponse | null> {
  try {
    const context = buildContext();
    const res = await fetch("/api/athena-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: userText, context }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AgentResponse;
  } catch {
    return null;
  }
}

/**
 * Εκτελεί την ενέργεια που αποφάσισε ο agent.
 */
async function executeAction(resp: AgentResponse): Promise<void> {
  // Πάντα δείχνουμε τι "λέει" η ATHENA
  dispatchWs({
    type: "agent.say",
    payload: { textEl: resp.text, mood: resp.mood },
  } as WsEvent);

  switch (resp.action) {
    case "simulate":
      await new Promise((r) => setTimeout(r, 1200));
      await playLocalFallback("SIMULATE");
      break;
    case "thermal":
      useStore.getState().setSensorMode("flir");
      break;
    case "sense":
      await new Promise((r) => setTimeout(r, 800));
      await playLocalFallback("SENSE");
      break;
    case "reports": {
      // Ενεργοποίηση reports layer + σημαία για "next urgent" button + λίστα
      useStore.getState().setLayer("reports", true);
      useStore.getState().setShowReportsList(true);
      const urgent = getMostUrgentReport();
      if (urgent) {
        useStore.getState().setShowUrgentNav(true);
      }
      break;
    }
    case "impact":
      useStore.getState().setShowImpactPanel(true);
      break;
    case "chat":
      break;
  }
}

// Keyword fallback αν δεν υπάρχει LLM
const SIM_KW = ["λωρίδ", "δέντρ", "δρόμο", "κλείσ", "κυκλοφορ", "σενάριο", "προσομοί", "πεζ", "ποδήλατ", "λεωφορ", "τι θα γίνει", "τι γίνεται αν"];
const THERMAL_KW = ["θερμ", "θερμοκρασ", "hotspot", "ζέστη", "καύσων", "καλοκαίρι", "ήλιο", "σκιά", "flir"];
const SENSE_KW = ["πρόβλημα", "φωτογραφ", "λακκούβ", "σκουπίδ", "φωτισμ"];
const REPORT_KW = ["αναφορ", "αιτήμ", "επείγ", "σοβαρ", "σημαντικ", "καταγγελ", "παράπον"];
const IMPACT_KW = ["impact", "αντίκτυπ", "αποτέλεσμ", "αποτελέσματ", "εξοικονόμ", "εξοικονομ", "κόστος", "όφελος", "roi", "dashboard", "στατιστικ", "kpi", "μετρ", "απόδοση", "απόδοσ", "δείκτες", "αξία"];

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function keywordFallback(q: string): AgentResponse {
  if (matchesAny(q, SIM_KW)) {
    return { text: "Τρέχω προσομοίωση για το σενάριό σου…", action: "simulate", mood: "neutral" };
  }
  if (matchesAny(q, THERMAL_KW)) {
    return { text: "Ενεργοποιώ τον θερμικό χάρτη. Βλέπεις τα hotspots στην περιοχή.", action: "thermal", mood: "neutral" };
  }
  if (matchesAny(q, IMPACT_KW)) {
    return { text: "Ανοίγω το Impact Dashboard. Εκτιμώμενη εξοικονόμηση €2,1M/έτος με 87% κλείσιμο εντός 48 ωρών.", action: "impact", mood: "proud" };
  }
  if (matchesAny(q, REPORT_KW)) {
    const reports = Object.values(useStore.getState().reports);
    return { text: `Υπάρχουν ${reports.length} αναφορές στην περιοχή. Πάτα το κουμπί για να πας στην πιο επείγουσα.`, action: "reports", mood: "alert" };
  }
  if (matchesAny(q, SENSE_KW)) {
    return { text: "Ας δούμε τις αναφορές στην περιοχή…", action: "sense", mood: "neutral" };
  }
  return {
    text: "Δοκίμασε κάτι όπως «Τι θα γίνει αν κλείσουμε μία λωρίδα;» ή «Δείξε μου τα επείγοντα αιτήματα».",
    action: "chat",
    mood: "neutral",
  };
}

/**
 * Entry point: στέλνει query στον agent, εκτελεί ενέργεια, επιστρέφει.
 * Πρώτα δοκιμάζει LLM, αν αποτύχει πέφτει σε keyword matching.
 */
export async function askAthena(userText: string): Promise<void> {
  const resp = (await callLLM(userText)) ?? keywordFallback(userText);
  await executeAction(resp);
}
