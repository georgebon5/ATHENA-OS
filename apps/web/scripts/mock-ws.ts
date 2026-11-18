/**
 * Mock WebSocket server: παίζει ολόκληρο το 5λεπτο demo με realistic timings,
 * ώστε ο Dev1 να μπορεί να στήνει visuals χωρίς να υπάρχει backend.
 *
 * Χρήση:  pnpm --filter @athena-os/web mock
 * Μετά: VITE_WS_URL=ws://localhost:8787 pnpm dev
 */
import { WebSocketServer, type WebSocket } from "ws";
import type { WsEvent } from "../src/types/contracts";
import {
  DEMO_BACKTESTS,
  DEMO_CONSULTATION,
  DEMO_DECISION,
  DEMO_REPORT,
  DEMO_REPORT_CLASSIFIED,
  DEMO_SCENARIO,
  DEMO_SIM_BEST,
  DEMO_SIM_RESULT,
  makeBuses,
} from "./fixtures";

const PORT = Number(process.env.MOCK_PORT ?? 8787);
const wss = new WebSocketServer({ port: PORT });
console.log(`[mock-ws] listening on ws://localhost:${PORT}`);

const timeline: Array<{ atMs: number; ev: WsEvent }> = [
  // INTRO (0:00–0:40)
  { atMs: 0, ev: { type: "director.beat", payload: { beat: "INTRO" } } },
  {
    atMs: 500,
    ev: {
      type: "camera.flyTo",
      payload: {
        lngLat: [23.7108, 37.9787],
        heightM: 500,
        headingDeg: 35,
        pitchDeg: -35,
        durationS: 4,
        shot: "orbitSerafio",
      },
    },
  },
  {
    atMs: 1200,
    ev: {
      type: "agent.say",
      payload: {
        textEl:
          "Είμαι η ATHENA. Αυτή τη στιγμή παρακολουθώ 3 λεωφορεία στην Πειραιώς και 180 αναφορές πολιτών.",
        mood: "neutral",
      },
    },
  },

  // PITCH (0:40–1:00)
  { atMs: 40_000, ev: { type: "director.beat", payload: { beat: "PITCH" } } },

  // SENSE (1:00–1:45)
  { atMs: 60_000, ev: { type: "director.beat", payload: { beat: "SENSE" } } },
  { atMs: 60_500, ev: { type: "report.created", payload: DEMO_REPORT } },
  {
    atMs: 61_000,
    ev: {
      type: "agent.say",
      payload: {
        textEl: "Νέα αναφορά στην Πειραιώς 144. Αναλύω την εικόνα…",
        mood: "alert",
      },
    },
  },
  {
    atMs: 63_500,
    ev: { type: "report.classified", payload: DEMO_REPORT_CLASSIFIED },
  },
  {
    atMs: 64_000,
    ev: { type: "layer.set", payload: { layer: "thermal", visible: true } },
  },
  {
    atMs: 64_200,
    ev: {
      type: "agent.say",
      payload: {
        textEl:
          "Το σημείο συμπίπτει με θερμικό hotspot 36°C. Το δρομολογώ στη Διεύθυνση Πρασίνου.",
        mood: "neutral",
      },
    },
  },

  // SIMULATE (1:45–3:00)
  { atMs: 105_000, ev: { type: "director.beat", payload: { beat: "SIMULATE" } } },
  {
    atMs: 105_500,
    ev: {
      type: "agent.say",
      payload: {
        textEl:
          "«Τι θα γίνει αν αφαιρέσουμε μία λωρίδα και φυτέψουμε δέντρα;» Το υπολογίζω.",
        mood: "neutral",
      },
    },
  },
  { atMs: 106_000, ev: { type: "scenario.created", payload: DEMO_SCENARIO } },
  {
    atMs: 106_500,
    ev: {
      type: "agent.thinking",
      payload: { stepEl: "Δοκιμάζω παραλλαγή 1/4: δέντρα στη βόρεια πλευρά…" },
    },
  },
  {
    atMs: 107_800,
    ev: {
      type: "agent.thinking",
      payload: { stepEl: "Δοκιμάζω παραλλαγή 2/4: δέντρα στη νότια πλευρά…" },
    },
  },
  {
    atMs: 109_000,
    ev: { type: "sim.progress", payload: { scenarioId: DEMO_SCENARIO.id, pct: 0.5 } },
  },
  {
    atMs: 109_500,
    ev: {
      type: "agent.thinking",
      payload: { stepEl: "Δοκιμάζω παραλλαγή 3/4: cool pavement + λιγότερα δέντρα…" },
    },
  },
  {
    atMs: 110_500,
    ev: {
      type: "agent.thinking",
      payload: { stepEl: "Δοκιμάζω παραλλαγή 4/4: δέντρα νότια + λωρίδα λεωφορείου…" },
    },
  },
  { atMs: 112_000, ev: { type: "sim.result", payload: DEMO_SIM_RESULT } },
  {
    atMs: 115_000,
    ev: {
      type: "variant.compare",
      payload: {
        base: DEMO_SIM_RESULT,
        best: DEMO_SIM_BEST,
        reasonEl:
          "Η παραλλαγή 4 ρίχνει το hotspot κατά 3,4°C με παρόμοιο κόστος και καλύτερη κυκλοφοριακή απόδοση.",
      },
    },
  },
  {
    atMs: 120_000,
    ev: {
      type: "time.set",
      payload: { when: `${new Date().getFullYear()}-07-15T12:00:00Z` },
    },
  },
  {
    atMs: 125_000,
    ev: { type: "backtest.show", payload: { model: "traffic" } },
  },

  // ENGAGE (3:00–4:00)
  { atMs: 180_000, ev: { type: "director.beat", payload: { beat: "ENGAGE" } } },
  { atMs: 180_500, ev: { type: "consultation.opened", payload: DEMO_CONSULTATION } },
  {
    atMs: 185_000,
    ev: {
      type: "vote.tally",
      payload: {
        consultationId: DEMO_CONSULTATION.id,
        yes: 12,
        no: 2,
        maybe: 3,
        points: samplePoints(17),
      },
    },
  },
  {
    atMs: 192_000,
    ev: {
      type: "vote.tally",
      payload: {
        consultationId: DEMO_CONSULTATION.id,
        yes: 38,
        no: 6,
        maybe: 9,
        points: samplePoints(53),
      },
    },
  },
  {
    atMs: 200_000,
    ev: {
      type: "vote.tally",
      payload: {
        consultationId: DEMO_CONSULTATION.id,
        yes: 71,
        no: 9,
        maybe: 14,
        points: samplePoints(94),
      },
    },
  },

  // DECISION (4:00–4:30)
  { atMs: 240_000, ev: { type: "director.beat", payload: { beat: "DECISION" } } },
  { atMs: 240_500, ev: { type: "decision.ready", payload: DEMO_DECISION } },

  // CLOSE (4:30–5:00)
  { atMs: 270_000, ev: { type: "director.beat", payload: { beat: "CLOSE" } } },
  {
    atMs: 270_500,
    ev: {
      type: "camera.flyTo",
      payload: {
        lngLat: [23.7108, 37.9787],
        heightM: 900,
        headingDeg: 0,
        pitchDeg: -55,
        durationS: 4,
        shot: "riseToOverview",
      },
    },
  },
];

function samplePoints(n: number) {
  const out: { lngLat: [number, number]; choice: "yes" | "no" | "maybe" }[] = [];
  for (let i = 0; i < n; i++) {
    const lng = 23.7108 + (Math.random() - 0.5) * 0.015;
    const lat = 37.9787 + (Math.random() - 0.5) * 0.012;
    const r = Math.random();
    const choice = r < 0.75 ? "yes" : r < 0.9 ? "maybe" : "no";
    out.push({ lngLat: [lng, lat], choice });
  }
  return out;
}

function schedule(ws: WebSocket, startAt: number) {
  for (const { atMs, ev } of timeline) {
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(ev));
    }, atMs);
  }
  // Συνεχές bus update κάθε 10s
  const busTimer = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return;
    const t = (Date.now() - startAt) / 1000;
    ws.send(
      JSON.stringify({
        type: "buses.update",
        payload: { buses: makeBuses(t) },
      }),
    );
  }, 10_000);
  ws.on("close", () => clearInterval(busTimer));
  // Αρχικό snapshot αμέσως
  ws.send(
    JSON.stringify({
      type: "buses.update",
      payload: { buses: makeBuses(0) },
    }),
  );
}

wss.on("connection", (ws) => {
  console.log("[mock-ws] client connected, πατάω play στο demo timeline");
  const start = Date.now();
  schedule(ws, start);
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
    } catch {
      // ignore
    }
  });
});
