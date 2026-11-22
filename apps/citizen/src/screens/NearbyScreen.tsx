import { useEffect, useState, useCallback } from "react";
import type { LngLat } from "@athena-os/contracts";
import { Shell, Spinner } from "../components/Shell";
import { LiveMap, type MapPoint } from "../components/LiveMap";
import { getVotables, type Votable } from "../lib/api";
import { SERAFIO, watchHeading, requestCompassPermission } from "../lib/sensors";
import { initialMockVotes, saveMockVotes, voteHeat, withMockVotes } from "../lib/voteHeat";

/** Αριθμός ψήφων σε χρώμα: γαλάζιο (λίγες) → σκούρο κόκκινο (οι περισσότερες, «κρίσιμο»). */
function VoteBadge({ votes, max }: { votes: number; max: number }) {
  const h = voteHeat(votes, max);
  return (
    <span className="min-w-[60px] shrink-0 rounded-xl px-2.5 py-1.5 text-center leading-tight" style={{ background: h.bg, color: h.fg }}>
      <span className="block text-[16px] font-bold tabular-nums">{votes}</span>
      <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">{h.critical ? "κρίσιμο" : "ψήφοι"}</span>
    </span>
  );
}

const KIND: Record<Votable["kind"], { label: string; color: string }> = {
  consultation: { label: "Διαβούλευση", color: "#79b7e4" },
  report: { label: "Αναφορά πολίτη", color: "#ffffff" },
  project: { label: "Δημοτικό έργο", color: "#1a73e8" },
};

interface Here {
  at: LngLat;
  approximate: boolean;
}

/** Μία θέση (όχι watch): αν αρνηθεί ή αργήσει, γύρω από το Σεράφειο. */
function locate(onHere: (h: Here) => void) {
  if (!("geolocation" in navigator)) return onHere({ at: SERAFIO, approximate: true });
  navigator.geolocation.getCurrentPosition(
    (p) => onHere({ at: [p.coords.longitude, p.coords.latitude], approximate: false }),
    () => onHere({ at: SERAFIO, approximate: true }),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
  );
}

const distance = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

const NEARBY_RADIUS = 50; // μέτρα

/** Αρχική: η θέση μου + ό,τι ψηφίζεται κοντά (διαβουλεύσεις, αναφορές, έργα). */
export function NearbyScreen() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [here, setHere] = useState<Here | null>(null);
  const [items, setItems] = useState<Votable[] | null>(null);
  const [mockVotes, setMockVotes] = useState(initialMockVotes);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Votable | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [voted, setVoted] = useState<Record<string, string>>({});

  // Start compass
  useEffect(() => {
    let stop: (() => void) | null = null;
    void requestCompassPermission().then((ok) => {
      if (ok) stop = watchHeading(setHeading);
    });
    return () => stop?.();
  }, []);

  useEffect(() => locate(setHere), []);
  useEffect(() => {
    if (!here) return;
    setError(null);
    getVotables(here.at)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [here]);

  const shown = items && mockVotes ? withMockVotes(items) : items;
  const nearby = shown?.filter((i) => i.kind === "report" && i.distanceM <= NEARBY_RADIUS) ?? [];
  const rest = shown?.filter((i) => !(i.kind === "report" && i.distanceM <= NEARBY_RADIUS)) ?? [];
  const maxVotes = Math.max(0, ...(shown ?? []).map((i) => i.yes + i.no + i.maybe));

  const handleSelect = useCallback((item: Votable) => {
    setSelected((prev) => (prev?.id === item.id ? null : item));
  }, []);

  const handleQuickVote = useCallback((item: Votable, choice: "yes" | "no" | "maybe") => {
    // Local vote (no gateway needed for demo)
    setVoted((prev) => ({ ...prev, [item.id]: choice }));
    // Update counts locally
    setItems((prev) =>
      prev?.map((i) =>
        i.id === item.id ? { ...i, [choice]: i[choice] + 1 } : i,
      ) ?? null,
    );
  }, []);

  return (
    <Shell subtitle="Κοντά σου · ψήφισε για τη γειτονιά σου">
      <div className="space-y-4">
        {here ? (
          <LiveMap
            at={here.at}
            heading={heading}
            approximate={here.approximate}
            caption={
              selected
                ? `${selected.titleEl}`
                : here.approximate
                ? "Δεν βρήκαμε τη θέση σου: γύρω από το Σεράφειο"
                : "Είσαι εδώ"
            }
            points={(shown ?? []).map((i): MapPoint => ({
              id: i.id,
              lngLat: i.lngLat,
              color: KIND[i.kind].color,
              label: i.titleEl,
            }))}
            zoomTo={selected?.lngLat}
            height={selected ? "320px" : "260px"}
            onPointClick={(id) => {
              const item = shown?.find((i) => i.id === id);
              if (item) handleSelect(item);
            }}
          />
        ) : (
          <div className="card flex aspect-[4/3] items-center justify-center gap-3 text-muted">
            <Spinner /> Βρίσκουμε τη θέση σου…
          </div>
        )}
        {here?.approximate && (
          <button type="button" className="btn-secondary" onClick={() => locate(setHere)}>
            Δοκίμασε ξανά τη θέση μου
          </button>
        )}

        {/* Quick vote panel when item selected */}
        {selected && (
          <div className="animate-rise rounded-2xl border border-holo/20 bg-card p-4 space-y-3" style={{ background: "linear-gradient(160deg, rgba(5, 38, 72, 0.92), rgba(3, 27, 53, 0.97))" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-holo/70">{KIND[selected.kind].label} · {distance(selected.distanceM)}</span>
                <p className="text-[16px] font-bold mt-0.5">{selected.titleEl}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[12px] text-muted hover:text-chalk"
              >
                ✕
              </button>
            </div>

            {/* Vote stats */}
            <div className="flex gap-2 text-[13px]">
              <span className="rounded-lg bg-yes/15 px-2 py-1 text-yes font-semibold">✓ {selected.yes}</span>
              <span className="rounded-lg bg-no/15 px-2 py-1 text-no font-semibold">✗ {selected.no}</span>
              <span className="rounded-lg bg-maybe/15 px-2 py-1 text-maybe font-semibold">~ {selected.maybe}</span>
              <span className="ml-auto text-muted self-center">{selected.yes + selected.no + selected.maybe} συνολικά</span>
            </div>

            {/* Quick vote buttons */}
            {voted[selected.id] ? (
              <div className="rounded-xl bg-yes/10 border border-yes/30 px-4 py-3 text-center">
                <span className="text-[15px] font-bold text-yes">Ψήφισες: {voted[selected.id] === "yes" ? "✓ Ναι" : voted[selected.id] === "no" ? "✗ Όχι" : "~ Ίσως"}</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickVote(selected, "yes")}
                  className="flex h-[48px] items-center justify-center rounded-xl bg-yes/90 font-display text-[15px] font-bold text-void transition active:scale-[0.97] shadow-[0_0_16px_-4px_#4ade80]"
                >
                  ✓ Ναι
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickVote(selected, "no")}
                  className="flex h-[48px] items-center justify-center rounded-xl bg-no/90 font-display text-[15px] font-bold text-white transition active:scale-[0.97]"
                >
                  ✗ Όχι
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickVote(selected, "maybe")}
                  className="flex h-[48px] items-center justify-center rounded-xl bg-maybe/90 font-display text-[15px] font-bold text-void transition active:scale-[0.97]"
                >
                  ~ Ίσως
                </button>
              </div>
            )}
          </div>
        )}

        {/* Προβλήματα σε ακτίνα 50m */}
        {here && items !== null && (
          <>
            <h1 className="text-[21px] font-bold">
              Προβλήματα κοντά σου{" "}
              <span className="text-[14px] font-normal text-muted">(&lt; {NEARBY_RADIUS}m)</span>
              <button
                type="button"
                onClick={() => {
                  saveMockVotes(!mockVotes);
                  setMockVotes(!mockVotes);
                }}
                className={`ml-2 rounded px-1.5 py-0.5 align-middle text-[12px] font-semibold ${mockVotes ? "bg-maybe/15 text-maybe" : "bg-white/5 text-muted"}`}
              >
                δοκιμαστικές ψήφοι · {mockVotes ? "ON" : "OFF"}
              </button>
            </h1>
            {nearby.length === 0 ? (
              <p className="text-muted text-[15px]">Δεν υπάρχουν αναφορές σε {NEARBY_RADIUS}m.</p>
            ) : (
              <ul className="animate-rise space-y-2">
                {nearby.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(i)}
                      className={`card w-full flex items-center gap-3 px-4 py-3.5 text-left transition active:scale-[0.99] ${
                        selected?.id === i.id ? "ring-2 ring-yes/60" : ""
                      }`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full bg-white" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold uppercase tracking-wider text-muted">
                          Αναφορά · {distance(i.distanceM)}
                        </span>
                        <span className="block truncate text-[16px] font-semibold">{i.titleEl}</span>
                      </span>
                      <VoteBadge votes={i.yes + i.no + i.maybe} max={maxVotes} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* Υπόλοιπα votables */}
        <h2 className="text-[18px] font-bold pt-2">Άλλα κοντά σου</h2>
        {error && <p className="rounded-xl bg-no/10 px-4 py-3 text-[15px] font-medium text-no">{error}</p>}
        {here && items === null && !error && <div className="h-20 animate-pulse rounded-2xl bg-line" />}
        {rest.length === 0 && items !== null && <p className="text-muted">Τίποτα ανοιχτό σε απόσταση 1,5 km.</p>}
        <ul className="animate-rise space-y-2.5">
          {rest.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => handleSelect(i)}
                className={`card w-full flex items-center gap-3 px-4 py-3.5 text-left transition active:scale-[0.99] ${
                  selected?.id === i.id ? "ring-2 ring-holo/50" : ""
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: KIND[i.kind].color }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold uppercase tracking-wider text-muted">
                    {KIND[i.kind].label} · {distance(i.distanceM)}
                  </span>
                  <span className="block truncate text-[16px] font-semibold">{i.titleEl}</span>
                </span>
                <VoteBadge votes={i.yes + i.no + i.maybe} max={maxVotes} />
              </button>
            </li>
          ))}
        </ul>
        <a href={`${base}/r`} className="btn-secondary block text-center">
          Ανέφερε ένα πρόβλημα
        </a>
      </div>
    </Shell>
  );
}
