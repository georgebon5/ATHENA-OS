# infra (Dev4): δίκτυο και demo

```
κινητά κοινού (4G/5G) ──https──▶ Cloudflare ──tunnel──▶ laptop: gateway:8000 ──▶ postgres, sim, agent
                                                         ▲
μεγάλη οθόνη (web, localhost:5173) ──────────────────────┘
laptop ◀── δικό μας 5G hotspot (το Wi-Fi του event μόνο backup)
```

Όλο το stack τρέχει στο laptop (docker). Τα κινητά μπαίνουν από το internet μέσω tunnel και **δεν** χρειάζονται το Wi-Fi μας.
Ένα μόνο δημόσιο origin: το tunnel δείχνει στον gateway, που σερβίρει και το citizen app (`/c`) και το API.

## Tunnel

**Για το demo, named tunnel με σταθερό domain** (το QR πρέπει να έχει δοκιμαστεί από πριν):

1. Cloudflare dashboard → Zero Trust → Networks → Tunnels → Create tunnel (cloudflared). Αντέγραψε το token.
2. Public hostname: `athena.<domain>` → Service `http://gateway:8000`.
3. `.env`: `CLOUDFLARE_TUNNEL_TOKEN=...` και `PUBLIC_CITIZEN_URL=https://athena.<domain>/c`
4. `make demo` (ανεβάζει και το profile `tunnel`).

**Για γρήγορες δοκιμές** (τυχαίο URL, αλλάζει κάθε φορά):
```bash
cloudflared tunnel --url http://localhost:8000
# PUBLIC_CITIZEN_URL=https://<random>.trycloudflare.com/c  και restart του gateway
```

## `make demo` (ή `pnpm demo` στα Windows)

Σηκώνει docker (postgres, gateway, και sim/agent/tunnel όταν υπάρχουν), περιμένει health, προθερμαίνει ΟΑΣΑ,
θερμοκρασία, backtests, τα βασικά σενάρια (fixtures + `demo/scenarios/*.json`) και το `/prewarm` του agent,
φορτώνει ιστορικές αναφορές και ελέγχει το citizen μέσω tunnel. Τυπώνει ✓ / ! / ✗ ανά βήμα.

`make reset` πριν από κάθε πρόβα. `make loadtest` = 50 ταυτόχρονες ψήφοι.

## Windows: «port not available» στο 8000/8100/8200

Σε μερικά Windows (Hyper-V/WSL) το δυναμικό εύρος ports ξεκινά από το 1024 και το σύστημα δεσμεύει μπλοκ όπως 7058–8480.
Έλεγχος: `netsh interface ipv4 show excludedportrange protocol=tcp`. Μόνιμη λύση (PowerShell **ως διαχειριστής**, μετά reboot):
```powershell
netsh int ipv4 set dynamic tcp start=49152 num=16384
netsh int ipv6 set dynamic tcp start=49152 num=16384
```
Προσωρινά: `GATEWAY_PORT=8600` στο `.env` (και `uv run python -m app --port 8600`).

## Checklist μέρας demo

- [ ] 5G hotspot φορτισμένο, laptop στο hotspot, Wi-Fi event ως backup
- [ ] `make demo` πράσινο (< 2')
- [ ] QR → κινητό με **δεδομένα κινητής** (όχι Wi-Fi) → ψήφος φαίνεται στην οθόνη
- [ ] Φωτογραφία από κινητό εκτός δικτύου → στο 3D σε < 3 s
- [ ] Καταγραφή ΟΑΣΑ μέρας στο `demo/cache/oasa/` (για replay)
- [ ] `make reset` αμέσως πριν βγούμε
