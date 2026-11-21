import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import type { SensorMode } from "@/store/useStore";
import type { DemoBeat } from "@/types/contracts";
import { LogoMark } from "./Logo";
import { useFootfall } from "@/opendata/useFootfall";
import { useEnvSensors } from "@/opendata/useEnvSensors";
import type { EnvReading } from "@/opendata/athensEnvClient";

const BEATS: { key: DemoBeat; label: string }[] = [
  { key: "INTRO",    label: "Intro" },
  { key: "PITCH",    label: "Pitch" },
  { key: "SENSE",    label: "Sense" },
  { key: "SIMULATE", label: "Simulate" },
  { key: "ENGAGE",   label: "Engage" },
  { key: "DECISION", label: "Decision" },
  { key: "CLOSE",    label: "Close" },
];

const clockFmt = new Intl.DateTimeFormat("el-GR", {
  timeZone: "Europe/Athens",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const dateFmt = new Intl.DateTimeFormat("el-GR", {
  timeZone: "Europe/Athens",
  weekday: "short", day: "numeric", month: "short",
});

export function TopBar() {
  const ws         = useStore((s) => s.wsConnected);
  const latency    = useStore((s) => s.wsLatencyMs);
  const beat       = useStore((s) => s.beat);
  const sensorMode = useStore((s) => s.sensorMode);
  const setSensorMode = useStore((s) => s.setSensorMode);
  const buses   = useStore((s) => s.buses.length);
  const reports = useStore((s) => Object.keys(s.reports).length);
  useFootfall();
  const { reading: envReading, loading: envLoading } = useEnvSensors();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const beatIdx = BEATS.findIndex((b) => b.key === beat);

  return (
    <>
      {/* ── Λεπτή γραμμή accent πάνω-πάνω ── */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(121,183,228,0.7) 30%, rgba(121,183,228,0.9) 50%, rgba(121,183,228,0.7) 70%, transparent 100%)" }}
      />

      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 px-5 pt-3">
        <div className="flex items-start justify-between gap-6">

          {/* ── Ταυτότητα ── */}
          <div className="flex items-center gap-3 animate-flicker">
            <LogoMark size={42} />
            <div className="leading-none">
              <div className="flex items-baseline gap-2">
                <span className="hud-title pr-1 text-[38px] leading-none holo-shimmer [filter:drop-shadow(0_3px_0_rgba(0,0,0,0.6))]">
                  ATHENA
                </span>
                <span className="hud-title -skew-x-6 rounded-sm bg-holo px-1.5 text-[16px] text-void">
                  OS
                </span>
              </div>
              <div className="mt-1.5 hud-label text-[10px] text-chalk/45">
                Αθήνα · Πειραιώς 144 · Σεράφειο
              </div>
            </div>
          </div>

          {/* ── Δεξιά: stats + beat track ── */}
          <div className="flex flex-col items-end gap-2">

            {/* Glass panel με corner brackets + scan shimmer */}
            <HudFrame>
              <div className="relative overflow-hidden rounded-xl border border-holo/15 bg-[rgba(5,49,93,0.55)] shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(121,183,228,0.1)] backdrop-blur-xl">

                {/* Scan shimmer */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-2/5 animate-scan bg-gradient-to-r from-transparent via-[rgba(121,183,228,0.06)] to-transparent" />

                <div className="relative flex items-stretch">

                  <StatCell label="λεωφορεία" value={String(buses).padStart(2, "0")} />
                  <VRule />
                  <StatCell label="αναφορές" value={String(reports).padStart(2, "0")} />
                  <VRule />
                  <EnvCell reading={envReading} loading={envLoading} />
                  <VRule />

                  {/* Clock — hero element */}
                  <div className="flex flex-col justify-center px-5 py-2.5 text-right leading-none">
                    <div
                      className="data text-[26px] font-semibold tabular-nums text-chalk"
                      style={{ textShadow: "0 0 24px rgba(121,183,228,0.4), 0 2px 0 rgba(0,0,0,0.5)" }}
                    >
                      {clockFmt.format(now)}
                    </div>
                    <div className="mt-1 hud-label text-[8.5px] text-chalk/35">{dateFmt.format(now)}</div>
                  </div>
                  <VRule />

                  {/* Sensor + live */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <SensorBadge mode={sensorMode} onToggle={(m) => setSensorMode(m)} />
                    <LiveDot ok={ws} latency={latency} />
                  </div>
                </div>
              </div>
            </HudFrame>

            {/* Node-based beat timeline */}
            <BeatTrack idx={beatIdx} />
          </div>
        </div>
      </header>
    </>
  );
}

/* ── HUD corner brackets ── */
function HudFrame({ children }: { children: React.ReactNode }) {
  const c = "border-holo/55";
  return (
    <div className="relative p-[3px]">
      <div className={`absolute top-0 left-0 h-3 w-3 border-t-[1.5px] border-l-[1.5px] ${c}`} />
      <div className={`absolute top-0 right-0 h-3 w-3 border-t-[1.5px] border-r-[1.5px] ${c}`} />
      <div className={`absolute bottom-0 left-0 h-3 w-3 border-b-[1.5px] border-l-[1.5px] ${c}`} />
      <div className={`absolute bottom-0 right-0 h-3 w-3 border-b-[1.5px] border-r-[1.5px] ${c}`} />
      {children}
    </div>
  );
}

function VRule() {
  return <div className="w-px self-stretch bg-gradient-to-b from-transparent via-holo/18 to-transparent" />;
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-center px-4 py-2.5 text-right leading-none">
      <div
        className="data text-[22px] font-semibold tabular-nums text-holo"
        style={{ textShadow: "0 0 16px rgba(121,183,228,0.5)" }}
      >
        {value}
      </div>
      <div className="mt-1 hud-label text-[8px] tracking-[0.16em] text-chalk/35">{label}</div>
    </div>
  );
}

function EnvCell({ reading, loading }: { reading: EnvReading | null; loading: boolean }) {
  const aqiColor = (aqi: number) =>
    aqi <= 2 ? "#55e6c1" : aqi <= 5 ? "#79b7e4" : aqi <= 8 ? "#ffcc5c" : "#ff6a4c";

  return (
    <div
      className="flex flex-col justify-center px-4 py-2.5 text-right leading-none"
      title={reading ? `${reading.stationName} · ${reading.timestamp}` : "Αισθητήρες"}
    >
      {loading || !reading ? (
        <>
          <div className="data text-[22px] text-chalk/20 tabular-nums">— °</div>
          <div className="mt-1 hud-label text-[8px] tracking-[0.16em] text-chalk/25">αισθητήρες</div>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-end gap-2">
            <span
              className="data text-[22px] font-semibold tabular-nums text-holo"
              style={{ textShadow: "0 0 16px rgba(121,183,228,0.5)" }}
            >
              {reading.temperature.toFixed(1)}°
            </span>
            <span
              className="data text-[13px] font-bold"
              style={{ color: aqiColor(reading.aqi), textShadow: `0 0 12px ${aqiColor(reading.aqi)}80` }}
            >
              AQI {reading.aqi}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <span className="hud-label text-[8px] tracking-[0.16em] text-chalk/35">αισθητήρες</span>
            {reading.source === "live" && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#55e6c1] opacity-60 animate-pulseRing" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#55e6c1]" />
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LiveDot({ ok, latency }: { ok: boolean; latency: number | null }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors duration-500 ${
        ok
          ? "border-[#55e6c1]/30 bg-[#55e6c1]/8 text-[#55e6c1]"
          : "border-[#ff6a4c]/30 bg-[#ff6a4c]/8 text-[#ff6a4c]"
      }`}
      title={ok ? "Συνδεδεμένο" : "Χωρίς σύνδεση"}
    >
      <span className="relative flex h-1.5 w-1.5">
        {ok && <span className="absolute inline-flex h-full w-full rounded-full bg-[#55e6c1] opacity-70 animate-pulseRing" />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${ok ? "bg-[#55e6c1]" : "bg-[#ff6a4c]"}`} />
      </span>
      <span className="hud-label text-[9px] font-semibold tracking-widest">{ok ? "live" : "offline"}</span>
      {ok && latency !== null && (
        <span className="data text-[9px] normal-case tracking-normal text-chalk/35">{Math.round(latency)}ms</span>
      )}
    </div>
  );
}

function SensorBadge({ mode, onToggle }: { mode: SensorMode; onToggle: (m: SensorMode) => void }) {
  const next: Record<SensorMode, SensorMode> = { normal: "flir", flir: "nvg", nvg: "normal" };
  const cfg: Record<SensorMode, { label: string; border: string; bg: string; text: string; glow: string }> = {
    normal: { label: "VIS",  border: "rgba(121,183,228,0.2)",  bg: "rgba(121,183,228,0.06)", text: "rgba(232,237,242,0.5)", glow: "" },
    flir:   { label: "FLIR", border: "rgba(255,204,92,0.45)",  bg: "rgba(255,204,92,0.12)",  text: "#ffcc5c",               glow: "0 0 12px rgba(255,204,92,0.4)" },
    nvg:    { label: "NVG",  border: "rgba(85,230,193,0.45)",  bg: "rgba(85,230,193,0.12)",  text: "#55e6c1",               glow: "0 0 12px rgba(85,230,193,0.4)" },
  };
  const s = cfg[mode];
  return (
    <button
      className="pointer-events-auto rounded-lg px-2.5 py-1 hud-label text-[9px] font-bold tracking-widest transition-all duration-300"
      style={{ border: `1px solid ${s.border}`, background: s.bg, color: s.text, boxShadow: s.glow }}
      onClick={() => onToggle(next[mode])}
      title="F = FLIR · N = NVG"
    >
      {s.label}
    </button>
  );
}

function BeatTrack({ idx }: { idx: number }) {
  const pct = idx / (BEATS.length - 1);
  return (
    <div className="relative flex items-start px-1 pt-2">
      {/* Full rail */}
      <div className="absolute top-0 left-1 right-1 h-px bg-chalk/8" />
      {/* Fill rail */}
      <div
        className="absolute top-0 left-1 h-px bg-gradient-to-r from-holo/50 to-holo transition-all duration-700 ease-in-out"
        style={{ width: `calc(${pct * 100}% - 2px)` }}
      />

      {BEATS.map((b, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div key={b.key} className="flex flex-col items-center" style={{ width: `${100 / BEATS.length}%` }}>
            {/* Node dot */}
            <div
              className={`h-2 w-2 rounded-full border transition-all duration-500 ${
                active
                  ? "scale-125 border-holo bg-holo"
                  : done
                  ? "border-holo/40 bg-holo/40"
                  : "border-chalk/15 bg-transparent"
              }`}
              style={active ? { boxShadow: "0 0 10px 2px rgba(121,183,228,0.65)" } : undefined}
            />
            {/* Label */}
            <span
              className={`mt-1.5 hud-label text-[7.5px] uppercase tracking-[0.18em] transition-colors duration-500 ${
                active ? "text-holo" : done ? "text-chalk/28" : "text-chalk/14"
              }`}
            >
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
