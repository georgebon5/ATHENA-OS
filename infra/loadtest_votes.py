"""Load test ψηφοφορίας: N «κινητά» ψηφίζουν ταυτόχρονα, μετράμε latency και πότε φτάνει το vote.tally στην οθόνη.

    uv run --no-project --with httpx --with websockets python infra/loadtest_votes.py --n 50
    uv run --no-project --with httpx --with websockets python infra/loadtest_votes.py --base http://localhost:8000 --n 200

Definition of Done: 50 ταυτόχρονες ψήφοι χωρίς καθυστέρηση στο broadcast.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import statistics
import time
import uuid

import httpx
import websockets

NEIGHBORHOODS = [[23.7125, 37.9785], [23.718, 37.978], [23.7205, 37.9765], [23.72, 37.984], [23.706, 37.975], None]


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--n", type=int, default=50)
    args = ap.parse_args()
    base = args.base.rstrip("/")

    async with httpx.AsyncClient(base_url=base, timeout=20) as http:
        c = (
            await http.post(
                "/api/consultations",
                json={
                    "scenarioId": "s-loadtest",
                    "beforeUrl": "https://example.org/before.jpg",
                    "afterUrl": "https://example.org/after.jpg",
                    "questionEl": "Load test: δέντρα στην Πειραιώς;",
                },
            )
        ).json()
        cid = c["id"]
        ws_url = base.replace("http", "ws", 1) + "/ws?room=screen"
        async with websockets.connect(ws_url, max_size=None) as screen:
            # άδειασε το replay
            try:
                while True:
                    await asyncio.wait_for(screen.recv(), timeout=0.5)
            except TimeoutError:
                pass

            latencies: list[float] = []
            errors: list[str] = []

            async def voter(i: int) -> None:
                body = {"consultationId": cid, "choice": random.choice(["yes", "yes", "no", "maybe"])}
                if loc := random.choice(NEIGHBORHOODS):
                    body["location"] = loc
                t0 = time.perf_counter()
                r = await http.post(f"/api/consultations/{cid}/votes", json=body, headers={"X-Device-Id": uuid.uuid4().hex})
                latencies.append((time.perf_counter() - t0) * 1000)
                if r.status_code != 200:
                    errors.append(f"{r.status_code} {r.text[:80]}")

            started = time.perf_counter()
            await asyncio.gather(*(voter(i) for i in range(args.n)))
            all_sent = time.perf_counter()

            final_ms = None
            broadcasts = 0
            deadline = time.perf_counter() + 10
            while time.perf_counter() < deadline:
                try:
                    msg = json.loads(await asyncio.wait_for(screen.recv(), timeout=deadline - time.perf_counter()))
                except TimeoutError:
                    break
                if msg["type"] == "vote.tally" and msg["payload"]["consultationId"] == cid:
                    broadcasts += 1
                    p = msg["payload"]
                    if p["yes"] + p["no"] + p["maybe"] == args.n - len(errors):
                        final_ms = (time.perf_counter() - all_sent) * 1000
                        break

    lat = sorted(latencies)
    p95 = lat[int(0.95 * (len(lat) - 1))]
    print(f"{args.n} ψήφοι σε {(all_sent - started) * 1000:.0f} ms · σφάλματα: {len(errors)}")
    print(f"POST latency: p50 {statistics.median(lat):.0f} ms · p95 {p95:.0f} ms · max {lat[-1]:.0f} ms")
    print(f"vote.tally broadcasts: {broadcasts} (throttled ~500 ms)")
    if final_ms is None:
        print("✗ η οθόνη ΔΕΝ είδε το τελικό σύνολο σε 10 s")
        return 1
    print(f"✓ η οθόνη είδε το τελικό σύνολο {final_ms:.0f} ms μετά την τελευταία ψήφο")
    for e in errors[:5]:
        print("  error:", e)
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
