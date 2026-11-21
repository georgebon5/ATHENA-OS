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

/**
 * All known stations — Σεπόλια, Κολωνός, Βοτανικός, Λαρίσης, Κυψέλη, Εξάρχεια…
 * resource_id = UUID extracted from signed blob download URLs (opendata.athens.gr).
 * Empty string → live fetch skipped, fixture only.
 */
export const STATION_REGISTRY: Record<
  number,
  { resourceId: string; name: string; neighbourhood: string }
> = {
  74:  { resourceId: "5253cacf-1d76-4e29-acec-52ef9b5cd02a", name: "Πάρκο Μιχαλακόπουλου",  neighbourhood: "ΓΑΛΑΤΣΙ"           },
  75:  { resourceId: "f243f6f7-e1f7-46ff-a446-8a76043a4088", name: "Αθλητικό Κέντρο Πλάτωνος", neighbourhood: "ΑΚΑΔΗΜΙΑ ΠΛΑΤΩΝΟΣ" },
  76:  { resourceId: "de29b400-01dc-4a9a-a97f-14ab92c598a3", name: "Αθλητικό Κέντρο Πατριάρχη Φωτίου", neighbourhood: "ΚΟΛΩΝΟΣ"  },
  77:  { resourceId: "15089f44-90ab-41bf-87d9-a5b97205cdd4", name: "Πλατεία Σταθμού Λαρίσης", neighbourhood: "ΣΤΑΘΜΟΣ ΛΑΡΙΣΗΣ"  },
  78:  { resourceId: "2a28dbc0-02db-409f-9a67-2d6b2f540f60", name: "Πλατεία Αττικής",          neighbourhood: "ΑΤΤΙΚΗ"            },
  79:  { resourceId: "884e0fef-6989-4d04-ba36-66a06c0cceaf", name: "Γήπεδο Λιοσίων & Μενεμάχου", neighbourhood: "ΑΓ. ΝΙΚΟΛΑΟΣ"   },
  80:  { resourceId: "949f0f85-85bd-4649-8449-b4498947ed2c", name: "Γήπεδα Κάδμου & Λένορμαν",  neighbourhood: "ΚΟΛΩΝΟΣ"          },
  81:  { resourceId: "b7187444-1820-4f8f-a05c-8b1939949911", name: "Κεντρική Δημοτική Βιβλιοθήκη", neighbourhood: "ΚΕΝΤΡΟ"        },
  82:  { resourceId: "f5489569-c8c9-4da9-bb54-fc7c8fdec1aa", name: "Πλατεία Ακαδημίας Πλάτωνος", neighbourhood: "ΑΚΑΔΗΜΙΑ ΠΛΑΤΩΝΟΣ" },
  83:  { resourceId: "9c89fd07-7814-43ed-b222-e69d016a96c6", name: "Αθλητικό Κέντρο Εξαρχείων", neighbourhood: "ΕΞΑΡΧΕΙΑ"         },
  84:  { resourceId: "ae190ab2-50b4-4409-b0d3-4ac0a3028eda", name: "Γυμναστήριο Ευελπίδων",     neighbourhood: "ΠΕΔΙΟΝ ΑΡΕΩΣ"     },
  85:  { resourceId: "c0a38b76-53ce-4e47-8b5c-6f68fdc6ca93", name: "Πλατεία Πετρούλα Κολωνού", neighbourhood: "ΚΟΛΩΝΟΣ"           },
  86:  { resourceId: "4a9a9638-21f6-41fc-8045-2d1b721d2066", name: "Πλατεία Ορθοδοξίας",        neighbourhood: "ΚΟΛΩΝΟΣ"           },
  87:  { resourceId: "c57c05d8-e021-4a46-8f05-6c8111d3aea1", name: "Παιδική Χαρά Κολωνού",      neighbourhood: "ΚΟΛΩΝΟΣ"           },
  88:  { resourceId: "6ab5471d-78d7-408f-ac3e-ea7943e8d663", name: "Πλατεία Κανελλοπούλου",     neighbourhood: "ΚΥΨΕΛΗ"            },
  89:  { resourceId: "22cf7134-12c0-4361-94c6-df31766c89e5", name: "Πολιτιστικό Κέντρο Κυψέλης", neighbourhood: "ΚΥΨΕΛΗ"          },
  90:  { resourceId: "d6b078da-c875-4a65-9c46-aa3fd48777bf", name: "Βοτανικός Κήπος",            neighbourhood: "ΒΟΤΑΝΙΚΟΣ"        },
  92:  { resourceId: "e5a66595-8f9a-4912-928e-4ea4f2b41b79", name: "Πλατεία Φλέμιγκ",           neighbourhood: "ΣΕΠΟΛΙΑ"           },
  93:  { resourceId: "695616c6-5d68-436f-918a-c7a22bc7d12c", name: "Θέατρο Κολωνού",             neighbourhood: "ΚΟΛΩΝΟΣ"           },
  95:  { resourceId: "",                                       name: "Άτλας Σεπολίων",            neighbourhood: "ΣΕΠΟΛΙΑ"           }, // TODO: UUID pending
  96:  { resourceId: "f39043ef-1289-4f3c-a25c-ea78551b7008", name: "Τρίτωνα Σεπολίων",           neighbourhood: "ΣΕΠΟΛΙΑ"           },
  97:  { resourceId: "b69836e4-b946-4431-befc-54227af0ddeb", name: "Πλατεία Θυμαράκια",          neighbourhood: "ΣΕΠΟΛΙΑ"           },
  98:  { resourceId: "b02ebb00-3e17-4bc0-b7aa-b0b3c610a447", name: "Πλατεία Ζέρβα",              neighbourhood: "ΣΕΠΟΛΙΑ"           },
  99:  { resourceId: "ed4b198e-9e89-4b06-87ca-c209aa76d43c", name: "Πλατεία Ναθαναήλ",           neighbourhood: "ΣΕΠΟΛΙΑ"           },
  100: { resourceId: "93ac4773-5f8f-4496-a445-0b5958c341c3", name: "Γηπεδάκι Αυλώνος",           neighbourhood: "ΣΕΠΟΛΙΑ"           },
  112: { resourceId: "bd264908-85dd-4759-a522-38284c0ac5b0", name: "Γήπεδο Εριουργίας",           neighbourhood: "ΚΕΡΑΜΕΙΚΟΣ"        },
  113: { resourceId: "7d9bbbcb-9556-43e2-9042-f2698a86d307", name: "Φωκίωνος Νέγρη",             neighbourhood: "ΦΩΚΙΩΝΟΣ ΝΕΓΡΗ"   },
};

// Σταθμοί που αποτελούν τη «γύρω περιοχή Σεραφείου» στο demo (Βοτανικός + Λαρίσης + Σεπόλια)
export const DEMO_AREA_STATIONS = [77, 90, 92, 93, 95, 96, 97, 98, 99, 100];

interface CkanRecord { highest_visitors: number; date: string }
interface CkanResponse { success: boolean; result: { records: CkanRecord[] } }

async function fetchLive(stationId: number): Promise<number | null> {
  const station = STATION_REGISTRY[stationId];
  if (!station?.resourceId) return null;
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
  stationIds: number[] = DEMO_AREA_STATIONS
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
