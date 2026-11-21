import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";

/**
 * FPS counter που εμφανίζεται μόνο σε dev mode ή όταν ο director
 * είναι ανοιχτός. Σηματοδοτεί με κόκκινο αν πέσει κάτω από 45.
 */
export function FPSOverlay() {
  const [fps, setFps] = useState(0);
  const framesRef = useRef(0);
  const lastRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);
  const director = useStore((s) => s.director);

  useEffect(() => {
    const loop = () => {
      framesRef.current++;
      const now = performance.now();
      if (now - lastRef.current >= 500) {
        setFps(Math.round((framesRef.current * 1000) / (now - lastRef.current)));
        framesRef.current = 0;
        lastRef.current = now;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!director) return null;
  const color = fps >= 55 ? "text-cool" : fps >= 45 ? "text-warn" : "text-hot";

  return (
    <div className="glass pointer-events-none fixed left-1/2 top-[96px] z-20 flex -translate-x-1/2 items-center gap-1 !rounded-md px-2 py-0.5 font-mono text-[11px]">
      <span className={color}>{fps}</span>
      <span className="text-chalk/50">fps</span>
    </div>
  );
}
