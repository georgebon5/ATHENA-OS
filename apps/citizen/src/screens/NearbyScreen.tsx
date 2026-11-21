import { useEffect, useState } from "react";
import type { LngLat } from "@athena-os/contracts";
import { Shell, Spinner } from "../components/Shell";
import { MiniMap } from "../components/MiniMap";
import { getVotables, type Votable } from "../lib/api";
import { SERAFIO } from "../lib/sensors";

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

/** Αρχική: η θέση μου + ό,τι ψηφίζεται κοντά (διαβουλεύσεις, αναφορές, έργα). Πάτημα → οθόνη ψήφου. */
export function NearbyScreen() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [here, setHere] = useState<Here | null>(null);
  const [items, setItems] = useState<Votable[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => locate(setHere), []);
  useEffect(() => {
    if (!here) return;
    setError(null);
    getVotables(here.at)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [here]);

  return (
    <Shell subtitle="Κοντά σου · ψήφισε για τη γειτονιά σου">
      <div className="space-y-4">
        {here ? (
          <MiniMap
            at={here.at}
            heading={null}
            approximate={here.approximate}
            caption={here.approximate ? "Δεν βρήκαμε τη θέση σου: γύρω από το Σεράφειο" : "Είσαι εδώ"}
            points={(items ?? []).map((i) => ({ lngLat: i.lngLat, color: KIND[i.kind].color }))}
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

        <h1 className="text-[21px] font-bold">Ψηφίζεται κοντά σου</h1>
        {error && <p className="rounded-xl bg-no/10 px-4 py-3 text-[15px] font-medium text-no">{error}</p>}
        {here && items === null && !error && <div className="h-20 animate-pulse rounded-2xl bg-line" />}
        {items?.length === 0 && <p className="text-muted">Τίποτα ανοιχτό σε απόσταση 1,5 km.</p>}
        <ul className="animate-rise space-y-2.5">
          {items?.map((i) => (
            <li key={i.id}>
              <a href={`${base}/v/${i.id}`} className="card flex items-center gap-3 px-4 py-3.5 transition active:scale-[0.99]">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: KIND[i.kind].color }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold uppercase tracking-wider text-muted">
                    {KIND[i.kind].label} · {distance(i.distanceM)}
                  </span>
                  <span className="block truncate text-[16px] font-semibold">{i.titleEl}</span>
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-muted">{i.yes + i.no + i.maybe} ψήφοι</span>
              </a>
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
