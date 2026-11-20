import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import type { LngLat, ScenarioEdit } from "@/types/contracts";

interface Props {
  viewer: Cesium.Viewer | null;
}

/**
 * Δείχνει αμέσως τις αλλαγές του ενεργού σεναρίου στο 3D,
 * πριν καν τρέξει το sim — έτσι ο χρήστης «βλέπει» τι θα αλλάξει.
 *
 * add_trees      → 3D δέντρα (κορμός + κόμη) στα κλικαρισμένα σημεία
 * cool_pavement  → γαλαζόλευκο overlay πάνω στους δρόμους
 * bus_lane       → κίτρινη λωρίδα overlay
 * close_road     → κόκκινο barrier + X marker
 * remove_lane    → πορτοκαλί hatching overlay
 */
export function ScenarioLayer({ viewer }: Props) {
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const scenario = useStore((s) => s.activeScenario);
  const networkWays = useStore((s) => s.networkWays);

  useEffect(() => {
    if (!viewer) return;
    const ds = new Cesium.CustomDataSource("scenario");
    viewer.dataSources.add(ds);
    dsRef.current = ds;
    return () => {
      viewer.dataSources.remove(ds, true);
      dsRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    if (!scenario) return;

    for (const edit of scenario.edits) {
      renderEdit(ds, edit, networkWays);
    }
    viewer?.scene.requestRender();
  }, [scenario, networkWays, viewer]);

  return null;
}

// ── per-edit renderers ────────────────────────────────────────────────────────

function renderEdit(
  ds: Cesium.CustomDataSource,
  edit: ScenarioEdit,
  networkWays: Map<number, LngLat[]>,
) {
  switch (edit.type) {
    case "add_trees":
      renderTrees(ds, edit.geometry);
      break;
    case "cool_pavement":
      renderWayOverlay(ds, edit.wayIds, networkWays, {
        color: "#a8e4f7",
        alpha: 0.65,
        width: 10,
        label: "cool",
      });
      break;
    case "bus_lane":
      renderWayOverlay(ds, edit.wayIds, networkWays, {
        color: "#f7c948",
        alpha: 0.80,
        width: 8,
        label: "bus",
      });
      break;
    case "close_road":
      renderWayOverlay(ds, edit.wayIds, networkWays, {
        color: "#ff4c4c",
        alpha: 0.85,
        width: 12,
        label: "closed",
      });
      renderBarriers(ds, edit.wayIds, networkWays);
      break;
    case "remove_lane":
      renderWayOverlay(ds, edit.wayIds, networkWays, {
        color: "#ff9a30",
        alpha: 0.65,
        width: 8,
        label: "−1 λωρίδα",
      });
      break;
  }
}

// ── δέντρα ───────────────────────────────────────────────────────────────────

function renderTrees(ds: Cesium.CustomDataSource, geometry: LngLat[]) {
  if (geometry.length === 0) return;

  for (const [lng, lat] of geometry) {
    // Κορμός
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, 2.5),
      cylinder: {
        length: 5,
        topRadius: 0.25,
        bottomRadius: 0.4,
        material: new Cesium.ColorMaterialProperty(
          Cesium.Color.fromCssColorString("#7a5230").withAlpha(0.95),
        ),
      },
    });
    // Κόμη (ellipsoid)
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, 7.5),
      ellipsoid: {
        radii: new Cesium.Cartesian3(3.5, 3.5, 4.5),
        material: new Cesium.ColorMaterialProperty(
          Cesium.Color.fromCssColorString("#3ab56e").withAlpha(0.88),
        ),
        outline: false,
      },
    });
    // Soft glow στο έδαφος
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, 0.1),
      ellipse: {
        semiMajorAxis: 4.5,
        semiMinorAxis: 4.5,
        material: Cesium.Color.fromCssColorString("#3ab56e").withAlpha(0.18),
        height: 0.1,
      },
    });
  }

  // Γραμμή δενδροστοιχίας
  if (geometry.length >= 2) {
    ds.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(
          geometry.flatMap(([lng, lat]) => [lng, lat]),
        ),
        width: 2,
        material: Cesium.Color.fromCssColorString("#3ab56e").withAlpha(0.4),
        clampToGround: true,
      },
    });
  }
  // Η κάμερα κινείται μόνο μέσω camera.flyTo WS events (από τον agent)
}

// ── δρόμος overlay ────────────────────────────────────────────────────────────

function renderWayOverlay(
  ds: Cesium.CustomDataSource,
  wayIds: number[],
  networkWays: Map<number, LngLat[]>,
  opts: { color: string; alpha: number; width: number; label: string },
) {
  for (const wayId of wayIds) {
    const path = networkWays.get(wayId);
    if (!path || path.length < 2) continue;

    // Κύρια γραμμή
    ds.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(
          path.flatMap(([lng, lat]) => [lng, lat]),
        ),
        width: opts.width,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          taperPower: 0.9,
          color: Cesium.Color.fromCssColorString(opts.color).withAlpha(opts.alpha),
        }),
        clampToGround: true,
        classificationType: Cesium.ClassificationType.TERRAIN,
      },
    });

    // Label στη μέση του way
    const mid = path[Math.floor(path.length / 2)];
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(mid[0], mid[1], 10),
      label: {
        text: opts.label,
        font: "bold 11px Inter, sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString("#000").withAlpha(0.7),
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 1500, 0.4),
      },
    });
  }
}

// ── barriers (close_road) ─────────────────────────────────────────────────────

function renderBarriers(
  ds: Cesium.CustomDataSource,
  wayIds: number[],
  networkWays: Map<number, LngLat[]>,
) {
  for (const wayId of wayIds) {
    const path = networkWays.get(wayId);
    if (!path || path.length < 2) continue;

    // Τοποθέτησε X-barriers κάθε ~50m περίπου (max 6)
    const step = Math.max(1, Math.floor(path.length / Math.min(6, path.length)));
    for (let i = 0; i < path.length; i += step) {
      const [lng, lat] = path[i];
      ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 1.5),
        box: {
          dimensions: new Cesium.Cartesian3(3, 0.6, 3),
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString("#ff4c4c").withAlpha(0.9),
          ),
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.8),
        },
      });
    }
  }
}
