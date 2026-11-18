import { useEffect, useRef, useState } from "react";
import type { LngLat, Report } from "@athena-os/contracts";
import { Shell, Spinner } from "../components/Shell";
import { MiniMap } from "../components/MiniMap";
import { getReport, uploadReport } from "../lib/api";
import { preparePhoto } from "../lib/image";
import { CATEGORY_EL } from "../lib/labels";
import { SERAFIO, compassLabel, requestCompassPermission, watchHeading, watchLocation, type GeoState } from "../lib/sensors";

type Step =
  | { kind: "start" }
  | { kind: "preview"; file: File; url: string }
  | { kind: "uploading"; url: string; progress: number }
  | { kind: "done"; report: Report; approximate: boolean }
  | { kind: "error"; message: string; file?: File; url?: string };

const WAIT_FOR_FIX_MS = 4000;

export function ReportScreen() {
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [heading, setHeading] = useState<number | null>(null);
  const geoRef = useRef<GeoState>(geo);
  const headingRef = useRef<number | null>(null);
  const stops = useRef<(() => void)[]>([]);
  geoRef.current = geo;
  headingRef.current = heading;

  useEffect(() => () => stops.current.forEach((s) => s()), []);

  /** Καλείται μέσα στο tap «Φωτογράφισε»: μόνο τότε ζητάμε τοποθεσία (κανόνας: καμία άδεια πριν από tap). */
  const startSensors = () => {
    if (geoRef.current.status === "idle") stops.current.push(watchLocation(setGeo));
    // Android: η πυξίδα δεν θέλει άδεια· στο iOS ζητάμε άδεια στο «Στείλε» (δεύτερο tap)
    const ctor = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined;
    if (ctor && typeof ctor.requestPermission !== "function" && heading == null) stops.current.push(watchHeading(setHeading));
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setStep({ kind: "preview", file, url: URL.createObjectURL(file) });
  };

  const send = async (file: File, url: string) => {
    setStep({ kind: "uploading", url, progress: 0 });
    // iOS: άδεια πυξίδας μέσα στο tap «Στείλε»
    const ctor = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined;
    if (ctor && typeof ctor.requestPermission === "function" && heading == null) {
      if (await requestCompassPermission()) stops.current.push(watchHeading(setHeading));
    }
    const [photo] = await Promise.all([preparePhoto(file), waitForFix(), waitFor(() => headingRef.current != null, 700)]);
    const g = geoRef.current;
    const fix = g.status === "ok" ? g.fix : null;
    const lngLat: LngLat = fix ? fix.lngLat : SERAFIO;
    try {
      const report = await uploadReport(
        { photo, lng: lngLat[0], lat: lngLat[1], heading: headingRef.current, accuracyM: fix ? fix.accuracyM : null },
        (p) => setStep((s) => (s.kind === "uploading" ? { ...s, progress: p } : s)),
      );
      setStep({ kind: "done", report, approximate: !fix });
      navigator.vibrate?.(60);
    } catch (e) {
      setStep({ kind: "error", message: (e as Error).message, file, url });
    }
  };

  /** Αν η τοποθεσία δεν έχει έρθει ακόμα, περιμένουμε λίγο· μετά πάμε με προεπιλογή. */
  const waitForFix = () => waitFor(() => ["ok", "denied", "unavailable"].includes(geoRef.current.status), WAIT_FOR_FIX_MS);

  const reset = () => {
    if ("url" in step && step.url) URL.revokeObjectURL(step.url);
    setStep({ kind: "start" });
  };

  return (
    <Shell subtitle="Αναφορά προβλήματος">
      {step.kind === "start" && <Start onPick={onFile} onTap={startSensors} />}
      {step.kind === "preview" && (
        <div className="animate-rise space-y-4">
          <img src={step.url} alt="Η φωτογραφία σου" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-card" />
          <SensorChips geo={geo} heading={heading} />
          <button type="button" onClick={() => send(step.file, step.url)} className="btn-primary">
            Στείλε την αναφορά
          </button>
          <PhotoButton onPick={onFile} onTap={startSensors} variant="secondary">
            Ξανά φωτογραφία
          </PhotoButton>
        </div>
      )}
      {step.kind === "uploading" && (
        <div className="space-y-5 animate-rise">
          <img src={step.url} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover opacity-60 shadow-card" />
          <div>
            <div className="mb-2 flex items-center justify-between text-[15px] font-semibold">
              <span className="flex items-center gap-2">
                <Spinner className="text-athenaDeep" /> {step.progress < 1 ? "Ανεβαίνει…" : "Μπαίνει στον χάρτη…"}
              </span>
              <span className="tabular-nums text-muted">{Math.round(step.progress * 100)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-athenaDeep transition-[width] duration-200" style={{ width: `${Math.max(4, step.progress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
      {step.kind === "done" && <Done report={step.report} approximate={step.approximate} heading={heading} onAgain={reset} />}
      {step.kind === "error" && (
        <div className="space-y-4 animate-rise">
          <div className="rounded-2xl border-2 border-no/30 bg-white p-5 shadow-card">
            <h2 className="text-lg font-bold text-no">Η αποστολή δεν ολοκληρώθηκε</h2>
            <p className="mt-1 text-[15px] text-muted">{step.message}</p>
          </div>
          {step.file && step.url && (
            <button type="button" className="btn-primary" onClick={() => send(step.file!, step.url!)}>
              Δοκίμασε ξανά
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={reset}>
            Από την αρχή
          </button>
        </div>
      )}
    </Shell>
  );
}

function waitFor(ready: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => (ready() || Date.now() - t0 > timeoutMs ? resolve() : window.setTimeout(tick, 100));
    tick();
  });
}

function Start({ onPick, onTap }: { onPick: (f: File | undefined) => void; onTap: () => void }) {
  return (
    <div className="space-y-6 animate-rise">
      <div className="pt-4">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Είδες κάτι να φτιάξουμε στον δρόμο;</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">
          Φωτογράφισέ το. Η αναφορά σου μπαίνει αμέσως στον ζωντανό χάρτη της πόλης και η ATHENA τη στέλνει στην αρμόδια υπηρεσία.
        </p>
      </div>
      <PhotoButton onPick={onPick} onTap={onTap} variant="primary">
        <CameraIcon /> Φωτογράφισε
      </PhotoButton>
      <ul className="space-y-2 text-[14px] text-muted">
        <li>📍 Θα ζητήσουμε την τοποθεσία σου μόνο για να μπει η φωτογραφία στο σωστό σημείο.</li>
        <li>🔒 Δεν χρειάζεται λογαριασμός. Δεν κρατάμε όνομα ή στοιχεία του κινητού.</li>
      </ul>
    </div>
  );
}

/** <label> γύρω από input capture: ανοίγει την κάμερα παντού (iOS, Android), χωρίς JS click(). */
function PhotoButton({
  children,
  onPick,
  onTap,
  variant,
}: {
  children: React.ReactNode;
  onPick: (f: File | undefined) => void;
  onTap: () => void;
  variant: "primary" | "secondary";
}) {
  return (
    <label className={variant === "primary" ? "btn-primary btn-hero" : "btn-secondary"} onClick={onTap}>
      {children}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function SensorChips({ geo, heading }: { geo: GeoState; heading: number | null }) {
  let loc: string;
  let tone = "bg-white";
  switch (geo.status) {
    case "ok":
      loc = `Τοποθεσία ±${Math.round(geo.fix.accuracyM)} m`;
      break;
    case "searching":
    case "idle":
      loc = "Αναζήτηση τοποθεσίας…";
      break;
    default:
      loc = "Χωρίς τοποθεσία: θα μπει στο Σεράφειο";
      tone = "bg-amber-50";
  }
  return (
    <div className="flex flex-wrap gap-2 text-[14px]">
      <span className={`rounded-full border border-line px-3 py-1.5 ${tone}`}>📍 {loc}</span>
      {heading != null && (
        <span className="rounded-full border border-line bg-white px-3 py-1.5 tabular-nums">
          🧭 {compassLabel(heading)} {Math.round(heading)}°
        </span>
      )}
    </div>
  );
}

function Done({ report, approximate, heading, onAgain }: { report: Report; approximate: boolean; heading: number | null; onAgain: () => void }) {
  const [current, setCurrent] = useState(report);
  useEffect(() => {
    if (current.classification) return;
    let stopped = false;
    const started = Date.now();
    const poll = async () => {
      if (stopped || Date.now() - started > 45_000) return;
      try {
        const r = await getReport(report.id);
        if (r.classification) return setCurrent(r);
      } catch {
        /* συνεχίζουμε */
      }
      window.setTimeout(poll, 1500);
    };
    const t = window.setTimeout(poll, 1200);
    return () => {
      stopped = true;
      window.clearTimeout(t);
    };
  }, [report.id, current.classification]);

  const c = current.classification;
  return (
    <div className="space-y-5">
      <div className="text-center animate-drop">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-yes text-3xl text-white shadow-card">✓</div>
        <h1 className="mt-4 text-[26px] font-extrabold leading-tight">Η αναφορά σου μπήκε στην πόλη</h1>
        <p className="mt-1 text-[15px] text-muted">Τώρα φαίνεται στον ζωντανό χάρτη, στη μεγάλη οθόνη.</p>
      </div>
      <div className="animate-rise" style={{ animationDelay: "150ms" }}>
        <MiniMap at={current.location} heading={heading} approximate={approximate} />
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-card animate-rise" style={{ animationDelay: "300ms" }} aria-live="polite">
        {c ? (
          <>
            <div className="text-[13px] font-semibold uppercase tracking-wider text-athenaDeep">Η ATHENA την ταξινόμησε</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xl font-bold">{CATEGORY_EL[c.category]}</span>
              <span className="rounded-full bg-paper px-2.5 py-1 text-[13px] font-semibold">Σοβαρότητα {c.severity}/5</span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed">{c.summaryEl}</p>
            <p className="mt-3 text-[14px] text-muted">
              Προς: <span className="font-semibold text-ink">{c.department}</span>
            </p>
          </>
        ) : (
          <div className="flex items-center gap-3 text-[15px]">
            <Spinner className="text-athenaDeep" /> Η ATHENA αναλύει τη φωτογραφία…
          </div>
        )}
      </section>
      <button type="button" className="btn-secondary" onClick={onAgain}>
        Νέα αναφορά
      </button>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
