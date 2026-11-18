# Build context: η ρίζα του repo  →  docker compose build gateway
# Στάδιο 1: build του citizen app (το σερβίρει ο gateway στο /c)
FROM node:20-alpine AS citizen
WORKDIR /repo
RUN npm i -g pnpm@9.15.9
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/citizen/package.json apps/citizen/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@athena-os/citizen..."
COPY packages/contracts packages/contracts
COPY apps/citizen apps/citizen
RUN pnpm --filter @athena-os/citizen build

# Στάδιο 2: gateway
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
ENV ATHENA_ROOT=/repo PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /repo/services/gateway
COPY packages/contracts/generated/py /repo/packages/contracts/generated/py
COPY services/gateway/pyproject.toml services/gateway/uv.lock ./
RUN uv sync --frozen --no-dev
COPY packages/contracts/fixtures /repo/packages/contracts/fixtures
COPY apps/web/public/demo/cache /repo/apps/web/public/demo/cache
COPY services/gateway/app ./app
COPY --from=citizen /repo/apps/citizen/dist /repo/apps/citizen/dist
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"
CMD [".venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--ws-ping-interval", "20"]
