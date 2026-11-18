// Τύποι που αντιστοιχούν στα contracts του CLAUDE.md §4.
// Πηγή αλήθειας είναι τα JSON Schemas στο packages/contracts·
// μέχρι να παραχθούν από generator, κρατάμε τους τύπους εδώ ως TS.

export type LngLat = [number, number]; // [lng, lat] WGS84

export type ReportCategory =
  | "pothole"
  | "sidewalk_damage"
  | "waste"
  | "lighting"
  | "obstruction"
  | "heat_exposure"
  | "graffiti"
  | "accessibility"
  | "other";

export interface ReportClassification {
  category: ReportCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  summaryEl: string;
  department: string;
  duplicates: string[];
  confidence: number;
}

export interface Report {
  id: string;
  createdAt: string;
  photoUrl: string;
  location: LngLat;
  heading: number | null;
  accuracyM: number | null;
  classification?: ReportClassification;
}

export type ScenarioEdit =
  | { type: "close_road"; wayIds: number[] }
  | { type: "bus_lane"; wayIds: number[] }
  | { type: "remove_lane"; wayIds: number[] }
  | {
      type: "add_trees";
      geometry: LngLat[];
      count: number;
      side?: "north" | "south" | "east" | "west" | "both";
    }
  | { type: "cool_pavement"; wayIds: number[] };

export interface Scenario {
  id: string;
  title: string;
  edits: ScenarioEdit[];
  when: string;
  origin: "user" | "agent_variant";
  parentId?: string;
}

export interface Range {
  p10: number;
  p50: number;
  p90: number;
}

export interface TrafficSegment {
  wayId: number;
  baseFlow: number;
  newFlow: number;
  baseTimeS: number;
  newTimeS: number;
  /** Προαιρετικό geometry — αν δεν δοθεί, ο client το αντιστοιχεί τοπικά */
  path?: LngLat[];
}

export interface Trip {
  path: LngLat[];
  departS: number;
  durationS: number;
}

export interface ThermalCell {
  lngLat: LngLat;
  baseC: number;
  newC: number;
}

export interface SimResult {
  scenarioId: string;
  status: "ok" | "error";
  computeMs: number;
  traffic: {
    segments: TrafficSegment[];
    corridorTravelTimeDeltaPct: Range;
    vehicleKmDeltaPct: Range;
    trips: Trip[];
  };
  thermal: {
    when: string;
    cells: ThermalCell[];
    hotspotDeltaC: Range;
  };
  emissions: { co2DeltaPct: Range };
  notes: string[];
}

export interface Backtest {
  model: "traffic" | "thermal";
  metric: "MAPE" | "MAE_C" | "R2";
  value: number;
  heldOut: string;
  nSamples: number;
  chart: { predicted: number; observed: number }[];
}

export interface Consultation {
  id: string;
  scenarioId: string;
  reportId?: string;
  beforeUrl: string;
  afterUrl: string;
  questionEl: string;
  publicUrl: string;
}

export interface Vote {
  consultationId: string;
  choice: "yes" | "no" | "maybe";
  location?: LngLat;
  comment?: string;
}

export interface DecisionDraft {
  scenarioId: string;
  markdownEl: string;
  citations: { label: string; source: string }[];
}

export interface Bus {
  id: string;
  line: string;
  lngLat: LngLat;
  bearing: number;
}

export type AgentMood = "neutral" | "alert" | "proud";

export type DemoBeat =
  | "INTRO"
  | "PITCH"
  | "SENSE"
  | "SIMULATE"
  | "ENGAGE"
  | "DECISION"
  | "CLOSE";

export type LayerKey = "traffic" | "thermal" | "reports" | "votes" | "buses";

// WebSocket events (/ws)
export type WsEvent =
  | { type: "buses.update"; payload: { buses: Bus[] } }
  | { type: "report.created"; payload: Report }
  | { type: "report.classified"; payload: Report }
  | {
      type: "agent.say";
      payload: { textEl: string; audioUrl?: string; mood?: AgentMood };
    }
  | { type: "agent.thinking"; payload: { stepEl: string } }
  | {
      type: "camera.flyTo";
      payload: {
        lngLat: LngLat;
        heightM: number;
        headingDeg: number;
        pitchDeg: number;
        durationS: number;
        shot?: string;
      };
    }
  | {
      type: "layer.set";
      payload: { layer: LayerKey; visible: boolean };
    }
  | { type: "time.set"; payload: { when: string } }
  | { type: "scenario.created"; payload: Scenario }
  | { type: "sim.progress"; payload: { scenarioId: string; pct: number } }
  | { type: "sim.result"; payload: SimResult }
  | {
      type: "variant.compare";
      payload: { base: SimResult; best: SimResult; reasonEl: string };
    }
  | { type: "backtest.show"; payload: { model: "traffic" | "thermal" } }
  | { type: "consultation.opened"; payload: Consultation }
  | {
      type: "vote.tally";
      payload: {
        consultationId: string;
        yes: number;
        no: number;
        maybe: number;
        points: { lngLat: LngLat; choice: Vote["choice"] }[];
      };
    }
  | { type: "decision.ready"; payload: DecisionDraft }
  | { type: "director.beat"; payload: { beat: DemoBeat } };
