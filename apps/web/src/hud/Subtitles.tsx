import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { getMostUrgentReport, flyToReport } from "@/agent/athenaAgent";

export function Subtitles() {
  const speech = useStore((s) => s.agentSpeech);
  const showUrgent = useStore((s) => s.showUrgentNav);

  const handleUrgent = () => {
    const report = getMostUrgentReport();
    if (report) {
      flyToReport(report);
      useStore.getState().setShowUrgentNav(false);
    }
  };

  return (
    <div className="pointer-events-none fixed left-1/2 bottom-24 -translate-x-1/2 max-w-xl w-full px-6">
      <AnimatePresence mode="wait">
        {speech && (
          <motion.div
            key={speech.at}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="glass-strong rounded-2xl px-4 py-3 text-center"
          >
            <div className="text-base font-medium leading-snug">{speech.textEl}</div>

            {/* Urgent navigation button */}
            <AnimatePresence>
              {showUrgent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 flex justify-center"
                >
                  <button
                    onClick={handleUrgent}
                    className="pointer-events-auto group flex items-center gap-2 rounded-xl bg-hot/20 px-4 py-2 text-sm font-semibold text-hot transition-all hover:bg-hot/30 hover:scale-105 active:scale-95"
                    style={{ border: "1px solid rgba(255,107,107,0.3)" }}
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hot opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-hot" />
                    </span>
                    Πήγαινε στο πιο επείγον
                    <span className="text-hot/60 transition-transform group-hover:translate-x-0.5">&rarr;</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-2 flex items-center justify-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  speech.mood === "alert" ? "bg-hot" :
                  speech.mood === "proud" ? "bg-cool" :
                  "bg-athena"
                } animate-breathe`}
              />
              <span className="text-[11px] uppercase tracking-widest text-chalk/50">
                ATHENA · {moodLabel(speech.mood)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function moodLabel(mood: string): string {
  switch (mood) {
    case "alert":
      return "προσοχή";
    case "proud":
      return "ικανοποίηση";
    default:
      return "ουδέτερη";
  }
}
