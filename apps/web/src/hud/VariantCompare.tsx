import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import type { SimResult } from "@/types/contracts";

/**
 * Split σύγκριση «Η πρότασή σας vs Η πρόταση της ATHENA» —
 * δείχνει τα κύρια νούμερα σε δύο στήλες και την εξήγηση.
 */
export function VariantCompare() {
  const variant = useStore((s) => s.variant);
  return (
    <AnimatePresence>
      {variant && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="pointer-events-none fixed right-6 top-32 w-[440px] glass-strong rounded-2xl p-5"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-chalk/60">
              Σύγκριση παραλλαγών
            </div>
            <span className="chip">ATHENA · πρόταση</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Column title="Η πρότασή σας" sim={variant.base} tone="neutral" />
            <Column title="Πρόταση ATHENA" sim={variant.best} tone="good" />
          </div>
          <div className="mt-4 text-sm text-chalk/85 border-t border-chalk/10 pt-3">
            {variant.reasonEl}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Column({
  title,
  sim,
  tone,
}: {
  title: string;
  sim: SimResult;
  tone: "neutral" | "good";
}) {
  const isGood = tone === "good";
  return (
    <div
      className={`rounded-xl p-3 ${isGood ? "bg-cool/[0.06] border border-cool/20" : "bg-rail/60"}`}
    >
      <div className="flex items-center justify-between">
        <div className="hud-label">{title}</div>
        {isGood && (
          <span className="chip-cool text-[10px] px-1.5 py-0.5">✓ βέλτιστο</span>
        )}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums ${isGood ? "text-cool text-glow-cool" : "text-chalk/80"}`}
      >
        {signed(sim.traffic.corridorTravelTimeDeltaPct.p50)}%
      </div>
      <div className="text-xs text-chalk/55 mb-2">χρόνος άξονα</div>
      <div
        className={`text-xl font-semibold tabular-nums ${isGood ? "text-athena text-glow-athena" : "text-athena/70"}`}
      >
        {signed(sim.thermal.hotspotDeltaC.p50)}°C
      </div>
      <div className="text-xs text-chalk/55">θερμικό hotspot</div>
    </div>
  );
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}
