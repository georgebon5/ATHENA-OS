import type {
  Backtest,
  Bus,
  Consultation,
  DecisionDraft,
  LngLat,
  Report,
  Scenario,
  SimResult,
  ThermalCell,
} from "../src/types/contracts";
// Shared canonical fixture — ίδιο ακριβώς JSON που βλέπει και ο sim του Dev2.
// Οτιδήποτε αλλάξει στο SimResult πρέπει να γίνει στο packages/contracts.
import sharedSimResult from "../../../packages/contracts/fixtures/sim_result.json";

// Παράδειγμα path της οδού Πειραιώς γύρω από το Σεράφειο (για buses animation)
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
    { type: "bus_lane", wayIds: [100003, 100004] },
  ],
  when: new Date().toISOString(),
  origin: "user",
};

// Βάση: το shared fixture του Dev2· κάνουμε μόνο override του scenarioId.
export const DEMO_SIM_RESULT: SimResult = {
  ...(sharedSimResult as SimResult),
  scenarioId: DEMO_SCENARIO.id,
};

// Variant της ATHENA: ίδιο δίκτυο αλλά ισχυρότερη μείωση hotspot/χρόνου.
export const DEMO_SIM_BEST: SimResult = {
  ...DEMO_SIM_RESULT,
  traffic: {
    ...DEMO_SIM_RESULT.traffic,
    corridorTravelTimeDeltaPct: { p10: -11.4, p50: -8.1, p90: -4.3 },
  },
  thermal: {
    ...DEMO_SIM_RESULT.thermal,
    cells: DEMO_SIM_RESULT.thermal.cells.map((c: ThermalCell) => ({
      ...c,
      newC: c.newC - 1.2,
    })),
    hotspotDeltaC: { p10: -5.8, p50: -4.5, p90: -2.4 },
  },
  emissions: { co2DeltaPct: { p10: -7.2, p50: -4.6, p90: -1.3 } },
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
  publicUrl: "http://localhost:8000/c/v/c-demo-001",
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
Η προσομοίωση του ATHENA OS εκτίμησε μείωση χρόνου διαδρομής του άξονα κατά 8,1% (p10 -11,4%, p90 -4,3%) και μείωση θερμικού hotspot κατά 4,5°C (p10 -5,8°C, p90 -2,4°C).

ΔΕΔΟΜΕΝΑ
· Κυκλοφοριακά ΟΑΣΑ 20/11/2026
· Θερμικός χάρτης Landsat 14/07/2025
· Αναφορές πολιτών μέσω ATHENA OS
· Δίκτυο: packages/contracts/fixtures/network.geojson

ΔΙΑΒΟΥΛΕΥΣΗ
Από την ανοιχτή διαβούλευση συμμετείχαν πολίτες μέσω QR στην πλατφόρμα ATHENA.

ΑΠΟΦΑΣΙΖΕΙ (ΣΧΕΔΙΟ)
Η Επιτροπή Ποιότητας Ζωής εισηγείται στο Δημοτικό Συμβούλιο την έγκριση του σεναρίου, με επανεκτίμηση μετά από 6 μήνες πιλοτικής εφαρμογής.`,
  citations: [
    { label: "Προσομοίωση κυκλοφορίας", source: "sim#s-fixture-001/traffic" },
    { label: "Θερμικός χάρτης", source: "Landsat-8 · 14/07/2025" },
    { label: "Αναφορές πολιτών", source: "ATHENA Sense · 2026-11" },
    { label: "Αποτελέσματα διαβούλευσης", source: "ATHENA Engage · c-demo-001" },
  ],
};
