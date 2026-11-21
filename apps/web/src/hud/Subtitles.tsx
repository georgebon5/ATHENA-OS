import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

export function Subtitles() {
  const speech = useStore((s) => s.agentSpeech);
  return (
    <div className="pointer-events-none fixed left-1/2 bottom-28 -translate-x-1/2 max-w-3xl w-full px-6">
      <AnimatePresence mode="wait">
        {speech && (
          <motion.div
            key={speech.at}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="glass-strong rounded-2xl px-6 py-4 text-center"
          >
            <div className="text-xl font-medium leading-snug">{speech.textEl}</div>
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
