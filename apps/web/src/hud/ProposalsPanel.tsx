import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Proposal {
  id: string;
  title: string;
  description: string;
  votes: number;
  category: string;
  status: "open" | "approved" | "planned";
}

const PROPOSALS: Proposal[] = [
  { id: "p1", title: "Πεζοδρόμηση Πειραιώς", description: "Μερική πεζοδρόμηση στο τμήμα Σεραφείου–Κεραμεικού με λωρίδα ποδηλάτου και πράσινο.", votes: 342, category: "Κυκλοφορία", status: "open" },
  { id: "p2", title: "Δεντροφύτευση Γκάζι", description: "50+ δέντρα στην πλατεία Γκαζιού και τους γύρω δρόμους για μείωση θερμοκρασίας.", votes: 287, category: "Πράσινο", status: "approved" },
  { id: "p3", title: "Φωτισμός LED Κεραμεικός", description: "Αντικατάσταση φωτισμού με LED χαμηλής κατανάλωσης σε 12 δρόμους της περιοχής.", votes: 215, category: "Φωτισμός", status: "planned" },
  { id: "p4", title: "Ράμπες προσβασιμότητας", description: "Νέες ράμπες σε 8 διαβάσεις πεζών στην Πειραιώς και Κωνσταντινουπόλεως.", votes: 198, category: "Προσβασιμότητα", status: "open" },
  { id: "p5", title: "Σταθμός κοινόχρηστων ποδηλάτων", description: "3 νέοι σταθμοί ποδηλάτων κοντά στο Μετρό Κεραμεικός και Θησείο.", votes: 164, category: "Μεταφορές", status: "open" },
  { id: "p6", title: "Cool pavement Θησείο", description: "Ψυχρά υλικά οδοστρώματος στους πεζόδρομους του Θησείου κατά του καύσωνα.", votes: 143, category: "Θερμικό", status: "open" },
];

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  open: { label: "Ανοιχτή", color: "#79b7e4" },
  approved: { label: "Εγκρίθηκε", color: "#2ee6c9" },
  planned: { label: "Σχεδιάζεται", color: "#ff9a5a" },
};

export function ProposalsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? PROPOSALS.find((p) => p.id === selectedId) : null;

  return (
    <div className="pointer-events-auto fixed bottom-[330px] left-2 z-10">
      {/* Collapsed pill */}
      {!expanded && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setExpanded(true)}
          className="group flex items-center gap-2 rounded-xl px-3 py-2 glass-strong transition-all hover:scale-105 active:scale-95"
          style={{ border: "1px solid rgba(121,183,228,0.15)" }}
        >
          <span className="text-[13px]">📋</span>
          <span className="text-[12px] font-semibold text-chalk/70 group-hover:text-chalk/90">
            Προτάσεις πολιτών
          </span>
          <span className="rounded-md bg-athena/15 px-1.5 py-0.5 text-[10px] font-bold text-athena">
            {PROPOSALS.length}
          </span>
        </motion.button>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[300px] overflow-hidden rounded-2xl glass-strong shadow-glowStrong"
            style={{ border: "1px solid rgba(121,183,228,0.1)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-chalk/8 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px]">📋</span>
                <span className="text-[13px] font-bold text-chalk/90">Προτάσεις πολιτών</span>
              </div>
              <button
                onClick={() => { setExpanded(false); setSelectedId(null); }}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[12px] text-chalk/40 transition-colors hover:text-chalk/80"
              >
                ×
              </button>
            </div>

            {/* Detail view */}
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-4"
                >
                  <button
                    onClick={() => setSelectedId(null)}
                    className="mb-2 text-[11px] text-chalk/40 hover:text-chalk/70 transition-colors"
                  >
                    ← Πίσω
                  </button>
                  <h3 className="text-[14px] font-bold text-chalk/90">{selected.title}</h3>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-chalk/55">{selected.description}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: `${STATUS_CFG[selected.status].color}18`, color: STATUS_CFG[selected.status].color }}
                    >
                      {STATUS_CFG[selected.status].label}
                    </span>
                    <span className="text-[11px] text-chalk/40">{selected.category}</span>
                    <span className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-athena">
                      ▲ {selected.votes}
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="max-h-[260px] overflow-y-auto overscroll-contain"
                >
                  {PROPOSALS.map((p, i) => {
                    const st = STATUS_CFG[p.status];
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className="group flex w-full items-center gap-3 border-b border-chalk/5 px-4 py-2 text-left transition-all hover:bg-chalk/5"
                      >
                        <span className="text-[10px] font-bold text-chalk/20">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-chalk/80 group-hover:text-chalk">
                            {p.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="rounded px-1 py-0.5 text-[9px] font-semibold"
                              style={{ background: `${st.color}15`, color: st.color }}
                            >
                              {st.label}
                            </span>
                            <span className="text-[10px] text-chalk/30">{p.category}</span>
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-[11px] font-bold text-athena/70">
                          ▲ {p.votes}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
