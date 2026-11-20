import type { Scenario, ScenarioEdit } from "@/types/contracts";
import { dispatchWs } from "@/ws/dispatcher";

const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000");

const AGENT_URL =
  (import.meta.env.VITE_AGENT_URL as string | undefined) ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8200`
    : "http://localhost:8200");

/**
 * Υποβάλλει σενάριο στον agent (POST /command).
 * Ο agent τρέχει simulate → emit events → φτάνουν μέσω WS.
 * Fallback: local dispatch του scenario.created για instant visual.
 */
export async function submitScenario(
  title: string,
  edits: ScenarioEdit[],
  when?: string,
): Promise<void> {
  const id = `s-${Math.random().toString(36).slice(2, 10)}`;
  const scenario: Scenario = {
    id,
    title,
    edits,
    when: when ?? new Date().toISOString(),
    origin: "user",
  };

  // Άμεσα local dispatch ώστε το ScenarioLayer να δείξει τα visuals
  dispatchWs({ type: "scenario.created", payload: scenario });

  // Στέλνουμε στον agent για πλήρη simulate flow
  try {
    await fetch(`${AGENT_URL}/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ textEl: title }),
    });
  } catch (err) {
    console.warn("[scenario] agent unreachable, trying gateway", err);
    // Fallback: gateway /api/scenarios
    try {
      await fetch(`${GATEWAY_URL}/api/scenarios`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scenario),
      });
    } catch (e2) {
      console.warn("[scenario] gateway also unreachable", e2);
    }
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
