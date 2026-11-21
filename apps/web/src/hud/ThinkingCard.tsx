import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

export function ThinkingCard() {
  const thinking = useStore((s) => s.thinking);
  const progress = useStore((s) => s.simProgress);
  const scenario = useStore((s) => s.activeScenario);

  const show = thinking.length > 0 || (progress !== null && progress < 1);

  return (
    <div className="pointer-events-none fixed left-6 top-6 w-80">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="glass rounded-2xl p-4 overflow-hidden relative"
          >
            {/* Scan line sweep */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              <div className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-athena/[0.05] to-transparent animate-scan" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2.5 relative">
              <div className="relative flex-shrink-0 w-3 h-3">
                <span className="absolute inset-[-3px] rounded-full bg-athena/40 animate-pulseRing" />
                <span className="relative block w-3 h-3 rounded-full bg-athena" />
              </div>
              <div className="hud-label">Η ATHENA σκέφτεται</div>
            </div>

            {scenario && (
              <div className="mt-2 text-sm font-medium text-chalk leading-snug">
                {scenario.title}
              </div>
            )}

            {/* Thinking steps — staggered */}
            <ul className="mt-3 space-y-1.5">
              {thinking.map((step, i) => (
                <motion.li
                  key={step.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.25 }}
                  className="text-sm text-chalk/85 flex gap-2"
                >
                  <span className="text-athena flex-shrink-0 select-none">›</span>
                  <span>{step.textEl}</span>
                </motion.li>
              ))}
            </ul>

            {/* Progress bar with glow dot */}
            {progress !== null && progress < 1 && (
              <div className="mt-3 relative h-1.5 rounded-full bg-rail overflow-visible">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-athenaDeep to-athena"
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-athena z-10"
                  style={{ boxShadow: "0 0 10px #7bd1ff, 0 0 4px #7bd1ff" }}
                  animate={{ left: `calc(${progress * 100}% - 6px)` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
