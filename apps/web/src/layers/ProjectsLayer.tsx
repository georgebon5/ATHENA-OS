import { useEffect, useState } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import { fetchProjects, type CityProject } from "@/opendata/athensGovClient";

interface Props {
  viewer: Cesium.Viewer | null;
}

const STATUS_COLOR: Record<CityProject["status"], string> = {
  in_progress: "#00e5ff",
  planned:     "#e8d9c5",
  completed:   "#2ee6c9",
};

export function ProjectsLayer({ viewer }: Props) {
  const [projects, setProjects] = useState<CityProject[]>([]);
  const visible = useStore((s) => s.layers.projects);

  useEffect(() => {
    void fetchProjects().then(setProjects);
  }, []);

  useEffect(() => {
    if (!viewer || projects.length === 0) return;
    const ds = new Cesium.CustomDataSource("projects");
    viewer.dataSources.add(ds);

    for (const p of projects) {
      const [lng, lat] = p.coordinates;
      const hex = STATUS_COLOR[p.status];
      const color = Cesium.Color.fromCssColorString(hex);
      const isActive = p.status === "in_progress";
      const tooltipLines = [
        p.title,
        p.district ?? "",
        p.budget != null ? `€${(p.budget / 1000).toFixed(0)}χιλ.` : "",
      ]
        .filter(Boolean)
        .join("\n");

      ds.entities.add({
        id: `project-${p.id}`,
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 3),
        point: {
          pixelSize: isActive ? 11 : 8,
          color: color.withAlpha(p.status === "planned" ? 0.45 : 0.85),
          outlineColor: color,
          outlineWidth: isActive ? 2 : 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: tooltipLines,
          font: "500 10px Inter, sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: color,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#0c0614").withAlpha(0.78),
          backgroundPadding: new Cesium.Cartesian2(5, 3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scale: 0.9,
        },
      });
    }

    viewer.scene.requestRender();

    return () => {
      viewer.dataSources.remove(ds, true);
    };
  }, [viewer, projects]);

  useEffect(() => {
    if (!viewer) return;
    const ds = viewer.dataSources.getByName("projects")[0];
    if (ds) {
      ds.show = visible;
      viewer.scene.requestRender();
    }
  }, [visible, viewer]);

  return null;
}
