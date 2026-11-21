import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { useStore } from "@/store/useStore";

/**
 * ENGAGE: full-screen πάνελ με draggable before/after slider της
 * φωτογραφίας του κριτή και QR για το consultation.publicUrl. Ο
 * live μετρητής ψήφων μπαίνει πάνω δεξιά.
 */
export function EngagePanel() {
  const consultation = useStore((s) => s.consultation);
  const tally = useStore((s) => s.voteTally);
  const [qr, setQr] = useState<string | null>(null);
  const [split, setSplit] = useState(0.5);
  const [dismissed, setDismissed] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDismissed(false);
    if (!consultation) return setQr(null);
    QRCode.toDataURL(consultation.publicUrl, {
      width: 480,
      margin: 2,
      color: { dark: "#06090d", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [consultation]);

  // Αυτόματο fade στο background μετά από ~15s ώστε να φαίνεται το 3D με ψήφους
  useEffect(() => {
    if (!consultation) return;
    const t = window.setTimeout(() => setDismissed(true), 15_000);
    return () => window.clearTimeout(t);
  }, [consultation]);

  const onDrag = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setSplit(r);
  };

  return (
    <AnimatePresence>
      {consultation && !dismissed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-30 bg-ink/80 backdrop-blur flex items-center justify-center"
        >
          <div className="glass-strong rounded-3xl p-6 w-[1100px] max-w-[95vw] grid grid-cols-5 gap-6">
            <div className="col-span-3">
              <div className="text-xs uppercase tracking-widest text-chalk/60">
                Διαβούλευση · ATHENA
              </div>
              <div className="mt-1 text-xl font-semibold">
                {consultation.questionEl}
              </div>
              <div
                ref={barRef}
                onMouseMove={(e) => (e.buttons === 1 ? onDrag(e.clientX) : undefined)}
                onMouseDown={(e) => onDrag(e.clientX)}
                onTouchMove={(e) => onDrag(e.touches[0].clientX)}
                className="relative mt-4 h-[380px] rounded-2xl overflow-hidden border border-chalk/10 select-none cursor-ew-resize"
                style={{ background: "#000" }}
              >
                <img
                  src={consultation.beforeUrl}
                  alt="before"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <img
                  src={consultation.afterUrl}
                  alt="after"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}
                />
                {/* Drag divider */}
                <div
                  className="absolute inset-y-0 flex items-center"
                  style={{ left: `calc(${split * 100}% - 1px)` }}
                >
                  <div
                    className="absolute inset-y-0 w-0.5"
                    style={{
                      background: "#7bd1ff",
                      boxShadow: "0 0 20px #7bd1ff, 0 0 6px #7bd1ff",
                    }}
                  />
                  <div
                    className="relative z-10 flex flex-col items-center justify-center w-7 h-10 rounded-full border border-athena/60 bg-slab"
                    style={{
                      transform: "translateX(-50%)",
                      boxShadow: "0 0 14px rgba(123,209,255,0.45)",
                    }}
                  >
                    <span className="text-athena text-[10px] font-bold leading-none">‹›</span>
                  </div>
                </div>
                <span className="absolute top-3 left-3 chip">πριν</span>
                <span className="absolute top-3 right-3 chip">με ATHENA</span>
              </div>
            </div>
            <div className="col-span-2 flex flex-col items-center justify-center">
              {qr ? (
                <img
                  src={qr}
                  alt="qr"
                  className="w-[320px] h-[320px] rounded-xl border border-chalk/10"
                />
              ) : (
                <div className="w-[320px] h-[320px] rounded-xl bg-rail animate-pulse" />
              )}
              <div className="mt-3 text-sm text-chalk/70 text-center">
                Σαρώστε με το κινητό για να ψηφίσετε
              </div>
              {tally && (
                <div className="mt-4 grid grid-cols-3 gap-3 w-full">
                  <Pill label="Ναι" value={tally.yes} color="cool" />
                  <Pill label="Ίσως" value={tally.maybe} color="warn" />
                  <Pill label="Όχι" value={tally.no} color="hot" />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Pill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "cool" | "warn" | "hot";
}) {
  const tone =
    color === "cool"
      ? "text-cool border-cool/30"
      : color === "warn"
      ? "text-warn border-warn/30"
      : "text-hot border-hot/30";
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${tone}`}>
      <div className="text-xs text-chalk/60">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
