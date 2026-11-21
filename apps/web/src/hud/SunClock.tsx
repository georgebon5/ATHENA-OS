import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import { cameraController } from "@/cesium/cameraShots";

/**
 * Χωρίς UI: όταν η ATHENA/ο director στέλνει `time.set`, ο ήλιος και οι
 * σκιές του Cesium «τρέχουν» ομαλά σε ~3s προς τη νέα ώρα.
 * (Το παλιό κουτί «Χρόνος» αφαιρέθηκε για minimal οθόνη.)
 */
export function SunClock() {
  const when = useStore((s) => s.when);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const v = cameraController.viewerRef;
    if (!v) return;
    if (!when) return;
    animateSun(v, prevRef.current, when);
    prevRef.current = when;
  }, [when]);

  return null;
}

function animateSun(v: Cesium.Viewer, fromIso: string | null, toIso: string) {
  const from = fromIso ? Cesium.JulianDate.fromIso8601(fromIso) : v.clock.currentTime;
  const to = Cesium.JulianDate.fromIso8601(toIso);
  v.scene.globe.enableLighting = true;
  // Οι σκιές ανάβουν μόνο όταν αλλάζει η ώρα (π.χ. «καύσωνας Ιουλίου»)· by default κλειστές για FPS
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
