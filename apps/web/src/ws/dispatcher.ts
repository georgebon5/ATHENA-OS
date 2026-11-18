import type { WsEvent } from "@/types/contracts";
import { useStore } from "@/store/useStore";
import { cameraController } from "@/cesium/cameraShots";

/**
 * Παίρνει ένα WsEvent και το γράφει στο Zustand store ή στέλνει
 * εντολή σε side-effect (π.χ. κάμερα). Έτσι όλα τα components
 * παραμένουν «καθαρά» αφού διαβάζουν μόνο από το store.
 */
export function dispatchWs(ev: WsEvent): void {
  const s = useStore.getState();

  switch (ev.type) {
    case "buses.update":
      s.setBuses(ev.payload.buses);
      return;

    case "report.created":
    case "report.classified":
      s.upsertReport(ev.payload);
      return;

    case "agent.say":
      s.setAgentSpeech({
        textEl: ev.payload.textEl,
        audioUrl: ev.payload.audioUrl,
        mood: ev.payload.mood ?? "neutral",
        at: performance.now(),
      });
      return;

    case "agent.thinking":
      s.pushThinking(ev.payload.stepEl);
      return;

    case "camera.flyTo":
      cameraController.flyTo(ev.payload);
      return;

    case "layer.set":
      s.setLayer(ev.payload.layer, ev.payload.visible);
      return;

    case "time.set":
      s.setWhen(ev.payload.when);
      return;

    case "scenario.created":
      s.setActiveScenario(ev.payload);
      s.setSimProgress(0);
      s.setSimResult(null);
      s.clearThinking();
      return;

    case "sim.progress":
      s.setSimProgress(Math.max(0, Math.min(1, ev.payload.pct)));
      return;

    case "sim.result":
      s.setSimResult(ev.payload);
      return;

    case "variant.compare":
      s.setVariant(ev.payload);
      return;

    case "backtest.show":
      s.setBacktestVisible(ev.payload.model);
      window.setTimeout(() => {
        if (useStore.getState().backtestVisible === ev.payload.model) {
          useStore.getState().setBacktestVisible(null);
        }
      }, 5000);
      return;

    case "consultation.opened":
      s.setConsultation(ev.payload);
      s.setVoteTally({
        consultationId: ev.payload.id,
        yes: 0,
        no: 0,
        maybe: 0,
        points: [],
      });
      return;

    case "vote.tally":
      s.setVoteTally({
        consultationId: ev.payload.consultationId,
        yes: ev.payload.yes,
        no: ev.payload.no,
        maybe: ev.payload.maybe,
        points: ev.payload.points.map((p) => ({ lngLat: p.lngLat, choice: p.choice })),
      });
      return;

    case "decision.ready":
      s.setDecision(ev.payload);
      return;

    case "director.beat":
      s.setBeat(ev.payload.beat);
      return;
  }
}
