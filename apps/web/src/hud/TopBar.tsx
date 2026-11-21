import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import type { DemoBeat } from "@/types/contracts";
import { LogoMark } from "./Logo";
import { TimeSlider } from "./TimeSlider";

const BEATS: { key: DemoBeat; label: string }[] = [
  { key: "INTRO", label: "Intro" },
  { key: "PITCH", label: "Pitch" },
  { key: "SENSE", label: "Sense" },
  { key: "SIMULATE", label: "Simulate" },
  { key: "ENGAGE", label: "Engage" },
  { key: "DECISION", label: "Decision" },
  { key: "CLOSE", label: "Close" },
];

const clockFmt = new Intl.DateTimeFormat("el-GR", {
  timeZone: "Europe/Athens",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const dateFmt = new Intl.DateTimeFormat("el-GR", {
  timeZone: "Europe/Athens",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Η «κορυφή» του λειτουργικού: ταυτότητα, χρόνος, ζωντανή κατάσταση, πρόοδος του demo. */
export function TopBar() {
  const ws = useStore((s) => s.wsConnected);
  const latency = useStore((s) => s.wsLatencyMs);
  const beat = useStore((s) => s.beat);
  const buses = useStore((s) => s.buses.length);
  const reports = useStore((s) => Object.keys(s.reports).length);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const beatIdx = BEATS.findIndex((b) => b.key === beat);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 px-6 pt-4">
      <div className="flex items-start justify-between gap-6">
        {/* Ταυτότητα */}
        <div className="flex items-center gap-3 animate-flicker">
          <LogoMark size={42} />
          <div className="leading-none">
            <div className="flex items-baseline gap-2">
              <span className="hud-title pr-1 text-[38px] leading-none holo-shimmer [filter:drop-shadow(0_3px_0_rgba(0,0,0,0.6))]">ATHENA</span>
              <span className="hud-title -skew-x-6 rounded-sm bg-holo px-1.5 text-[16px] text-void">OS</span>
            </div>
            <div className="mt-1.5 hud-label text-[10px] text-chalk/55">
              Αθήνα · Πειραιώς 144 · Σεράφειο
            </div>
          </div>
        </div>

        {/* Χρόνος προσομοίωσης */}
        <div className="pointer-events-auto mt-1">
          <TimeSlider />
        </div>

        {/* Ζωντανή κατάσταση */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-4">
            <Stat label="λεωφορεία" value={buses} />
            <Stat label="αναφορές" value={reports} />
            <div className="text-right leading-none">
              <div className="data text-[26px] font-medium text-chalk">{clockFmt.format(now)}</div>
              <div className="mt-1 hud-label text-[10px] text-chalk/50">{dateFmt.format(now)}</div>
            </div>
            <LiveDot ok={ws} latency={latency} />
          </div>
          <BeatTrack idx={beatIdx} />
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right leading-none">
      <div className="data text-[20px] text-holo">{String(value).padStart(2, "0")}</div>
      <div className="mt-1 hud-label text-[9px] text-chalk/45">{label}</div>
    </div>
  );
}

function LiveDot({ ok, latency }: { ok: boolean; latency: number | null }) {
  return (
    <div className={`chip ${ok ? "" : "!text-flare !bg-flare/10"}`} title={ok ? "Συνδεδεμένο" : "Χωρίς σύνδεση"}>
      <span className="relative flex h-2 w-2">
        {ok && <span className="absolute inline-flex h-full w-full rounded-full bg-aurora opacity-70 animate-pulseRing" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${ok ? "bg-aurora" : "bg-flare"}`} />
      </span>
      {ok ? "live" : "offline"}
      {ok && latency !== null && <span className="data normal-case tracking-normal text-chalk/50">{Math.round(latency)}ms</span>}
    </div>
  );
}

function BeatTrack({ idx }: { idx: number }) {
  return (
    <div className="flex items-center gap-1">
      {BEATS.map((b, i) => (
        <div key={b.key} className="flex flex-col items-center gap-1">
          <div
            className={`h-[3px] w-10 rounded-full transition-all duration-500 ${
              i < idx ? "bg-holo/50" : i === idx ? "bg-holo shadow-glow" : "bg-chalk/10"
            }`}
          />
          <span className={`hud-label text-[8px] tracking-[0.18em] ${i === idx ? "text-holo" : "text-chalk/30"}`}>
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
}
