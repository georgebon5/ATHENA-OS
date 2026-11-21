import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import type { DemoBeat } from "@/types/contracts";

const CHAPTERS: Record<DemoBeat, { n: number; sub: string }> = {
  INTRO: { n: 1, sub: "Η πόλη ξυπνά" },
  PITCH: { n: 2, sub: "Το όραμα" },
  SENSE: { n: 3, sub: "Η πόλη βλέπει" },
  SIMULATE: { n: 4, sub: "Τι θα γίνει αν…" },
  ENGAGE: { n: 5, sub: "Η πόλη αποφασίζει" },
  DECISION: { n: 6, sub: "Η απόφαση" },
  CLOSE: { n: 7, sub: "Το επόμενο βήμα" },
};
const SHOW_MS = 2800;

/**
 * Κάρτα τίτλου σε κάθε live director.beat: letterbox μπάρες + μεγάλος πλάγιος τίτλος με το
 * χρώμα του ηλιοβασιλέματος. Όχι στο replay μετά από refresh (beatSignal δεν αλλάζει).
 */
export function BeatBanner() {
  const signal = useStore((s) => s.beatSignal);
  const [shown, setShown] = useState<DemoBeat | null>(null);

  useEffect(() => {
    if (signal === 0) return;
    setShown(useStore.getState().beat);
    const t = window.setTimeout(() => setShown(null), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [signal]);

  const ch = shown ? CHAPTERS[shown] : null;

  return (
    <AnimatePresence>
      {shown && ch && (
        <motion.div key={shown} className="pointer-events-none fixed inset-0 z-[25]" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          {/* letterbox */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[11vh] bg-black"
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 h-[11vh] bg-black"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative text-center">
              <motion.div
                initial={{ opacity: 0, letterSpacing: "0.8em" }}
                animate={{ opacity: 1, letterSpacing: "0.4em" }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="hud-label text-[15px] !text-chalk/80"
              >
                κεφάλαιο {ch.n} / 7
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, x: -60, skewX: -12 }}
                animate={{ opacity: 1, x: 0, skewX: -8 }}
                transition={{ delay: 0.25, type: "spring", stiffness: 140, damping: 16 }}
                className="hud-title mt-1 text-[150px] leading-[0.9] holo-text drop-shadow-[0_8px_40px_rgba(255,95,184,0.45)]"
              >
                {shown}
              </motion.h1>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="mx-auto mt-3 h-[3px] w-[60%] origin-left bg-gradient-to-r from-solar via-plasma to-holo"
              />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="mt-4 font-display text-[34px] font-bold italic text-chalk [text-shadow:0_2px_18px_rgba(0,0,0,0.8)]"
              >
                {ch.sub}
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
