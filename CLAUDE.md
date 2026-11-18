# ATHENA OS — Κοινό context για όλη την ομάδα

Αυτό το αρχείο μπαίνει στη ρίζα του repo ως CLAUDE.md (ή AGENTS.md / κανόνες του Cursor). Κάθε coding agent το διαβάζει πρώτο. Περιγράφει τι φτιάχνουμε, πώς κουμπώνουν τα κομμάτια και ποια συμβόλαια δεν αλλάζουν.

## 1. Τι φτιάχνουμε

**ATHENA OS** — Το πρώτο AI-native λειτουργικό σύστημα μιας πόλης. Φτιάχνεται για το Apps4Athens 3.0 Gov Hackathon (Δήμος Αθηναίων, Σεράφειο, 21–22 Νοεμβρίου 2026). Έχουμε 5 λεπτά παρουσίαση.

Μια ζωντανή, φωτορεαλιστική 3D Αθήνα που μιλάει ελληνικά και κλείνει τον κύκλο πρόβλημα → προσομοίωση → γνώμη πολιτών → απόφαση:

- **SENSE** — Ο πολίτης φωτογραφίζει ένα πρόβλημα από mobile web app. Η φωτογραφία μπαίνει live στο σωστό σημείο του 3D (GPS + πυξίδα). Το AI την ταξινομεί, βαθμολογεί τη σοβαρότητα και τη δρομολογεί. Στο ίδιο μοντέλο τρέχουν live ΟΑΣΑ, open data του Δήμου και αισθητήρες.
- **SIMULATE** — Φωνητικό «τι θα γίνει αν…». Η προσομοίωση κυκλοφορίας και θερμοκρασίας τρέχει live, με εύρη αβεβαιότητας και backtesting σε ιστορικά δεδομένα. Η ATHENA εξερευνά μόνη της παραλλαγές και προτείνει καλύτερη λύση. Ένας χρονικός slider δείχνει «τώρα → καύσωνας Ιουλίου → 2035».
- **ENGAGE** — Αυτόματη διαβούλευση: AI before/after του δρόμου, ψηφοφορία μέσω QR, live heatmap αποδοχής στο 3D, και σχέδιο απόφασης του Δήμου με παραπομπές.

### Το demo είναι η προδιαγραφή

Ό,τι δεν εξυπηρετεί αυτή τη ροή δεν φτιάχνεται. Όλη η ροή γίνεται σε ένα σημείο: την οδό Πειραιώς έξω από το Σεράφειο (Πειραιώς 144 / Εχελιδών 19).

| Χρόνος | Beat | Τι πρέπει να δουλεύει |
|---|---|---|
| 0:00–0:40 | INTRO | Splat του Σεραφείου → crossfade σε Cesium → fly-over. Η ATHENA μιλάει πρώτη με live νούμερα ΟΑΣΑ |
| 0:40–1:00 | PITCH | Τίποτα τεχνικό (μιλάει ο presenter) |
| 1:00–1:45 | SENSE | Ο κριτής φωτογραφίζει → η φωτογραφία εμφανίζεται στο 3D σε <5s → ταξινόμηση → η ATHENA επισημαίνει θερμικό hotspot |
| 1:45–3:00 | SIMULATE | Φωνητική πρόταση → σενάριο → sim live → η ATHENA φέρνει καλύτερη παραλλαγή → slider στον Ιούλιο → πάνελ backtesting 5s |
| 3:00–4:00 | ENGAGE | Before/after της φωτογραφίας του κριτή → QR → ψήφοι live στον χάρτη |
| 4:00–4:30 | DECISION | Σχέδιο απόφασης στην οθόνη |
| 4:30–5:00 | CLOSE | Slide pilot (1 γειτονιά, 3 μήνες) |

## 2. Ομάδα και ιδιοκτησία

| Dev | Άτομο | Κομμάτι | Φάκελοι |
|---|---|---|---|
| Dev 1 | Γιώργος | 3D & Experience | `apps/web` |
| Dev 2 | Σωτήρης | Simulation & Backtesting | `services/sim`, `data/` |
| Dev 3 | Ledi | AI Agent (φωνή, εργαλεία, vision, image editing, απόφαση) | `services/agent` |
| Dev 4 | Φρατζιάς | Platform, realtime & Citizen app | `services/gateway`, `apps/citizen`, `infra/` |

**Κανόνας:** δεν πειράζεις φάκελο άλλου χωρίς να του το πεις. Τα κοινά (`packages/contracts`) αλλάζουν μόνο με συμφωνία και των 4.

## 3. Αρχιτεκτονική

```
                    ┌──────────────────────────┐
  Κινητά κοινού ───▶│  apps/citizen (PWA)      │  φωτογραφία + ψήφος
                    └────────────┬─────────────┘
                                 │ HTTPS REST
                    ┌────────────▼─────────────┐       ┌───────────────────┐
                    │  services/gateway        │◀─────▶│ Postgres+PostGIS  │
                    │  FastAPI · REST · WS hub │       └───────────────────┘
                    └──┬──────────▲─────────┬──┘
           WS events   │          │         │ HTTP (internal)
                    ┌──▼──────────┴──┐  ┌───▼────────────────┐
                    │ apps/web       │  │ services/sim        │
                    │ React+Cesium   │  │ traffic + thermal   │
                    │ + Director     │  │ + backtesting       │
                    └──▲─────────────┘  └───▲────────────────┘
                       │ WS events          │ HTTP (tools)
                    ┌──┴────────────────────┴──┐
                    │ services/agent            │  LLM tool-calling, STT, TTS,
                    │ "ATHENA"                  │  vision, image edit, decision
                    └───────────────────────────┘
```

- Όλη η επικοινωνία UI ↔ backend περνάει από τον gateway. Το web app ανοίγει ένα WebSocket (`/ws`) και ακούει events.
- Ο agent «οδηγεί» το UI στέλνοντας events (`camera.flyTo`, `layer.set`, `time.set`…). Έτσι η ATHENA κινεί την κάμερα όταν μιλάει, και αυτό είναι κεντρικό στο demo.
- Ο sim είναι stateless υπηρεσία. Παίρνει `Scenario` και επιστρέφει `SimResult`. Ο gateway καλεί, αποθηκεύει (cache) και κάνει broadcast.

### Stack (κλειδωμένο, αλλάζει μόνο με καλό λόγο)

- **Web:** Vite + React 18 + TypeScript + CesiumJS (απευθείας, χωρίς resium) + Zustand + Tailwind
- **Citizen app:** Vite + React + TypeScript PWA, mobile-first, HTTPS υποχρεωτικά (απαιτείται για κάμερα, γεωεντοπισμό και πυξίδα)
- **Gateway:** Python 3.11+, FastAPI, uvicorn, websockets, SQLAlchemy/asyncpg, Postgres 16 + PostGIS (docker-compose). Fallback: SQLite
- **Sim:** Python, osmnx, networkx, numpy, scipy, geopandas, shapely, pvlib (θέση ηλίου), rasterio, scikit-learn/LightGBM
- **Agent:** Python, FastAPI, SDK του LLM provider με tool calling και vision, STT (Whisper ή αντίστοιχο), ελληνικό TTS, API για image editing
- **Contracts:** `packages/contracts` με JSON Schema ως πηγή αλήθειας → παράγονται TS types (json-schema-to-typescript) και Pydantic models (datamodel-code-generator)

### Repo layout

```
athena-os/
  CLAUDE.md                 ← αυτό το αρχείο
  docker-compose.yml        ← postgres, gateway, sim, agent
  .env.example
  packages/contracts/       ← schemas/*.json, generated/ts, generated/py
  apps/web/                 ← Dev1
  apps/citizen/             ← Dev4
  services/gateway/         ← Dev4
  services/sim/             ← Dev2
  services/agent/           ← Dev3
  data/                     ← Dev2 (raw/, processed/ — όχι στο git αν είναι μεγάλα, βάλε script λήψης)
  demo/                     ← cached αποτελέσματα, fallback βίντεο, assets (splat, εικόνες)
```

## 4. Συμβόλαια (CONTRACTS) — παγώνουν στο T+2h

### 4.1 Βασικοί τύποι

```ts
type LngLat = [number, number];             // [lng, lat], WGS84

interface Report {
  id: string;                               // uuid
  createdAt: string;                        // ISO
  photoUrl: string;
  location: LngLat;
  heading: number | null;                   // μοίρες 0–360 από πυξίδα
  accuracyM: number | null;
  classification?: {
    category: "pothole" | "sidewalk_damage" | "waste" | "lighting" | "obstruction"
            | "heat_exposure" | "graffiti" | "accessibility" | "other";
    severity: 1 | 2 | 3 | 4 | 5;
    summaryEl: string;                      // μία πρόταση στα ελληνικά
    department: string;                     // αρμόδια υπηρεσία
    duplicates: string[];                   // report ids
    confidence: number;                     // 0–1
  };
}

type ScenarioEdit =
  | { type: "close_road";     wayIds: number[] }
  | { type: "bus_lane";       wayIds: number[] }            // αφαιρεί μία λωρίδα ΙΧ
  | { type: "remove_lane";    wayIds: number[] }
  | { type: "add_trees";      geometry: LngLat[]; count: number; side?: "north"|"south"|"east"|"west"|"both" }
  | { type: "cool_pavement";  wayIds: number[] };

interface Scenario {
  id: string;
  title: string;                            // π.χ. "Δέντρα και λωρίδα λεωφορείου στην Πειραιώς"
  edits: ScenarioEdit[];
  when: string;                             // ISO datetime για θερμικό/ήλιο (slider)
  origin: "user" | "agent_variant";
  parentId?: string;                        // για παραλλαγές του agent
}

interface Range { p10: number; p50: number; p90: number; }

interface SimResult {
  scenarioId: string;
  status: "ok" | "error";
  computeMs: number;
  traffic: {
    segments: { wayId: number; baseFlow: number; newFlow: number; baseTimeS: number; newTimeS: number }[];
    corridorTravelTimeDeltaPct: Range;      // κύριος άξονας του σεναρίου
    vehicleKmDeltaPct: Range;
    trips: { path: LngLat[]; departS: number; durationS: number }[];  // για animation, ≤ 3000
  };
  thermal: {
    when: string;
    cells: { lngLat: LngLat; baseC: number; newC: number }[];         // πλέγμα ~20–30 m
    hotspotDeltaC: Range;                   // στο σημείο του σεναρίου
  };
  emissions: { co2DeltaPct: Range };
  notes: string[];                          // παραδοχές, στα ελληνικά
}

interface Backtest {
  model: "traffic" | "thermal";
  metric: "MAPE" | "MAE_C" | "R2";
  value: number;
  heldOut: string;                          // π.χ. "Τρίτη 17/11, 07:00–10:00" ή "Landsat 14/07/2025"
  nSamples: number;
  chart: { predicted: number; observed: number }[];
}

interface Consultation {
  id: string;
  scenarioId: string;
  reportId?: string;
  beforeUrl: string;
  afterUrl: string;
  questionEl: string;
  publicUrl: string;                        // αυτό γίνεται QR
}

interface Vote {
  consultationId: string;
  choice: "yes" | "no" | "maybe";
  location?: LngLat;                        // προαιρετικό (γειτονιά ψηφοφόρου)
  comment?: string;
}

interface DecisionDraft {
  scenarioId: string;
  markdownEl: string;                       // δομή: ΘΕΜΑ / ΣΚΕΠΤΙΚΟ / ΔΕΔΟΜΕΝΑ / ΔΙΑΒΟΥΛΕΥΣΗ / ΑΠΟΦΑΣΙΖΕΙ — με ένδειξη «ΣΧΕΔΙΟ»
  citations: { label: string; source: string }[];
}
```

### 4.2 REST (gateway, prefix `/api`)

| Method | Path | Ποιος καλεί | Σκοπός |
|---|---|---|---|
| POST | `/reports` (multipart: photo, lng, lat, heading, accuracy) | citizen | Νέα αναφορά → broadcast `report.created` → ο agent ταξινομεί |
| GET | `/reports` | web | Όλες οι αναφορές |
| POST | `/scenarios` | agent | Δημιουργία σεναρίου → καλεί sim → `sim.result` |
| GET | `/scenarios/{id}/result` | web, agent | Αποτέλεσμα (cached) |
| GET | `/backtests` | web | Και τα δύο backtests |
| POST | `/consultations` | agent | Άνοιγμα διαβούλευσης → `consultation.opened` |
| GET | `/consultations/{id}` | citizen | Σελίδα ψηφοφορίας |
| POST | `/consultations/{id}/votes` | citizen | Ψήφος → `vote.tally` |
| GET | `/city/live` | agent, web | Live σύνοψη (λεωφορεία σε κίνηση, θερμοκρασία, αναφορές) |
| POST | `/director/{beat}` | web (director panel) | Χειροκίνητο trigger beat ή fallback |

### 4.3 WebSocket events (`/ws`, JSON `{ "type": ..., "payload": ... }`)

| type | Από | Payload | Τι κάνει το web |
|---|---|---|---|
| `buses.update` | gateway | `{ buses: {id, line, lngLat, bearing}[] }` | Κινεί τα λεωφορεία (κάθε ~10s, με interpolation) |
| `report.created` | gateway | `Report` | Billboard της φωτογραφίας στο 3D + pulse |
| `report.classified` | agent | `Report` | Badge κατηγορίας/σοβαρότητας |
| `agent.say` | agent | `{ textEl, audioUrl?, mood?: "neutral"\|"alert"\|"proud" }` | Υπότιτλος + αναπαραγωγή φωνής + waveform |
| `agent.thinking` | agent | `{ stepEl }` | «Η ATHENA σκέφτεται…» με τα βήματα (δείχνει τις παραλλαγές) |
| `camera.flyTo` | agent / director | `{ lngLat, heightM, headingDeg, pitchDeg, durationS }` | Κινηματογραφική κίνηση |
| `layer.set` | agent / director | `{ layer: "traffic"\|"thermal"\|"reports"\|"votes"\|"buses", visible: boolean }` | Εναλλαγή layers |
| `time.set` | agent / director | `{ when: ISO }` | Ήλιος/σκιές + θερμικό για αυτή την ώρα |
| `scenario.created` | gateway | `Scenario` | Highlight των δρόμων/σημείων που αλλάζουν |
| `sim.progress` | gateway | `{ scenarioId, pct }` | Progress |
| `sim.result` | gateway | `SimResult` | Αλλαγή χρωμάτων κυκλοφορίας, θερμικού, animation trips |
| `variant.compare` | agent | `{ base: SimResult, best: SimResult, reasonEl }` | Split/σύγκριση «η πρότασή σας vs η πρόταση της ATHENA» |
| `backtest.show` | agent / director | `{ model }` | Πάνελ backtesting για 5s |
| `consultation.opened` | gateway | `Consultation` | Before/after + QR full-screen |
| `vote.tally` | gateway | `{ consultationId, yes, no, maybe, points: {lngLat, choice}[] }` | Live heatmap ψήφων + μετρητής |
| `decision.ready` | agent | `DecisionDraft` | «Γράφεται» στην οθόνη (typewriter) |
| `director.beat` | gateway | `{ beat }` | Συγχρονισμός όλων στο τρέχον beat |

## 5. Κανόνες εργασίας (για ανθρώπους και agents)

1. **Mock-first.** Κάθε υπηρεσία τρέχει με `MOCK=1` και επιστρέφει ρεαλιστικά fake δεδομένα σύμφωνα με τα contracts. Κανείς δεν μπλοκάρεται περιμένοντας άλλον. Τα mocks ζουν στο `packages/contracts/fixtures/`.
2. **Πάντα runnable.** Το `main` πρέπει πάντα να σηκώνεται με `docker compose up` + `pnpm dev`. Μικρά commits, συχνά merges.
3. **Το demo πάνω από όλα.** Πριν από κάθε feature ρωτάς: «σε ποιο beat εμφανίζεται;». Αν δεν εμφανίζεται πουθενά, δεν το φτιάχνεις.
4. **Ένα σενάριο τέλειο.** Περιοχή: bbox γύρω από Πειραιώς / Γκάζι / Κεραμεικός / Θησείο (περίπου 23.700,37.970 έως 23.730,37.990). Δεν μοντελοποιούμε όλη την Αθήνα.
5. **Fallbacks παντού.** Κάθε live βήμα έχει cached εκδοχή στο `demo/cache/`, και ο director μπορεί να την πυροδοτήσει με ένα πλήκτρο. Αν κάτι αργεί >8s, δείχνουμε το cached.
6. **Ειλικρίνεια στα νούμερα.** Δεν εμφανίζουμε νούμερο χωρίς εύρος. Παραδοχές στο `SimResult.notes`. Δεν βάζουμε hardcoded «ωραία» νούμερα στο live μονοπάτι.
7. **Ελληνικά στο UI και στη φωνή, αγγλικά στον κώδικα.**
8. **Μυστικά μόνο στο `.env`.** Ποτέ στο git. Λίστα στο `.env.example`.
9. **Κανόνες hackathon:** πριν το Σάββατο ελέγχουμε στους Όρους Συμμετοχής τι επιτρέπεται να υπάρχει από πριν (κώδικας, assets, δεδομένα). Το git history πρέπει να δείχνει δουλειά μέσα στο Σαββατοκύριακο.

## 6. Ορόσημα (T = έναρξη hackathon)

| Ώρα | Ορόσημο | Ορισμός του «done» |
|---|---|---|
| T+2h | Contracts frozen + skeleton | Repo, docker-compose, όλες οι υπηρεσίες σηκώνονται με mocks, το web δείχνει Cesium στην Πειραιώς και λαμβάνει WS events |
| T+6h | Κάθε κομμάτι μόνο του | Πραγματικά δεδομένα στο bbox, sim επιστρέφει πραγματικό αποτέλεσμα, ο agent καλεί εργαλεία, το citizen app ανεβάζει φωτογραφία |
| T+12h | Πρώτο end-to-end | Φωτογραφία → 3D → σενάριο → sim → ψήφος → απόφαση, άσχημο αλλά δουλεύει |
| T+18h | Polish + backtesting | Κινηματογραφική κάμερα, φωνή, παραλλαγές, slider, backtest πάνελ |
| T+22h | Feature freeze | Μόνο bug fixes. Γεμίζει το `demo/cache/`, ηχογραφείται fallback βίντεο |
| T+22h → παρουσίαση | Πρόβες | ≥5 πλήρεις με χρονόμετρο, σενάρια «ο κριτής λέει κάτι παράξενο» |

**Σειρά περικοπών αν πιεστούμε:** Gaussian splat → slider 2035 → typewriter της απόφασης → emissions. **Δεν κόβονται:** φωτογραφία στο 3D, live sim, ψήφοι live.

## 7. Μεταβλητές περιβάλλοντος (`.env.example`)

```
MOCK=0
GATEWAY_URL=http://localhost:8000
PUBLIC_CITIZEN_URL=https://<tunnel-or-vercel>/c
DATABASE_URL=postgresql://athena:athena@localhost:5432/athena
SIM_URL=http://localhost:8100
AGENT_URL=http://localhost:8200
LLM_API_KEY=
STT_API_KEY=
TTS_API_KEY=
IMAGE_EDIT_API_KEY=
CESIUM_ION_TOKEN=
GOOGLE_MAPS_API_KEY=          # Photorealistic 3D Tiles
OASA_BASE_URL=http://telematics.oasa.gr/api/
```
