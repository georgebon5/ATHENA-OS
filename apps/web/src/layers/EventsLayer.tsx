import { useEffect, useState } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import { fetchEvents, type CityEvent } from "@/opendata/athensGovClient";

interface Props {
  viewer: Cesium.Viewer | null;
}

const EVENT_COLOR = "#f59e0b";

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "short" });
  } catch {
    return iso.slice(0, 10);
  }
}

export function EventsLayer({ viewer }: Props) {
  const [events, setEvents] = useState<CityEvent[]>([]);
  const visible = useStore((s) => s.layers.events);

  useEffect(() => {
    void fetchEvents().then(setEvents);
  }, []);

  useEffect(() => {
    if (!viewer || events.length === 0) return;
    const ds = new Cesium.CustomDataSource("events");
    viewer.dataSources.add(ds);
    const color = Cesium.Color.fromCssColorString(EVENT_COLOR);

    for (const ev of events) {
      const [lng, lat] = ev.coordinates;
      const dateStr = formatDate(ev.startDate);
      const label = dateStr ? `${ev.title}\n${dateStr}` : ev.title;
      ds.entities.add({
        id: `event-${ev.id}`,
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 3),
        point: {
          pixelSize: 10,
          color: color.withAlpha(0.9),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.6),
          outlineWidth: 1.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: label,
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
  }, [viewer, events]);

  useEffect(() => {
    if (!viewer) return;
    const ds = viewer.dataSources.getByName("events")[0];
    if (ds) { ds.show = visible; viewer.scene.requestRender(); }
  }, [visible, viewer]);

  return null;
}
