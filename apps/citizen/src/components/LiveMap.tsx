import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LngLat } from "@athena-os/contracts";

const SEVERITY_COLOR: Record<number, string> = {
  1: "#2ee6c9",
  2: "#9fe68a",
  3: "#ffd84d",
  4: "#ff9a5a",
  5: "#ff4b3e",
};

export interface MapPoint {
  id: string;
  lngLat: LngLat;
  color: string;
  severity?: number;
  label?: string;
}

interface Props {
  at: LngLat;
  heading: number | null;
  approximate?: boolean;
  points?: MapPoint[];
  zoomTo?: LngLat;
  caption?: string;
  height?: string;
  onPointClick?: (id: string) => void;
}

export function LiveMap({
  at,
  heading,
  approximate,
  points = [],
  zoomTo,
  caption,
  height = "260px",
  onPointClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | L.CircleMarker | null>(null);
  const userPulseRef = useRef<L.CircleMarker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: L.LatLngExpression = [at[1], at[0]];
    const map = L.map(containerRef.current, {
      center,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    // ESRI World Imagery — δορυφορικό HD (ίδιο με main desktop screen)
    L.tileLayer(
      "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, crossOrigin: true },
    ).addTo(map);

    // ESRI Reference — ονόματα δρόμων πάνω στο δορυφορικό
    L.tileLayer(
      "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, crossOrigin: true, opacity: 0.55 },
    ).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      userMarkerRef.current = null;
      userPulseRef.current = null;
    };
  }, []);

  // Update center / view
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (zoomTo) {
      map.flyTo([zoomTo[1], zoomTo[0]], 18, { duration: 0.6 });
    } else {
      map.flyTo([at[1], at[0]], 16, { duration: 0.6 });
    }
  }, [at[0], at[1], zoomTo?.[0], zoomTo?.[1]]);

  // Update user location marker (triangle when heading available, circle otherwise)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userPulseRef.current) {
      userPulseRef.current.remove();
      userPulseRef.current = null;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const latLng: L.LatLngExpression = [at[1], at[0]];

    userPulseRef.current = L.circleMarker(latLng, {
      radius: 18,
      color: "#79b7e4",
      weight: 2,
      fillColor: "#79b7e4",
      fillOpacity: 0.12,
      className: "user-pulse",
    }).addTo(map);

    if (heading != null) {
      // Triangle marker pointing in heading direction
      const triIcon = L.divIcon({
        className: "user-heading-triangle",
        html: `<svg width="32" height="32" viewBox="0 0 32 32" style="transform:rotate(${heading}deg)">
          <polygon points="16,2 26,28 16,22 6,28" fill="#79b7e4" stroke="#031b35" stroke-width="2.5" stroke-linejoin="round"/>
        </svg>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      userMarkerRef.current = L.marker(latLng, { icon: triIcon }).addTo(map);
    } else {
      userMarkerRef.current = L.circleMarker(latLng, {
        radius: 7,
        color: "#031b35",
        weight: 2.5,
        fillColor: "#79b7e4",
        fillOpacity: 1,
      }).addTo(map);
    }

    userMarkerRef.current.bindTooltip(
      approximate ? "Κατά προσέγγιση" : "Είσαι εδώ",
      { permanent: false, direction: "top", offset: [0, -10], className: "athena-tooltip" },
    );
  }, [at[0], at[1], heading, approximate]);

  // Update report markers
  useEffect(() => {
    const group = markersRef.current;
    if (!group) return;
    group.clearLayers();

    for (const p of points) {
      const sev = p.severity ?? 3;
      const radius = sev <= 2 ? 5 + sev : 5 + sev * 1.5;
      const color = p.color || SEVERITY_COLOR[sev] || "#79b7e4";

      const marker = L.circleMarker([p.lngLat[1], p.lngLat[0]], {
        radius,
        color: sev >= 4 ? color : "#0c0614",
        weight: sev >= 4 ? 2.5 : 2,
        fillColor: color,
        fillOpacity: 0.9,
      });

      if (p.label) {
        marker.bindTooltip(p.label, {
          permanent: false,
          direction: "top",
          offset: [0, -radius],
          className: "athena-tooltip",
        });
      }

      if (onPointClick) {
        marker.on("click", () => onPointClick(p.id));
      }

      marker.addTo(group);
    }
  }, [points, onPointClick]);

  const captionText =
    caption ??
    (approximate
      ? "Κατά προσέγγιση: Σεράφειο"
      : "Είσαι εδώ");

  return (
    <figure className="overflow-hidden rounded-2xl" style={{ boxShadow: "inset 0 0 0 1px rgba(121,183,228,0.16), 0 18px 50px -20px rgba(0,0,0,0.9)" }}>
      <div
        ref={containerRef}
        style={{ height, minHeight: "180px" }}
        className="w-full"
      />
      <figcaption className="flex justify-between gap-3 border-t border-holo/10 bg-void/90 px-4 py-2.5 text-[13px] text-chalk/75 backdrop-blur-sm">
        <span>{captionText}</span>
        <span className="font-mono tabular-nums text-chalk/50">
          {at[1].toFixed(5)}, {at[0].toFixed(5)}
        </span>
      </figcaption>
    </figure>
  );
}
