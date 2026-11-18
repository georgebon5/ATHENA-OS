import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

/**
 * Big live μετρητής ψήφων — φαίνεται μόνο όταν έχει κλείσει
 * το ENGAGE panel και έχουμε γυρίσει στο 3D.
 */
export function VoteCounter() {
  const tally = useStore((s) => s.voteTally);
  const consultation = useStore((s) => s.consultation);
  if (!tally || !consultation) return null;
  const total = tally.yes + tally.no + tally.maybe;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-none fixed left-1/2 top-24 -translate-x-1/2 glass rounded-full px-6 py-3 flex items-center gap-6"
      >
        <div className="text-xs uppercase tracking-widest text-chalk/60">
          Ψήφοι live
        </div>
        <Tile label="Ναι" value={tally.yes} color="text-cool" />
        <Tile label="Ίσως" value={tally.maybe} color="text-warn" />
        <Tile label="Όχι" value={tally.no} color="text-hot" />
        <div className="text-chalk/60 text-sm">· σύνολο {total}</div>
      </motion.div>
    </AnimatePresence>
  );
}

function Tile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-chalk/60">{label}</div>
    </div>
  );
}
