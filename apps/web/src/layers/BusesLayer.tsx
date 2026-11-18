import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import type { Bus } from "@/types/contracts";

interface Props {
  viewer: Cesium.Viewer | null;
}

/**
 * Σχεδιάζει τα λεωφορεία της ΟΑΣΑ ως 3D markers. Κάθε νέο update
 * γίνεται smooth interpolation από την προηγούμενη θέση σε
 * ~10 δευτερόλεπτα (όσο κι ο ρυθμός ανανέωσης από τον gateway).
 */
export function BusesLayer({ viewer }: Props) {
  const entitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const prevRef = useRef<Map<string, Bus>>(new Map());
  const targetRef = useRef<Map<string, Bus>>(new Map());
  const prevTimeRef = useRef<number>(performance.now());
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);

  const buses = useStore((s) => s.buses);
  const visible = useStore((s) => s.layers.buses);

  // Mount: φτιάχνουμε το data source ΜΙΑ φορά ανά viewer, μαζί με τον tick.
  useEffect(() => {
    if (!viewer) return;
    const ds = new Cesium.CustomDataSource("buses");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(1, (now - prevTimeRef.current) / 10_000);
      for (const [id, start] of prevRef.current.entries()) {
        const target = targetRef.current.get(id);
        const entity = entitiesRef.current.get(id);
        if (!entity || !target) continue;
        const lng = start.lngLat[0] + (target.lngLat[0] - start.lngLat[0]) * dt;
        const lat = start.lngLat[1] + (target.lngLat[1] - start.lngLat[1]) * dt;
        const bearing = start.bearing + shortestAngle(start.bearing, target.bearing) * dt;
        entity.position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(lng, lat, 2),
        );
        entity.orientation = new Cesium.ConstantProperty(
          Cesium.Transforms.headingPitchRollQuaternion(
            Cesium.Cartesian3.fromDegrees(lng, lat, 2),
            new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(bearing), 0, 0),
          ),
        );
      }
      viewer.scene.requestRender();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      viewer.dataSources.remove(ds, true);
      entitiesRef.current.clear();
      prevRef.current.clear();
      targetRef.current.clear();
      dsRef.current = null;
    };
  }, [viewer]);

  // Sync: κάθε νέο buses update ενημερώνει τα entities χωρίς να
  // ξαναδημιουργεί το data source.
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;

    // Το tick ξεκινά από τις ΤΡΕΧΟΥΣΕΣ θέσεις των entities και στοχεύει στις νέες.
    const freshPrev = new Map<string, Bus>();
    for (const [id, old] of prevRef.current.entries()) {
      const target = targetRef.current.get(id);
      const t = Math.min(1, (performance.now() - prevTimeRef.current) / 10_000);
      if (target) {
        freshPrev.set(id, {
          id,
          line: old.line,
          lngLat: [
            old.lngLat[0] + (target.lngLat[0] - old.lngLat[0]) * t,
            old.lngLat[1] + (target.lngLat[1] - old.lngLat[1]) * t,
          ],
          bearing: old.bearing + shortestAngle(old.bearing, target.bearing) * t,
        });
      } else {
        freshPrev.set(id, old);
      }
    }
    prevRef.current = freshPrev;
    targetRef.current = new Map(buses.map((b) => [b.id, b]));
    prevTimeRef.current = performance.now();

    const seen = new Set<string>();
    for (const b of buses) {
      seen.add(b.id);
      let ent = entitiesRef.current.get(b.id);
      if (!ent) {
        ent = ds.entities.add({
          id: `bus-${b.id}`,
          position: Cesium.Cartesian3.fromDegrees(b.lngLat[0], b.lngLat[1], 2),
          box: {
            dimensions: new Cesium.Cartesian3(12, 3.5, 3),
            material: Cesium.Color.fromCssColorString("#7bd1ff").withAlpha(0.95),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#bfe5ff"),
          },
          label: {
            text: b.line,
            font: "600 12px Inter, sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        entitiesRef.current.set(b.id, ent);
        prevRef.current.set(b.id, b);
      }
    }
    // Αφαίρεση όσων δεν υπάρχουν πια
    for (const [id, ent] of entitiesRef.current.entries()) {
      if (!seen.has(id)) {
        ds.entities.remove(ent);
        entitiesRef.current.delete(id);
        prevRef.current.delete(id);
        targetRef.current.delete(id);
      }
    }
  }, [buses]);

  useEffect(() => {
    const ds = dsRef.current;
    if (ds) ds.show = visible;
    viewer?.scene.requestRender();
  }, [visible, viewer]);

  return null;
}

function shortestAngle(from: number, to: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}
