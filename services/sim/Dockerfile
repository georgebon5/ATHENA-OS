FROM python:3.11-slim

WORKDIR /app

# System deps for geopandas / rasterio / shapely
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev gdal-bin libgeos-dev libproj-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service source
COPY . .

# Default: mock mode so the service starts instantly during dev
ENV MOCK=1
ENV PORT=8100
# Data paths — compose mounts ./data:/data
ENV DATA_PROCESSED_DIR=/data/processed
ENV DEMO_CACHE_DIR=/data/cache

EXPOSE 8100

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
