import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import type { Backtest } from "@/types/contracts";

/**
 * Πάνελ backtesting για ~5s (τον χρόνο τον ελέγχει ο dispatcher):
 * scatter «πρόβλεψη vs μέτρηση» και το metric σε δεδομένα που δεν είχε δει το μοντέλο.
 */
export function BacktestPanel() {
  const model = useStore((s) => s.backtestVisible);
  const backtests = useStore((s) => s.backtests);
  const bt = model ? backtests.find((b) => b.model === model) : null;

  return (
    <AnimatePresence>
      {bt && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          className="glass-strong holo-corners holo-scan pointer-events-none fixed left-1/2 top-1/2 z-20 w-[720px] -translate-x-1/2 -translate-y-1/2 p-6"
        >
          <span className="scanline" />
          <div className="flex items-center justify-between gap-4">
            <div className="hud-label">backtesting · {bt.model === "traffic" ? "κυκλοφορία" : "θερμικό"}</div>
            <span className="chip max-w-[60%] truncate normal-case tracking-normal">{bt.heldOut}</span>
          </div>
          <div className="mt-3 flex items-baseline gap-4">
            <div className="data text-[56px] font-bold leading-none holo-text">{formatMetric(bt)}</div>
            <div className="text-[13px] text-chalk/60">
              σε <span className="data text-chalk">{bt.nSamples}</span> δείγματα
              <br />
              που δεν είχε δει το μοντέλο
            </div>
          </div>
          <Scatter chart={bt.chart} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatMetric(bt: Backtest): string {
  switch (bt.metric) {
    case "MAPE":
      return `MAPE ${bt.value.toFixed(1)}%`;
    case "MAE_C":
      return `MAE ${bt.value.toFixed(2)}°C`;
    case "R2":
      return `R² ${bt.value.toFixed(2)}`;
  }
}

function Scatter({ chart }: { chart: Backtest["chart"] }) {
  if (chart.length === 0) return null;
  const xs = chart.map((p) => p.predicted);
  const ys = chart.map((p) => p.observed);
  const min = Math.min(...xs, ...ys);
  const max = Math.max(...xs, ...ys);
  const span = max - min || 1;
  const W = 640;
  const H = 220;
  const pad = 24;
  const sx = (v: number) => pad + ((v - min) / span) * (W - 2 * pad);
  const sy = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - 2 * pad)} y2={pad + f * (H - 2 * pad)} stroke="#ff5fb814" />
      ))}
      <line x1={sx(min)} y1={sy(min)} x2={sx(max)} y2={sy(max)} stroke="#ffa043" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="5 5" />
      <text x={W - pad} y={pad - 6} textAnchor="end" fontSize={10} fill="#ffa043" fontFamily="JetBrains Mono">
        τέλεια πρόβλεψη
      </text>
      {chart.map((p, i) => (
        <motion.circle
          key={i}
          initial={{ r: 0, opacity: 0 }}
          animate={{ r: 3.5, opacity: 0.85 }}
          transition={{ delay: 0.2 + i * 0.03 }}
          cx={sx(p.predicted)}
          cy={sy(p.observed)}
          fill="#ff5fb8"
          style={{ filter: "drop-shadow(0 0 4px #ff5fb8)" }}
        />
      ))}
      <text x={pad} y={H - 4} fontSize={10} fill="#fff1ea66" fontFamily="JetBrains Mono">
        πρόβλεψη →
      </text>
    </svg>
  );
}
