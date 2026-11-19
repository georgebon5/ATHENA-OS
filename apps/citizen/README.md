# apps/citizen (Dev4)

Mobile web app για το κοινό, χωρίς εγκατάσταση. Σερβίρεται από τον gateway στο **`/c`** (ένα origin, ένα tunnel, χωρίς CORS).

| Route | Οθόνη |
|---|---|
| `/c/r` | Αναφορά: «Φωτογράφισε» → προεπισκόπηση με τοποθεσία/πυξίδα → upload με progress → «Η αναφορά σου μπήκε στην πόλη» + ταξινόμηση live |
| `/c/v/{id}` | Διαβούλευση: before/after slider, ερώτηση, Ναι / Όχι / Ίσως, προαιρετικά γειτονιά και σχόλιο, live αποτελέσματα |

```bash
pnpm dev:citizen        # http://localhost:5174/c/r  (proxy /api /media /ws → localhost:8000)
pnpm --filter @athena-os/citizen build   # dist/ → το σερβίρει ο gateway στο /c
```

Proxy σε άλλο port: `VITE_GATEWAY_PROXY=http://localhost:8600 pnpm dev:citizen`.

## Κανόνες που τηρούνται

- **Καμία άδεια πριν από tap.** Τοποθεσία στο tap «Φωτογράφισε». Πυξίδα: Android χωρίς άδεια, iOS `requestPermission()` στο tap «Στείλε».
- Κάμερα μέσω `<label>` + `<input type="file" accept="image/*" capture="environment">`: δουλεύει παντού, χωρίς `click()` από JS.
- Αν ο χρήστης αρνηθεί την τοποθεσία (ή δεν έρθει σε 4 s): Πειραιώς 144 μπροστά στο Σεράφειο, με ένδειξη «κατά προσέγγιση».
- Resize στο κινητό σε 1600 px JPEG πριν το upload: μια φωτογραφία 12 MP ανεβαίνει σε <1 s.
- Bundle ~60 KB gzip, system fonts, κανένα service worker (για να μη σερβίρει παλιά έκδοση στο demo).
- Ψήφος για τη γειτονιά: λίστα, όχι GPS (δεν ζητάμε τοποθεσία για να ψηφίσεις).

## Έλεγχος σε πραγματικά κινητά (DoD)

Κάμερα, τοποθεσία και πυξίδα θέλουν **HTTPS**: δοκιμή μόνο μέσω tunnel (βλ. `infra/README.md`), από κινητό **εκτός** του Wi-Fi μας.

- [ ] iOS Safari: κάμερα, άδεια τοποθεσίας, άδεια πυξίδας στο «Στείλε», heading ≠ null
- [ ] Android Chrome: κάμερα, τοποθεσία, πυξίδα χωρίς άδεια
- [ ] Άρνηση τοποθεσίας → Σεράφειο + ένδειξη
- [ ] QR από τη μεγάλη οθόνη → `/c/v/{id}` → ψήφος → αλλάζει ο μετρητής στην οθόνη
