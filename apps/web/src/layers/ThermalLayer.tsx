import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";

interface Props {
  viewer: Cesium.Viewer | null;
}

const MORPH_MS = 1500;
const CELL_SIZE_M = 25;

/**
 * Θερμικό heatmap ως εκτεταμένα ορθογώνια πλακίδια στο έδαφος.
 * Όταν αλλάζει η σκηνή, κάνει morph από baseC → newC σε ~1.5s.
 */
export function ThermalLayer({ viewer }: Props) {
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const morphStart = useRef<number>(0);

  const simResult = useStore((s) => s.simResult);
  const visible = useStore((s) => s.layers.thermal);

  useEffect(() => {
    if (!viewer) return;
    const ds = new Cesium.CustomDataSource("thermal");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    let raf = 0;
    const tick = () => {
      if (dsRef.current && simResult && visible) {
        const t = Math.min(1, (performance.now() - morphStart.current) / MORPH_MS);
        updateAlpha(dsRef.current, t);
        viewer.scene.requestRender();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      viewer.dataSources.remove(ds, true);
      dsRef.current = null;
    };
  }, [viewer, simResult, visible]);

  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    if (!simResult) return;

    morphStart.current = performance.now();
    const half = (CELL_SIZE_M / 2) * 1e-5 * 1.1;
    for (const cell of simResult.thermal.cells) {
      const [lng, lat] = cell.lngLat;
      ds.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            lng - half,
            lat - half,
            lng + half,
            lat + half,
          ),
          material: Cesium.Color.fromCssColorString(tempColor(cell.baseC)).withAlpha(0.35),
          height: 2,
        },
      });
      // Αποθηκεύουμε target color σε custom property για το morph
      const last = ds.entities.values[ds.entities.values.length - 1];
      (last as unknown as { _targetColor: string })._targetColor = tempColor(cell.newC);
      (last as unknown as { _baseColor: string })._baseColor = tempColor(cell.baseC);
    }
    viewer?.scene.requestRender();
  }, [simResult, viewer]);

  useEffect(() => {
    const ds = dsRef.current;
    if (ds) ds.show = visible;
    viewer?.scene.requestRender();
  }, [visible, viewer]);

  return null;
}

function updateAlpha(ds: Cesium.CustomDataSource, t: number) {
  for (const ent of ds.entities.values) {
    const base = (ent as unknown as { _baseColor?: string })._baseColor;
    const target = (ent as unknown as { _targetColor?: string })._targetColor;
    if (!base || !target || !ent.rectangle) continue;
    const color = lerpColor(base, target, t);
    ent.rectangle.material = new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString(color).withAlpha(0.42),
    );
  }
}

function tempColor(c: number): string {
  // 24°C cool, 36°C hot — κλιμακώνουμε στο γνωστό cividis-ish palette
  const stops: Array<[number, [number, number, number]]> = [
    [24, [40, 100, 150]],
    [28, [80, 180, 170]],
    [32, [255, 200, 90]],
    [36, [255, 90, 60]],
    [40, [200, 40, 100]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (c <= t1) {
      const f = (c - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const bl = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseRgb(a);
  const pb = parseRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function parseRgb(s: string): [number, number, number] {
  const m = s.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}
