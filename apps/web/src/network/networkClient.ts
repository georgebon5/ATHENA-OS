import type { LngLat } from "@/types/contracts";

export interface NetworkFeature {
  type: "Feature";
  properties: {
    wayId: number;
    name?: string;
    highway?: string;
    lanes?: number;
    oneway?: boolean;
    maxspeed?: number;
  };
  geometry: { type: "LineString"; coordinates: LngLat[] };
}

export interface NetworkFeatureCollection {
  type: "FeatureCollection";
  features: NetworkFeature[];
}

const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000");

/**
 * Φέρνει το road network GeoJSON από τον gateway. Αν το endpoint δεν
 * απαντήσει (dev / χωρίς backend), πέφτουμε σε τοπικό fallback στο
 * public/demo/network.geojson. Ποτέ δεν πετάει exception στον caller.
 */
export async function fetchNetwork(): Promise<Map<number, LngLat[]>> {
  const map = new Map<number, LngLat[]>();
  const sources = [`${GATEWAY_URL}/network`, "/demo/network.geojson"];
  for (const url of sources) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const fc = (await res.json()) as NetworkFeatureCollection;
      for (const f of fc.features) {
        map.set(f.properties.wayId, f.geometry.coordinates);
      }
      if (map.size > 0) return map;
    } catch {
      // Προχωράμε στο επόμενο source
    }
  }
  return map;
}
