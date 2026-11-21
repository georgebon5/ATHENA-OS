import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { submitScenario, DEMO_PRESETS } from "@/director/scenarioApi";

/**
 * Πάνελ κάτω αριστερά — δύο modes:
 * 1. Preset σενάρια Πειραιώς (δέντρα / bus lane / δροσερό / κλείσιμο)
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
      await submitScenario(`Σχεδιασμένο σενάριο — ${points.length} δέντρα`, [
        { type: "add_trees", geometry: [...points], count: points.length },
      ]);
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
    <div className="pointer-events-auto flex flex-col-reverse items-start gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`glass !rounded-full flex items-center gap-2 px-4 py-2 text-[13px] transition-all ${open ? "shadow-glow" : ""}`}
      >
        <span className="text-holo">◈</span>
        <span className="hud-label !text-chalk/85">σενάρια πειραιώς</span>
        <span className="text-[10px] text-chalk/50">{open ? "▼" : "▲"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="glass-strong holo-corners w-80 p-4"
          >
            <div className="hud-label mb-3 text-[10px]">γρήγορα σενάρια</div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_PRESETS.map((p) => {
                const active = activeScenario?.title === p.titleEl;
                return (
                  <button
                    key={p.id}
                    onClick={() => runPreset(p.id)}
                    disabled={loading !== null}
                    className={`rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition-all disabled:opacity-50 ${
                      active
                        ? "bg-holo/15 text-holo shadow-[inset_0_0_0_1px_rgba(255,95,184,0.6),0_0_18px_-4px_rgba(255,95,184,0.6)]"
                        : "bg-holo/[0.04] text-chalk shadow-[inset_0_0_0_1px_rgba(255,95,184,0.14)] hover:bg-holo/10"
                    }`}
                  >
                    {loading === p.id ? <span className="animate-pulse">…</span> : p.labelEl}
                  </button>
                );
              })}
            </div>

            <div className="divider my-4" />

            {!drawMode ? (
              <button onClick={() => setDrawMode(true)} className="btn-ghost w-full !justify-start">
                ✎ Σχεδίασε δικά σου σημεία
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px] text-holo">
                  <span className="h-2 w-2 rounded-full bg-holo animate-breathe" />
                  <span className="data">{points.length}</span> σημεία · κλικ στον χάρτη
                </div>
                <div className="flex gap-2">
                  <button onClick={clear} disabled={points.length === 0} className="btn-ghost flex-1 text-[12px] disabled:opacity-40">
                    Καθάρισε
                  </button>
                  <button onClick={commitDraw} disabled={points.length === 0 || loading !== null} className="btn-holo flex-1 text-[12px]">
                    {loading === "draw" ? "…" : "ΥΠΟΛΟΓΙΣΕ"}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setDrawMode(false);
                    clear();
                  }}
                  className="mt-1 text-[12px] text-chalk/40 hover:text-chalk/70"
                >
                  ✕ Άκυρο
                </button>
              </div>
            )}

            {activeScenario && !drawMode && (
              <button onClick={clearAll} className="mt-3 w-full text-left text-[12px] text-chalk/40 hover:text-chalk/70">
                ✕ Καθάρισε τρέχον σενάριο
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
