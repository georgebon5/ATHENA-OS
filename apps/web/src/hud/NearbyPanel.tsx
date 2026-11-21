import { useEffect, useState } from "react";
import * as Cesium from "cesium";
import { cameraController } from "@/cesium/cameraShots";
import { SERAFIO_LNGLAT } from "@/cesium/constants";
import { GATEWAY_URL } from "@/director/directorApi";
import type { LngLat } from "@/types/contracts";

/** gateway GET /api/votables. Τοπικός τύπος: δεν είναι (ακόμα) στα contracts. */
interface Votable {
  id: string;
  kind: "consultation" | "report" | "project";
  titleEl: string;
  lngLat: LngLat;
  distanceM: number;
  yes: number;
  no: number;
  maybe: number;
}

const KIND: Record<Votable["kind"], { label: string; color: string }> = {
  consultation: { label: "Διαβούλευση", color: "#ff5fb8" },
  report: { label: "Αναφορά", color: "#ffa043" },
  project: { label: "Έργο", color: "#2ee6c9" },
};
// Η θέση του laptop έρχεται από Wi‑Fi και καμιά φορά είναι άλλη πόλη: εκτός Αττικής → Σεράφειο
const ATTICA = { w: 23.3, s: 37.6, e: 24.2, n: 38.4 };

const distance = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

/** Με το άνοιγμα: η θέση μου στον χάρτη + popup με ό,τι ψηφίζεται κοντά. Κλικ → 3D close-up εκεί. */
export function NearbyPanel({ viewer }: { viewer: Cesium.Viewer | null }) {
  const [here, setHere] = useState<LngLat | null>(null);
  const [items, setItems] = useState<Votable[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!viewer) return;
    const done = (at: LngLat) => {
      const inAttica = at[0] > ATTICA.w && at[0] < ATTICA.e && at[1] > ATTICA.s && at[1] < ATTICA.n;
      const where = inAttica ? at : SERAFIO_LNGLAT;
      setHere(where);
      cameraController.flyTo({ lngLat: where, heightM: 2500, headingDeg: 0, pitchDeg: -90, durationS: 3 });
    };
    if (!("geolocation" in navigator)) return done(SERAFIO_LNGLAT);
    navigator.geolocation.getCurrentPosition(
      (p) => done([p.coords.longitude, p.coords.latitude]),
      () => done(SERAFIO_LNGLAT),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }, [viewer]);

  // «Είσαι εδώ» στον χάρτη (μπλε, όπως στους χάρτες κινητού)
  useEffect(() => {
    if (!viewer || !here) return;
    const me = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(here[0], here[1], 0),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString("#4da3ff"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: "Είσαι εδώ",
        font: "600 12px Inter, sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    return () => {
      if (!viewer.isDestroyed()) viewer.entities.remove(me);
    };
  }, [viewer, here]);

  useEffect(() => {
    if (!here) return;
    const load = () =>
      fetch(`${GATEWAY_URL}/api/votables?lng=${here[0]}&lat=${here[1]}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setItems)
        .catch(() => undefined);
    void load();
    const t = window.setInterval(load, 15_000);
    return () => window.clearInterval(t);
  }, [here]);

  if (!open || items.length === 0) return null;
  return (
    <div className="glass pointer-events-auto fixed bottom-20 left-6 z-10 w-[340px] p-3">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="hud-label text-[10px]">Ψηφίζεται κοντά σου · {items.length}</span>
        <button type="button" onClick={() => setOpen(false)} className="px-1 text-chalk/50 hover:text-chalk" aria-label="Κλείσιμο">
          ×
        </button>
      </div>
      <ul className="space-y-0.5">
        {items.slice(0, 6).map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => cameraController.closeUp(Cesium.Cartesian3.fromDegrees(i.lngLat[0], i.lngLat[1], 0))}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND[i.kind].color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-chalk">{i.titleEl}</span>
                <span className="block text-[11px] text-chalk/50">
                  {KIND[i.kind].label} · {distance(i.distanceM)}
                </span>
              </span>
              <span className="text-[11px] tabular-nums text-chalk/50">{i.yes + i.no + i.maybe} ψήφοι</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
