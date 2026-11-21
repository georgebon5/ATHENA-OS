import type { LngLat } from "@/types/contracts";

interface NetworkFeature {
  properties: { wayId: number };
  geometry:
    | { type: "LineString"; coordinates: LngLat[] }
    | { type: "MultiLineString"; coordinates: LngLat[][] }
    | null;
}

const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000");

/**
 * Οδικό δίκτυο: wayId → όλες οι γραμμές του δρόμου (ένας δρόμος έχει πολλά τμήματα).
 * Πρώτα από τον gateway (ίδιο με τον sim), αλλιώς το public/demo/network.geojson.
 * Ποτέ δεν πετάει exception στον caller.
 */
export async function fetchNetwork(): Promise<Map<number, LngLat[][]>> {
  for (const url of [`${GATEWAY_URL}/api/network`, "/demo/network.geojson"]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const fc = (await res.json()) as { features: NetworkFeature[] };
      const map = new Map<number, LngLat[][]>();
      for (const f of fc.features) {
        const g = f.geometry;
        if (!g) continue;
        const lines = g.type === "LineString" ? [g.coordinates] : g.coordinates;
        const id = f.properties.wayId;
        map.set(id, [...(map.get(id) ?? []), ...lines]);
      }
      if (map.size > 0) return map;
    } catch {
      // Προχωράμε στο επόμενο source
    }
  }
  return new Map();
}
