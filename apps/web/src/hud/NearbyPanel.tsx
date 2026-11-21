import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import { cameraController } from "@/cesium/cameraShots";
import { HEIGHT, SERAFIO_LNGLAT } from "@/cesium/constants";
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
  consultation: { label: "Διαβούλευση", color: "#79b7e4" },
  report: { label: "Αναφορά", color: "#ffffff" },
  project: { label: "Έργο", color: "#1a73e8" },
};
// Η θέση του laptop έρχεται από Wi‑Fi και καμιά φορά είναι άλλη πόλη: εκτός Αττικής → Σεράφειο
const ATTICA = { w: 23.3, s: 37.6, e: 24.2, n: 38.4 };

const distance = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

// Ενδεικτικές φωτογραφίες (Unsplash, ελεύθερη άδεια, ελεγμένες μία-μία) για ό,τι δεν έχει πραγματική:
// τα έργα και οι ιστορικές αναφορές του seed (εκείνες έχουν generated placeholder). Οι αληθινές δεν αντικαθίστανται.
const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;
const MOCK: Record<string, string[]> = {
  pothole: [U("1657811146442-0d66d65dbe92"), U("1560782205-4dd83ceb0270")],
  sidewalk_damage: [U("1717185691293-4ecd7072b847"), U("1777985075988-efde43fbcc78")],
  waste: [U("1759401654832-ab2e73a14336"), U("1739569482726-511824b03679")],
  lighting: [U("1565199975350-a723a63c053f"), U("1543518360-68b9612a7c8c")],
  obstruction: [U("1774686251372-33e8fae4faef"), U("1786391756547-89c6c69b140c")],
  graffiti: [U("1765230182334-e29feea9e49e"), U("1571446390594-87abc6667406")],
  accessibility: [U("1653701888795-a23335d9aee2"), U("1699170551757-348ed5a52e48")],
  street: [U("1655548624089-18e789cd3245"), U("1602769247692-126fdf1f1da6")],
  roadworks: [U("1529792083865-d23889753466"), U("1503708928676-1cb796a0891e")],
  park: [U("1641357441057-e798d0af9ed8"), U("1668009219418-4ece0d9e36c4")],
};

function mockPhotos(i: Votable, category?: string): string[] {
  if (i.kind === "project") {
    if (/φύτευ|πάρκ|πρασιν|δέντρ/i.test(i.titleEl)) return MOCK.park;
    if (/λεωφορ|ποδηλατ|λωρίδ/i.test(i.titleEl)) return MOCK.street;
    return MOCK.roadworks;
  }
  return MOCK[category ?? ""] ?? MOCK.street;
}

/**
 * Με το άνοιγμα: η θέση μου στον χάρτη + popup με ό,τι ψηφίζεται κοντά.
 * Κλικ → 3D close-up εκεί και οι φωτογραφίες του: αναφορά (+ ίδιο συμβάν από άλλους), διαβούλευση (πριν/μετά).
 */
interface PhotoPair { before: string; after: string | null; mock: boolean }

export function NearbyPanel({ viewer }: { viewer: Cesium.Viewer | null }) {
  const [here, setHere] = useState<LngLat | null>(null);
  const [items, setItems] = useState<Votable[]>([]);
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [pair, setPair] = useState<PhotoPair | null>(null);
  const [photoTab, setPhotoTab] = useState<"before" | "after">("before");
  const selectedRef = useRef<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const reports = useStore((s) => s.reports);

  const pick = (i: Votable) => {
    cameraController.flyTo({ lngLat: i.lngLat, heightM: HEIGHT.street + 20, headingDeg: 0, pitchDeg: -30, durationS: 1.8 });
    const id = selected === i.id ? null : i.id;
    selectedRef.current = id;
    setSelected(id);
    setPair(null);
    setPhotoTab("before");
    if (!id) return;
    fetch(`${GATEWAY_URL}/api/consultations/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { beforeUrl?: string; afterUrl?: string; reportId?: string } | null) => {
        if (selectedRef.current !== id) return;
        const cat = c?.reportId ? reports[c.reportId]?.classification?.category : undefined;
        const seeded = !!c?.reportId?.startsWith("r-seed-");
        const fallbacks = mockPhotos(i, cat);
        const before = (!seeded && c?.beforeUrl) ? c.beforeUrl : fallbacks[0];
        const after  = (!seeded && c?.afterUrl)  ? c.afterUrl  : (fallbacks[1] ?? null);
        setPair({ before, after, mock: seeded || (!c?.beforeUrl) });
      })
      .catch(() => {
        if (selectedRef.current !== id) return;
        const fallbacks = mockPhotos(i);
        setPair({ before: fallbacks[0], after: fallbacks[1] ?? null, mock: true });
      });
  };

  useEffect(() => {
    if (!viewer) return;
    const done = (at: LngLat) => {
      const inAttica = at[0] > ATTICA.w && at[0] < ATTICA.e && at[1] > ATTICA.s && at[1] < ATTICA.n;
      const where = inAttica ? at : SERAFIO_LNGLAT;
      setHere(where);
      cameraController.flyTo({ lngLat: where, heightM: HEIGHT.nearby, headingDeg: 0, pitchDeg: -90, durationS: 3 });
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

  // Μετακίνηση από την κεφαλίδα· μέχρι το πρώτο drag μένει δεξιά (right/bottom των classes)
  const startDrag = (e: React.PointerEvent) => {
    const box = boxRef.current;
    if (!box || e.button !== 0) return;
    const r = box.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    const move = (ev: PointerEvent) =>
      setPos({
        x: Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - 120),
        y: Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - 48),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!open) return null;

  const nearby50 = items.filter((i) => i.kind === "report" && i.distanceM <= 50);
  return (
    // Δεξιά, πάνω από το minimap. Σέρνεται από την κεφαλίδα, αλλάζει μέγεθος από την κάτω-δεξιά γωνία (CSS resize)
    <div
      ref={boxRef}
      className="glass pointer-events-auto fixed bottom-[210px] right-6 z-10 flex h-[460px] w-[440px] min-h-[180px] min-w-[300px] max-h-[90vh] max-w-[90vw] resize flex-col overflow-hidden"
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
    >
      <div
        onPointerDown={startDrag}
        className="flex cursor-move touch-none select-none items-center justify-between border-b border-white/5 px-4 py-2.5"
      >
        <span className="hud-label text-[11px]">
          <span className="mr-2 text-chalk/30">⠿</span>Ψηφίζεται κοντά σου · {items.length}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setOpen(false)}
          className="px-1 text-[18px] leading-none text-chalk/50 hover:text-chalk"
          aria-label="Κλείσιμο"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* ── Αναφορές ≤ 50m ── */}
        <div>
          <p className="hud-label px-2 pb-1.5 text-[11px]">
            Προβλήματα κοντά σου <span className="text-chalk/30">(&lt;50m)</span>
          </p>
          {nearby50.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-chalk/40">
              {items.length === 0 ? "Φορτώνουμε…" : "Δεν υπάρχουν αναφορές σε 50m."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {nearby50.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-white/5 ${selected === i.id ? "bg-white/8 ring-1 ring-yes/40" : ""}`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full bg-white" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-chalk">{i.titleEl}</span>
                      <span className="block text-[12px] text-chalk/50">Αναφορά · {distance(i.distanceM)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-bold tabular-nums text-chalk">{i.yes + i.no + i.maybe}</span>
                      <span className="block text-[11px] text-chalk/40">ψήφοι</span>
                    </span>
                  </button>
                  {selected === i.id && (
                    <div className="mx-2.5 my-2 space-y-2">
                      {pair === null ? (
                        <div className="aspect-[4/3] animate-pulse rounded-lg bg-white/5" />
                      ) : (
                        <>
                          {/* Tabs Τώρα / Με βελτίωση */}
                          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                            <button
                              type="button"
                              onClick={() => setPhotoTab("before")}
                              className={`flex-1 rounded-md py-1 text-[12px] font-semibold transition ${photoTab === "before" ? "bg-white/15 text-chalk" : "text-chalk/40 hover:text-chalk/70"}`}
                            >
                              Τώρα
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhotoTab("after")}
                              disabled={!pair.after}
                              className={`flex-1 rounded-md py-1 text-[12px] font-semibold transition ${photoTab === "after" ? "bg-holo/30 text-chalk" : "text-chalk/40 hover:text-chalk/70"} disabled:opacity-30`}
                            >
                              Με βελτίωση
                            </button>
                          </div>
                          <img
                            src={photoTab === "after" && pair.after ? pair.after : pair.before}
                            alt={photoTab === "after" ? "Με βελτίωση" : "Τρέχουσα κατάσταση"}
                            className="aspect-[4/3] w-full rounded-lg object-cover"
                          />
                          {pair.mock && <p className="text-[11px] text-chalk/40">Ενδεικτική φωτογραφία</p>}
                        </>
                      )}
                      <a
                        href={`/c/v/${i.id}`}
                        className="flex h-11 w-full items-center justify-center rounded-xl bg-yes font-bold text-[15px] text-void shadow-[0_0_16px_-4px_#4ade80] transition active:scale-[0.98]"
                      >
                        ✓ Επικύρωσε / Vote
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Υπόλοιπα votables ── */}
        {items.filter((i) => !(i.kind === "report" && i.distanceM <= 50)).length > 0 && (
          <div>
            <p className="hud-label px-2 pb-1.5 text-[11px]">Άλλα κοντά σου</p>
            <ul className="space-y-0.5">
              {items.filter((i) => !(i.kind === "report" && i.distanceM <= 50)).map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-white/5 ${selected === i.id ? "bg-white/5" : ""}`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: KIND[i.kind].color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-chalk">{i.titleEl}</span>
                      <span className="block text-[12px] text-chalk/50">{KIND[i.kind].label} · {distance(i.distanceM)}</span>
                    </span>
                    <span className="text-[12px] tabular-nums text-chalk/50">{i.yes + i.no + i.maybe} ψήφοι</span>
                  </button>
                  {selected === i.id && (
                    <div className="mx-2.5 my-2 space-y-2">
                      {pair === null ? (
                        <div className="aspect-[4/3] animate-pulse rounded-lg bg-white/5" />
                      ) : (
                        <>
                          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                            <button type="button" onClick={() => setPhotoTab("before")} className={`flex-1 rounded-md py-1 text-[12px] font-semibold transition ${photoTab === "before" ? "bg-white/15 text-chalk" : "text-chalk/40 hover:text-chalk/70"}`}>Τώρα</button>
                            <button type="button" onClick={() => setPhotoTab("after")} disabled={!pair.after} className={`flex-1 rounded-md py-1 text-[12px] font-semibold transition ${photoTab === "after" ? "bg-holo/30 text-chalk" : "text-chalk/40 hover:text-chalk/70"} disabled:opacity-30`}>Με βελτίωση</button>
                          </div>
                          <img src={photoTab === "after" && pair.after ? pair.after : pair.before} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
                          {pair.mock && <p className="text-[11px] text-chalk/40">Ενδεικτική φωτογραφία</p>}
                        </>
                      )}
                      <a href={`/c/v/${i.id}`} className="flex h-11 w-full items-center justify-center rounded-xl bg-yes font-bold text-[15px] text-void shadow-[0_0_16px_-4px_#4ade80] transition active:scale-[0.98]">
                        ✓ Επικύρωσε / Vote
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
