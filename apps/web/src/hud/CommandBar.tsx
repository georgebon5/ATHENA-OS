import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { triggerText, triggerBeat } from "@/director/directorApi";
import { askAthena } from "@/agent/athenaAgent";
import { useStore } from "@/store/useStore";

const SUGGESTIONS = [
  "Τι θα γίνει αν βάλουμε δέντρα στην Πειραιώς;",
  "Τι θα γίνει αν κλείσουμε μία λωρίδα;",
  "Δείξε μου το θερμικό hotspot",
  "Τι γίνεται το καλοκαίρι;",
  "Δείξε μου το impact για τον Δήμο",
];

/**
 * Persistent command bar κάτω από το AgentOrb.
 * Πάντα ορατό — δεν χρειάζεται director mode.
 * Enter → στέλνει στον agent (POST /command).
 */
export function CommandBar() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggIdx, setSuggIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsConnected = useStore((s) => s.wsConnected);

  // Rotate placeholder suggestion
  useEffect(() => {
    const t = window.setInterval(
      () => setSuggIdx((i) => (i + 1) % SUGGESTIONS.length),
      3500,
    );
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    const q = text.trim();
    if (!q || loading) return;
    setLoading(true);
    setText("");

    // Πρώτα δοκιμάζουμε τον πραγματικό agent (gateway → agent service)
    const ok = await triggerText(q);
    if (ok) {
      // Περιμένουμε 3s — αν ο agent απαντήσει, τέλεια
      const before = useStore.getState().thinking.length + (useStore.getState().agentSpeech ? 1 : 0);
      await new Promise((r) => setTimeout(r, 3000));
      const after = useStore.getState().thinking.length + (useStore.getState().agentSpeech ? 1 : 0);
      if (after !== before) {
        setLoading(false);
        return;
      }
    }

    // Agent δεν απάντησε → LLM fallback (Claude) → keyword fallback
    await askAthena(q);
    setLoading(false);
  };

  return (
    <div className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-6 w-full max-w-xl px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-strong rounded-2xl px-4 py-3 flex items-center gap-3 transition-all duration-200"
        style={focused ? {
          boxShadow: "0 0 0 1px rgba(123,209,255,0.4), 0 0 28px rgba(123,209,255,0.14), 0 12px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(123,209,255,0.08)"
        } : undefined}
      >
        {/* WS indicator */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
            wsConnected ? "bg-cool" : "bg-chalk/30"
          }`}
          title={wsConnected ? "Συνδεδεμένο" : "Αποσυνδεδεμένο"}
        />

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={SUGGESTIONS[suggIdx]}
          className="flex-1 bg-transparent outline-none text-sm text-chalk placeholder:text-chalk/35 min-w-0"
        />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-athena animate-pulse flex-shrink-0"
            >
              σκέφτεται…
            </motion.span>
          ) : (
            <motion.button
              key="send"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => void submit()}
              disabled={!text.trim()}
              className="flex-shrink-0 rounded-xl bg-athena/90 hover:bg-athena text-ink text-xs font-semibold px-3 py-1.5 disabled:opacity-30 transition-all"
            >
              Πες της
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Quick-fire beat buttons για director */}
      <QuickBeats />
    </div>
  );
}

function QuickBeats() {
  const director = useStore((s) => s.director);
  if (!director) return null;
  const beats = ["INTRO", "SENSE", "SIMULATE", "ENGAGE", "DECISION"] as const;
  return (
    <div className="flex gap-2 justify-center mt-2">
      {beats.map((b) => (
        <button
          key={b}
          onClick={() => void triggerBeat(b)}
          className="glass rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-chalk/60 hover:text-athena transition-colors"
        >
          {b}
        </button>
      ))}
    </div>
  );
}
