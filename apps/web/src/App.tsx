import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { CesiumViewer } from "./cesium/Viewer";
import { BusesLayer } from "./layers/BusesLayer";
import { ReportsLayer } from "./layers/ReportsLayer";
import { TrafficLayer } from "./layers/TrafficLayer";
import { ThermalLayer } from "./layers/ThermalLayer";
import { VotesLayer } from "./layers/VotesLayer";
import { DrawLayer } from "./layers/DrawLayer";
import { ScenarioLayer } from "./layers/ScenarioLayer";
import { ProjectsLayer } from "./layers/ProjectsLayer";
import { PoisLayer } from "./layers/PoisLayer";
import { EventsLayer } from "./layers/EventsLayer";
import { Subtitles } from "./hud/Subtitles";
import { CommandBar } from "./hud/CommandBar";
import { ThinkingCard } from "./hud/ThinkingCard";
import { ResultsCard } from "./hud/ResultsCard";
import { TopBar } from "./hud/TopBar";
import { BeatBanner } from "./hud/BeatBanner";
import { Toasts } from "./hud/Toasts";
import { VariantCompare } from "./hud/VariantCompare";
import { EngagePanel } from "./hud/EngagePanel";
import { BacktestPanel } from "./hud/BacktestPanel";
import { DecisionPanel } from "./hud/DecisionPanel";
import { DirectorBar } from "./hud/DirectorBar";
import { FPSOverlay } from "./hud/FPSOverlay";
import { IntroPills } from "./hud/IntroPills";
import { VoteCounter } from "./hud/VoteCounter";
import { SunClock } from "./hud/SunClock";
import { NearbyPanel } from "./hud/NearbyPanel";
import { WsClient } from "./ws/client";
import { dispatchWs } from "./ws/dispatcher";
import { useStore } from "./store/useStore";
import { WS_URL } from "./cesium/cesium-config";
import { ErrorBoundary } from "./ErrorBoundary";
import { fetchNetwork } from "./network/networkClient";
import { fetchAllEnvReadings, buildLiveThermalResult } from "./opendata/athensEnvClient";

const DOCK_TOP = "top-[118px]";

export default function App() {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const setWsConnected = useStore((s) => s.setWsConnected);
  const setNetworkWays = useStore((s) => s.setNetworkWays);
  const sensorMode = useStore((s) => s.sensorMode);
  const setSensorMode = useStore((s) => s.setSensorMode);
  const simResult = useStore((s) => s.simResult);
  const setLiveSimResult = useStore((s) => s.setLiveSimResult);
  const setLayer = useStore((s) => s.setLayer);
  const clientRef = useRef<WsClient | null>(null);

  useEffect(() => {
    const client = new WsClient({
      url: WS_URL,
      onEvent: dispatchWs,
      onStatus: (connected, latencyMs) => setWsConnected(connected, latencyMs),
    });
    client.connect();
    clientRef.current = client;
    return () => client.close();
  }, [setWsConnected]);

  useEffect(() => {
    void fetchNetwork().then(setNetworkWays);
  }, [setNetworkWays]);

  // FLIR → thermal layer με live αισθητήρες
  useEffect(() => {
    if (sensorMode === "flir") {
      setLayer("thermal", true);
      if (!simResult) {
        void fetchAllEnvReadings().then((readings) => {
          if (readings.length > 0) setLiveSimResult(buildLiveThermalResult(readings));
        });
      }
    } else {
      setLayer("thermal", false);
      setLiveSimResult(null);
    }
  }, [sensorMode, simResult, setLayer, setLiveSimResult]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") setSensorMode(sensorMode === "flir" ? "normal" : "flir");
      if (e.key === "n" || e.key === "N") setSensorMode(sensorMode === "nvg"  ? "normal" : "nvg");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sensorMode, setSensorMode]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      {/* ── 3D πόλη ── */}
      <ErrorBoundary name="viewer"><CesiumViewer onReady={setViewer} /></ErrorBoundary>
      <ErrorBoundary name="buses"><BusesLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="reports"><ReportsLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="traffic"><TrafficLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="thermal"><ThermalLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="votes"><VotesLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="draw"><DrawLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="scenario"><ScenarioLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="projects"><ProjectsLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="pois"><PoisLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="events"><EventsLayer viewer={viewer} /></ErrorBoundary>

      {/* ── εφέ οθόνης ── */}
      <div className="screen-grid" />
      <div className="screen-fx" />

      {/* ── HUD ── */}
      <ErrorBoundary name="topbar"><TopBar /></ErrorBoundary>
      <ErrorBoundary name="intro-pills"><IntroPills /></ErrorBoundary>

      <aside className={`pointer-events-none fixed left-6 ${DOCK_TOP} z-10 flex w-[340px] flex-col gap-3`}>
        <ErrorBoundary name="director"><DirectorBar /></ErrorBoundary>
        <ErrorBoundary name="toasts"><Toasts /></ErrorBoundary>
        <ErrorBoundary name="thinking"><ThinkingCard /></ErrorBoundary>
      </aside>

      <aside className={`pointer-events-none fixed right-6 ${DOCK_TOP} z-10 flex max-h-[calc(100vh-360px)] w-[380px] flex-col gap-3`}>
        <ErrorBoundary name="results"><ResultsCard /></ErrorBoundary>
        <ErrorBoundary name="variant"><VariantCompare /></ErrorBoundary>
      </aside>

      <div className={`pointer-events-none fixed left-1/2 ${DOCK_TOP} z-10 -translate-x-1/2`}>
        <ErrorBoundary name="vote-counter"><VoteCounter /></ErrorBoundary>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex flex-col items-center gap-3 px-6">
        <ErrorBoundary name="subtitles"><Subtitles /></ErrorBoundary>
        <div className="flex w-full max-w-2xl items-center gap-3">
          <ErrorBoundary name="command"><CommandBar /></ErrorBoundary>
        </div>
      </div>

      <SunClock />
      <ErrorBoundary name="nearby"><NearbyPanel viewer={viewer} /></ErrorBoundary>

      {/* ── full-screen στιγμές ── */}
      <ErrorBoundary name="beat-banner"><BeatBanner /></ErrorBoundary>
      <ErrorBoundary name="engage"><EngagePanel /></ErrorBoundary>
      <ErrorBoundary name="backtest"><BacktestPanel /></ErrorBoundary>
      <ErrorBoundary name="decision"><DecisionPanel /></ErrorBoundary>
      <ErrorBoundary name="fps"><FPSOverlay /></ErrorBoundary>
    </div>
  );
}
