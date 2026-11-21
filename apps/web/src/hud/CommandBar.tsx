import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { triggerText, triggerBeat } from "@/director/directorApi";
import { useStore } from "@/store/useStore";

const SUGGESTIONS = [
  "Τι θα γίνει αν βάλουμε δέντρα στην Πειραιώς;",
  "Τι θα γίνει αν κλείσουμε μία λωρίδα;",
  "Δείξε μου το θερμικό hotspot",
  "Τι γίνεται το καλοκαίρι;",
];

/**
 * Γραμμή εντολών της ATHENA (πάντα ορατή). Enter → gateway /api/agent/prompt → agent.
 */
export function CommandBar() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggIdx, setSuggIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsConnected = useStore((s) => s.wsConnected);

  useEffect(() => {
    const t = window.setInterval(() => setSuggIdx((i) => (i + 1) % SUGGESTIONS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    const q = text.trim();
    if (!q || loading) return;
    setLoading(true);
    setText("");
    try {
      await triggerText(q);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pointer-events-auto w-full max-w-xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-strong holo-corners flex items-center gap-3 px-4 py-3"
      >
        <span className="data text-[15px] text-holo">❯</span>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder={SUGGESTIONS[suggIdx]}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-chalk outline-none placeholder:text-chalk/35"
        />
        {!text && !loading && <span className="data h-5 w-[2px] bg-holo animate-blink" aria-hidden />}
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${wsConnected ? "bg-aurora shadow-[0_0_8px_#2ee6c9]" : "bg-chalk/25"}`}
          title={wsConnected ? "Συνδεδεμένο" : "Αποσυνδεδεμένο"}
        />
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hud-label shrink-0 text-holo animate-pulse">
              επεξεργασία
            </motion.span>
          ) : (
            <motion.button
              key="s"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => void submit()}
              disabled={!text.trim()}
              className="btn-holo shrink-0 !px-3 !py-1.5 text-[12px]"
            >
              ΠΕΣ ΤΗΣ
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      <QuickBeats />
    </div>
  );
}

function QuickBeats() {
  const director = useStore((s) => s.director);
  const beat = useStore((s) => s.beat);
  if (!director) return null;
  const beats = ["INTRO", "SENSE", "SIMULATE", "ENGAGE", "DECISION"] as const;
  return (
    <div className="mt-2 flex justify-center gap-2">
      {beats.map((b) => (
        <button
          key={b}
          onClick={() => void triggerBeat(b)}
          className={`chip transition-colors hover:!text-holo ${beat === b ? "!bg-holo/25 !text-white" : "!text-chalk/55"}`}
        >
          {b}
        </button>
      ))}
    </div>
  );
}
