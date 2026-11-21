import { useEffect, useState } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import { fetchPois, type CityPoi } from "@/opendata/athensGovClient";

interface Props {
  viewer: Cesium.Viewer | null;
}

const CATEGORY_COLOR: Record<string, string> = {
  park:      "#4ade80",
  culture:   "#a78bfa",
  sport:     "#38bdf8",
  health:    "#1a73e8",
  education: "#fbbf24",
};

function poiColor(category: string): string {
  const key = Object.keys(CATEGORY_COLOR).find((k) =>
    category.toLowerCase().includes(k)
  );
  return key ? CATEGORY_COLOR[key] : "#a78bfa";
}

export function PoisLayer({ viewer }: Props) {
  const [pois, setPois] = useState<CityPoi[]>([]);
  const visible = useStore((s) => s.layers.pois);

  useEffect(() => {
    void fetchPois().then(setPois);
  }, []);

  useEffect(() => {
    if (!viewer || pois.length === 0) return;
    const ds = new Cesium.CustomDataSource("pois");
    viewer.dataSources.add(ds);

    for (const poi of pois) {
      const [lng, lat] = poi.coordinates;
      const color = Cesium.Color.fromCssColorString(poiColor(poi.category));
      ds.entities.add({
        id: `poi-${poi.id}`,
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 3),
        point: {
          pixelSize: 9,
          color: color.withAlpha(0.85),
          outlineColor: color,
          outlineWidth: 1.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: poi.name,
          font: "500 10px Inter, sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: color,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#0c0614").withAlpha(0.75),
          backgroundPadding: new Cesium.Cartesian2(5, 3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scale: 0.9,
        },
      });
    }

    viewer.scene.requestRender();
    return () => { viewer.dataSources.remove(ds, true); };
  }, [viewer, pois]);

  useEffect(() => {
    if (!viewer) return;
    const ds = viewer.dataSources.getByName("pois")[0];
    if (ds) { ds.show = visible; viewer.scene.requestRender(); }
  }, [visible, viewer]);

  return null;
}
