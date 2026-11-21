/**
 * AthensGov Sandbox API — https://athensgov.cityofathens.gr/sandbox
 * Auth: X-API-Key header (VITE_ATHENSGOV_API_KEY).
 * Falls back to /demo/fixtures/projects.geojson if key is absent or fetch fails.
 */

const SANDBOX_BASE = "https://athensgov.cityofathens.gr/sandbox";
const API_KEY = import.meta.env.VITE_ATHENSGOV_API_KEY as string | undefined;

export interface CityProject {
  id: string;
  title: string;
  category: string;
  status: "planned" | "in_progress" | "completed";
  coordinates: [number, number]; // [lng, lat] centroid
  district?: string;
  budget?: number;
  description?: string;
  source: "live" | "fixture";
}

interface GeoJSONGeometry {
  type: "Point" | "LineString" | "Polygon" | string;
  coordinates: unknown;
}

interface GeoJSONFeature {
  type: "Feature";
  id?: string | number;
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
}

function extractCentroid(geom: GeoJSONGeometry): [number, number] | null {
  if (geom.type === "Point") {
    const c = geom.coordinates as number[];
    return [c[0], c[1]];
  }
  if (geom.type === "LineString") {
    const pts = geom.coordinates as number[][];
    return [
      (pts[0][0] + pts[pts.length - 1][0]) / 2,
      (pts[0][1] + pts[pts.length - 1][1]) / 2,
    ];
  }
  if (geom.type === "Polygon") {
    const ring = (geom.coordinates as number[][][])[0];
    const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return [lng, lat];
  }
  return null;
}

function normalizeStatus(raw: unknown): CityProject["status"] {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("progress") || s.includes("εξέλιξη") || s.includes("εξελιξη")) return "in_progress";
  if (s.includes("complet") || s.includes("ολοκλη")) return "completed";
  return "planned";
}

function parseFeature(f: GeoJSONFeature, i: number, source: "live" | "fixture"): CityProject | null {
  const coords = extractCentroid(f.geometry);
  if (!coords) return null;
  const p = f.properties;
  return {
    id: String(f.id ?? p["id"] ?? `${source}-${i}`),
    title: String(p["title"] ?? p["name"] ?? "Έργο Δήμου"),
    category: String(p["category"] ?? "Γενικό"),
    status: normalizeStatus(p["status"]),
    coordinates: coords,
    district: p["district"] != null ? String(p["district"]) : undefined,
    budget: typeof p["budget"] === "number" ? p["budget"] : undefined,
    description: p["description"] != null ? String(p["description"]) : undefined,
    source,
  };
}

async function fetchLive(): Promise<CityProject[] | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${SANDBOX_BASE}/v1/projects.geojson`, {
      headers: { "X-API-Key": API_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const fc = (await res.json()) as { features: GeoJSONFeature[] };
    return (fc.features ?? [])
      .map((f, i) => parseFeature(f, i, "live"))
      .filter((p): p is CityProject => p !== null);
  } catch {
    return null;
  }
}

let _fixtureCache: CityProject[] | null = null;

async function loadFixture(): Promise<CityProject[]> {
  if (_fixtureCache) return _fixtureCache;
  try {
    const res = await fetch("/demo/fixtures/projects.geojson");
    const fc = (await res.json()) as { features: GeoJSONFeature[] };
    _fixtureCache = (fc.features ?? [])
      .map((f, i) => parseFeature(f, i, "fixture"))
      .filter((p): p is CityProject => p !== null);
    return _fixtureCache;
  } catch {
    return [];
  }
}

export async function fetchProjects(): Promise<CityProject[]> {
  const live = await fetchLive();
  if (live !== null && live.length > 0) return live;
  return loadFixture();
}
