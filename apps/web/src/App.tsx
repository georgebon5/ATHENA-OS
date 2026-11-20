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
import { AgentOrb } from "./hud/AgentOrb";
import { Subtitles } from "./hud/Subtitles";
import { ThinkingCard } from "./hud/ThinkingCard";
import { ResultsCard } from "./hud/ResultsCard";
import { TimeSlider } from "./hud/TimeSlider";
import { VariantCompare } from "./hud/VariantCompare";
import { EngagePanel } from "./hud/EngagePanel";
import { BacktestPanel } from "./hud/BacktestPanel";
import { DecisionPanel } from "./hud/DecisionPanel";
import { DirectorBar } from "./hud/DirectorBar";
import { FPSOverlay } from "./hud/FPSOverlay";
import { VoteCounter } from "./hud/VoteCounter";
import { Minimap } from "./hud/Minimap";
import { DrawPanel } from "./hud/DrawPanel";
import { CommandBar } from "./hud/CommandBar";
import { WsClient } from "./ws/client";
import { dispatchWs } from "./ws/dispatcher";
import { useStore } from "./store/useStore";
import { WS_URL } from "./cesium/cesium-config";
import { ErrorBoundary } from "./ErrorBoundary";
import { fetchNetwork } from "./network/networkClient";

export default function App() {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const setWsConnected = useStore((s) => s.setWsConnected);
  const setNetworkWays = useStore((s) => s.setNetworkWays);
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

  return (
    <div className="fixed inset-0 bg-ink overflow-hidden">
      <ErrorBoundary name="viewer"><CesiumViewer onReady={setViewer} /></ErrorBoundary>
      <ErrorBoundary name="buses"><BusesLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="reports"><ReportsLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="traffic"><TrafficLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="thermal"><ThermalLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="votes"><VotesLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="draw"><DrawLayer viewer={viewer} /></ErrorBoundary>
      <ErrorBoundary name="scenario"><ScenarioLayer viewer={viewer} /></ErrorBoundary>

      <ErrorBoundary name="time"><TimeSlider /></ErrorBoundary>
      <ErrorBoundary name="minimap"><Minimap /></ErrorBoundary>
      <ErrorBoundary name="draw-panel"><DrawPanel /></ErrorBoundary>
      <ErrorBoundary name="thinking"><ThinkingCard /></ErrorBoundary>
      <ErrorBoundary name="results"><ResultsCard /></ErrorBoundary>
      <ErrorBoundary name="variant"><VariantCompare /></ErrorBoundary>
      <ErrorBoundary name="vote-counter"><VoteCounter /></ErrorBoundary>
      <ErrorBoundary name="orb"><AgentOrb /></ErrorBoundary>
      <ErrorBoundary name="subtitles"><Subtitles /></ErrorBoundary>
      <ErrorBoundary name="engage"><EngagePanel /></ErrorBoundary>
      <ErrorBoundary name="backtest"><BacktestPanel /></ErrorBoundary>
      <ErrorBoundary name="decision"><DecisionPanel /></ErrorBoundary>
      <ErrorBoundary name="command"><CommandBar /></ErrorBoundary>
      <ErrorBoundary name="director"><DirectorBar /></ErrorBoundary>
      <ErrorBoundary name="fps"><FPSOverlay /></ErrorBoundary>
    </div>
  );
}
