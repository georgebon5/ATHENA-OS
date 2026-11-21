import { useEffect, useMemo, useRef, useState } from "react";
import * as Cesium from "cesium";
import { cameraController } from "@/cesium/cameraShots";
import { SERAFIO_LNGLAT } from "@/cesium/constants";
import { useStore } from "@/store/useStore";
import type { LngLat } from "@/types/contracts";

const SIZE = 220;
const R = SIZE / 2;
const M_PER_PX = 6; // ~1.3 km διάμετρος
const M_LAT = 111_320;
const M_LNG = 87_900; // στις 38° Β

// Μέτρα από το Σεράφειο (σταθερό σημείο αναφοράς), σε pixels του minimap
const toPx = ([lng, lat]: LngLat): [number, number] => [
  ((lng - SERAFIO_LNGLAT[0]) * M_LNG) / M_PER_PX,
  (-(lat - SERAFIO_LNGLAT[1]) * M_LAT) / M_PER_PX,
];

/**
 * Κυκλικό minimap σε στυλ open-world: κέντρο η κάμερα, ο χάρτης γυρίζει με την κατεύθυνσή της,
 * με τους πραγματικούς δρόμους (/api/network), αναφορές, λεωφορεία και το Σεράφειο.
 */
export function Minimap() {
  const [cam, setCam] = useState({ lng: SERAFIO_LNGLAT[0], lat: SERAFIO_LNGLAT[1], heading: 0 });
  const reports = useStore((s) => s.reports);
  const buses = useStore((s) => s.buses);
  const ways = useStore((s) => s.networkWays);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let raf = 0;
    const bindWhenReady = () => {
      const v = cameraController.viewerRef;
      if (!v) {
        raf = requestAnimationFrame(bindWhenReady);
        return;
      }
      const listener = () => {
        const carto = v.camera.positionCartographic;
        setCam({
          lng: Cesium.Math.toDegrees(carto.longitude),
          lat: Cesium.Math.toDegrees(carto.latitude),
          heading: Cesium.Math.toDegrees(v.camera.heading),
        });
      };
      v.scene.postRender.addEventListener(listener);
      cleanupRef.current = () => v.scene.postRender.removeEventListener(listener);
    };
    bindWhenReady();
    return () => {
      cancelAnimationFrame(raf);
      cleanupRef.current?.();
    };
  }, []);

  // Οι δρόμοι υπολογίζονται μία φορά· σε κάθε frame αλλάζει μόνο το transform του group
  const roads = useMemo(() => {
    let d = "";
    for (const lines of ways.values())
      for (const line of lines)
        line.forEach((p, i) => {
          const [x, y] = toPx(p);
          d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        });
    return d;
  }, [ways]);

  const [cx, cy] = toPx([cam.lng, cam.lat]);

  return (
    <div className="pointer-events-none relative" style={{ width: SIZE + 16, height: SIZE + 16 }}>
      {/* δαχτυλίδι ηλιοβασιλέματος */}
      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,#ffd84d,#ffa043,#ff5fb8,#b45cff,#ffd84d)] p-[3px] shadow-[0_0_30px_rgba(255,95,184,0.45)]">
        <div className="h-full w-full rounded-full bg-void" />
      </div>
      <svg width={SIZE} height={SIZE} viewBox={`${-R} ${-R} ${SIZE} ${SIZE}`} className="absolute left-2 top-2">
        <defs>
          <clipPath id="mm-clip">
            <circle r={R} />
          </clipPath>
          <radialGradient id="mm-bg">
            <stop offset="0" stopColor="#2a1238" />
            <stop offset="1" stopColor="#0c0614" />
          </radialGradient>
        </defs>
        <g clipPath="url(#mm-clip)">
          <circle r={R} fill="url(#mm-bg)" />
          <g transform={`rotate(${-cam.heading}) translate(${-cx} ${-cy})`}>
            <path d={roads} fill="none" stroke="#ffd3ec" strokeOpacity={0.3} strokeWidth={1.4} strokeLinecap="round" />
            {buses.map((b) => {
              const [x, y] = toPx(b.lngLat);
              return <rect key={b.id} x={x - 3} y={y - 3} width={6} height={6} rx={1.5} fill="#b45cff" />;
            })}
            {Object.values(reports).map((r) => {
              const [x, y] = toPx(r.location);
              return <circle key={r.id} cx={x} cy={y} r={3.2} fill="#ffd84d" stroke="#0c0614" strokeWidth={1} />;
            })}
            {/* Σεράφειο (στο 0,0), το γράμμα μένει όρθιο */}
            <g transform={`rotate(${cam.heading})`}>
              <circle r={9} fill="#ff5fb8" stroke="#fff1ea" strokeWidth={2} />
              <text y={3.5} textAnchor="middle" fontSize={10} fontWeight={900} fill="#0c0614" fontFamily="Fira Sans Extra Condensed">
                Σ
              </text>
            </g>
          </g>
          {/* ο «παίκτης»: η κάμερα, πάντα στο κέντρο και προς τα πάνω */}
          <path d="M0 -10 L7 8 L0 4 L-7 8 Z" fill="#fff1ea" stroke="#0c0614" strokeWidth={1.5} />
        </g>
        {/* Βορράς πάνω στο δαχτυλίδι */}
        <g transform={`rotate(${-cam.heading})`}>
          <text y={-R + 15} textAnchor="middle" fontSize={14} fontWeight={900} fill="#ffd84d" fontFamily="Fira Sans Extra Condensed">
            Β
          </text>
        </g>
      </svg>
    </div>
  );
}
