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
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 px-5 pt-4">
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
            <div className="mt-1.5 hud-label text-[10px] text-chalk/50">
              Αθήνα · Πειραιώς 144 · Σεράφειο
            </div>
          </div>
        </div>

        {/* ── Ζωντανή κατάσταση ── */}
        <div className="flex flex-col items-end gap-2">

          {/* Glass stats bar */}
          <div className="flex items-center gap-0 overflow-hidden rounded-2xl border border-chalk/10 bg-void/60 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl">

            <StatCell label="λεωφορεία" value={String(buses).padStart(2, "0")} />
            <Divider />
            <StatCell label="αναφορές"  value={String(reports).padStart(2, "0")} />
            <Divider />
            <EnvCell reading={envReading} loading={envLoading} />
            <Divider />

            {/* Clock */}
            <div className="px-4 py-2 text-right leading-none">
              <div className="data text-[24px] font-medium tabular-nums text-chalk [text-shadow:0_0_18px_rgba(255,255,255,0.18)]">
                {clockFmt.format(now)}
              </div>
              <div className="mt-0.5 hud-label text-[9px] text-chalk/40">{dateFmt.format(now)}</div>
            </div>
            <Divider />

            {/* Sensor badge */}
            <div className="px-3 py-2">
              <SensorBadge mode={sensorMode} onToggle={(m) => setSensorMode(m)} />
            </div>

            {/* Live dot */}
            <div className="pl-0 pr-3 py-2">
              <LiveDot ok={ws} latency={latency} />
            </div>
          </div>

          {/* Beat timeline */}
          <BeatTrack idx={beatIdx} />
        </div>
      </div>
    </header>
  );
}

function Divider() {
  return <div className="h-9 w-px shrink-0 bg-chalk/10" />;
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2 text-right leading-none">
      <div className="data text-[22px] font-medium tabular-nums text-holo">{value}</div>
      <div className="mt-0.5 hud-label text-[8.5px] uppercase tracking-[0.14em] text-chalk/40">{label}</div>
    </div>
  );
}

function EnvCell({ reading, loading }: { reading: EnvReading | null; loading: boolean }) {
  const aqiColor = (aqi: number) =>
    aqi <= 2 ? "text-aurora" : aqi <= 5 ? "text-solar" : aqi <= 8 ? "text-warn" : "text-flare";
  return (
    <div
      className="px-4 py-2 text-right leading-none"
      title={reading ? `${reading.stationName} · ${reading.timestamp}` : "Αισθητήρες ατμόσφαιρας"}
    >
      {loading || !reading ? (
        <>
          <div className="data text-[22px] text-chalk/25">—</div>
          <div className="mt-0.5 hud-label text-[8.5px] uppercase tracking-[0.14em] text-chalk/30">αισθητήρες</div>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-end gap-2">
            <span className="data text-[22px] font-medium text-holo">{reading.temperature.toFixed(1)}°</span>
            <span className={`data text-[14px] font-semibold ${aqiColor(reading.aqi)}`}>AQI {reading.aqi}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1.5">
            <span className="hud-label text-[8.5px] uppercase tracking-[0.14em] text-chalk/40">αισθητήρες</span>
            <span className={`text-[9px] leading-none ${reading.source === "live" ? "text-aurora/70" : "text-chalk/20"}`}>
              {reading.source === "live" ? "●" : "○"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function LiveDot({ ok, latency }: { ok: boolean; latency: number | null }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] transition-colors duration-500 ${
        ok
          ? "border-aurora/30 bg-aurora/8 text-aurora"
          : "border-flare/30 bg-flare/8 text-flare"
      }`}
      title={ok ? "Συνδεδεμένο" : "Χωρίς σύνδεση"}
    >
      <span className="relative flex h-1.5 w-1.5">
        {ok && <span className="absolute inline-flex h-full w-full rounded-full bg-aurora opacity-70 animate-pulseRing" />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${ok ? "bg-aurora" : "bg-flare"}`} />
      </span>
      <span className="hud-label font-medium tracking-wider">{ok ? "live" : "offline"}</span>
      {ok && latency !== null && (
        <span className="data normal-case tracking-normal text-chalk/40">{Math.round(latency)}ms</span>
      )}
    </div>
  );
}

function SensorBadge({ mode, onToggle }: { mode: SensorMode; onToggle: (m: SensorMode) => void }) {
  const next: Record<SensorMode, SensorMode> = { normal: "flir", flir: "nvg", nvg: "normal" };
  const label: Record<SensorMode, string>    = { normal: "VIS",  flir: "FLIR", nvg: "NVG" };
  const styles: Record<SensorMode, string>  = {
    normal: "border-chalk/15 bg-chalk/5 text-chalk/60",
    flir:   "border-warn/40  bg-warn/15  text-warn  shadow-[0_0_10px_rgba(255,216,77,0.35)]",
    nvg:    "border-aurora/40 bg-aurora/15 text-aurora shadow-[0_0_10px_rgba(46,230,201,0.35)]",
  };
  return (
    <button
      className={`pointer-events-auto rounded-lg border px-2.5 py-1 hud-label text-[10px] font-medium tracking-widest transition-all duration-300 ${styles[mode]}`}
      onClick={() => onToggle(next[mode])}
      title="F = FLIR · N = NVG"
    >
      {label[mode]}
    </button>
  );
}

function BeatTrack({ idx }: { idx: number }) {
  return (
    <div className="flex items-center">
      {BEATS.map((b, i) => (
        <div key={b.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1 px-2.5">
            <div
              className={`h-[2px] w-10 rounded-full transition-all duration-700 ${
                i < idx
                  ? "bg-holo/35"
                  : i === idx
                  ? "bg-holo shadow-[0_0_10px_rgba(0,229,255,0.7)]"
                  : "bg-chalk/8"
              }`}
            />
            <span
              className={`hud-label text-[7.5px] uppercase tracking-[0.2em] transition-colors duration-500 ${
                i === idx ? "text-holo" : i < idx ? "text-chalk/28" : "text-chalk/18"
              }`}
            >
              {b.label}
            </span>
          </div>
          {i < BEATS.length - 1 && (
            <div className={`h-px w-1.5 shrink-0 ${i < idx ? "bg-holo/20" : "bg-chalk/8"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
