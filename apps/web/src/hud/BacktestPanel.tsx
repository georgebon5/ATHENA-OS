import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import type { Backtest } from "@/types/contracts";

/**
 * Πάνελ backtesting που εμφανίζεται για ~5s (τον χρόνο τον ελέγχει
 * ο dispatcher). Δείχνει scatter predicted vs observed και το metric.
 */
export function BacktestPanel() {
  const model = useStore((s) => s.backtestVisible);
  const backtests = useStore((s) => s.backtests);
  const bt = model ? backtests.find((b) => b.model === model) : null;

  return (
    <AnimatePresence>
      {bt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="pointer-events-none fixed left-1/2 bottom-32 -translate-x-1/2 glass-strong rounded-2xl p-5 w-[640px]"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-chalk/60">
              Backtesting · {bt.model === "traffic" ? "κυκλοφορία" : "θερμικό"}
            </div>
            <span className="chip">{bt.heldOut}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-5xl font-semibold text-athena">
              {formatMetric(bt)}
            </div>
            <div className="text-sm text-chalk/60">
              σε {bt.nSamples} δείγματα που δεν είχε δει το μοντέλο
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
  const W = 560;
  const H = 200;
  const padL = 32;
  const padB = 28;
  const padT = 10;
  const padR = 10;
  const sx = (v: number) => padL + ((v - min) / span) * (W - padL - padR);
  const sy = (v: number) => H - padB - ((v - min) / span) * (H - padT - padB);

  // Faint grid lines
  const gridTicks = [0.25, 0.5, 0.75];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full">
      {/* Grid */}
      {gridTicks.map((t) => {
        const v = min + t * span;
        return (
          <g key={t}>
            <line x1={sx(v)} y1={padT} x2={sx(v)} y2={H - padB}
              stroke="rgba(232,237,242,0.06)" strokeWidth={1} />
            <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)}
              stroke="rgba(232,237,242,0.06)" strokeWidth={1} />
          </g>
        );
      })}
      {/* Perfect-prediction line */}
      <line
        x1={sx(min)} y1={sy(min)}
        x2={sx(max)} y2={sy(max)}
        stroke="#7bd1ff55"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {/* Data points */}
      {chart.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.predicted)}
          cy={sy(p.observed)}
          r={3}
          fill="#7bd1ff"
          opacity={0.72}
        />
      ))}
      {/* Axis labels */}
      <text x={W / 2} y={H - 4} textAnchor="middle"
        fill="rgba(232,237,242,0.35)" fontSize={10} fontFamily="Inter,sans-serif">
        Προβλεπόμενο
      </text>
      <text
        x={10} y={H / 2}
        textAnchor="middle"
        fill="rgba(232,237,242,0.35)"
        fontSize={10}
        fontFamily="Inter,sans-serif"
        transform={`rotate(-90, 10, ${H / 2})`}
      >
        Παρατηρούμενο
      </text>
    </svg>
  );
}
