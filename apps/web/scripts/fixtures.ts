import type {
  Backtest,
  Bus,
  Consultation,
  DecisionDraft,
  LngLat,
  Report,
  Scenario,
  SimResult,
  TrafficSegment,
  Trip,
} from "../src/types/contracts";

const SERAFIO: LngLat = [23.7108, 37.9787];
// Παράδειγμα path της οδού Πειραιώς γύρω από το Σεράφειο
const PIRAIOS: LngLat[] = [
  [23.705, 37.974],
  [23.7065, 37.9755],
  [23.708, 37.977],
  [23.7108, 37.9787],
  [23.713, 37.98],
  [23.7155, 37.9815],
];

export function makeBuses(nowS: number): Bus[] {
  const t = nowS % 60;
  const f = t / 60;
  const idx = Math.floor(f * (PIRAIOS.length - 1));
  const next = Math.min(PIRAIOS.length - 1, idx + 1);
  const subF = f * (PIRAIOS.length - 1) - idx;
  const a = PIRAIOS[idx];
  const b = PIRAIOS[next];
  const lng = a[0] + (b[0] - a[0]) * subF;
  const lat = a[1] + (b[1] - a[1]) * subF;
  return [
    { id: "b1", line: "049", lngLat: [lng, lat], bearing: 60 },
    {
      id: "b2",
      line: "914",
      lngLat: [lng - 0.0025, lat - 0.0012],
      bearing: 240,
    },
    {
      id: "b3",
      line: "Β18",
      lngLat: [lng + 0.0019, lat + 0.0009],
      bearing: 70,
    },
  ];
}

export const DEMO_REPORT: Report = {
  id: "r-demo-001",
  createdAt: new Date().toISOString(),
  photoUrl:
    "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=600&q=70",
  location: [23.7111, 37.9789],
  heading: 48,
  accuracyM: 6,
};

export const DEMO_REPORT_CLASSIFIED: Report = {
  ...DEMO_REPORT,
  classification: {
    category: "heat_exposure",
    severity: 4,
    summaryEl: "Έκθεση σε υψηλή θερμοκρασία στο πεζοδρόμιο της Πειραιώς",
    department: "Διεύθυνση Πρασίνου & Αστικής Πανίδας",
    duplicates: [],
    confidence: 0.84,
  },
};

export const DEMO_SCENARIO: Scenario = {
  id: "s-demo-001",
  title: "Δέντρα και λωρίδα λεωφορείου στην Πειραιώς",
  edits: [
    { type: "add_trees", geometry: PIRAIOS, count: 42, side: "south" },
    { type: "bus_lane", wayIds: [10045, 10046] },
  ],
  when: new Date().toISOString(),
  origin: "user",
};

function makeSegments(scale: number): TrafficSegment[] {
  const segs: TrafficSegment[] = [];
  for (let i = 0; i < PIRAIOS.length - 1; i++) {
    const a = PIRAIOS[i];
    const b = PIRAIOS[i + 1];
    segs.push({
      wayId: 10000 + i,
      baseFlow: 1200,
      newFlow: Math.round(1200 * (1 - 0.12 * scale)),
      baseTimeS: 65,
      newTimeS: Math.round(65 * (1 - 0.1 * scale)),
      path: [a, b],
    });
  }
  return segs;
}

function makeTrips(count: number): Trip[] {
  const out: Trip[] = [];
  for (let i = 0; i < count; i++) {
    const offsetLat = (Math.random() - 0.5) * 0.0004;
    const offsetLng = (Math.random() - 0.5) * 0.0004;
    const path: LngLat[] = PIRAIOS.map(
      ([lng, lat]) => [lng + offsetLng, lat + offsetLat],
    );
    if (Math.random() < 0.5) path.reverse();
    out.push({
      path,
      departS: Math.random() * 10,
      durationS: 20 + Math.random() * 20,
    });
  }
  return out;
}

function makeCells(deltaC: number) {
  const cells = [];
  const span = 0.006;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const lng = SERAFIO[0] + (dx / 6) * span;
      const lat = SERAFIO[1] + (dy / 6) * span;
      const d = Math.hypot(dx, dy);
      const base = 36 - Math.max(0, d - 1) * 1.2;
      cells.push({
        lngLat: [lng, lat] as LngLat,
        baseC: base,
        newC: base + deltaC + (Math.random() - 0.5) * 0.2,
      });
    }
  }
  return cells;
}

export const DEMO_SIM_RESULT: SimResult = {
  scenarioId: DEMO_SCENARIO.id,
  status: "ok",
  computeMs: 2100,
  traffic: {
    segments: makeSegments(1),
    corridorTravelTimeDeltaPct: { p10: -6.5, p50: -3.8, p90: -1.1 },
    vehicleKmDeltaPct: { p10: -5.1, p50: -2.4, p90: 0.3 },
    trips: makeTrips(800),
  },
  thermal: {
    when: new Date().toISOString(),
    cells: makeCells(-2.2),
    hotspotDeltaC: { p10: -3.1, p50: -2.2, p90: -0.9 },
  },
  emissions: { co2DeltaPct: { p10: -4.8, p50: -2.1, p90: 0.2 } },
  notes: [
    "Προσομοίωση με δεδομένα ΟΑΣΑ Πεμ 20/11, 08:00–10:00",
    "Θερμικό πλέγμα 25m από Landsat 14/07/2025",
    "Παραδοχή: 42 δέντρα, κάλυψη κόμης +18%",
  ],
};

export const DEMO_SIM_BEST: SimResult = {
  ...DEMO_SIM_RESULT,
  traffic: {
    ...DEMO_SIM_RESULT.traffic,
    corridorTravelTimeDeltaPct: { p10: -9.0, p50: -6.3, p90: -3.2 },
  },
  thermal: {
    ...DEMO_SIM_RESULT.thermal,
    cells: makeCells(-3.4),
    hotspotDeltaC: { p10: -4.6, p50: -3.4, p90: -1.9 },
  },
  emissions: { co2DeltaPct: { p10: -6.0, p50: -3.4, p90: -0.9 } },
};

export const DEMO_CONSULTATION: Consultation = {
  id: "c-demo-001",
  scenarioId: DEMO_SCENARIO.id,
  reportId: DEMO_REPORT.id,
  beforeUrl:
    "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=70",
  afterUrl:
    "https://images.unsplash.com/photo-1507149833265-60c372daea22?auto=format&fit=crop&w=1200&q=70",
  questionEl:
    "Να προστεθούν 42 δέντρα και αποκλειστική λωρίδα λεωφορείου στην Πειραιώς;",
  publicUrl: "https://athena.gov.gr/c/demo-001",
};

export const DEMO_BACKTESTS: Backtest[] = [
  {
    model: "traffic",
    metric: "MAPE",
    value: 11.4,
    heldOut: "Τρίτη 18/11/2026, 07:00–10:00",
    nSamples: 184,
    chart: Array.from({ length: 100 }, () => {
      const v = 300 + Math.random() * 900;
      return { predicted: v, observed: v + (Math.random() - 0.5) * 120 };
    }),
  },
  {
    model: "thermal",
    metric: "MAE_C",
    value: 0.72,
    heldOut: "Landsat 14/07/2025",
    nSamples: 420,
    chart: Array.from({ length: 160 }, () => {
      const v = 28 + Math.random() * 10;
      return { predicted: v, observed: v + (Math.random() - 0.5) * 1.5 };
    }),
  },
];

export const DEMO_DECISION: DecisionDraft = {
  scenarioId: DEMO_SCENARIO.id,
  markdownEl: `ΘΕΜΑ
Διαμόρφωση της οδού Πειραιώς στο ύψος του Σεραφείου με προσθήκη αστικού πρασίνου και αποκλειστικής λωρίδας λεωφορείου.

ΣΚΕΠΤΙΚΟ
Η προσομοίωση του ATHENA OS εκτίμησε μείωση χρόνου διαδρομής του άξονα κατά 6,3% (p10 -9,0%, p90 -3,2%) και μείωση θερμικού hotspot κατά 3,4°C (p10 -4,6°C, p90 -1,9°C).

ΔΕΔΟΜΕΝΑ
· Κυκλοφοριακά ΟΑΣΑ 20/11/2026
· Θερμικός χάρτης Landsat 14/07/2025
· Αναφορές πολιτών μέσω ATHENA OS

ΔΙΑΒΟΥΛΕΥΣΗ
Από την ανοιχτή διαβούλευση συμμετείχαν πολίτες μέσω QR στην πλατφόρμα ATHENA.

ΑΠΟΦΑΣΙΖΕΙ (ΣΧΕΔΙΟ)
Η Επιτροπή Ποιότητας Ζωής εισηγείται στο Δημοτικό Συμβούλιο την έγκριση του σεναρίου, με επανεκτίμηση μετά από 6 μήνες πιλοτικής εφαρμογής.`,
  citations: [
    { label: "Προσομοίωση κυκλοφορίας", source: "sim#s-demo-001/traffic" },
    { label: "Θερμικός χάρτης", source: "Landsat-8 · 14/07/2025" },
    { label: "Αναφορές πολιτών", source: "ATHENA Sense · 2026-11" },
    { label: "Αποτελέσματα διαβούλευσης", source: "ATHENA Engage · c-demo-001" },
  ],
};
