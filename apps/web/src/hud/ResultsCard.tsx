import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import type { Range } from "@/types/contracts";

/**
 * Κάρτα αποτελεσμάτων sim: πάντα δείχνουμε εύρος p10–p90.
 * Δεν εμφανίζουμε νούμερο χωρίς εύρος (CLAUDE.md §5.6).
 */
export function ResultsCard() {
  const sim = useStore((s) => s.simResult);
  return (
    <div className="pointer-events-none fixed right-6 top-6 w-96">
      <AnimatePresence>
        {sim && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div className="hud-label">Εκτιμώμενα αποτελέσματα</div>
              <span className="chip">εκτίμηση</span>
            </div>

            <Metric
              label="Χρόνος διαδρομής άξονα"
              unit="%"
              range={sim.traffic.corridorTravelTimeDeltaPct}
              invertGood
            />
            <Metric
              label="Οχηματο-χλμ."
              unit="%"
              range={sim.traffic.vehicleKmDeltaPct}
              invertGood
            />
            <Metric
              label="Θερμικό hotspot"
              unit="°C"
              range={sim.thermal.hotspotDeltaC}
              invertGood
            />
            <Metric
              label="CO₂"
              unit="%"
              range={sim.emissions.co2DeltaPct}
              invertGood
            />

            {sim.notes.length > 0 && (
              <div className="mt-4 border-t border-chalk/10 pt-3">
                <div className="hud-label mb-1">Παραδοχές</div>
                <ul className="text-xs text-chalk/60 space-y-0.5 list-disc list-inside">
                  {sim.notes.slice(0, 3).map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({
  label,
  unit,
  range,
  invertGood,
}: {
  label: string;
  unit: string;
  range: Range;
  invertGood?: boolean;
}) {
  const good = invertGood ? range.p50 < 0 : range.p50 > 0;
  const neutral = range.p50 === 0;
  const color = neutral ? "text-chalk/70" : good ? "text-cool" : "text-hot";
  const glowClass = neutral ? "" : good ? "text-glow-cool" : "text-glow-hot";
  const sign = range.p50 > 0 ? "+" : "";
  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-chalk/75">{label}</div>
        <div className={`text-lg font-semibold tabular-nums ${color} ${glowClass}`}>
          {sign}{range.p50.toFixed(1)}{unit}
        </div>
      </div>
      <RangeBar range={range} unit={unit} good={good} neutral={neutral} />
      <div className="range-badge mt-1">
        εύρος {range.p10.toFixed(1)}{unit} … {range.p90.toFixed(1)}{unit} (p10–p90)
      </div>
    </div>
  );
}

function RangeBar({
  range,
  unit,
  good,
  neutral,
}: {
  range: Range;
  unit: string;
  good: boolean;
  neutral: boolean;
}) {
  const maxScale = unit === "°C" ? 5 : 35;
  // Map value to 0–100% position (50% = zero)
  const toPos = (v: number) =>
    Math.round(50 + Math.max(-1, Math.min(1, v / maxScale)) * 50);

  const p10pos = toPos(range.p10);
  const p50pos = toPos(range.p50);
  const p90pos = toPos(range.p90);
  const bandLeft = Math.min(p10pos, p90pos);
  const bandWidth = Math.max(Math.abs(p90pos - p10pos), 2);

  const hex = neutral ? "#9ca3af" : good ? "#55e6c1" : "#ff6a4c";

  return (
    <div className="relative h-1 bg-rail rounded-full mt-1.5">
      {/* Zero line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-chalk/20"
        style={{ left: "50%" }}
      />
      {/* P10–P90 band */}
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: `${bandLeft}%`,
          width: `${bandWidth}%`,
          backgroundColor: hex,
          opacity: 0.28,
        }}
      />
      {/* P50 marker dot */}
      <div
        className="absolute top-1/2 w-2.5 h-2.5 rounded-full"
        style={{
          left: `${p50pos}%`,
          transform: "translate(-50%, -50%)",
          backgroundColor: hex,
          boxShadow: `0 0 8px ${hex}99`,
        }}
      />
    </div>
  );
}
