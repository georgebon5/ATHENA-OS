import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

/** Live μετρητής ψήφων πάνω στο 3D, αφού κλείσει το full-screen ENGAGE. */
export function VoteCounter() {
  const tally = useStore((s) => s.voteTally);
  const consultation = useStore((s) => s.consultation);
  const show = !!tally && !!consultation;
  const total = tally ? tally.yes + tally.no + tally.maybe : 0;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  return (
    <AnimatePresence>
      {show && tally && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="glass holo-corners pointer-events-none w-[460px] px-5 py-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-flare opacity-70 animate-pulseRing" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-flare" />
              </span>
              <span className="hud-label">ψηφοφορία live</span>
            </div>
            <span className="data text-[13px] text-chalk/60">
              σύνολο <span className="text-chalk">{total}</span>
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <Tile label="ναι" value={tally.yes} color="text-aurora" />
            <Tile label="ίσως" value={tally.maybe} color="text-solar" />
            <Tile label="όχι" value={tally.no} color="text-flare" />
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-holo/10">
            <div className="h-full bg-aurora transition-all duration-700" style={{ width: `${pct(tally.yes)}%` }} />
            <div className="h-full bg-solar transition-all duration-700" style={{ width: `${pct(tally.maybe)}%` }} />
            <div className="h-full bg-flare transition-all duration-700" style={{ width: `${pct(tally.no)}%` }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <motion.span key={value} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className={`data text-[34px] font-bold leading-none ${color}`}>
        {value}
      </motion.span>
      <span className="hud-label text-[10px] text-chalk/55">{label}</span>
    </div>
  );
}
