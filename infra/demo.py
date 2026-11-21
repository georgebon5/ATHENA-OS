"""`make demo`: σηκώνει τα πάντα, προθερμαίνει caches, health checks. Στόχος < 2 λεπτά.

    python infra/demo.py              # docker compose up + prewarm + έλεγχοι
    python infra/demo.py --no-up      # μόνο prewarm + έλεγχοι (αν τρέχουν ήδη)

Μόνο standard library: τρέχει όπου υπάρχει Python 3.11+, και στα Windows χωρίς make.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OK, FAIL, WARN = "✓", "✗", "!"
results: list[tuple[str, str, str]] = []


def env() -> dict[str, str]:
    values = dict(os.environ)
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.split("#", 1)[0].strip()
            if "=" in line:
                k, v = line.split("=", 1)
                values.setdefault(k.strip(), v.strip())
    return values


def http(method: str, url: str, body: object | None = None, timeout: float = 15) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw)
            except ValueError:
                return r.status, raw.decode(errors="replace")[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")[:200]
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        return 0, str(e)


def check(name: str, ok: bool, detail: str = "", warn: bool = False) -> bool:
    mark = OK if ok else (WARN if warn else FAIL)
    results.append((mark, name, detail))
    print(f"  {mark} {name}  {detail}", flush=True)
    return ok


def wait_for(url: str, seconds: float) -> bool:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        status, _ = http("GET", url, timeout=3)
        if status and status < 500:
            return True
        time.sleep(1)
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-up", action="store_true", help="μην τρέξεις docker compose")
    args = ap.parse_args()
    e = env()
    t0 = time.monotonic()
    port = e.get("GATEWAY_PORT", "8000")
    gw = f"http://localhost:{port}"
    # κάθε υπηρεσία ανεβαίνει μόλις υπάρξει το δικό της Dockerfile, ανεξάρτητα από τις άλλες
    has = {s: (ROOT / f"services/{s}/Dockerfile").exists() for s in ("sim", "agent")}
    tunnel = bool(e.get("CLOUDFLARE_TUNNEL_TOKEN"))

    if not args.no_up:
        cmd = ["docker", "compose"]
        for s, ok in has.items():
            if ok:
                cmd += ["--profile", s]
        if tunnel:
            cmd += ["--profile", "tunnel"]
        cmd += ["up", "-d", "--build", "--wait"]
        print(f"→ {' '.join(cmd)}", flush=True)
        if subprocess.run(cmd, cwd=ROOT).returncode != 0:
            print(f"{FAIL} docker compose απέτυχε (τρέχει το Docker Desktop; είναι ελεύθερα τα ports {port} και {e.get('POSTGRES_PORT', '5432')}; αν όχι, άλλαξέ τα στο .env)")
            return 1

    print("→ health", flush=True)
    if not check("gateway", wait_for(f"{gw}/api/health", 90), gw):
        return 1
    _, health = http("GET", f"{gw}/api/health")
    if isinstance(health, dict):
        check("database", health.get("db") == "postgres", f"{health.get('db')} (PostGIS={health.get('postgis')})", warn=True)
        check("MOCK", not health.get("mock"), "MOCK=1: όλα από fixtures" if health.get("mock") else "live", warn=True)
    sim_port, agent_port = e.get("SIM_PORT", "8100"), e.get("AGENT_PORT", "8200")
    for s, p in (("sim", sim_port), ("agent", agent_port)):
        check(s, wait_for(f"http://localhost:{p}/health", 30 if has[s] else 2), "" if has[s] else "(δεν έχει Dockerfile ακόμα → fallback)", warn=not has[s])
    _, sim_health = http("GET", f"http://localhost:{sim_port}/health")
    if isinstance(sim_health, dict):
        check("sim με πραγματικά δεδομένα", not sim_health.get("mock"), "MOCK=1: fixtures, όχι προσομοίωση" if sim_health.get("mock") else "", warn=True)

    print("→ prewarm", flush=True)
    status, live = http("GET", f"{gw}/api/city/live", timeout=40)
    if status == 200 and isinstance(live, dict):
        b = live["buses"]
        check("ΟΑΣΑ", b["source"] == "live", f"{b['active']} λεωφορεία ({b['source']}), γραμμές {', '.join(b['lines'][:8])}", warn=True)
        check("θερμοκρασία", live["weather"]["temperatureC"] is not None, f"{live['weather']['temperatureC']} °C", warn=True)
    else:
        check("city/live", False, str(live))
    status, _ = http("GET", f"{gw}/api/backtests", timeout=10)
    check("backtests", status == 200, f"HTTP {status}", warn=True)

    scenarios = [json.loads((ROOT / f"packages/contracts/fixtures/{n}").read_text(encoding="utf-8")) for n in ("scenario.json", "scenario_variant.json")]
    # Τα ίδια σενάρια με το demo/precompute.py: περνώντας από τον gateway ζεσταίνουν και το δικό του fallback cache
    scenarios += json.loads((ROOT / "demo/scenarios.json").read_text(encoding="utf-8"))
    for s in scenarios:
        t = time.monotonic()
        status, res = http("POST", f"{gw}/api/scenarios?broadcast=false", s, timeout=30)
        ok = status == 200 and isinstance(res, dict) and res.get("status") == "ok"
        check(f"sim «{s['title'][:40]}»", ok, f"{(time.monotonic() - t):.1f}s", warn=True)

    status, seeded = http("POST", f"{gw}/api/director/seed")
    check("ιστορικές αναφορές", status == 200, json.dumps(seeded, ensure_ascii=False))

    print("→ κινητά", flush=True)
    public = e.get("PUBLIC_CITIZEN_URL", "")
    if public.startswith("https://") and "<" not in public:
        status, _ = http("GET", f"{public}/r", timeout=10)
        check("citizen μέσω tunnel", status == 200, f"{public}/r → HTTP {status}")
    else:
        check("citizen μέσω tunnel", False, "όρισε PUBLIC_CITIZEN_URL=https://... στο .env (βλ. infra/README.md)", warn=True)
    status, _ = http("GET", f"{gw}/c/r")
    check("citizen build", status == 200, f"{gw}/c/r → HTTP {status}")

    took = time.monotonic() - t0
    fails = [r for r in results if r[0] == FAIL]
    warns = [r for r in results if r[0] == WARN]
    print(f"\n{'ΕΤΟΙΜΟ' if not fails else 'ΠΡΟΒΛΗΜΑ'} σε {took:.0f}s · {len(fails)} αποτυχίες · {len(warns)} προειδοποιήσεις")
    print(f"  οθόνη:    http://localhost:5173  (pnpm dev:web)\n  director: {gw}/api/director/status\n  κινητά:   {public or gw + '/c'}/r")
    return 1 if fails else 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
        except Exception:  # noqa: BLE001
            pass
    raise SystemExit(main())
