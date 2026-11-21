import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { cameraController } from "@/cesium/cameraShots";
import { DEMO_BBOX, SERAFIO_LNGLAT } from "@/cesium/constants";

const W = 180;
const H = 140;
const PAD = 10;

/**
 * Μικρός χάρτης αναφοράς στην κάτω δεξιά γωνία. Δείχνει το bbox
 * του demo, το Σεράφειο και την τρέχουσα θέση κάμερας. Δεν είναι
 * δεύτερο Cesium viewer (ακριβό) — απλό SVG που διαβάζει την
 * κάμερα σε κάθε frame μέσω postRender listener.
 */
export function Minimap() {
  const [cam, setCam] = useState<{ lng: number; lat: number; heading: number }>(
    {
      lng: SERAFIO_LNGLAT[0],
      lat: SERAFIO_LNGLAT[1],
      heading: 0,
    },
  );
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let raf = 0;
    const bindWhenReady = () => {
      const v = cameraController.viewerRef;
      if (!v || v.isDestroyed()) {
        raf = requestAnimationFrame(bindWhenReady);
        return;
      }
      const listener = () => {
        if (v.isDestroyed()) return;
        const carto = v.camera.positionCartographic;
        setCam({
          lng: Cesium.Math.toDegrees(carto.longitude),
          lat: Cesium.Math.toDegrees(carto.latitude),
          heading: Cesium.Math.toDegrees(v.camera.heading),
        });
      };
      v.scene.postRender.addEventListener(listener);
      cleanupRef.current = () => {
        if (!v.isDestroyed()) v.scene.postRender.removeEventListener(listener);
      };
    };
    bindWhenReady();
    return () => {
      cancelAnimationFrame(raf);
      cleanupRef.current?.();
    };
  }, []);

  const toX = (lng: number) =>
    PAD + ((lng - DEMO_BBOX.west) / (DEMO_BBOX.east - DEMO_BBOX.west)) * (W - 2 * PAD);
  const toY = (lat: number) =>
    H - PAD -
    ((lat - DEMO_BBOX.south) / (DEMO_BBOX.north - DEMO_BBOX.south)) * (H - 2 * PAD);

  const camX = Math.max(PAD, Math.min(W - PAD, toX(cam.lng)));
  const camY = Math.max(PAD, Math.min(H - PAD, toY(cam.lat)));

  return (
    <div className="pointer-events-none fixed right-6 bottom-20 glass rounded-xl p-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <rect
          x={PAD}
          y={PAD}
          width={W - 2 * PAD}
          height={H - 2 * PAD}
          fill="#0b0f14"
          stroke="#7bd1ff33"
          strokeWidth={1}
          rx={6}
        />
        <circle cx={toX(SERAFIO_LNGLAT[0])} cy={toY(SERAFIO_LNGLAT[1])} r={3} fill="#bfe5ff" />
        <text
          x={toX(SERAFIO_LNGLAT[0]) + 6}
          y={toY(SERAFIO_LNGLAT[1]) + 3}
          fontSize={9}
          fill="#bfe5ff99"
        >
          Σεράφειο
        </text>
        {/* Camera position glow */}
        <circle cx={camX} cy={camY} r={10} fill="#7bd1ff" opacity={0.08} />
        <g transform={`translate(${camX}, ${camY}) rotate(${cam.heading})`}>
          <filter id="orbGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <path d="M 0 -8 L 6 6 L 0 2 L -6 6 Z" fill="#7bd1ff" stroke="#06090d" strokeWidth={1} filter="url(#orbGlow)" />
        </g>
      </svg>
      <div className="text-[10px] text-chalk/50 mt-1 px-1 font-mono">
        κάμερα · {cam.lng.toFixed(4)}, {cam.lat.toFixed(4)}
      </div>
    </div>
  );
}
