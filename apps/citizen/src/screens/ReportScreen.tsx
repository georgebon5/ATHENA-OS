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
          <div className="relative">
            <img src={step.url} alt="Η φωτογραφία σου" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-card ring-1 ring-holo/30" />
            <Corners />
          </div>
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
          <div className="relative overflow-hidden rounded-2xl">
            <img src={step.url} alt="" className="aspect-[4/3] w-full object-cover opacity-60" />
            <div className="absolute inset-x-0 top-0 h-1/3 animate-[scanY_1.6s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-holo/30 to-transparent" />
            <Corners />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-[15px] font-semibold">
              <span className="flex items-center gap-2">
                <Spinner className="text-athenaDeep" /> {step.progress < 1 ? "Ανεβαίνει…" : "Μπαίνει στον χάρτη…"}
              </span>
              <span className="tabular-nums text-muted">{Math.round(step.progress * 100)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-gradient-to-r from-holo to-plasma shadow-glow transition-[width] duration-200" style={{ width: `${Math.max(4, step.progress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
      {step.kind === "done" && <Done report={step.report} approximate={step.approximate} heading={heading} onAgain={reset} />}
      {step.kind === "error" && (
        <div className="space-y-4 animate-rise">
          <div className="card p-5 ring-1 ring-no/60">
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
        <Viewfinder />
        <div className="hud-label mt-6 !text-holo">Αναφορά · Sense</div>
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1]">
          Είδες κάτι να φτιάξουμε <span className="holo-text">στον δρόμο;</span>
        </h1>
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
  let tone = "bg-card";
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
      tone = "bg-solar/10 text-solar";
  }
  return (
    <div className="flex flex-wrap gap-2 text-[14px]">
      <span className={`rounded-full px-3 py-1.5 ring-1 ring-holo/25 ${tone}`}>📍 {loc}</span>
      {heading != null && (
        <span className="rounded-full bg-card px-3 py-1.5 font-mono tabular-nums ring-1 ring-holo/25">
          🧭 {compassLabel(heading)} {Math.round(heading)}°
        </span>
      )}
    </div>
  );
}

function Done({ report, approximate, heading, onAgain }: { report: Report; approximate: boolean; heading: number | null; onAgain: () => void }) {
  const [current, setCurrent] = useState(report);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (current.classification) return;
    let stopped = false;
    const started = Date.now();
    const poll = async () => {
      if (stopped) return;
      if (Date.now() - started > 45_000) return setGaveUp(true);
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
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-yes/30" />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-yes text-3xl font-bold text-void shadow-[0_0_40px_rgba(46,230,201,0.7)]">✓</span>
        </div>
        <h1 className="mt-4 text-[26px] font-extrabold leading-tight">Η αναφορά σου μπήκε στην πόλη</h1>
        <p className="mt-1 text-[15px] text-muted">Τώρα φαίνεται στον ζωντανό χάρτη, στη μεγάλη οθόνη.</p>
      </div>
      <div className="animate-rise" style={{ animationDelay: "150ms" }}>
        <MiniMap at={current.location} heading={heading} approximate={approximate} />
      </div>
      <section className="card p-5 animate-rise" style={{ animationDelay: "300ms" }} aria-live="polite">
        {c ? (
          <>
            <div className="text-[13px] font-semibold uppercase tracking-wider text-athenaDeep">Η ATHENA την ταξινόμησε</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xl font-bold">{CATEGORY_EL[c.category]}</span>
              <SeverityMeter level={c.severity} />
            </div>
            <p className="mt-2 text-[15px] leading-relaxed">{c.summaryEl}</p>
            <p className="mt-3 text-[14px] text-muted">
              Προς: <span className="font-semibold text-chalk">{c.department}</span>
            </p>
          </>
        ) : gaveUp ? (
          <p className="text-[15px] text-muted">Η ταξινόμηση αργεί. Η αναφορά σου έχει ήδη καταχωρηθεί στον χάρτη.</p>
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

/** Ηλιοβασίλεμα πάνω από την Ακρόπολη, και ο δρόμος με το πρόβλημα στο «κάδρο» της κάμερας. */
function Viewfinder() {
  const cols = [176, 186, 196, 206, 216, 226, 236];
  return (
    <div className="relative mx-auto mt-2 aspect-[16/10] w-full overflow-hidden rounded-2xl ring-1 ring-holo/30 shadow-[0_20px_60px_-20px_rgba(121, 183, 228,0.6)]" aria-hidden>
      <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#021a33" />
            <stop offset="0.4" stopColor="#0a51a0" />
            <stop offset="0.62" stopColor="#79b7e4" />
            <stop offset="0.8" stopColor="#ffffff" />
            <stop offset="1" stopColor="#79b7e4" />
          </linearGradient>
          <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e5f4ff" />
            <stop offset="0.5" stopColor="#ffffff" />
            <stop offset="1" stopColor="#79b7e4" />
          </linearGradient>
          <mask id="sun-stripes">
            <rect width="320" height="200" fill="#fff" />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x="150" y={74 + i * 9} width="120" height={2 + i * 0.8} fill="#000" />
            ))}
          </mask>
          <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#04213f" />
            <stop offset="1" stopColor="#031b35" />
          </linearGradient>
        </defs>
        <rect width="320" height="132" fill="url(#sky)" />
        {/* ήλιος με «ρίγες» */}
        <circle cx="206" cy="80" r="44" fill="url(#sun)" mask="url(#sun-stripes)" />
        {/* βράχος της Ακρόπολης + Παρθενώνας σε σιλουέτα */}
        <path d="M108 132 C130 104 150 96 166 94 L258 94 C276 98 292 112 312 132 Z" fill="#04213f" />
        <path d="M170 90 H244 V94 H170 Z M168 64 H246 V68 H168 Z M168 64 L207 52 L246 64 Z" fill="#04213f" />
        {cols.map((x) => (
          <rect key={x} x={x - 2} y="68" width="4" height="22" fill="#04213f" />
        ))}
        {/* πόλη στο πρώτο πλάνο */}
        <path d="M0 132 V108 H22 V98 H40 V114 H58 V102 H80 V120 H96 V110 H112 V132 Z M258 132 V116 H272 V104 H290 V118 H304 V100 H320 V132 Z" fill="#041f3b" />
        <path d="M0 132 H320" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.9" />
        {/* δρόμος */}
        <rect y="132" width="320" height="68" fill="url(#road)" />
        <path d="M150 132 L60 200 M170 132 L260 200" stroke="#79b7e4" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 4px #79b7e4)" }} />
        <path d="M160 136 V142 M160 150 V160 M160 170 V186" stroke="#e5f4ff" strokeWidth="2.5" />
        {/* στόχος: λακκούβα */}
        <ellipse cx="186" cy="176" rx="20" ry="6" fill="#ff4b3e" fillOpacity="0.35" stroke="#ff4b3e" />
        <g stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M158 160 h-8 v8 M214 160 h8 v8 M158 192 h-8 v-8 M214 192 h8 v-8" />
        </g>
        <g transform="translate(222 146) skewX(-10)">
          <rect width="86" height="18" rx="3" fill="#ff4b3e" />
          <text x="7" y="13" fill="#031b35" fontSize="11" fontWeight="900" fontFamily="Fira Sans Extra Condensed">ΛΑΚΚΟΥΒΑ · 4/5</text>
        </g>
      </svg>
      <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 font-display text-[12px] font-extrabold italic tracking-wider text-chalk [text-shadow:0_1px_4px_#000]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-no" /> REC · GPS · ΠΥΞΙΔΑ
      </div>
    </div>
  );
}

function Corners() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 75" preserveAspectRatio="none" aria-hidden>
      <g stroke="#79b7e4" strokeWidth="0.8" fill="none" vectorEffect="non-scaling-stroke">
        <path d="M3 9 V3 H9 M91 3 H97 V9 M3 66 V72 H9 M91 72 H97 V66" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

function SeverityMeter({ level }: { level: number }) {
  const colors = ["#2ee6c9", "#a6ff6b", "#ffd84d", "#ff8a5c", "#ff4b3e"];
  return (
    <span className="flex items-center gap-2 rounded-full bg-paper px-3 py-1 ring-1 ring-holo/20">
      <span className="flex gap-0.5">
        {colors.map((c, i) => (
          <span key={c} className="h-3 w-1.5 rounded-sm" style={{ background: i < level ? c : "#1b4d80", boxShadow: i < level ? `0 0 6px ${c}` : undefined }} />
        ))}
      </span>
      <span className="font-mono text-[13px] font-semibold">{level}/5</span>
    </span>
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
