import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import { cameraController } from "@/cesium/cameraShots";
import { HEIGHT, SERAFIO_LNGLAT } from "@/cesium/constants";
import { GATEWAY_URL } from "@/director/directorApi";
import type { LngLat } from "@/types/contracts";
import { initialMockVotes, saveMockVotes, voteHeat, withMockVotes } from "./voteHeat";

/** Αριθμός ψήφων σε χρώμα: γαλάζιο (λίγες) → σκούρο κόκκινο (οι περισσότερες, «κρίσιμο»). */
function VoteBadge({ votes, max }: { votes: number; max: number }) {
  const h = voteHeat(votes, max);
  return (
    <span className="min-w-[58px] shrink-0 rounded-lg px-2.5 py-1 text-center leading-tight" style={{ background: h.bg, color: h.fg }}>
      <span className="block text-[15px] font-bold tabular-nums">{votes}</span>
      <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">{h.critical ? "κρίσιμο" : "ψήφοι"}</span>
    </span>
  );
}

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

// Ενδεικτικές φωτογραφίες (Unsplash, ελεύθερη άδεια) — δύο λεξιλόγια:
// BEFORE: εικόνες του προβλήματος · AFTER: πώς θα φαίνεται φτιαγμένο
const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;
const MOCK_BEFORE: Record<string, string> = {
  pothole:         U("1657811146442-0d66d65dbe92"),
  sidewalk_damage: U("1717185691293-4ecd7072b847"),
  waste:           U("1759401654832-ab2e73a14336"),
  lighting:        U("1565199975350-a723a63c053f"),
  obstruction:     U("1774686251372-33e8fae4faef"),
  graffiti:        U("1765230182334-e29feea9e49e"),
  accessibility:   U("1653701888795-a23335d9aee2"),
  street:          U("1655548624089-18e789cd3245"),
  roadworks:       U("1529792083865-d23889753466"),
  park:            U("1641357441057-e798d0af9ed8"),
};
// "Μετά": καθαρός δρόμος, νέο πεζοδρόμιο, ράμπα ΑΜΕΑ, κτλ.
const MOCK_AFTER: Record<string, string> = {
  pothole:         U("1584905347025-55c1b4a4c0cb"),  // smooth new asphalt
  sidewalk_damage: U("1476231682828-37e571bc172f"),  // clean walkway
  waste:           U("1485115905815-74a5dd96ffe8"),  // clean street
  lighting:        U("1543518360-68b9612a7c8c"),     // well-lit
  obstruction:     U("1600596542815-0c92b59a69b0"),  // clear path
  graffiti:        U("1571446390594-87abc6667406"),  // clean wall
  accessibility:   U("1544551706-26bb6a4a24a7"),     // accessible ramp
  street:          U("1602769247692-126fdf1f1da6"),  // clean road
  roadworks:       U("1503708928676-1cb796a0891e"),  // finished road
  park:            U("1668009219418-4ece0d9e36c4"),  // planted trees
};

function mockPhotos(i: Votable, category?: string): { before: string; after: string } {
  let key = category ?? "";
  if (i.kind === "project") {
    if (/φύτευ|πάρκ|πρασιν|δέντρ/i.test(i.titleEl)) key = "park";
    else if (/λεωφορ|ποδηλατ|λωρίδ/i.test(i.titleEl)) key = "street";
    else key = "roadworks";
  }
  return {
    before: MOCK_BEFORE[key] ?? MOCK_BEFORE.street,
    after:  MOCK_AFTER[key]  ?? MOCK_AFTER.street,
  };
}

/**
 * Με το άνοιγμα: η θέση μου στον χάρτη + popup με ό,τι ψηφίζεται κοντά.
 * Κλικ → 3D close-up εκεί και οι φωτογραφίες του: αναφορά (+ ίδιο συμβάν από άλλους), διαβούλευση (πριν/μετά).
 */
interface PhotoPair { before: string; after: string | null; mock: boolean }

export function NearbyPanel({ viewer }: { viewer: Cesium.Viewer | null }) {
  const [here, setHere] = useState<LngLat | null>(null);
  const [items, setItems] = useState<Votable[]>([]);
  const [mockVotes, setMockVotes] = useState(initialMockVotes);
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [pair, setPair] = useState<PhotoPair | null>(null);
  const [myVote, setMyVote] = useState<Record<string, "yes" | "no" | "maybe">>({});
  const [extraVotes, setExtraVotes] = useState<Record<string, { yes: number; no: number; maybe: number }>>({});
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
    if (!id) return;
    fetch(`${GATEWAY_URL}/api/consultations/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { beforeUrl?: string; afterUrl?: string; reportId?: string } | null) => {
        if (selectedRef.current !== id) return;
        const cat = c?.reportId ? reports[c.reportId]?.classification?.category : undefined;
        const seeded = !!c?.reportId?.startsWith("r-seed-");
        const fallbacks = mockPhotos(i, cat);
        const before = (!seeded && c?.beforeUrl) ? c.beforeUrl : fallbacks.before;
        const after  = (!seeded && c?.afterUrl)  ? c.afterUrl  : fallbacks.after;
        setPair({ before, after, mock: seeded || (!c?.beforeUrl) });
      })
      .catch(() => {
        if (selectedRef.current !== id) return;
        const fallbacks = mockPhotos(i);
        setPair({ before: fallbacks.before, after: fallbacks.after, mock: true });
      });
  };

  const castVote = (i: Votable, choice: "yes" | "no" | "maybe") => {
    if (myVote[i.id]) return;
    setMyVote((v) => ({ ...v, [i.id]: choice }));
    setExtraVotes((e) => {
      const cur = e[i.id] ?? { yes: 0, no: 0, maybe: 0 };
      return { ...e, [i.id]: { ...cur, [choice]: cur[choice] + 1 } };
    });
    fetch(`${GATEWAY_URL}/api/consultations/${encodeURIComponent(i.id)}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultationId: i.id, choice }),
    }).catch(() => undefined);
  };

  const tally = (i: Votable) => {
    const ex = extraVotes[i.id] ?? { yes: 0, no: 0, maybe: 0 };
    return { yes: i.yes + ex.yes, no: i.no + ex.no, maybe: i.maybe + ex.maybe };
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

  const shown = mockVotes ? withMockVotes(items) : items;
  const nearby50 = shown.filter((i) => i.kind === "report" && i.distanceM <= 300);
  const maxVotes = Math.max(0, ...shown.map((i) => i.yes + i.no + i.maybe));
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
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              saveMockVotes(!mockVotes);
              setMockVotes(!mockVotes);
            }}
            title="Δοκιμαστικές ψήφοι μόνο στην οθόνη (τίποτα στη βάση)"
            className={`ml-2 rounded px-1.5 py-0.5 ${mockVotes ? "bg-warn/15 text-warn" : "bg-white/5 text-chalk/40 hover:text-chalk/70"}`}
          >
            δοκιμαστικές ψήφοι · {mockVotes ? "ON" : "OFF"}
          </button>
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
            Προβλήματα κοντά σου <span className="text-chalk/30">(&lt;300m)</span>
          </p>
          {nearby50.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-chalk/40">
              {items.length === 0 ? "Φορτώνουμε…" : "Δεν υπάρχουν αναφορές σε 300m."}
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
                    <VoteBadge votes={i.yes + i.no + i.maybe} max={maxVotes} />
                  </button>
                  {selected === i.id && (
                    <div className="mx-2.5 my-2 space-y-2">
                      {pair === null ? (
                        <div className="aspect-[4/3] animate-pulse rounded-lg bg-white/5" />
                      ) : (
                        <>
                          <img src={pair.before} alt="Τρέχουσα κατάσταση" className="aspect-[4/3] w-full rounded-lg object-cover" />
                          {pair.mock && <p className="text-[11px] text-chalk/30">Ενδεικτική φωτογραφία</p>}
                        </>
                      )}
                      {myVote[i.id] ? (
                        <div className="flex items-center justify-between rounded-xl border border-yes/20 bg-yes/10 px-4 py-2.5">
                          <span className="text-[14px] font-semibold text-yes">✓ Ψήφος καταγράφηκε</span>
                          <span className="tabular-nums text-[12px] text-chalk/50">{tally(i).yes + tally(i).no + tally(i).maybe} ψήφοι</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                          <button type="button" onClick={() => castVote(i, "yes")} className="flex h-10 items-center justify-center rounded-xl bg-[#4ade80]/15 text-[13px] font-bold text-[#4ade80] transition hover:bg-[#4ade80]/25 active:scale-95">✓ ΝΑΙ</button>
                          <button type="button" onClick={() => castVote(i, "maybe")} className="flex h-10 items-center justify-center rounded-xl bg-holo/15 text-[13px] font-bold text-holo transition hover:bg-holo/25 active:scale-95">~ ΙΣΩΣ</button>
                          <button type="button" onClick={() => castVote(i, "no")} className="flex h-10 items-center justify-center rounded-xl bg-[#ff6a4c]/15 text-[13px] font-bold text-[#ff6a4c] transition hover:bg-[#ff6a4c]/25 active:scale-95">✗ ΟΧΙ</button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Υπόλοιπα votables ── */}
        {shown.filter((i) => !(i.kind === "report" && i.distanceM <= 300)).length > 0 && (
          <div>
            <p className="hud-label px-2 pb-1.5 text-[11px]">Άλλα κοντά σου</p>
            <ul className="space-y-0.5">
              {shown.filter((i) => !(i.kind === "report" && i.distanceM <= 300)).map((i) => (
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
                    <VoteBadge votes={i.yes + i.no + i.maybe} max={maxVotes} />
                  </button>
                  {selected === i.id && (
                    <div className="mx-2.5 my-2 space-y-2">
                      {pair === null ? (
                        <div className="aspect-[4/3] animate-pulse rounded-lg bg-white/5" />
                      ) : (
                        <>
                          <img src={pair.before} alt="Τρέχουσα κατάσταση" className="aspect-[4/3] w-full rounded-lg object-cover" />
                          {pair.mock && <p className="text-[11px] text-chalk/30">Ενδεικτική φωτογραφία</p>}
                        </>
                      )}
                      {myVote[i.id] ? (
                        <div className="flex items-center justify-between rounded-xl border border-yes/20 bg-yes/10 px-4 py-2.5">
                          <span className="text-[14px] font-semibold text-yes">✓ Ψήφος καταγράφηκε</span>
                          <span className="tabular-nums text-[12px] text-chalk/50">{tally(i).yes + tally(i).no + tally(i).maybe} ψήφοι</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                          <button type="button" onClick={() => castVote(i, "yes")} className="flex h-10 items-center justify-center rounded-xl bg-[#4ade80]/15 text-[13px] font-bold text-[#4ade80] transition hover:bg-[#4ade80]/25 active:scale-95">✓ ΝΑΙ</button>
                          <button type="button" onClick={() => castVote(i, "maybe")} className="flex h-10 items-center justify-center rounded-xl bg-holo/15 text-[13px] font-bold text-holo transition hover:bg-holo/25 active:scale-95">~ ΙΣΩΣ</button>
                          <button type="button" onClick={() => castVote(i, "no")} className="flex h-10 items-center justify-center rounded-xl bg-[#ff6a4c]/15 text-[13px] font-bold text-[#ff6a4c] transition hover:bg-[#ff6a4c]/25 active:scale-95">✗ ΟΧΙ</button>
                        </div>
                      )}
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
