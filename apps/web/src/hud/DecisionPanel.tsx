import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

/**
 * DECISION: γράφεται με typewriter effect το DecisionDraft.markdownEl
 * σαν «επίσημο» έγγραφο. Το στεμπλάρουμε με «ΣΧΕΔΙΟ» για να μη μοιάζει
 * με οριστική απόφαση.
 */
export function DecisionPanel() {
  const decision = useStore((s) => s.decision);
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!decision) return setShown("");
    setShown("");
    const text = decision.markdownEl;
    let i = 0;
    const perChar = Math.max(6, Math.min(24, 4000 / Math.max(1, text.length)));
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, perChar);
    return () => window.clearInterval(id);
  }, [decision]);

  return (
    <AnimatePresence>
      {decision && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-ink/60 backdrop-blur"
        >
          <div className="relative glass-strong rounded-2xl p-8 w-[820px] max-w-[92vw] max-h-[86vh] overflow-y-auto">
            <div className="absolute -right-6 -top-6 rotate-[-18deg] border-4 border-hot/80 text-hot font-bold px-3 py-1 tracking-widest text-xl bg-ink/80 rounded-md">
              ΣΧΕΔΙΟ
            </div>
            <div className="text-[11px] uppercase tracking-widest text-chalk/50">
              Δήμος Αθηναίων · Σχέδιο απόφασης
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-display text-[15px] leading-relaxed text-chalk">
              {shown}
              <span className="inline-block w-2 h-5 align-middle bg-athena animate-pulse" />
            </pre>
            {decision.citations.length > 0 && (
              <div className="mt-6 border-t border-chalk/10 pt-3">
                <div className="text-xs uppercase tracking-widest text-chalk/50">
                  Παραπομπές
                </div>
                <ol className="mt-2 text-sm text-chalk/80 space-y-1 list-decimal list-inside">
                  {decision.citations.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium">{c.label}</span>{" "}
                      <span className="text-chalk/50">· {c.source}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
