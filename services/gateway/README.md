# services/gateway (Dev4)

FastAPI στο port 8000: REST, WebSocket hub, αποθήκευση, ΟΑΣΑ, director, σερβίρισμα citizen app και media.
**Ένας worker** (το pub/sub είναι in-process).

```bash
uv sync
uv run python -m app --mock          # όλα από τα fixtures, χωρίς postgres/sim/agent
uv run python -m app --reload        # live (διαβάζει .env / env vars)
uv run pytest -q                     # tests
```

Χωρίς Postgres πέφτει αυτόματα σε SQLite (`var/athena.db`). Στην πρώτη εκκίνηση φορτώνει 40 ιστορικές αναφορές.

## Τι υλοποιεί ο sim (Dev2) και τι ο agent (Dev3)

Ο gateway **καλεί**:

| Υπηρεσία | Endpoint | Body → απάντηση | Timeout / fallback |
|---|---|---|---|
| sim | `POST /simulate` | `Scenario` → `SimResult` | 8 s → cached αποτέλεσμα (ίδια edits+when) |
| sim | `GET /backtests` | → `Backtest[]` | 5 s → τελευταίο επιτυχημένο |
| sim, agent | `GET /health` | οτιδήποτε 2xx/4xx = «ζωντανός» | ελέγχεται κάθε 5 s |
| agent | `POST /classify` | `ClassifyRequest` → `ReportClassification` (ή 202 και μετά event) | 20 s → ειδοποίηση director |
| agent | `POST /director/{BEAT}` | — (απάντα γρήγορα, 202) | αν ο agent είναι κάτω: αυτόματο fallback του beat |
| agent | `POST /prompt` | `AgentPrompt` (`{ textEl }`) από το director panel | |
| agent | `POST /prewarm` (προαιρετικό) | καλείται από `make demo`, π.χ. TTS σταθερών φράσεων | |

Ο agent **στέλνει** στον gateway:

- **Events στην οθόνη:** `POST /api/events` με `{ type, payload }` ή λίστα. Εναλλακτικά WebSocket `/ws?room=agent` και `send({type, payload})`. Ελέγχονται με τα contracts: λάθος payload → 422 με το σφάλμα.
- **Σενάρια:** `POST /api/scenarios` (`Scenario`, το `id` προαιρετικό) → επιστρέφει `SimResult` όταν τελειώσει. Header `X-Athena-Source: live|fallback|mock|error`. Με `?broadcast=false` τρέχει «σιωπηλά» (για εξερεύνηση παραλλαγών, χωρίς να αλλάζει η οθόνη). Μετά στέλνεις `variant.compare`.
- **Διαβούλευση:** `POST /api/consultations` (`ConsultationCreate`) → `Consultation` με `publicUrl` για το QR. Ο gateway κάνει broadcast `consultation.opened`.
- **Media:** `POST /api/media` (multipart `file`: jpeg/png/webp/mp3/wav/ogg/webm) → `{ url }`. Για την εικόνα «μετά» και το audio του TTS.
- **Πληροφορίες:** `GET /api/city/live`, `GET /api/reports`, `GET /api/scenarios/{id}/result`.

Τα URLs των media είναι `GATEWAY_URL/media/...` (π.χ. `http://localhost:8000/media/photos/x.jpg`). Μέσα στο docker
ο agent τα φτάνει αλλάζοντας τη βάση σε `http://gateway:8000`. Το `/classify` στέλνει ήδη την εικόνα σε base64.

## WebSocket `/ws?room=...`

| room | Παίρνει | Μπορεί να στέλνει events |
|---|---|---|
| `screen` (default) | όλα | όχι |
| `director` | όλα + `system.status` | ναι |
| `agent` | όλα | ναι |
| `citizen:{consultationId}` | μόνο `vote.tally` της διαβούλευσης | όχι |

- `{"type":"ping"}` → `{"type":"pong"}` (το web μετρά latency).
- **Replay:** μόλις συνδεθεί client στέλνονται beat, layers, ώρα, λεωφορεία, όλες οι αναφορές, τρέχον σενάριο/αποτέλεσμα/παραλλαγή, διαβούλευση, ψήφοι, απόφαση και κάμερα (με `durationS: 0`), όλα με `replay: true`. Refresh στη μέση του demo → ίδια εικόνα.
- Αργός client δεν καθυστερεί τους άλλους (ουρά ανά client· αν γεμίσει, κόβεται και ξανασυνδέεται).

## Director

| | |
|---|---|
| `POST /api/director/{beat}` | `director.beat` + προώθηση στον agent. Στο MOCK παίζει το cached beat |
| `POST /api/director/fallback/{beat}` | Παίζει `demo/cache/beats/{beat}.json` ή `apps/web/public/demo/cache/{beat}.json`. Η διαβούλευση του fallback γίνεται **πραγματική** (το QR δουλεύει, οι ψήφοι μετράνε) |
| `POST /api/director/reset` | Νέα πρόβα: σβήνει αναφορές του demo, ψήφους, διαβουλεύσεις, σενάρια. Κρατά ιστορικές αναφορές + cache sim |
| `POST /api/reports/{id}/hide` | Moderation: κρύβει φωτογραφία (`report.hidden`) |
| `GET /api/director/status`, `GET /api/health` | Κατάσταση υπηρεσιών και πρόσφατα fallbacks |

## Ασφάλεια (το QR είναι δημόσιο)

Ό,τι έρχεται μέσω tunnel (headers `cf-connecting-ip` / `x-forwarded-for`) φτάνει **μόνο** σε: citizen app (`/c`),
media, `GET /api/consultations/{id}[/tally]`, `POST /api/consultations/{id}/votes`, `POST /api/reports`,
`GET /api/reports/{id}` και WS `citizen:*`. Όλα τα άλλα → 403. Κανείς από την αίθουσα δεν μπορεί να στείλει events ή reset.

Ψήφοι: μία ανά συσκευή ανά διαβούλευση (cookie + `X-Device-Id`)· νέα ψήφος = αλλαγή γνώμης. Αναφορές: 1 ανά 4 s ανά συσκευή.
Φωτογραφίες: resize ≤1600 px, εφαρμογή orientation, **καμία** μεταδεδομένη πληροφορία (GPS, μοντέλο κινητού).

## ΟΑΣΑ

Το `OASA_MODE=live` ανακαλύπτει τις γραμμές γύρω από την Πειραιώς (`getClosestStops` → `webRoutesForStop`) και κάθε 10 s
ρωτά `getBusLocation`. Μετά από 3 αποτυχίες γυρίζει σε **replay** (`demo/cache/oasa/recording-*.jsonl`) και ξαναδοκιμάζει live κάθε λεπτό.
`OASA_RECORD=1` γράφει νέα καταγραφή. **Κάνε μία καταγραφή μέρα, Παρασκευή στις 10:00–11:00**, ώστε το replay να έχει πολλά λεωφορεία.
