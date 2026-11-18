import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { dispatchWs } from "@/ws/dispatcher";
import type { Scenario } from "@/types/contracts";

/**
 * Pill κουμπί κάτω αριστερά για να ανοίξει draw mode. Όταν είναι
 * ενεργό, εμφανίζεται ένα panel με counter και «Υπολόγισε».
 * Το commit φτιάχνει τοπικά ένα Scenario και το στέλνει στο store
 * μέσω του ίδιου dispatcher όπως το WS — ώστε η ροή είναι ίδια
 * με το κανονικό live demo.
 */
export function DrawPanel() {
  const drawMode = useStore((s) => s.drawMode);
  const setDrawMode = useStore((s) => s.setDrawMode);
  const points = useStore((s) => s.drawPoints);
  const clear = useStore((s) => s.clearDrawPoints);

  const commit = () => {
    if (points.length === 0) return;
    const scenario: Scenario = {
      id: `s-draw-${Date.now()}`,
      title: `Σχεδιασμένο σενάριο — ${points.length} δέντρα`,
      edits: [
        {
          type: "add_trees",
          geometry: [...points],
          count: points.length,
        },
      ],
      when: new Date().toISOString(),
      origin: "user",
    };
    dispatchWs({ type: "scenario.created", payload: scenario });
    setDrawMode(false);
    clear();
  };

  return (
    <div className="pointer-events-auto fixed left-6 bottom-20 flex flex-col gap-2">
      <button
        onClick={() => setDrawMode(!drawMode)}
        className={`glass rounded-full px-4 py-2 text-sm flex items-center gap-2 transition ${
          drawMode ? "ring-2 ring-athena shadow-glow" : ""
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            drawMode ? "bg-athena animate-breathe" : "bg-chalk/40"
          }`}
        />
        {drawMode ? "Σχεδιάζεις… πάτα στον χάρτη" : "Σχεδίασε σενάριο"}
      </button>

      <AnimatePresence>
        {drawMode && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="glass-strong rounded-xl p-3 text-sm w-72"
          >
            <div className="text-chalk/70 text-xs uppercase tracking-widest">
              Νέο σενάριο
            </div>
            <div className="mt-1 text-lg font-semibold text-athena">
              {points.length} δέντρα
            </div>
            <div className="mt-2 text-xs text-chalk/60">
              Κάνε κλικ στα σημεία που θέλεις δέντρα. Μετά πάτα «Υπολόγισε».
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={clear}
                disabled={points.length === 0}
                className="flex-1 rounded-lg bg-rail px-3 py-1.5 text-xs text-chalk/80 disabled:opacity-40"
              >
                Καθάρισε
              </button>
              <button
                onClick={commit}
                disabled={points.length === 0}
                className="flex-1 rounded-lg bg-athena text-ink font-medium px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Υπολόγισε
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
