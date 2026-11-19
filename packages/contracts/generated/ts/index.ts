/* AUTO-GENERATED από packages/contracts/schemas — ΜΗΝ το αλλάξεις με το χέρι. Τρέξε `pnpm contracts:gen`. */

/**
 * [lng, lat] σε WGS84
 *
 * @minItems 2
 * @maxItems 2
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "LngLat".
 */
export type LngLat = [number, number];
/**
 * Από πού ήρθαν τα δεδομένα: live, replay ηχογράφησης, fixtures (mock) ή εκτός λειτουργίας
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "DataSource".
 */
export type DataSource = "live" | "replay" | "mock" | "down";
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "VoteChoice".
 */
export type VoteChoice = "yes" | "no" | "maybe";
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "DemoBeat".
 */
export type DemoBeat = "INTRO" | "PITCH" | "SENSE" | "SIMULATE" | "ENGAGE" | "DECISION" | "CLOSE";
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "LayerKey".
 */
export type LayerKey = "traffic" | "thermal" | "reports" | "votes" | "buses";
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "AgentMood".
 */
export type AgentMood = "neutral" | "alert" | "proud";
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ServiceState".
 */
export type ServiceState = "up" | "down" | "mock";
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ReportCategory".
 */
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
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ScenarioEdit".
 */
export type ScenarioEdit =
  CloseRoadEdit | BusLaneEdit | RemoveLaneEdit | AddTreesEdit | CoolPavementEdit;
/**
 * OSM way ids
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "WayIds".
 */
export type WayIds = number[];
/**
 * Κάθε μήνυμα στο /ws: { type, payload }
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "WsEvent".
 */
export type WsEvent =
  | BusesUpdateEvent
  | ReportCreatedEvent
  | ReportClassifiedEvent
  | ReportHiddenEvent
  | AgentSayEvent
  | AgentThinkingEvent
  | CameraFlyToEvent
  | LayerSetEvent
  | TimeSetEvent
  | ScenarioCreatedEvent
  | SimProgressEvent
  | SimResultEvent
  | VariantCompareEvent
  | BacktestShowEvent
  | ConsultationOpenedEvent
  | VoteTallyEvent
  | DecisionReadyEvent
  | DirectorBeatEvent
  | SystemStatusEvent
  | StateResetEvent;

/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Bus".
 */
export interface Bus {
  /**
   * Αριθμός οχήματος ΟΑΣΑ
   */
  id: string;
  /**
   * π.χ. 049, 914, Β18
   */
  line: string;
  lngLat: LngLat;
  /**
   * Μοίρες 0–360
   */
  bearing: number;
}
/**
 * GET /api/city/live — σύνοψη για να μιλήσει η ATHENA με live νούμερα
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "CityLive".
 */
export interface CityLive {
  updatedAt: string;
  buses: {
    /**
     * Λεωφορεία σε κίνηση μέσα στο bbox
     */
    active: number;
    lines: string[];
    source: DataSource;
  };
  weather: {
    temperatureC: number | null;
    apparentC: number | null;
    /**
     * π.χ. open-meteo
     */
    source: string;
  };
  reports: {
    total: number;
    last24h: number;
    byCategory: {
      [k: string]: number;
    };
  };
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Consultation".
 */
export interface Consultation {
  id: string;
  scenarioId: string;
  reportId?: string;
  beforeUrl: string;
  afterUrl: string;
  questionEl: string;
  /**
   * Αυτό γίνεται QR
   */
  publicUrl: string;
}
/**
 * Body του POST /api/consultations. Τα id και publicUrl τα βάζει ο gateway.
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ConsultationCreate".
 */
export interface ConsultationCreate {
  scenarioId: string;
  reportId?: string;
  beforeUrl: string;
  afterUrl: string;
  questionEl: string;
}
/**
 * Body του POST /api/consultations/{id}/votes. location = προαιρετικά η γειτονιά του ψηφοφόρου.
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Vote".
 */
export interface Vote {
  consultationId: string;
  choice: VoteChoice;
  location?: LngLat;
  comment?: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "VotePoint".
 */
export interface VotePoint {
  lngLat: LngLat;
  choice: VoteChoice;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "VoteTally".
 */
export interface VoteTally {
  consultationId: string;
  yes: number;
  no: number;
  maybe: number;
  points: VotePoint[];
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Citation".
 */
export interface Citation {
  label: string;
  source: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "DecisionDraft".
 */
export interface DecisionDraft {
  scenarioId: string;
  /**
   * ΘΕΜΑ / ΣΚΕΠΤΙΚΟ / ΔΕΔΟΜΕΝΑ / ΔΙΑΒΟΥΛΕΥΣΗ / ΑΠΟΦΑΣΙΖΕΙ, με ένδειξη «ΣΧΕΔΙΟ»
   */
  markdownEl: string;
  citations: Citation[];
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "BusesUpdatePayload".
 */
export interface BusesUpdatePayload {
  buses: Bus[];
}
/**
 * ΠΡΟΤΑΣΗ Dev4: ο director κρύβει ακατάλληλη φωτογραφία (moderation)
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ReportHiddenPayload".
 */
export interface ReportHiddenPayload {
  id: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "AgentSayPayload".
 */
export interface AgentSayPayload {
  textEl: string;
  audioUrl?: string;
  mood?: AgentMood;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "AgentThinkingPayload".
 */
export interface AgentThinkingPayload {
  stepEl: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "CameraFlyToPayload".
 */
export interface CameraFlyToPayload {
  lngLat: LngLat;
  heightM: number;
  headingDeg: number;
  pitchDeg: number;
  durationS: number;
  /**
   * Όνομα προκαθορισμένου πλάνου του web (π.χ. orbitSerafio)
   */
  shot?: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "LayerSetPayload".
 */
export interface LayerSetPayload {
  layer: LayerKey;
  visible: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "TimeSetPayload".
 */
export interface TimeSetPayload {
  /**
   * ISO 8601
   */
  when: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "SimProgressPayload".
 */
export interface SimProgressPayload {
  scenarioId: string;
  /**
   * Κλάσμα 0–1
   */
  pct: number;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "VariantComparePayload".
 */
export interface VariantComparePayload {
  base: SimResult;
  best: SimResult;
  reasonEl: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "SimResult".
 */
export interface SimResult {
  scenarioId: string;
  status: "ok" | "error";
  computeMs: number;
  traffic: {
    segments: TrafficSegment[];
    corridorTravelTimeDeltaPct: Range;
    vehicleKmDeltaPct: Range;
    /**
     * @maxItems 3000
     */
    trips: Trip[];
  };
  thermal: {
    when: string;
    /**
     * Πλέγμα ~20–30 m
     */
    cells: ThermalCell[];
    hotspotDeltaC: Range;
  };
  emissions: {
    co2DeltaPct: Range;
  };
  /**
   * Παραδοχές, στα ελληνικά
   */
  notes: string[];
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "TrafficSegment".
 */
export interface TrafficSegment {
  wayId: number;
  baseFlow: number;
  newFlow: number;
  baseTimeS: number;
  newTimeS: number;
  /**
   * Προαιρετικό geometry. Αν λείπει, ο client το αντιστοιχεί τοπικά.
   */
  path?: LngLat[];
}
/**
 * Εύρος αβεβαιότητας. Κανένα νούμερο στην οθόνη χωρίς εύρος.
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Range".
 */
export interface Range {
  p10: number;
  p50: number;
  p90: number;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Trip".
 */
export interface Trip {
  path: LngLat[];
  departS: number;
  durationS: number;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ThermalCell".
 */
export interface ThermalCell {
  lngLat: LngLat;
  baseC: number;
  newC: number;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "BacktestShowPayload".
 */
export interface BacktestShowPayload {
  model: "traffic" | "thermal";
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "DirectorBeatPayload".
 */
export interface DirectorBeatPayload {
  beat: DemoBeat;
}
/**
 * ΠΡΟΤΑΣΗ Dev4: κατάσταση υπηρεσιών. Το web το δείχνει μόνο στο director panel, ποτέ στο κοινό.
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "SystemStatus".
 */
export interface SystemStatus {
  at: string;
  services: SystemServices;
  /**
   * Πρόσφατα fallbacks, στα ελληνικά. Δείχνονται ΜΟΝΟ στον director.
   */
  fallbacks: string[];
}
export interface SystemServices {
  db: "postgres" | "sqlite";
  sim: ServiceState;
  agent: ServiceState;
  oasa: DataSource;
}
/**
 * ΠΡΟΤΑΣΗ Dev4: ο director έκανε reset για νέα πρόβα. Ο client καθαρίζει σενάριο/ψήφους/απόφαση.
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "StateResetPayload".
 */
export interface StateResetPayload {}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "BusesUpdateEvent".
 */
export interface BusesUpdateEvent {
  type: "buses.update";
  payload: BusesUpdatePayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ReportCreatedEvent".
 */
export interface ReportCreatedEvent {
  type: "report.created";
  payload: Report;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Report".
 */
export interface Report {
  id: string;
  /**
   * ISO 8601
   */
  createdAt: string;
  photoUrl: string;
  location: LngLat;
  /**
   * Μοίρες 0–360 από πυξίδα (0 = βορράς, δεξιόστροφα)
   */
  heading: number | null;
  accuracyM: number | null;
  classification?: ReportClassification;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ReportClassification".
 */
export interface ReportClassification {
  category: ReportCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  /**
   * Μία πρόταση στα ελληνικά
   */
  summaryEl: string;
  /**
   * Αρμόδια υπηρεσία του Δήμου
   */
  department: string;
  /**
   * Report ids
   */
  duplicates: string[];
  confidence: number;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ReportClassifiedEvent".
 */
export interface ReportClassifiedEvent {
  type: "report.classified";
  payload: Report;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ReportHiddenEvent".
 */
export interface ReportHiddenEvent {
  type: "report.hidden";
  payload: ReportHiddenPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "AgentSayEvent".
 */
export interface AgentSayEvent {
  type: "agent.say";
  payload: AgentSayPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "AgentThinkingEvent".
 */
export interface AgentThinkingEvent {
  type: "agent.thinking";
  payload: AgentThinkingPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "CameraFlyToEvent".
 */
export interface CameraFlyToEvent {
  type: "camera.flyTo";
  payload: CameraFlyToPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "LayerSetEvent".
 */
export interface LayerSetEvent {
  type: "layer.set";
  payload: LayerSetPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "TimeSetEvent".
 */
export interface TimeSetEvent {
  type: "time.set";
  payload: TimeSetPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ScenarioCreatedEvent".
 */
export interface ScenarioCreatedEvent {
  type: "scenario.created";
  payload: Scenario;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Scenario".
 */
export interface Scenario {
  id: string;
  /**
   * π.χ. «Δέντρα και λωρίδα λεωφορείου στην Πειραιώς»
   */
  title: string;
  edits: ScenarioEdit[];
  /**
   * ISO 8601 — για θερμικό/ήλιο (slider)
   */
  when: string;
  origin: "user" | "agent_variant";
  /**
   * Για παραλλαγές του agent
   */
  parentId?: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "CloseRoadEdit".
 */
export interface CloseRoadEdit {
  type: "close_road";
  wayIds: WayIds;
}
/**
 * Αφαιρεί μία λωρίδα ΙΧ και τη δίνει στα λεωφορεία
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "BusLaneEdit".
 */
export interface BusLaneEdit {
  type: "bus_lane";
  wayIds: WayIds;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "RemoveLaneEdit".
 */
export interface RemoveLaneEdit {
  type: "remove_lane";
  wayIds: WayIds;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "AddTreesEdit".
 */
export interface AddTreesEdit {
  type: "add_trees";
  geometry: LngLat[];
  count: number;
  side?: "north" | "south" | "east" | "west" | "both";
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "CoolPavementEdit".
 */
export interface CoolPavementEdit {
  type: "cool_pavement";
  wayIds: WayIds;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "SimProgressEvent".
 */
export interface SimProgressEvent {
  type: "sim.progress";
  payload: SimProgressPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "SimResultEvent".
 */
export interface SimResultEvent {
  type: "sim.result";
  payload: SimResult;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "VariantCompareEvent".
 */
export interface VariantCompareEvent {
  type: "variant.compare";
  payload: VariantComparePayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "BacktestShowEvent".
 */
export interface BacktestShowEvent {
  type: "backtest.show";
  payload: BacktestShowPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ConsultationOpenedEvent".
 */
export interface ConsultationOpenedEvent {
  type: "consultation.opened";
  payload: Consultation;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "VoteTallyEvent".
 */
export interface VoteTallyEvent {
  type: "vote.tally";
  payload: VoteTally;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "DecisionReadyEvent".
 */
export interface DecisionReadyEvent {
  type: "decision.ready";
  payload: DecisionDraft;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "DirectorBeatEvent".
 */
export interface DirectorBeatEvent {
  type: "director.beat";
  payload: DirectorBeatPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "SystemStatusEvent".
 */
export interface SystemStatusEvent {
  type: "system.status";
  payload: SystemStatus;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "StateResetEvent".
 */
export interface StateResetEvent {
  type: "state.reset";
  payload: StateResetPayload;
  /**
   * true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)
   */
  replay?: boolean;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "NearbyReport".
 */
export interface NearbyReport {
  id: string;
  distanceM: number;
  category?: ReportCategory;
}
/**
 * gateway → agent: POST {AGENT_URL}/classify. Απάντηση: ReportClassification.
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "ClassifyRequest".
 */
export interface ClassifyRequest {
  report: Report;
  /**
   * Η φωτογραφία (ήδη resized ~1600px)
   */
  imageBase64: string;
  mimeType: string;
  /**
   * Αναφορές σε ακτίνα 50 m (PostGIS), για να γεμίσει το duplicates
   */
  nearby: NearbyReport[];
}
/**
 * web → gateway POST /api/agent/prompt → agent POST {AGENT_URL}/prompt
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "AgentPrompt".
 */
export interface AgentPrompt {
  textEl: string;
}
/**
 * Απάντηση του POST /api/media (εικόνες after, audio του TTS)
 *
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "MediaUploadResult".
 */
export interface MediaUploadResult {
  url: string;
}
/**
 * This interface was referenced by `AthenaContracts`'s JSON-Schema
 * via the `definition` "Backtest".
 */
export interface Backtest {
  model: "traffic" | "thermal";
  metric: "MAPE" | "MAE_C" | "R2";
  value: number;
  /**
   * π.χ. «Τρίτη 17/11, 07:00–10:00» ή «Landsat 14/07/2025»
   */
  heldOut: string;
  nSamples: number;
  chart: {
    predicted: number;
    observed: number;
  }[];
}
