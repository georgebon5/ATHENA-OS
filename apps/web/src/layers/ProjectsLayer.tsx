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

/** Shared project list — popup reads from here. */
let _projectList: CityProject[] = [];
export function getProjectById(id: string): CityProject | undefined {
  return _projectList.find((p) => p.id === id);
}

export function ProjectsLayer({ viewer }: Props) {
  const [projects, setProjects] = useState<CityProject[]>([]);
  const visible = useStore((s) => s.layers.projects);

  useEffect(() => {
    void fetchProjects().then((ps) => {
      _projectList = ps;
      setProjects(ps);
    });
  }, []);

  useEffect(() => {
    if (!viewer || projects.length === 0) return;
    const ds = new Cesium.CustomDataSource("projects");
    viewer.dataSources.add(ds);

    const startTime = performance.now();

    for (const p of projects) {
      const [lng, lat] = p.coordinates;
      const hex = STATUS_COLOR[p.status];
      const color = Cesium.Color.fromCssColorString(hex);
      const isActive = p.status === "in_progress";

      const pos = Cesium.Cartesian3.fromDegrees(lng, lat, 3);

      ds.entities.add({
        id: `project-${p.id}`,
        position: pos,
        point: {
          pixelSize: isActive ? 11 : 7,
          color: color.withAlpha(isActive ? 0.95 : (p.status === "planned" ? 0.5 : 0.85)),
          outlineColor: color,
          outlineWidth: isActive ? 2.5 : 1,
          heightReference: Cesium.HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // Pulse ring for in_progress projects — expanding/fading point
      if (isActive) {
        ds.entities.add({
          id: `project-pulse-${p.id}`,
          position: pos,
          point: {
            pixelSize: new Cesium.CallbackProperty(() => {
              const t = ((performance.now() - startTime) % 2200) / 2200;
              viewer.scene.requestRender();
              return 11 + t * 28;
            }, false) as unknown as Cesium.Property,
            color: new Cesium.CallbackProperty(() => {
              const t = ((performance.now() - startTime) % 2200) / 2200;
              return color.withAlpha(0.5 * (1 - t));
            }, false) as unknown as Cesium.Property,
            outlineWidth: 0,
            outlineColor: Cesium.Color.TRANSPARENT,
            heightReference: Cesium.HeightReference.NONE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
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
