import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

/** Η ATHENA «σκέφτεται»: τα βήματα σαν log συστήματος + πρόοδος προσομοίωσης. */
export function ThinkingCard() {
  const thinking = useStore((s) => s.thinking);
  const progress = useStore((s) => s.simProgress);
  const scenario = useStore((s) => s.activeScenario);

  const running = progress !== null && progress < 1;
  const show = thinking.length > 0 || running;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          className="glass holo-corners holo-scan pointer-events-none w-full p-4"
        >
          <span className="scanline" />
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-holo opacity-70 animate-pulseRing" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-holo" />
            </span>
            <div className="hud-label">η athena σκέφτεται</div>
          </div>
          {scenario && <div className="hud-title mt-2 text-[15px] text-chalk">{scenario.title}</div>}
          <ul className="mt-3 space-y-1.5">
            {thinking.map((step, i) => (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: i === thinking.length - 1 ? 1 : 0.6, x: 0 }}
                className="flex gap-2 text-[13px] leading-snug text-chalk"
              >
                <span className="data text-[11px] text-holo/70">{String(i + 1).padStart(2, "0")}</span>
                <span>{step.textEl}</span>
              </motion.li>
            ))}
          </ul>
          {running && (
            <div className="mt-4">
              <div className="flex justify-between">
                <span className="hud-label text-[9px] text-chalk/50">προσομοίωση</span>
                <span className="data text-[11px] text-holo">{Math.round((progress ?? 0) * 100)}%</span>
              </div>
              <div className="range-track mt-1.5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-holo to-plasma shadow-glow"
                  animate={{ width: `${(progress ?? 0) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
