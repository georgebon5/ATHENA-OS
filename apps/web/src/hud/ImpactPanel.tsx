import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

const SPARKLINE = [12, 18, 15, 22, 28, 25, 31, 34, 29, 38, 42, 36, 45, 41, 48, 52, 47, 55, 58, 53, 61, 65, 59, 68, 72, 67, 75, 79, 82, 85];

function MiniSparkline() {
  const max = Math.max(...SPARKLINE);
  const h = 32;
  const w = 160;
  const step = w / (SPARKLINE.length - 1);
  const points = SPARKLINE.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={points} fill="none" stroke="#2ee6c9" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={(SPARKLINE.length - 1) * step} cy={h - (SPARKLINE[SPARKLINE.length - 1] / max) * h} r="2.5" fill="#2ee6c9" />
    </svg>
  );
}

interface KPI {
  value: string;
  label: string;
  delta: string;
  deltaColor: string;
}

const KPIS: KPI[] = [
  { value: "847", label: "Αιτήματα διαχειρισμένα", delta: "+34%", deltaColor: "#2ee6c9" },
  { value: "18h", label: "Μέσος χρόνος απόκρισης", delta: "ήταν 6.2 ημ.", deltaColor: "#ff9a5a" },
  { value: "2.143", label: "Πολίτες συμμετείχαν", delta: "×8 vs παραδ.", deltaColor: "#2ee6c9" },
  { value: "87%", label: "Έκλεισαν <48h", delta: "SLA: 70%", deltaColor: "#9fe68a" },
];

export function ImpactPanel() {
  const show = useStore((s) => s.showImpactPanel);
  const setShow = useStore((s) => s.setShowImpactPanel);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-auto fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
        >
          <div
            className="glass-strong w-[420px] max-w-[94vw] overflow-hidden rounded-2xl shadow-glowStrong"
            style={{ border: "1px solid rgba(46,230,201,0.15)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-chalk/8 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cool animate-breathe" />
                <span className="text-[13px] font-bold uppercase tracking-wider text-chalk/70">
                  Impact Dashboard
                </span>
              </div>
              <button
                onClick={() => setShow(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[14px] text-chalk/40 transition-colors hover:text-chalk/80"
                aria-label="Κλείσιμο"
              >
                ×
              </button>
            </div>

            {/* Hero metric */}
            <div className="px-5 pt-5 pb-2 text-center">
              <div
                className="text-[42px] font-black tracking-tight text-cool"
                style={{ textShadow: "0 0 30px rgba(46,230,201,0.3)" }}
              >
                €2,1M
              </div>
              <div className="text-[13px] text-chalk/50">
                Εκτιμώμενη εξοικονόμηση / έτος
              </div>
              <div className="mt-3 flex justify-center">
                <MiniSparkline />
              </div>
              <div className="mt-1 text-[10px] text-chalk/25">30 ημέρες τάση</div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-px bg-chalk/5 mx-4 mb-4 mt-2 overflow-hidden rounded-xl">
              {KPIS.map((kpi) => (
                <div key={kpi.label} className="bg-ink/50 px-4 py-3">
                  <div className="text-[22px] font-bold text-chalk/90">{kpi.value}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-chalk/45">{kpi.label}</div>
                  <div
                    className="mt-1 text-[10px] font-semibold"
                    style={{ color: kpi.deltaColor }}
                  >
                    {kpi.delta}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-chalk/5 px-5 py-2.5 text-center text-[10px] text-chalk/25">
              Πηγές: 1555 · ΟΑΣΑ · data.gov.gr
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
