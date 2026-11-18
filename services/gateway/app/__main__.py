"""Εκκίνηση χωρίς env tricks (δουλεύει ίδια σε Windows/macOS/Linux):

uv run python -m app                 # live, port 8000
uv run python -m app --mock          # όλα από τα fixtures
uv run python -m app --port 8600 --reload
"""

import argparse
import os

import uvicorn


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m app")
    ap.add_argument("--mock", action="store_true", help="MOCK=1: απαντήσεις από packages/contracts/fixtures")
    ap.add_argument("--port", type=int, default=int(os.environ.get("GATEWAY_PORT", 8000)))
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--reload", action="store_true")
    args = ap.parse_args()
    if args.mock:
        os.environ["MOCK"] = "1"
    if args.port != 8000 and "GATEWAY_URL" not in os.environ:
        os.environ["GATEWAY_URL"] = f"http://localhost:{args.port}"
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload, ws_ping_interval=20)


if __name__ == "__main__":
    main()
