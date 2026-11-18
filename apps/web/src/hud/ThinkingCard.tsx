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
            className="glass rounded-2xl p-4"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-athena animate-breathe" />
              <div className="text-xs uppercase tracking-widest text-chalk/60">
                Η ATHENA σκέφτεται
              </div>
            </div>
            {scenario && (
              <div className="mt-2 text-sm font-medium text-chalk">
                {scenario.title}
              </div>
            )}
            <ul className="mt-3 space-y-1.5">
              {thinking.map((step) => (
                <li key={step.id} className="text-sm text-chalk/85 flex gap-2">
                  <span className="text-athena">›</span>
                  <span>{step.textEl}</span>
                </li>
              ))}
            </ul>
            {progress !== null && progress < 1 && (
              <div className="mt-3 h-1.5 rounded-full bg-rail overflow-hidden">
                <motion.div
                  className="h-full bg-athena"
                  animate={{ width: `${progress * 100}%` }}
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
