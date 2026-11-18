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
  const entities = useRef<Map<string, Cesium.Entity>>(new Map());
  const prev = useRef<Map<string, Bus>>(new Map());
  const prevTime = useRef<number>(performance.now());

  const buses = useStore((s) => s.buses);
  const visible = useStore((s) => s.layers.buses);

  useEffect(() => {
    if (!viewer) return;
    const scene = viewer.scene;
    const ds = new Cesium.CustomDataSource("buses");
    viewer.dataSources.add(ds);

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(1, (now - prevTime.current) / 10_000);
      for (const [id, b] of prev.current.entries()) {
        const target = buses.find((x) => x.id === id);
        const entity = entities.current.get(id);
        if (!entity) continue;
        if (target) {
          const lng = b.lngLat[0] + (target.lngLat[0] - b.lngLat[0]) * dt;
          const lat = b.lngLat[1] + (target.lngLat[1] - b.lngLat[1]) * dt;
          const bearing = b.bearing + shortestAngle(b.bearing, target.bearing) * dt;
          entity.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(lng, lat, 2),
          );
          entity.orientation = new Cesium.ConstantProperty(
            Cesium.Transforms.headingPitchRollQuaternion(
              Cesium.Cartesian3.fromDegrees(lng, lat, 2),
              new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(bearing),
                0,
                0,
              ),
            ),
          );
        }
      }
      scene.requestRender();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      viewer.dataSources.remove(ds, true);
      entities.current.clear();
      prev.current.clear();
    };
  }, [viewer, buses]);

  useEffect(() => {
    if (!viewer) return;
    const ds = viewer.dataSources.getByName("buses")[0] as
      | Cesium.CustomDataSource
      | undefined;
    if (!ds) return;

    prevTime.current = performance.now();
    const seen = new Set<string>();
    for (const b of buses) {
      seen.add(b.id);
      let ent = entities.current.get(b.id);
      if (!ent) {
        ent = ds.entities.add({
          id: `bus-${b.id}`,
          position: Cesium.Cartesian3.fromDegrees(
            b.lngLat[0],
            b.lngLat[1],
            2,
          ),
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
        entities.current.set(b.id, ent);
      }
      prev.current.set(b.id, b);
    }

    // Αφαίρεση όσων δεν υπάρχουν πια
    for (const [id, ent] of entities.current.entries()) {
      if (!seen.has(id)) {
        ds.entities.remove(ent);
        entities.current.delete(id);
        prev.current.delete(id);
      }
    }
  }, [buses, viewer]);

  useEffect(() => {
    if (!viewer) return;
    const ds = viewer.dataSources.getByName("buses")[0];
    if (ds) ds.show = visible;
    viewer.scene.requestRender();
  }, [visible, viewer]);

  return null;
}

function shortestAngle(from: number, to: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}
