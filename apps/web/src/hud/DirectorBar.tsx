import { useState } from "react";
import { useDirector } from "@/director/useDirector";
import { useStore } from "@/store/useStore";

const BEATS = ["INTRO", "PITCH", "SENSE", "SIMULATE", "ENGAGE", "DECISION", "CLOSE"] as const;

/**
 * Status bar του director — ορατή μόνο όταν director mode είναι on.
 * Δείχνει beat, συνδέσεις WS και FPS. Επίσης text prompt input (T).
 */
export function DirectorBar() {
  const { director, promptOpen, submitPrompt, closePrompt } = useDirector();
  const beat = useStore((s) => s.beat);
  const ws = useStore((s) => s.wsConnected);
  const latency = useStore((s) => s.wsLatencyMs);
  const [text, setText] = useState("");

  if (!director) return null;

  return (
    <>
      <div className="fixed left-6 bottom-6 glass rounded-xl px-4 py-2 text-xs flex items-center gap-4 pointer-events-auto">
        <span className="chip">DIRECTOR</span>
        <div className="flex items-center gap-1">
          <span
            className={`w-2 h-2 rounded-full ${ws ? "bg-cool" : "bg-hot"}`}
          />
          <span>WS {ws ? "ok" : "off"}</span>
          {ws && latency !== null && (
            <span className="text-chalk/60">· {Math.round(latency)}ms</span>
          )}
        </div>
        <div>
          beat: <span className="text-athena font-medium">{beat}</span>
        </div>
        <div className="text-chalk/60">1–7 beat · F fallback · T prompt · R reset</div>
      </div>

      {promptOpen && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!text.trim()) return;
              await submitPrompt(text.trim());
              setText("");
            }}
            className="glass-strong rounded-2xl p-5 w-[640px] max-w-[90vw]"
          >
            <div className="text-xs uppercase tracking-widest text-chalk/60">
              Πες στην ATHENA
            </div>
            <input
              autoFocus
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="π.χ. Τι θα γίνει αν αφαιρέσουμε μία λωρίδα στην Πειραιώς;"
              className="mt-3 w-full bg-ink/70 border border-chalk/10 rounded-xl px-4 py-3 text-base outline-none focus:border-athena/60"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePrompt}
                className="px-3 py-1.5 text-sm rounded-lg bg-rail text-chalk/80"
              >
                Άκυρο
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm rounded-lg bg-athena text-ink font-medium"
              >
                Στείλε
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
