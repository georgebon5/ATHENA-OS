import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { submitScenario, DEMO_PRESETS } from "@/director/scenarioApi";

/**
 * Panel κάτω αριστερά — δύο modes:
 * 1. Preset buttons: Πειραιώς (δέντρα / bus lane / δροσερό / κλείσιμο)
 * 2. Draw mode: ο χρήστης κλικάρει σημεία για custom add_trees
 */
export function DrawPanel() {
  const drawMode = useStore((s) => s.drawMode);
  const setDrawMode = useStore((s) => s.setDrawMode);
  const points = useStore((s) => s.drawPoints);
  const clear = useStore((s) => s.clearDrawPoints);
  const activeScenario = useStore((s) => s.activeScenario);
  const setActiveScenario = useStore((s) => s.setActiveScenario);
  const [loading, setLoading] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const runPreset = async (presetId: string) => {
    const preset = DEMO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setLoading(presetId);
    try {
      await submitScenario(preset.titleEl, preset.edits(), preset.when);
    } finally {
      setLoading(null);
    }
  };

  const commitDraw = async () => {
    if (points.length === 0) return;
    setLoading("draw");
    try {
      await submitScenario(
        `Σχεδιασμένο σενάριο — ${points.length} δέντρα`,
        [{ type: "add_trees", geometry: [...points], count: points.length }],
      );
    } finally {
      setLoading(null);
    }
    setDrawMode(false);
    clear();
  };

  const clearAll = () => {
    setActiveScenario(null);
    clear();
    setDrawMode(false);
  };

  return (
    <div className="pointer-events-auto fixed left-6 bottom-6 flex flex-col gap-2 items-start">
      {/* Trigger pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`glass rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-all ${
          open ? "ring-2 ring-athena" : ""
        }`}
      >
        <span className="text-base">🗺</span>
        <span>Σενάρια Πειραιώς</span>
        <span className="text-chalk/50 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="glass-strong rounded-2xl p-4 w-72"
          >
            <div className="text-[11px] uppercase tracking-widest text-chalk/50 mb-3">
              Γρήγορα σενάρια demo
            </div>

            {/* Preset buttons */}
            <div className="grid grid-cols-2 gap-2">
              {DEMO_PRESETS.map((p) => {
                const isActive = activeScenario?.title === p.titleEl;
                const accentMap: Record<string, string> = {
                  trees: "hover:border-cool/40 hover:bg-cool/[0.08]",
                  bus_lane: "hover:border-warn/40 hover:bg-warn/[0.08]",
                  cool: "hover:border-athena/40 hover:bg-athena/[0.08]",
                  close: "hover:border-hot/40 hover:bg-hot/[0.08]",
                };
                const activeMap: Record<string, string> = {
                  trees: "bg-cool/10 ring-1 ring-cool/50 text-cool",
                  bus_lane: "bg-warn/10 ring-1 ring-warn/50 text-warn",
                  cool: "bg-athena/10 ring-1 ring-athena/50 text-athena",
                  close: "bg-hot/10 ring-1 ring-hot/50 text-hot",
                };
                return (
                  <button
                    key={p.id}
                    onClick={() => runPreset(p.id)}
                    disabled={loading !== null}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-all border border-chalk/[0.06]
                      ${isActive
                        ? activeMap[p.id] ?? "bg-athena/20 ring-1 ring-athena text-athena"
                        : `bg-rail text-chalk ${accentMap[p.id] ?? ""}`
                      } disabled:opacity-50`}
                  >
                    {loading === p.id ? (
                      <span className="animate-pulse">…</span>
                    ) : (
                      p.labelEl
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-chalk/10 my-3" />

            {/* Draw mode */}
            {!drawMode ? (
              <button
                onClick={() => setDrawMode(true)}
                className="w-full rounded-xl bg-rail hover:bg-rail/70 px-3 py-2 text-sm text-chalk/80 text-left"
              >
                ✏️ Σχεδίασε custom σημεία
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-athena">
                  <span className="w-2 h-2 rounded-full bg-athena animate-breathe" />
                  {points.length} σημεία — κλικ στον χάρτη
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clear}
                    disabled={points.length === 0}
                    className="flex-1 rounded-lg bg-rail px-3 py-1.5 text-xs text-chalk/80 disabled:opacity-40"
                  >
                    Καθάρισε
                  </button>
                  <button
                    onClick={commitDraw}
                    disabled={points.length === 0 || loading !== null}
                    className="flex-1 rounded-lg bg-athena text-ink font-medium px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    {loading === "draw" ? "…" : "Υπολόγισε"}
                  </button>
                </div>
                <button
                  onClick={() => { setDrawMode(false); clear(); }}
                  className="text-xs text-chalk/40 hover:text-chalk/70 mt-1"
                >
                  ✕ Άκυρο
                </button>
              </div>
            )}

            {/* Clear active scenario */}
            {activeScenario && !drawMode && (
              <button
                onClick={clearAll}
                className="mt-3 text-xs text-chalk/40 hover:text-chalk/70 w-full text-left"
              >
                ✕ Καθάρισε τρέχον σενάριο
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
