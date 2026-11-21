import { useEffect, useState } from "react";
import { useDirector } from "@/director/useDirector";
import { GATEWAY_URL } from "@/director/directorApi";
import { useStore } from "@/store/useStore";
import type { SystemStatus } from "@/types/contracts";

const KEYS: [string, string][] = [
  ["1–7", "beat"],
  ["F", "fallback"],
  ["T", "εντολή"],
  ["H", "κρύψε φωτό"],
  ["R", "reset"],
];

/**
 * Κονσόλα του director (Ctrl+D ή ?director=1): beat, συνδέσεις, υγεία υπηρεσιών και τα
 * πρόσφατα fallbacks του gateway (system.status), ώστε να ξέρει τι παίζει live και τι cached.
 */
export function DirectorBar() {
  const { director, promptOpen, submitPrompt, closePrompt } = useDirector();
  const beat = useStore((s) => s.beat);
  const ws = useStore((s) => s.wsConnected);
  const latency = useStore((s) => s.wsLatencyMs);
  const status = useStore((s) => s.systemStatus);
  const setStatus = useStore((s) => s.setSystemStatus);
  const [text, setText] = useState("");

  // Η οθόνη δεν παίρνει replay του system.status: το ζητάμε μόλις ανοίξει ο director
  useEffect(() => {
    if (!director) return;
    fetch(`${GATEWAY_URL}/api/director/status`)
      .then((r) => (r.ok ? (r.json() as Promise<SystemStatus>) : null))
      .then((st) => st && setStatus(st))
      .catch(() => undefined);
  }, [director, setStatus]);

  if (!director) return null;

  return (
    <>
      <div className="glass holo-corners pointer-events-auto w-full p-4">
        <div className="flex items-center justify-between">
          <span className="chip !bg-plasma/15 !text-plasma">director</span>
          <span className="hud-title text-[15px] text-holo">{beat}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Svc name="ws" state={ws ? "up" : "down"} extra={ws && latency !== null ? `${Math.round(latency)}ms` : undefined} />
          {status &&
            Object.entries(status.services).map(([k, v]) => <Svc key={k} name={k} state={v} />)}
        </div>
        {status && status.fallbacks.length > 0 && (
          <div className="mt-3">
            <div className="hud-label text-[9px] text-solar/80">fallbacks</div>
            <ul className="data mt-1 max-h-24 space-y-0.5 overflow-y-auto text-[10.5px] leading-snug text-solar/85">
              {status.fallbacks.slice(0, 5).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {KEYS.map(([k, v]) => (
            <span key={k} className="text-[11px] text-chalk/50">
              <kbd className="data mr-1 rounded bg-holo/10 px-1.5 py-0.5 text-[10px] text-holo">{k}</kbd>
              {v}
            </span>
          ))}
        </div>
      </div>

      {promptOpen && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-void/70 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!text.trim()) return;
              await submitPrompt(text.trim());
              setText("");
            }}
            className="glass-strong holo-corners w-[680px] max-w-[90vw] p-6"
          >
            <div className="hud-label">πες στην athena</div>
            <input
              autoFocus
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="π.χ. Τι θα γίνει αν αφαιρέσουμε μία λωρίδα στην Πειραιώς;"
              className="mt-3 w-full rounded-xl bg-void/70 px-4 py-3 text-base text-chalk outline-none shadow-[inset_0_0_0_1px_rgba(255,95,184,0.2)] focus:shadow-[inset_0_0_0_1px_rgba(255,95,184,0.7)]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closePrompt} className="btn-ghost">
                Άκυρο
              </button>
              <button type="submit" className="btn-holo">
                ΣΤΕΙΛΕ
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Svc({ name, state, extra }: { name: string; state: string; extra?: string }) {
  const ok = ["up", "live", "postgres", "mock", "replay"].includes(state);
  const warn = ["mock", "replay", "sqlite"].includes(state);
  const tone = warn ? "text-solar bg-solar" : ok ? "text-aurora bg-aurora" : "text-flare bg-flare";
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-holo/[0.04] px-2 py-1 shadow-[inset_0_0_0_1px_rgba(255,95,184,0.1)]">
      <span className={`h-1.5 w-1.5 rounded-full ${tone.split(" ")[1]}`} />
      <span className="hud-label text-[9px] !text-chalk/60">{name}</span>
      <span className={`data ml-auto text-[10px] ${tone.split(" ")[0]}`}>{extra ?? state}</span>
    </div>
  );
}
