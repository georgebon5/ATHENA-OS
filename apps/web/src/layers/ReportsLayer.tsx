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

const PULSE_COLOR = Cesium.Color.fromCssColorString("#ff5fb8");
/** Κάρτα φωτογραφίας μόνο για τις πιο πρόσφατες (π.χ. του κριτή)· οι υπόλοιπες είναι κουκκίδα σοβαρότητας. */
const PHOTO_CARDS = 3;
/** Pulse μόνο για φρέσκες αναφορές, όχι για τις ιστορικές του seed (43 pulses μαζί στην εκκίνηση). */
const PULSE_IF_YOUNGER_MS = 60_000;

/**
 * Σχεδιάζει τις αναφορές πολιτών στο σημείο GPS: οι PHOTO_CARDS πιο πρόσφατες
 * ως billboard της φωτογραφίας με badge κατηγορίας/σοβαρότητας (μόλις έρθει
 * `report.classified`), οι υπόλοιπες ως μικρή κουκκίδα στο χρώμα της σοβαρότητας.
 * Νέα αναφορά (`report.created`) → pulse ring. Ύψη σχετικά με το έδαφος:
 * η Πειραιώς είναι ~70 m πάνω από το ellipsoid στα Google 3D tiles.
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
        // Δαχτυλίδι σε pixels: φθηνό point αντί για ellipse geometry που ξαναχτιζόταν κάθε frame
        p.entity.point!.pixelSize = new Cesium.ConstantProperty(12 + age * 60);
        p.entity.point!.outlineColor = new Cesium.ConstantProperty(PULSE_COLOR.withAlpha(0.9 * (1 - age)));
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

    const all = Object.values(reports);
    const photoIds = new Set(
      [...all]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, PHOTO_CARDS)
        .map((r) => r.id),
    );
    for (const r of all) {
      upsertReportEntity(ds, entities.current, pulses.current, r, photoIds.has(r.id));
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
  photo: boolean,
) {
  const pos = Cesium.Cartesian3.fromDegrees(r.location[0], r.location[1], 8);
  let ent = entities.get(r.id);

  const severity = r.classification?.severity ?? 3;
  const color = Cesium.Color.fromCssColorString(SEVERITY_COLOR[severity] ?? "#ff5fb8");
  const labelText = r.classification
    ? `${categoryLabel(r.classification.category)} · Σ${severity}`
    : "Νέα αναφορά";

  if (!ent) {
    ent = ds.entities.add({
      id: `report-${r.id}`,
      position: pos,
      point: {
        pixelSize: 9,
        color,
        outlineColor: Cesium.Color.fromCssColorString("#0c0614"),
        outlineWidth: 1.5,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entities.set(r.id, ent);

    // Pulse ring για νέες αναφορές
    if (Date.now() - Date.parse(r.createdAt) < PULSE_IF_YOUNGER_MS) {
      const pulse = ds.entities.add({
        id: `report-pulse-${r.id}`,
        position: Cesium.Cartesian3.fromDegrees(r.location[0], r.location[1], 0.5),
        point: {
          pixelSize: 12,
          color: Cesium.Color.TRANSPARENT,
          outlineColor: PULSE_COLOR,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      pulses.set(r.id, { entity: pulse, start: performance.now() });
    }
  }

  ent.position = new Cesium.ConstantPositionProperty(pos);
  ent.point!.color = new Cesium.ConstantProperty(color);
  ent.point!.show = new Cesium.ConstantProperty(!photo);
  if (!photo) {
    // Χωρίς billboard δεν φορτώνεται καν η εικόνα
    ent.billboard = undefined;
    ent.label = undefined;
    return;
  }
  if (!ent.billboard) {
    ent.billboard = new Cesium.BillboardGraphics({
      width: 120,
      height: 90,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      color: Cesium.Color.WHITE,
    });
    ent.label = new Cesium.LabelGraphics({
      font: "600 11px Inter, sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      pixelOffset: new Cesium.Cartesian2(0, 6),
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString("#0c0614").withAlpha(0.85),
      backgroundPadding: new Cesium.Cartesian2(6, 4),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }
  ent.billboard.image = new Cesium.ConstantProperty(r.photoUrl);
  ent.label!.text = new Cesium.ConstantProperty(labelText);
  ent.label!.outlineColor = new Cesium.ConstantProperty(color);
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
