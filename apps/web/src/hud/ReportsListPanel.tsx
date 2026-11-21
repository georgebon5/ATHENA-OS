import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { categoryLabel } from "@/layers/ReportsLayer";
import { flyToReport } from "@/agent/athenaAgent";
import type { Report, ReportStatus } from "@/types/contracts";

const SEVERITY_COLOR: Record<number, string> = {
  1: "#2ee6c9", 2: "#9fe68a", 3: "#ffd84d", 4: "#ff9a5a", 5: "#ff4b3e",
};

function deriveStatus(r: Report): ReportStatus {
  if (r.status) return r.status;
  return r.classification ? "classified" : "pending";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "τώρα";
  if (mins < 60) return `${mins}λ`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ω`;
  return `${Math.floor(hours / 24)}η`;
}

export function ReportsListPanel() {
  const show = useStore((s) => s.showReportsList);
  const setShow = useStore((s) => s.setShowReportsList);
  const reports = useStore((s) => s.reports);
  const pickedId = useStore((s) => s.pickedReportId);

  const sorted = Object.values(reports)
    .filter((r) => r.classification)
    .sort((a, b) => {
      const sa = deriveStatus(a);
      const sb = deriveStatus(b);
      // Resolved/rejected sink to bottom
      const aResolved = sa === "resolved" || sa === "rejected" ? 1 : 0;
      const bResolved = sb === "resolved" || sb === "rejected" ? 1 : 0;
      if (aResolved !== bResolved) return aResolved - bResolved;
      // Then sort by severity desc
      return (b.classification!.severity - a.classification!.severity);
    });

  const unresolved = sorted.filter((r) => {
    const st = deriveStatus(r);
    return st !== "resolved" && st !== "rejected";
  }).length;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-auto fixed right-4 top-[118px] z-20 flex w-[280px] flex-col overflow-hidden rounded-2xl glass-strong shadow-glowStrong"
          style={{ maxHeight: "calc(100vh - 180px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-chalk/8 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hot opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-hot" />
              </span>
              <span className="text-[14px] font-bold text-chalk/90">Αιτήματα</span>
              <span className="rounded-md bg-hot/15 px-1.5 py-0.5 text-[10px] font-bold text-hot">
                {unresolved}
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

          {/* List */}
          <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(100vh - 240px)" }}>
            {sorted.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-chalk/30">
                Δεν υπάρχουν ταξινομημένα αιτήματα
              </div>
            )}
            {sorted.map((r, i) => {
              const sev = r.classification!.severity;
              const sevColor = SEVERITY_COLOR[sev] ?? "#79b7e4";
              const status = deriveStatus(r);
              const isActive = r.id === pickedId;
              const isDone = status === "resolved" || status === "rejected";

              return (
                <motion.button
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => flyToReport(r)}
                  className={`group flex w-full items-center gap-3 border-b border-chalk/5 px-4 py-2.5 text-left transition-all hover:bg-chalk/5 ${
                    isActive ? "bg-chalk/8" : ""
                  } ${isDone ? "opacity-40" : ""}`}
                >
                  {/* Rank + severity dot */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-chalk/25">{i + 1}</span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: sevColor,
                        boxShadow: sev >= 4 ? `0 0 6px ${sevColor}60` : "none",
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold text-chalk/85 group-hover:text-chalk">
                        {categoryLabel(r.classification!.category)}
                      </span>
                      {isDone && (
                        <span className="text-[10px] text-cool">✓</span>
                      )}
                    </div>
                    {r.classification!.summaryEl && (
                      <p className="mt-0.5 truncate text-[11px] leading-snug text-chalk/40">
                        {r.classification!.summaryEl}
                      </p>
                    )}
                  </div>

                  {/* Right meta */}
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: `${sevColor}18`, color: sevColor }}
                    >
                      {sev}/5
                    </span>
                    <span className="text-[10px] text-chalk/25">{timeAgo(r.createdAt)}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
