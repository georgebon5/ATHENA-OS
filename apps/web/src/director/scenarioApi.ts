import type { Scenario, ScenarioEdit } from "@/types/contracts";
import { dispatchWs } from "@/ws/dispatcher";
import { GATEWAY_URL } from "./directorApi";

/**
 * Preset / σχεδιασμένο σενάριο → gateway (POST /api/scenarios) με τα ΑΚΡΙΒΗ edits.
 * Ο gateway στέλνει αμέσως scenario.created και μετά sim.result σε όλες τις οθόνες.
 * Αν ο gateway είναι κάτω, δείχνουμε τουλάχιστον τοπικά τι αλλάζει (χωρίς νούμερα).
 */
export async function submitScenario(
  title: string,
  edits: ScenarioEdit[],
  when?: string,
): Promise<void> {
  const scenario: Scenario = {
    id: `s-${Math.random().toString(36).slice(2, 10)}`,
    title,
    edits,
    when: when ?? new Date().toISOString(),
    origin: "user",
  };
  try {
    await fetch(`${GATEWAY_URL}/api/scenarios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(scenario),
    });
  } catch (err) {
    console.warn("[scenario] gateway unreachable", err);
    dispatchWs({ type: "scenario.created", payload: scenario });
  }
}

// ── Demo presets (Πειραιώς corridor) ─────────────────────────────────────────

export const PIREOS_WAY_IDS = [652510532, 217698400, 217698402, 734712545];

// Δενδροστοιχία κατά μήκος Πειραιώς (8 δέντρα ανά 30m)
export const PIREOS_TREE_GEOMETRY: [number, number][] = [
  [23.7108, 37.9787], [23.7112, 37.9781], [23.7116, 37.9775],
  [23.7120, 37.9769], [23.7124, 37.9763], [23.7128, 37.9757],
  [23.7132, 37.9751], [23.7136, 37.9745],
];

export const DEMO_PRESETS = [
  {
    id: "trees",
    labelEl: "🌳 Δέντρα",
    titleEl: "Δενδροστοιχία Πειραιώς — 42 δέντρα",
    edits: (): ScenarioEdit[] => [
      { type: "add_trees", geometry: PIREOS_TREE_GEOMETRY, count: 42, side: "both" },
    ],
    when: `${new Date().getFullYear()}-07-15T13:00:00+03:00`,
  },
  {
    id: "bus_lane",
    labelEl: "🚌 Λωρίδα",
    titleEl: "Λωρίδα λεωφορείου Πειραιώς",
    edits: (): ScenarioEdit[] => [{ type: "bus_lane", wayIds: PIREOS_WAY_IDS }],
    when: `${new Date().getFullYear()}-07-15T08:30:00+03:00`,
  },
  {
    id: "cool",
    labelEl: "❄️ Δροσερό",
    titleEl: "Δροσερό πεζοδρόμιο Πειραιώς",
    edits: (): ScenarioEdit[] => [{ type: "cool_pavement", wayIds: PIREOS_WAY_IDS }],
    when: `${new Date().getFullYear()}-07-15T13:00:00+03:00`,
  },
  {
    id: "close",
    labelEl: "🚫 Κλείσιμο",
    titleEl: "Κλείσιμο Πειραιώς (δοκιμή)",
    edits: (): ScenarioEdit[] => [{ type: "close_road", wayIds: PIREOS_WAY_IDS }],
    when: `${new Date().getFullYear()}-07-15T10:00:00+03:00`,
  },
] as const;
