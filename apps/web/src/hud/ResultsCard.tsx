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
            className="glass rounded-2xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-chalk/60">
                Εκτιμώμενα αποτελέσματα
              </div>
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
              <div className="mt-3 border-t border-chalk/10 pt-2">
                <div className="text-[11px] uppercase tracking-widest text-chalk/50">
                  Παραδοχές
                </div>
                <ul className="mt-1 text-xs text-chalk/70 space-y-0.5 list-disc list-inside">
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
  const color = good ? "text-cool" : range.p50 === 0 ? "text-chalk/70" : "text-hot";
  const sign = range.p50 > 0 ? "+" : "";
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-chalk/80">{label}</div>
        <div className={`text-lg font-semibold ${color}`}>
          {sign}
          {range.p50.toFixed(1)}
          {unit}
        </div>
      </div>
      <div className="range-badge">
        εύρος {range.p10.toFixed(1)}{unit} … {range.p90.toFixed(1)}{unit} (p10–p90)
      </div>
    </div>
  );
}
