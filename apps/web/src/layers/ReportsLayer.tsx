import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import type { Report, ReportCategory } from "@/types/contracts";

interface Props {
  viewer: Cesium.Viewer | null;
}

const SEVERITY_COLOR: Record<number, string> = {
  1: "#2ee6c9",
  2: "#9fe68a",
  3: "#ffd84d",
  4: "#ff9a5a",
  5: "#ff4b3e",
};

/**
 * Σχεδιάζει κάθε αναφορά πολίτη ως 3D billboard της φωτογραφίας στο
 * σημείο GPS, προσανατολισμένη κατά το heading της πυξίδας. Όταν έρχεται
 * νέα αναφορά (`report.created`), εμφανίζεται ένα pulse ring. Μόλις ο
 * agent στείλει `report.classified`, πάνω της μπαίνει ένα badge με
 * κατηγορία και σοβαρότητα.
 */
export function ReportsLayer({ viewer }: Props) {
  const entities = useRef<Map<string, Cesium.Entity>>(new Map());
  const pulses = useRef<Map<string, { entity: Cesium.Entity; start: number }>>(
    new Map(),
  );

  const reports = useStore((s) => s.reports);
  const visible = useStore((s) => s.layers.reports);

  useEffect(() => {
    if (!viewer) return;
    const ds = new Cesium.CustomDataSource("reports");
    viewer.dataSources.add(ds);

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      for (const [id, p] of pulses.current.entries()) {
        const age = (now - p.start) / 1600;
        if (age > 1) {
          ds.entities.remove(p.entity);
          pulses.current.delete(id);
          continue;
        }
        const radius = 4 + age * 18;
        const alpha = 0.9 * (1 - age);
        p.entity.ellipse = new Cesium.EllipseGraphics({
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: Cesium.Color.fromCssColorString("#ff5fb8").withAlpha(alpha),
          height: 1,
        });
      }
      viewer.scene.requestRender();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      viewer.dataSources.remove(ds, true);
      entities.current.clear();
      pulses.current.clear();
    };
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    const ds = viewer.dataSources.getByName("reports")[0] as
      | Cesium.CustomDataSource
      | undefined;
    if (!ds) return;

    for (const r of Object.values(reports)) {
      upsertReportEntity(ds, entities.current, pulses.current, r);
    }
    viewer.scene.requestRender();
  }, [reports, viewer]);

  useEffect(() => {
    if (!viewer) return;
    const ds = viewer.dataSources.getByName("reports")[0];
    if (ds) ds.show = visible;
    viewer.scene.requestRender();
  }, [visible, viewer]);

  return null;
}

function upsertReportEntity(
  ds: Cesium.CustomDataSource,
  entities: Map<string, Cesium.Entity>,
  pulses: Map<string, { entity: Cesium.Entity; start: number }>,
  r: Report,
) {
  const pos = Cesium.Cartesian3.fromDegrees(r.location[0], r.location[1], 8);
  let ent = entities.get(r.id);

  const severity = r.classification?.severity ?? 3;
  const color = SEVERITY_COLOR[severity] ?? "#ff5fb8";
  const labelText = r.classification
    ? `${categoryLabel(r.classification.category)} · Σ${severity}`
    : "Νέα αναφορά";

  if (!ent) {
    ent = ds.entities.add({
      id: `report-${r.id}`,
      position: pos,
      billboard: {
        image: r.photoUrl,
        width: 120,
        height: 90,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        color: Cesium.Color.WHITE,
      },
      label: {
        text: labelText,
        font: "600 11px Inter, sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString(color),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, 6),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("#0c0614").withAlpha(0.85),
        backgroundPadding: new Cesium.Cartesian2(6, 4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entities.set(r.id, ent);

    // Pulse ring για νέες αναφορές
    const pulse = ds.entities.add({
      id: `report-pulse-${r.id}`,
      position: Cesium.Cartesian3.fromDegrees(r.location[0], r.location[1], 0.5),
    });
    pulses.set(r.id, { entity: pulse, start: performance.now() });
  } else {
    ent.position = new Cesium.ConstantPositionProperty(pos);
    if (ent.billboard) ent.billboard.image = new Cesium.ConstantProperty(r.photoUrl);
    if (ent.label) {
      ent.label.text = new Cesium.ConstantProperty(labelText);
      ent.label.outlineColor = new Cesium.ConstantProperty(
        Cesium.Color.fromCssColorString(color),
      );
    }
  }
}

export function categoryLabel(c: ReportCategory): string {
  switch (c) {
    case "pothole":
      return "Λακκούβα";
    case "sidewalk_damage":
      return "Πεζοδρόμιο";
    case "waste":
      return "Καθαριότητα";
    case "lighting":
      return "Φωτισμός";
    case "obstruction":
      return "Εμπόδιο";
    case "heat_exposure":
      return "Θερμικό";
    case "graffiti":
      return "Γκραφίτι";
    case "accessibility":
      return "Προσβασιμότητα";
    default:
      return "Άλλο";
  }
}
