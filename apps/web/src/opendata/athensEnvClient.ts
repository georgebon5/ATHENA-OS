const CKAN_BASE = "/ckan-proxy/api/3/action";

export interface EnvReading {
  stationId: number;
  stationName: string;
  neighbourhood: string;
  timestamp: string;
  temperature: number;
  humidity: number | null;
  aqi: number;
  co: number;
  no2: number;
  o3: number | null;
  pm2_5: number | null;
  source: "live" | "fixture";
}

export const ENV_STATIONS: Record<
  number,
  { resourceId: string; name: string; neighbourhood: string; lngLat: [number, number] }
> = {
  78: { resourceId: "261e3a98-bd04-41dd-bf32-653985f965be", name: "Γηπεδάκι Σεπολίων", neighbourhood: "ΣΕΠΟΛΙΑ",   lngLat: [23.7132, 37.9878] },
  81: { resourceId: "6ee7c097-ee8c-40ba-9516-541d78f4972c", name: "Τρίτωνα Σεπολίων",  neighbourhood: "ΣΕΠΟΛΙΑ",   lngLat: [23.7141, 37.9868] },
  76: { resourceId: "56a4a304-a2e0-4765-b49f-c17963f3a8c0", name: "Βοτανικός Κήπος",   neighbourhood: "ΒΟΤΑΝΙΚΟΣ", lngLat: [23.7035, 37.9788] },
  82: { resourceId: "4c71e4a7-501a-4ec5-b0f6-54caf0c60a78", name: "Άτλας Σεπολίων",    neighbourhood: "ΣΕΠΟΛΙΑ",   lngLat: [23.7149, 37.9873] },
  77: { resourceId: "a34408f2-60e1-44a3-8edc-e399e1c023a8", name: "Θέατρο Κολωνού",    neighbourhood: "ΚΟΛΩΝΟΣ",   lngLat: [23.7158, 37.9893] },
};

export const DEMO_ENV_STATIONS = [78, 81, 76, 82, 77];

interface CkanEnvRecord {
  timestamp: string;
  station_id: number;
  station_name: string;
  neighbourhood_name: string;
  temperature: number;
  humidity: number | null;
  aqi: number;
  co: number;
  no: number;
  no2: number;
  o3: number | null;
  so2: number;
  pm1: number;
  pm2_5: number | null;
  pm10: number;
  pressure: number;
}

interface CkanResponse {
  success: boolean;
  result: { records: CkanEnvRecord[] };
}

async function fetchLiveStation(stationId: number): Promise<EnvReading | null> {
  const station = ENV_STATIONS[stationId];
  if (!station?.resourceId) return null;
  const url =
    `${CKAN_BASE}/datastore_search` +
    `?resource_id=${station.resourceId}` +
    `&limit=1&sort=timestamp%20desc`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = (await res.json()) as CkanResponse;
    if (data.success && data.result.records.length > 0) {
      const r = data.result.records[0];
      return {
        stationId,
        stationName: station.name,
        neighbourhood: station.neighbourhood,
        timestamp: r.timestamp,
        temperature: r.temperature,
        humidity: r.humidity ?? null,
        aqi: r.aqi,
        co: r.co,
        no2: r.no2,
        o3: r.o3 ?? null,
        pm2_5: r.pm2_5 ?? null,
        source: "live",
      };
    }
  } catch {
    // network unavailable → fall through
  }
  return null;
}

interface FixtureFile {
  stations: EnvReading[];
}

async function loadFixture(): Promise<EnvReading[]> {
  try {
    const res = await fetch("/demo/fixtures/env_sensors.json");
    const data = (await res.json()) as FixtureFile;
    return data.stations;
  } catch {
    return [];
  }
}

export async function fetchNearestEnvReading(): Promise<EnvReading> {
  for (const id of DEMO_ENV_STATIONS) {
    const reading = await fetchLiveStation(id);
    if (reading) return reading;
  }
  const fixtures = await loadFixture();
  if (fixtures.length > 0) return fixtures[0];
  // hard fallback if fixture file is also missing
  return {
    stationId: 78,
    stationName: "Γηπεδάκι Σεπολίων",
    neighbourhood: "ΣΕΠΟΛΙΑ",
    timestamp: new Date().toISOString(),
    temperature: 22.0,
    humidity: null,
    aqi: 2,
    co: 300,
    no2: 10,
    o3: null,
    pm2_5: null,
    source: "fixture",
  };
}

import type { SimResult } from "@/types/contracts";

/** Χτίζει ένα συνθετικό SimResult.thermal από live αισθητήρες για το FLIR layer. */
export function buildLiveThermalResult(readings: EnvReading[]): SimResult {
  const cells: SimResult["thermal"]["cells"] = [];
  const SPREAD = 0.00045; // ~50m βήμα
  const GRID = 3;         // 7×7 κελιά γύρω από κάθε σταθμό

  for (const r of readings) {
    const station = ENV_STATIONS[r.stationId];
    if (!station) continue;
    const [lng, lat] = station.lngLat;
    for (let dx = -GRID; dx <= GRID; dx++) {
      for (let dy = -GRID; dy <= GRID; dy++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noise = (Math.random() - 0.5) * 0.6;
        const baseC = r.temperature + noise - dist * 0.15;
        cells.push({
          lngLat: [lng + dx * SPREAD, lat + dy * SPREAD],
          baseC,
          newC: baseC - 1.4 - dist * 0.05, // με δέντρα: -1.4°C hotspot
        });
      }
    }
  }

  return {
    scenarioId: "live-thermal",
    status: "ok",
    computeMs: 0,
    traffic: {
      segments: [],
      corridorTravelTimeDeltaPct: { p10: 0, p50: 0, p90: 0 },
      vehicleKmDeltaPct: { p10: 0, p50: 0, p90: 0 },
      trips: [],
    },
    thermal: {
      when: new Date().toISOString(),
      cells,
      hotspotDeltaC: { p10: -1.1, p50: -1.4, p90: -1.8 },
    },
    emissions: { co2DeltaPct: { p10: 0, p50: 0, p90: 0 } },
    notes: ["Live θερμοκρασία από αισθητήρες opendata.cityofathens.gr"],
  };
}

export async function fetchAllEnvReadings(): Promise<EnvReading[]> {
  const results = await Promise.all(
    DEMO_ENV_STATIONS.map(async (id): Promise<EnvReading | null> => {
      const live = await fetchLiveStation(id);
      if (live) return live;
      const fixtures = await loadFixture();
      return fixtures.find((f) => f.stationId === id) ?? null;
    })
  );
  return results.filter((r): r is EnvReading => r !== null);
}
