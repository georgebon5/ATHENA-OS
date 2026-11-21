import { useRef, useState } from "react";

/** Slider «πριν / μετά»: σέρνεις με το δάχτυλο ή με τα πλήκτρα (input range για προσβασιμότητα). */
export function BeforeAfter({ before, after }: { before: string; after: string }) {
  const [split, setSplit] = useState(50);
  const [loaded, setLoaded] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setSplit(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <div className="relative">
      <div
        ref={box}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slab shadow-card select-none touch-none ring-1 ring-holo/30"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && move(e.clientX)}
      >
        <img src={after} alt="Μετά: πώς θα μπορούσε να γίνει ο δρόμος" className="absolute inset-0 h-full w-full object-cover" draggable={false} onLoad={() => setLoaded((n) => n + 1)} />
        <img
          src={before}
          alt="Πριν: ο δρόμος σήμερα"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
          draggable={false}
          onLoad={() => setLoaded((n) => n + 1)}
        />
        {loaded < 2 && <div className="absolute inset-0 animate-pulse bg-slab" />}
        <div className="absolute inset-y-0 w-[3px] bg-holo shadow-[0_0_18px_#79b7e4]" style={{ left: `calc(${split}% - 1.5px)` }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full border-2 border-holo bg-void/85 text-holo shadow-glow text-lg font-bold">
            ⇆
          </div>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-void/75 px-3 py-1 text-[13px] font-semibold text-chalk ring-1 ring-holo/30 backdrop-blur">Σήμερα</span>
        <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-holo to-plasma px-3 py-1 text-[13px] font-bold text-void">Πρόταση</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(split)}
        onChange={(e) => setSplit(Number(e.target.value))}
        className="sr-only"
        aria-label="Σύγκριση πριν και μετά"
      />
      <p className="mt-2 text-center text-[13px] text-muted">Σύρε τη γραμμή για να δεις πριν και μετά · η εικόνα «μετά» είναι οπτικοποίηση AI</p>
    </div>
  );
}
