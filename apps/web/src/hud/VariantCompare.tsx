import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import type { Range, SimResult } from "@/types/contracts";

/** «Η πρότασή σας» απέναντι στην «Πρόταση ATHENA», με τα εύρη και την αιτιολόγηση. */
export function VariantCompare() {
  const variant = useStore((s) => s.variant);
  return (
    <AnimatePresence>
      {variant && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="glass-strong holo-corners holo-scan pointer-events-none w-full p-5"
        >
          <span className="scanline" />
          <div className="flex items-center justify-between">
            <div className="hud-label">σύγκριση παραλλαγών</div>
            <span className="chip !text-plasma !bg-plasma/10 !shadow-[inset_0_0_0_1px_rgba(255,160,67,0.4)]">
              ✦ athena
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Column title="Η πρότασή σας" sim={variant.base} />
            <Column title="Πρόταση ATHENA" sim={variant.best} best />
          </div>
          <p className="mt-4 border-l-2 border-plasma/60 pl-3 text-[13px] leading-snug text-chalk/85">
            {variant.reasonEl}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Column({ title, sim, best }: { title: string; sim: SimResult; best?: boolean }) {
  return (
    <div
      className={`rounded-xl p-3 ${
        best ? "bg-gradient-to-b from-plasma/15 to-transparent shadow-[inset_0_0_0_1px_rgba(255,160,67,0.45)]" : "bg-holo/5 shadow-[inset_0_0_0_1px_rgba(255,95,184,0.15)]"
      }`}
    >
      <div className={`hud-label text-[9px] ${best ? "text-plasma" : "text-chalk/55"}`}>{title}</div>
      <Value range={sim.thermal.hotspotDeltaC} unit="°C" label="θερμοκρασία" big />
      <Value range={sim.traffic.corridorTravelTimeDeltaPct} unit="%" label="χρόνος άξονα" />
    </div>
  );
}

function Value({ range, unit, label, big }: { range: Range; unit: string; label: string; big?: boolean }) {
  const tone = range.p50 < 0 ? "text-aurora" : range.p50 > 0 ? "text-flare" : "text-chalk/70";
  return (
    <div className="mt-2">
      <div className={`data font-bold ${tone} ${big ? "text-[28px]" : "text-[18px]"}`}>
        {signed(range.p50)}
        <span className="text-[12px] opacity-80">{unit}</span>
      </div>
      <div className="range-badge">
        {label} · {signed(range.p10)}…{signed(range.p90)}
      </div>
    </div>
  );
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}
