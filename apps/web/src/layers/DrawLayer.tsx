import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";

interface Props {
  viewer: Cesium.Viewer | null;
}

/**
 * Interactive scenario drawing. Όταν `drawMode` είναι ενεργό,
 * κάθε αριστερό κλικ στο 3D προσθέτει ένα σημείο «δέντρου» στο
 * store και το σχεδιάζει ως πράσινο κυλινδρικό marker. Μετά ο
 * χρήστης πατάει «Υπολόγισε» στο HUD για να φτιαχτεί Scenario.
 */
export function DrawLayer({ viewer }: Props) {
  const drawMode = useStore((s) => s.drawMode);
  const drawPoints = useStore((s) => s.drawPoints);
  const pushDrawPoint = useStore((s) => s.pushDrawPoint);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);

  useEffect(() => {
    if (!viewer) return;
    const ds = new Cesium.CustomDataSource("draw");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    handlerRef.current = handler;
    handler.setInputAction((ev: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!useStore.getState().drawMode) return;
      const cart = viewer.scene.pickPosition(ev.position);
      if (!cart) return;
      const carto = Cesium.Cartographic.fromCartesian(cart);
      pushDrawPoint([
        Cesium.Math.toDegrees(carto.longitude),
        Cesium.Math.toDegrees(carto.latitude),
      ]);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      viewer.dataSources.remove(ds, true);
      handlerRef.current = null;
      dsRef.current = null;
    };
  }, [viewer, pushDrawPoint]);

  // Sync visual markers με τα σημεία του store
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    if (!viewer) return;

    for (let i = 0; i < drawPoints.length; i++) {
      const [lng, lat] = drawPoints[i];
      ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
        cylinder: {
          length: 6,
          topRadius: 1.8,
          bottomRadius: 0.4,
          material: Cesium.Color.fromCssColorString("#55e6c1").withAlpha(0.9),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#0f3a2d"),
        },
        label: {
          text: `${i + 1}`,
          font: "600 11px Inter, sans-serif",
          fillColor: Cesium.Color.WHITE,
          pixelOffset: new Cesium.Cartesian2(0, -24),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
    if (drawPoints.length >= 2) {
      ds.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(
            drawPoints.flatMap(([lng, lat]) => [lng, lat]),
          ),
          width: 3,
          material: Cesium.Color.fromCssColorString("#55e6c1").withAlpha(0.7),
          clampToGround: true,
        },
      });
    }
    viewer.scene.requestRender();
  }, [drawPoints, viewer]);

  useEffect(() => {
    if (!viewer) return;
    viewer.canvas.style.cursor = drawMode ? "crosshair" : "";
    return () => {
      viewer.canvas.style.cursor = "";
    };
  }, [drawMode, viewer]);

  return null;
}
