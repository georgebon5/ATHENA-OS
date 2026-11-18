# @athena-os/web

Το frontend που βλέπουν οι κριτές: μια ζωντανή, φωτορεαλιστική 3D Αθήνα που
μιλάει ελληνικά, οδηγείται από τον AI agent και υλοποιεί τον κύκλο
SENSE → SIMULATE → ENGAGE → DECISION.

## Quickstart

```bash
pnpm install              # ή npm install
cp .env.example .env
pnpm dev                  # ανοίγει στο http://localhost:5173
```

### Παίξε όλο το demo χωρίς backend

Σε δεύτερο τερματικό:

```bash
pnpm mock                 # σηκώνει mock WebSocket στο ws://localhost:8787
```

Και τρέξε το web app με:

```bash
VITE_WS_URL=ws://localhost:8787 pnpm dev
```

Το mock timeline διαρκεί 5 λεπτά και περιέχει όλα τα beats
(INTRO → PITCH → SENSE → SIMULATE → ENGAGE → DECISION → CLOSE).

## Director mode

Ενεργοποιείται με `?director=1` στο URL ή με `Ctrl+D`.

| Πλήκτρο | Λειτουργία |
|---|---|
| `1`–`7` | Πήγαινε στο αντίστοιχο beat (INTRO…CLOSE) |
| `F` | Fallback από `demo/cache/<beat>.json` |
| `T` | Στείλε text prompt στην ATHENA |
| `R` | Reset κατάστασης για νέα πρόβα |
| `Ctrl+D` | Κλείσε το director mode |

## Στοίβα

- Vite + React 18 + TypeScript
- CesiumJS (απευθείας, χωρίς resium)
- Zustand (state) + framer-motion (UI motion)
- Tailwind CSS

## Σημειώσεις

- Στόχος ≥ 45 FPS στο laptop του demo. Το FPS counter εμφανίζεται πάντα σε
  dev mode και όταν ο director είναι ανοιχτός.
- Κάθε live βήμα έχει fallback στο `demo/cache/`. Η ρύθμιση των assets
  (splat, εικόνες) γίνεται στο root `demo/assets/`.
