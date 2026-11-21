import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { useStore } from "@/store/useStore";

/**
 * ENGAGE: full-screen πάνελ με draggable before/after slider της φωτογραφίας του κριτή,
 * μεγάλο QR για το consultation.publicUrl και live μετρητή.
 */
export function EngagePanel() {
  const consultation = useStore((s) => s.consultation);
  const tally = useStore((s) => s.voteTally);
  // Μόλις έρθει η απόφαση, το ENGAGE υποχωρεί (και μετά από refresh, όπου ο gateway ξαναστέλνει και τα δύο)
  const decided = useStore((s) => s.decision !== null);
  const [qr, setQr] = useState<string | null>(null);
  const [split, setSplit] = useState(0.5);
  const [dismissed, setDismissed] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDismissed(false);
    setSplit(0.5);
    if (!consultation) return setQr(null);
    QRCode.toDataURL(consultation.publicUrl, {
      width: 560,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0c0614", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [consultation]);

  // Αυτόματο fade στο background μετά από ~15s ώστε να φαίνεται το 3D με τις ψήφους
  useEffect(() => {
    if (!consultation) return;
    const t = window.setTimeout(() => setDismissed(true), 15_000);
    return () => window.clearTimeout(t);
  }, [consultation]);

  const onDrag = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSplit(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  const total = tally ? tally.yes + tally.no + tally.maybe : 0;

  return (
    <AnimatePresence>
      {consultation && !dismissed && !decided && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-void/75 backdrop-blur-md"
          onClick={() => setDismissed(true)}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong holo-corners holo-scan grid w-[1180px] max-w-[95vw] grid-cols-5 gap-8 p-8"
          >
            <span className="scanline" />
            <div className="col-span-3">
              <div className="hud-label">ανοιχτή διαβούλευση · δήμος αθηναίων</div>
              <h2 className="hud-title mt-2 text-[28px] leading-tight text-chalk">{consultation.questionEl}</h2>
              <div
                ref={barRef}
                onMouseMove={(e) => (e.buttons === 1 ? onDrag(e.clientX) : undefined)}
                onMouseDown={(e) => onDrag(e.clientX)}
                onTouchMove={(e) => onDrag(e.touches[0].clientX)}
                className="relative mt-5 h-[420px] cursor-ew-resize select-none overflow-hidden rounded-2xl bg-void shadow-[inset_0_0_0_1px_rgba(255,95,184,0.25)]"
              >
                <img src={consultation.beforeUrl} alt="πριν" className="absolute inset-0 h-full w-full object-cover" />
                <img
                  src={consultation.afterUrl}
                  alt="μετά"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}
                />
                <div
                  className="absolute inset-y-0 w-[2px] bg-holo"
                  style={{ left: `calc(${split * 100}% - 1px)`, boxShadow: "0 0 24px #ff5fb8, 0 0 60px #ff5fb8" }}
                >
                  <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-holo bg-void/80 text-holo shadow-glow">
                    ⇆
                  </div>
                </div>
                <span className="chip absolute left-4 top-4 !bg-void/70">σήμερα</span>
                <span className="chip absolute right-4 top-4 !bg-plasma/30 !text-white">με την athena</span>
              </div>
            </div>

            <div className="col-span-2 flex flex-col items-center justify-center">
              <div className="relative p-3">
                {/* Ολογραφικό πλαίσιο QR */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-holo via-plasma to-holo opacity-80 blur-[2px]" />
                <div className="relative rounded-xl bg-white p-3">
                  {qr ? (
                    <img src={qr} alt="QR ψηφοφορίας" className="h-[300px] w-[300px]" />
                  ) : (
                    <div className="h-[300px] w-[300px] animate-pulse bg-chalk/20" />
                  )}
                </div>
              </div>
              <div className="hud-title mt-5 text-[22px] holo-text">Σκάναρε & ψήφισε</div>
              <div className="data mt-1 max-w-full truncate text-[12px] text-chalk/45">{consultation.publicUrl}</div>
              {tally && (
                <div className="mt-6 grid w-full grid-cols-3 gap-3">
                  <Pill label="ναι" value={tally.yes} total={total} color="aurora" />
                  <Pill label="ίσως" value={tally.maybe} total={total} color="solar" />
                  <Pill label="όχι" value={tally.no} total={total} color="flare" />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const TONES = {
  aurora: "text-aurora shadow-[inset_0_0_0_1px_rgba(46,230,201,0.35)] bg-aurora/5",
  solar: "text-solar shadow-[inset_0_0_0_1px_rgba(255,216,77,0.35)] bg-solar/5",
  flare: "text-flare shadow-[inset_0_0_0_1px_rgba(255,75,62,0.35)] bg-flare/5",
};

function Pill({ label, value, total, color }: { label: string; value: number; total: number; color: keyof typeof TONES }) {
  return (
    <div className={`rounded-xl px-3 py-3 text-center ${TONES[color]}`}>
      <div className="hud-label text-[10px] text-chalk/60">{label}</div>
      <motion.div key={value} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="data text-[34px] font-bold leading-tight">
        {value}
      </motion.div>
      <div className="data text-[11px] opacity-70">{total ? Math.round((value / total) * 100) : 0}%</div>
    </div>
  );
}
