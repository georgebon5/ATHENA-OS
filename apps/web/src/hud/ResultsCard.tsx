import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import type { Range } from "@/types/contracts";

/**
 * Κάρτα αποτελεσμάτων sim: πάντα δείχνουμε εύρος p10–p90, και οπτικά (μπάρα) και αριθμητικά.
 * Δεν εμφανίζουμε νούμερο χωρίς εύρος (CLAUDE.md §5.6).
 */
export function ResultsCard() {
  const sim = useStore((s) => s.simResult);
  return (
    <AnimatePresence>
      {sim && sim.status === "ok" && (
        <motion.div
          key={sim.scenarioId}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          className="glass holo-corners holo-scan pointer-events-none w-full p-5"
        >
          <span className="scanline" />
          <div className="flex items-center justify-between">
            <div className="hud-label">αποτελέσματα προσομοίωσης</div>
            <span className="chip">εκτίμηση</span>
          </div>

          <Metric label="Χρόνος διαδρομής άξονα" unit="%" range={sim.traffic.corridorTravelTimeDeltaPct} />
          <Metric label="Θερμοκρασία επιφάνειας" unit="°C" range={sim.thermal.hotspotDeltaC} />
          <Metric label="Οχηματοχιλιόμετρα" unit="%" range={sim.traffic.vehicleKmDeltaPct} />
          <Metric label="CO₂" unit="%" range={sim.emissions.co2DeltaPct} />

          {sim.notes.length > 0 && (
            <div className="mt-4">
              <div className="divider" />
              <div className="hud-label mt-3 text-[9px] text-chalk/45">παραδοχές</div>
              <ul className="mt-1.5 space-y-1 text-[11.5px] leading-snug text-chalk/65">
                {sim.notes.slice(0, 3).map((n, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-holo/60">▸</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="data mt-3 text-right text-[10px] text-chalk/35">υπολογισμός {sim.computeMs} ms</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Μείωση = καλό (λιγότερος χρόνος, θερμοκρασία, km, CO₂). */
function Metric({ label, unit, range }: { label: string; unit: string; range: Range }) {
  const zero = range.p10 === 0 && range.p50 === 0 && range.p90 === 0;
  const tone = zero ? "text-chalk/60" : range.p50 < 0 ? "text-aurora" : "text-flare";
  const bar = zero ? "bg-chalk/30" : range.p50 < 0 ? "bg-aurora" : "bg-flare";
  // Κλίμακα συμμετρική γύρω από το 0, ώστε να φαίνεται αν το εύρος περνά το μηδέν
  const span = Math.max(Math.abs(range.p10), Math.abs(range.p90), 0.5) * 1.15;
  const x = (v: number) => 50 + (v / span) * 50;
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[13px] text-chalk/80">{label}</div>
        <div className={`data text-[22px] font-bold ${tone}`}>
          {zero ? "0" : signed(range.p50)}
          <span className="ml-0.5 text-[13px] font-medium opacity-80">{unit}</span>
        </div>
      </div>
      <div className="range-track mt-2">
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-chalk/25" />
        {!zero && (
          <>
            <div
              className={`absolute inset-y-0 rounded-full opacity-40 ${bar}`}
              style={{ left: `${x(range.p10)}%`, width: `${Math.max(x(range.p90) - x(range.p10), 1)}%` }}
            />
            <div
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${bar}`}
              style={{ left: `${x(range.p50)}%`, boxShadow: "0 0 10px currentColor" }}
            />
          </>
        )}
      </div>
      <div className="range-badge mt-1.5 flex justify-between">
        <span>p10 {signed(range.p10)}{unit}</span>
        <span>p90 {signed(range.p90)}{unit}</span>
      </div>
    </div>
  );
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}
