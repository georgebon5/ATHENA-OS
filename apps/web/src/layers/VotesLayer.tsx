import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";

interface Props {
  viewer: Cesium.Viewer | null;
}

const COLORS = {
  yes: "#2ee6c9",
  no: "#ff4b3e",
  maybe: "#ffd84d",
};

/**
 * Votes layer: κάθε ψήφος (αν έχει location) σχεδιάζεται στο 3D ως
 * μικρή σφαίρα με χρώμα ανάλογα με την επιλογή (yes/no/maybe). Ο live
 * μετρητής εμφανίζεται σε overlay (δες EngagePanel/HUD).
 */
export function VotesLayer({ viewer }: Props) {
  const collRef = useRef<Cesium.PointPrimitiveCollection | null>(null);

  const tally = useStore((s) => s.voteTally);
  const visible = useStore((s) => s.layers.votes);

  useEffect(() => {
    if (!viewer) return;
    const coll = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(coll);
    collRef.current = coll;
    return () => {
      viewer.scene.primitives.remove(coll);
      collRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    const coll = collRef.current;
    if (!coll) return;
    coll.removeAll();
    if (!tally) return;
    for (const p of tally.points) {
      if (!p.lngLat) continue;
      coll.add({
        position: Cesium.Cartesian3.fromDegrees(p.lngLat[0], p.lngLat[1], 4),
        color: Cesium.Color.fromCssColorString(COLORS[p.choice]).withAlpha(0.85),
        pixelSize: 10,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
        outlineWidth: 1,
      });
    }
    viewer?.scene.requestRender();
  }, [tally, viewer]);

  useEffect(() => {
    const coll = collRef.current;
    if (coll) coll.show = visible;
    viewer?.scene.requestRender();
  }, [visible, viewer]);

  return null;
}
