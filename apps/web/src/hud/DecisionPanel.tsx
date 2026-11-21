import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useStore } from "@/store/useStore";

/**
 * DECISION: το DecisionDraft.markdownEl «γράφεται» με typewriter σαν επίσημο έγγραφο,
 * με σφραγίδα «ΣΧΕΔΙΟ» για να μη μοιάζει με οριστική απόφαση. Λήψη ως PDF: snapshot με
 * html2canvas σε A4 (bitmap επίτηδες: το default font του jsPDF δεν έχει ελληνικά).
 */
export function DecisionPanel() {
  const decision = useStore((s) => s.decision);
  const [shown, setShown] = useState("");
  const [exporting, setExporting] = useState(false);
  const [closed, setClosed] = useState(false);
  const docRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setClosed(false);
    if (!decision) return setShown("");
    setShown("");
    const text = decision.markdownEl;
    let i = 0;
    const perChar = Math.max(6, Math.min(24, 4000 / Math.max(1, text.length)));
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, perChar);
    return () => window.clearInterval(id);
  }, [decision]);

  const typing = !!decision && shown.length < decision.markdownEl.length;

  const exportPdf = async () => {
    const node = docRef.current;
    if (!node || !decision) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(node, { backgroundColor: "#041f3b", scale: 2 });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let w = pageW - 20;
      let h = w / ratio;
      if (h > pageH - 20) {
        h = pageH - 20;
        w = h * ratio;
      }
      pdf.addImage(img, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save(`athena-apofasi-${decision.scenarioId}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {decision && !closed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-void/70 backdrop-blur-md"
        >
          <motion.div
            initial={{ y: 30, rotateX: 8, opacity: 0 }}
            animate={{ y: 0, rotateX: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            className="glass-strong holo-corners flex max-h-[88vh] w-[880px] max-w-[92vw] flex-col p-6"
          >
            <div className="flex items-center justify-between">
              <div className="hud-label">σχέδιο απόφασης · δημοτικό συμβούλιο</div>
              <div className="flex gap-2">
                <button onClick={exportPdf} disabled={exporting || typing} className="btn-holo">
                  {exporting ? "ΠΑΡΑΓΕΤΑΙ…" : "ΛΗΨΗ PDF"}
                </button>
                <button onClick={() => setClosed(true)} className="btn-ghost" aria-label="Κλείσιμο">
                  ✕
                </button>
              </div>
            </div>
            <div className="mt-4 overflow-y-auto pr-1">
              <div ref={docRef} className="relative rounded-xl bg-[#041f3b] p-8 shadow-[inset_0_0_0_1px_rgba(121, 183, 228,0.18)]">
                <motion.div
                  initial={{ scale: 2.2, opacity: 0, rotate: -30 }}
                  animate={{ scale: 1, opacity: 1, rotate: -14 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 160, damping: 12 }}
                  className="hud-title absolute right-6 top-6 rounded-md border-[3px] border-flare px-3 py-1 text-[22px] tracking-[0.3em] text-flare shadow-[0_0_24px_rgba(255,75,62,0.5)]"
                >
                  ΣΧΕΔΙΟ
                </motion.div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-holo to-plasma p-[2px]">
                    <div className="grid h-full w-full place-items-center rounded-full bg-[#041f3b] text-[11px] font-bold text-holo">ΔΑ</div>
                  </div>
                  <div className="leading-tight">
                    <div className="hud-label text-[10px] text-chalk/60">Δήμος Αθηναίων</div>
                    <div className="data text-[11px] text-chalk/40">ATHENA OS · {decision.scenarioId}</div>
                  </div>
                </div>
                <div className="mt-6 space-y-1 text-[15px] leading-relaxed text-chalk/90">
                  {shown.split("\n").map((line, i) => (
                    <Line key={i} text={line} />
                  ))}
                  {typing && <span className="inline-block h-5 w-2 bg-holo align-middle animate-blink" />}
                </div>
                {!typing && decision.citations.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
                    <div className="divider" />
                    <div className="hud-label mt-4 text-[10px]">παραπομπές</div>
                    <ol className="mt-2 space-y-1 text-[13px] text-chalk/80">
                      {decision.citations.map((c, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="data text-holo">[{i + 1}]</span>
                          <span className="font-semibold">{c.label}</span>
                          <span className="text-chalk/45">· {c.source}</span>
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Μίνιμαλ markdown: # τίτλος, ## ενότητα, - λίστα, 1. αρίθμηση, **έντονα**, *πλάγια*. */
function Line({ text }: { text: string }) {
  if (text.startsWith("# ")) return <h1 className="hud-title pr-40 text-[24px] leading-tight holo-text">{inline(text.slice(2))}</h1>;
  // «## ΘΕΜΑ» ή σκέτο «ΘΕΜΑ» / «ΑΠΟΦΑΣΙΖΕΙ (ΣΧΕΔΙΟ)» σε κεφαλαία → ενότητα
  const section = text.startsWith("## ") ? text.slice(3) : /^[Α-ΩΆΈΉΊΌΎΏΪΫ\s()]{3,40}$/.test(text.trim()) ? text.trim() : null;
  if (section) return <h2 className="hud-label !mt-5 !text-[12px] !text-holo">{section}</h2>;
  if (/^\s*[-•] /.test(text))
    return (
      <div className="flex gap-2 pl-1">
        <span className="text-holo">▸</span>
        <span>{inline(text.replace(/^\s*[-•] /, ""))}</span>
      </div>
    );
  const num = text.match(/^\s*(\d+)\. (.*)$/);
  if (num)
    return (
      <div className="flex gap-2 pl-1">
        <span className="data text-plasma">{num[1]}.</span>
        <span>{inline(num[2])}</span>
      </div>
    );
  return text.trim() ? <p>{inline(text)}</p> : <div className="h-2" />;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-bold text-chalk">{part.slice(2, -2)}</strong>
    ) : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <em key={i} className="text-chalk/60">{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  );
}
