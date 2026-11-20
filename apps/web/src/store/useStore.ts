import { create } from "zustand";
import type {
  AgentMood,
  Backtest,
  Bus,
  Consultation,
  DecisionDraft,
  DemoBeat,
  LayerKey,
  LngLat,
  Report,
  Scenario,
  SimResult,
  Vote,
} from "@/types/contracts";

export type Visibility = Record<LayerKey, boolean>;

export interface AgentSpeech {
  textEl: string;
  audioUrl?: string;
  mood: AgentMood;
  at: number;
}

export interface ThinkingStep {
  id: string;
  textEl: string;
  at: number;
}

export interface VariantCompareState {
  base: SimResult;
  best: SimResult;
  reasonEl: string;
}

export interface VoteTally {
  consultationId: string;
  yes: number;
  no: number;
  maybe: number;
  points: { lngLat: Vote["location"]; choice: Vote["choice"] }[];
}

export interface AthenaState {
  // connectivity + beat
  wsConnected: boolean;
  wsLatencyMs: number | null;
  beat: DemoBeat;
  director: boolean;

  // layers
  layers: Visibility;

  // data
  buses: Bus[];
  busesUpdatedAt: number;
  reports: Record<string, Report>;
  activeScenario: Scenario | null;
  simProgress: number | null; // 0..1
  simResult: SimResult | null;
  variant: VariantCompareState | null;
  consultation: Consultation | null;
  voteTally: VoteTally | null;
  decision: DecisionDraft | null;
  backtestVisible: "traffic" | "thermal" | null;
  backtests: Backtest[];

  // agent presentation
  agentSpeech: AgentSpeech | null;
  thinking: ThinkingStep[];

  // time
  when: string | null;

  // scenario draw mode (interactive, ο χρήστης κλικάρει σημεία)
  drawMode: boolean;
  drawPoints: LngLat[];

  // road network (wayId → geometry) από GET /network — fallback για segments χωρίς inline path
  networkWays: Map<number, LngLat[]>;

  // actions
  setWsConnected: (v: boolean, latencyMs?: number) => void;
  setBeat: (b: DemoBeat) => void;
  setDirector: (v: boolean) => void;
  setLayer: (layer: LayerKey, visible: boolean) => void;
  setBuses: (buses: Bus[]) => void;
  upsertReport: (r: Report) => void;
  setActiveScenario: (s: Scenario | null) => void;
  setSimProgress: (pct: number | null) => void;
  setSimResult: (r: SimResult | null) => void;
  setVariant: (v: VariantCompareState | null) => void;
  setConsultation: (c: Consultation | null) => void;
  setVoteTally: (t: VoteTally | null) => void;
  setDecision: (d: DecisionDraft | null) => void;
  setBacktestVisible: (model: "traffic" | "thermal" | null) => void;
  setBacktests: (bs: Backtest[]) => void;
  setAgentSpeech: (s: AgentSpeech | null) => void;
  pushThinking: (stepEl: string) => void;
  clearThinking: () => void;
  setWhen: (iso: string | null) => void;
  setDrawMode: (v: boolean) => void;
  pushDrawPoint: (p: LngLat) => void;
  clearDrawPoints: () => void;
  setNetworkWays: (ways: Map<number, LngLat[]>) => void;
  reset: () => void;
}

const initialLayers: Visibility = {
  traffic: true,
  thermal: false,
  reports: true,
  votes: false,
  buses: true,
};

export const useStore = create<AthenaState>((set) => ({
  wsConnected: false,
  wsLatencyMs: null,
  beat: "INTRO",
  director: false,
  layers: initialLayers,
  buses: [],
  busesUpdatedAt: 0,
  reports: {},
  activeScenario: null,
  simProgress: null,
  simResult: null,
  variant: null,
  consultation: null,
  voteTally: null,
  decision: null,
  backtestVisible: null,
  backtests: [],
  agentSpeech: null,
  thinking: [],
  when: null,
  drawMode: false,
  drawPoints: [],
  networkWays: new Map(),

  setWsConnected: (v, latencyMs) =>
    set({ wsConnected: v, wsLatencyMs: latencyMs ?? null }),
  setBeat: (b) => set({ beat: b }),
  setDirector: (v) => set({ director: v }),
  setLayer: (layer, visible) =>
    set((s) => ({ layers: { ...s.layers, [layer]: visible } })),
  setBuses: (buses) => set({ buses, busesUpdatedAt: performance.now() }),
  upsertReport: (r) =>
    set((s) => ({ reports: { ...s.reports, [r.id]: { ...s.reports[r.id], ...r } } })),
  setActiveScenario: (s) => set({ activeScenario: s }),
  setSimProgress: (pct) => set({ simProgress: pct }),
  setSimResult: (r) => set({ simResult: r, simProgress: r ? 1 : null }),
  setVariant: (v) => set({ variant: v }),
  setConsultation: (c) => set({ consultation: c }),
  setVoteTally: (t) => set({ voteTally: t }),
  setDecision: (d) => set({ decision: d }),
  setBacktestVisible: (model) => set({ backtestVisible: model }),
  setBacktests: (bs) => set({ backtests: bs }),
  setAgentSpeech: (s) => set({ agentSpeech: s }),
  pushThinking: (stepEl) =>
    set((s) => ({
      thinking: [
        ...s.thinking,
        { id: crypto.randomUUID(), textEl: stepEl, at: performance.now() },
      ].slice(-8),
    })),
  clearThinking: () => set({ thinking: [] }),
  setWhen: (iso) => set({ when: iso }),
  setDrawMode: (v) =>
    set((s) => ({ drawMode: v, drawPoints: v ? s.drawPoints : [] })),
  pushDrawPoint: (p) =>
    set((s) => ({ drawPoints: [...s.drawPoints, p] })),
  clearDrawPoints: () => set({ drawPoints: [] }),
  setNetworkWays: (ways) => set({ networkWays: ways }),
  reset: () =>
    set({
      beat: "INTRO",
      buses: [],
      reports: {},
      activeScenario: null,
      simProgress: null,
      simResult: null,
      variant: null,
      consultation: null,
      voteTally: null,
      decision: null,
      backtestVisible: null,
      agentSpeech: null,
      thinking: [],
      when: null,
      drawMode: false,
      drawPoints: [],
      layers: initialLayers,
    }),
}));
