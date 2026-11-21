import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import { cameraController } from "@/cesium/cameraShots";

const PRESETS: { label: string; iso: string; icon: string }[] = [
  { icon: "🕐", label: "τώρα", iso: new Date().toISOString() },
  { icon: "🌡️", label: "Ιούλιος 15:00", iso: `${new Date().getFullYear()}-07-15T12:00:00Z` },
  { icon: "🌍", label: "2035", iso: `2035-07-15T12:00:00Z` },
];

/**
 * Δίνει έλεγχο του ηλίου και των σκιών του Cesium μέσω του
 * viewer.clock. Στα preset ο ήλιος «τρέχει» ομαλά σε ~3s.
 */
export function TimeSlider() {
  const when = useStore((s) => s.when);
  const setWhen = useStore((s) => s.setWhen);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const v = cameraController.viewerRef;
    if (!v) return;
    if (!when) return;
    animateSun(v, prevRef.current, when);
    prevRef.current = when;
  }, [when]);

  return (
    <div className="pointer-events-auto fixed left-1/2 top-6 -translate-x-1/2 glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-sm">
      <span className="hud-label mr-1">Χρόνος</span>
      {PRESETS.map((p) => (
        <button
          key={p.iso}
          onClick={() => setWhen(p.iso)}
          className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 transition-all duration-200 ${
            when === p.iso
              ? "bg-athena text-ink font-semibold"
              : "text-chalk/75 hover:text-chalk"
          }`}
          style={when === p.iso ? { boxShadow: "0 0 14px rgba(123,209,255,0.45)" } : undefined}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
}

function animateSun(v: Cesium.Viewer, fromIso: string | null, toIso: string) {
  const from = fromIso ? Cesium.JulianDate.fromIso8601(fromIso) : v.clock.currentTime;
  const to = Cesium.JulianDate.fromIso8601(toIso);
  v.scene.globe.enableLighting = true;
  v.shadows = true;
  v.scene.shadowMap.enabled = true;

  const start = performance.now();
  const duration = 3000;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const current = Cesium.JulianDate.addSeconds(
      from,
      Cesium.JulianDate.secondsDifference(to, from) * t,
      new Cesium.JulianDate(),
    );
    v.clock.currentTime = current;
    v.scene.requestRender();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
