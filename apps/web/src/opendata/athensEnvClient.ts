const CKAN_BASE = "https://opendata.cityofathens.gr/api/3/action";

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
  { resourceId: string; name: string; neighbourhood: string }
> = {
  78: { resourceId: "261e3a98-bd04-41dd-bf32-653985f965be", name: "Γηπεδάκι Σεπολίων",  neighbourhood: "ΣΕΠΟΛΙΑ"   },
  81: { resourceId: "6ee7c097-ee8c-40ba-9516-541d78f4972c", name: "Τρίτωνα Σεπολίων",   neighbourhood: "ΣΕΠΟΛΙΑ"   },
  76: { resourceId: "56a4a304-a2e0-4765-b49f-c17963f3a8c0", name: "Βοτανικός Κήπος",     neighbourhood: "ΒΟΤΑΝΙΚΟΣ" },
  82: { resourceId: "4c71e4a7-501a-4ec5-b0f6-54caf0c60a78", name: "Άτλας Σεπολίων",      neighbourhood: "ΣΕΠΟΛΙΑ"   },
  77: { resourceId: "a34408f2-60e1-44a3-8edc-e399e1c023a8", name: "Θέατρο Κολωνού",      neighbourhood: "ΚΟΛΩΝΟΣ"   },
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
