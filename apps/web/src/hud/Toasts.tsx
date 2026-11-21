import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { categoryLabel } from "@/layers/ReportsLayer";

const TTL_MS = 7000;
const SEVERITY = ["#2ee6c9", "#a6ff6b", "#ffd84d", "#ffa043", "#ff4b3e"];

/**
 * Ειδοποίηση σαν του κινητού για κάθε νέα αναφορά πολίτη: φωτογραφία, «μόλις τώρα» και,
 * όταν την ταξινομήσει η ATHENA, κατηγορία + σοβαρότητα. Μόνο για live report.created (όχι replay).
 */
export function Toasts() {
  const reports = useStore((s) => s.reports);
  const live = useStore((s) => s.liveReportIds);
  const [ids, setIds] = useState<string[]>([]);
  const shown = useRef(0);

  useEffect(() => {
    const fresh = live.slice(shown.current);
    shown.current = live.length;
    if (!fresh.length) return;
    setIds((cur) => [...fresh.reverse(), ...cur].slice(0, 3));
    for (const id of fresh) window.setTimeout(() => setIds((cur) => cur.filter((x) => x !== id)), TTL_MS);
  }, [live]);

  return (
    <div className="pointer-events-none flex w-full flex-col gap-2">
      <AnimatePresence>
        {ids.map((id) => {
          const r = reports[id];
          if (!r) return null;
          const c = r.classification;
          return (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, x: -80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -80 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="glass-strong holo-corners flex items-center gap-3 p-3 pl-4"
            >
              <img src={r.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-holo/40" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="hud-label text-[12px] !text-solar">νέα αναφορά</span>
                  <span className="text-[11px] text-chalk/50">μόλις τώρα</span>
                </div>
                {c ? (
                  <>
                    <div className="hud-title truncate text-[22px] leading-tight text-chalk">{categoryLabel(c.category)}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {SEVERITY.map((col, i) => (
                        <span key={col} className="h-2 w-4 -skew-x-12 rounded-[2px]" style={{ background: i < c.severity ? col : "#ffffff1a" }} />
                      ))}
                      <span className="data ml-1 text-[13px] text-chalk/70">{c.severity}/5</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-[14px] text-chalk/80">
                    Η ATHENA αναλύει τη φωτογραφία<span className="animate-pulse">…</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
