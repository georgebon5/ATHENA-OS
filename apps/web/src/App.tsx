import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { CesiumViewer } from "./cesium/Viewer";
import { BusesLayer } from "./layers/BusesLayer";
import { ReportsLayer } from "./layers/ReportsLayer";
import { TrafficLayer } from "./layers/TrafficLayer";
import { ThermalLayer } from "./layers/ThermalLayer";
import { VotesLayer } from "./layers/VotesLayer";
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
import { WsClient } from "./ws/client";
import { dispatchWs } from "./ws/dispatcher";
import { useStore } from "./store/useStore";
import { WS_URL } from "./cesium/cesium-config";
import { useDirector } from "./director/useDirector";

export default function App() {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const setWsConnected = useStore((s) => s.setWsConnected);
  const clientRef = useRef<WsClient | null>(null);
  useDirector();

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

  return (
    <div className="fixed inset-0 bg-ink overflow-hidden">
      <CesiumViewer onReady={setViewer} />
      <BusesLayer viewer={viewer} />
      <ReportsLayer viewer={viewer} />
      <TrafficLayer viewer={viewer} />
      <ThermalLayer viewer={viewer} />
      <VotesLayer viewer={viewer} />

      <TimeSlider />
      <ThinkingCard />
      <ResultsCard />
      <VariantCompare />
      <VoteCounter />
      <AgentOrb />
      <Subtitles />
      <EngagePanel />
      <BacktestPanel />
      <DecisionPanel />
      <DirectorBar />
      <FPSOverlay />
    </div>
  );
}
