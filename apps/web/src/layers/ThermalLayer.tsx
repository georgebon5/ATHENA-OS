import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";

interface Props {
  viewer: Cesium.Viewer | null;
}

const MORPH_MS = 1500;
const CELL_SIZE_M = 25;
const ALPHA = 0.42;

/**
 * Θερμικό heatmap ως πλακίδια «ντυμένα» πάνω στα 3D tiles (δρόμοι + ταράτσες).
 * Όταν αλλάζει η σκηνή, κάνει morph από baseC → newC σε ~1.5s.
 */
export function ThermalLayer({ viewer }: Props) {
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const morphStart = useRef<number>(0);

  const simResult = useStore((s) => s.simResult);
  const visible = useStore((s) => s.layers.thermal);

  // Create-once effect με tick για το morph.
  useEffect(() => {
    if (!viewer) return;
    const ds = new Cesium.CustomDataSource("thermal");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    let raf = 0;
    const tick = () => {
      if (performance.now() - morphStart.current < MORPH_MS) viewer.scene.requestRender();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      viewer.dataSources.remove(ds, true);
      dsRef.current = null;
    };
  }, [viewer]);

  // Sync: κάθε νέο simResult ενημερώνει τα entities (όχι το data source).
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    if (!simResult) return;

    morphStart.current = performance.now();
    const morphT = () => Math.min(1, (performance.now() - morphStart.current) / MORPH_MS);
    const half = (CELL_SIZE_M / 2) * 1e-5 * 1.1;
    for (const cell of simResult.thermal.cells) {
      const [lng, lat] = cell.lngLat;
      const base = Cesium.Color.fromCssColorString(tempColor(cell.baseC)).withAlpha(ALPHA);
      const target = Cesium.Color.fromCssColorString(tempColor(cell.newC)).withAlpha(ALPHA);
      const color = new Cesium.Color();
      ds.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            lng - half,
            lat - half,
            lng + half,
            lat + half,
          ),
          // Χρώμα μέσω callback: το Cesium αλλάζει μόνο το χρώμα του instance. Πριν μπαινε νέο material
          // σε κάθε frame → η γεωμετρία ξαναχτιζόταν συνέχεια και δεν προλάβαινε ποτέ να φανεί.
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => Cesium.Color.lerp(base, target, morphT(), color), false),
          ),
          // Χωρίς height: ντύνεται πάνω στα 3D tiles, ανεξάρτητα από το ύψος του δρόμου
          classificationType: Cesium.ClassificationType.BOTH,
        },
      });
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

function tempColor(c: number): string {
  // Clamp στο [24, 40] ώστε extreme τιμές να μην πέφτουν εκτός παλέτας.
  const x = Math.max(24, Math.min(40, c));
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
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}
