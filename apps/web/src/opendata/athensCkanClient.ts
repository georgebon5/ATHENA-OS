/**
 * Athens Smart Neighbourhood WiFi footfall — real open data from opendata.athens.gr.
 * Resource IDs extracted from the signed blob download URLs of the datapackage ZIPs.
 * API: https://opendata.athens.gr/api/3/action/datastore_search?resource_id=<uuid>&limit=1&sort=date%20desc
 */

export interface VisitorRecord {
  stationId: number;
  stationName: string;
  neighbourhood: string;
  date: string;
  visitors: number;
  source: "live" | "fixture";
}

const CKAN_BASE = "https://opendata.athens.gr/api/3/action";

// Stations near Πειραιώς/Σεράφειο — Σεπόλια + Κεραμεικός.
// resource_id = UUID from the signed blob URL for each station's datapackage ZIP.
export const STATION_REGISTRY: Record<
  number,
  { resourceId: string; name: string; neighbourhood: string }
> = {
  // resource_ids from signed blob download URLs (opendata.athens.gr)
  95:  { resourceId: "",                                       name: "Άτλας Σεπολίων",      neighbourhood: "ΣΕΠΟΛΙΑ"    }, // TODO: UUID pending
  96:  { resourceId: "f39043ef-1289-4f3c-a25c-ea78551b7008", name: "Τρίτωνα Σεπολίων",    neighbourhood: "ΣΕΠΟΛΙΑ"    },
  97:  { resourceId: "b69836e4-b946-4431-befc-54227af0ddeb", name: "Πλατεία Θυμαράκια",   neighbourhood: "ΣΕΠΟΛΙΑ"    },
  98:  { resourceId: "b02ebb00-3e17-4bc0-b7aa-b0b3c610a447", name: "Πλατεία Ζέρβα",       neighbourhood: "ΣΕΠΟΛΙΑ"    },
  99:  { resourceId: "ed4b198e-9e89-4b06-87ca-c209aa76d43c", name: "Πλατεία Ναθαναήλ",    neighbourhood: "ΣΕΠΟΛΙΑ"    },
  100: { resourceId: "93ac4773-5f8f-4496-a445-0b5958c341c3", name: "Γηπεδάκι Αυλώνος",    neighbourhood: "ΣΕΠΟΛΙΑ"    },
  112: { resourceId: "bd264908-85dd-4759-a522-38284c0ac5b0", name: "Γήπεδο Εριουργίας",    neighbourhood: "ΚΕΡΑΜΕΙΚΟΣ" },
};

interface CkanRecord { highest_visitors: number; date: string }
interface CkanResponse { success: boolean; result: { records: CkanRecord[] } }

async function fetchLive(stationId: number): Promise<number | null> {
  const station = STATION_REGISTRY[stationId];
  if (!station) return null;
  const url =
    `${CKAN_BASE}/datastore_search` +
    `?resource_id=${station.resourceId}` +
    `&limit=1&sort=date%20desc` +
    `&filters=%7B%22interval_type%22%3A%22OneDay%22%7D`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = (await res.json()) as CkanResponse;
    if (data.success && data.result.records.length > 0) {
      return data.result.records[0].highest_visitors;
    }
  } catch {
    // network unavailable → fall through
  }
  return null;
}

async function loadFixture(): Promise<Record<number, number>> {
  try {
    const res = await fetch("/demo/fixtures/wifi_footfall.json");
    const data = (await res.json()) as { stations: { stationId: number; visitors: number }[] };
    return Object.fromEntries(data.stations.map((s) => [s.stationId, s.visitors]));
  } catch {
    return {};
  }
}

let _fixtureCache: Record<number, number> | null = null;

export async function fetchAreaFootfall(
  stationIds: number[] = [95, 96, 97, 98, 99, 100, 112]
): Promise<VisitorRecord[]> {
  if (!_fixtureCache) _fixtureCache = await loadFixture();
  const fixture = _fixtureCache;

  const results = await Promise.all(
    stationIds.map(async (id): Promise<VisitorRecord | null> => {
      const meta = STATION_REGISTRY[id];
      if (!meta) return null;
      const live = await fetchLive(id);
      if (live !== null) {
        return {
          stationId: id,
          stationName: meta.name,
          neighbourhood: meta.neighbourhood,
          date: new Date().toISOString().slice(0, 10),
          visitors: live,
          source: "live",
        };
      }
      const visitors = fixture[id] ?? 0;
      return {
        stationId: id,
        stationName: meta.name,
        neighbourhood: meta.neighbourhood,
        date: new Date().toISOString().slice(0, 10),
        visitors,
        source: "fixture",
      };
    })
  );
  return results.filter(Boolean) as VisitorRecord[];
}
