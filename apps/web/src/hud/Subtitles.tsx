import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

const MOOD_TONE: Record<string, string> = {
  neutral: "text-holo",
  alert: "text-solar",
  proud: "text-aurora",
};

/** Κινηματογραφικοί υπότιτλοι: όνομα ομιλητή σε χρώμα, λέξη-λέξη, χωρίς κουτί. */
export function Subtitles() {
  const speech = useStore((s) => s.agentSpeech);
  const tone = MOOD_TONE[speech?.mood ?? "neutral"];
  return (
    <div className="pointer-events-none w-full max-w-4xl text-center">
      <AnimatePresence mode="wait">
        {speech && (
          <motion.p
            key={speech.at}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-[28px] font-semibold leading-snug text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.9),0_0_24px_rgba(0,0,0,0.85)]"
          >
            <span className={`hud-title mr-2 text-[30px] ${tone}`}>ATHENA:</span>
            {speech.textEl.split(" ").map((w, i) => (
              <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.045, duration: 0.2 }}>
                {w}{" "}
              </motion.span>
            ))}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
