import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import type { LngLat, SimResult, Trip } from "@/types/contracts";

interface Props {
  viewer: Cesium.Viewer | null;
}

const MAX_TRIPS = 3000;

/**
 * Traffic layer: πολύγραμμες χρωματισμένες από πράσινο→κόκκινο
 * αναλόγως του newFlow/baseFlow, και animated trips (<= 3000 κινούμενα
 * σημεία) που ακολουθούν δεδομένα paths με departS/durationS.
 */
export function TrafficLayer({ viewer }: Props) {
  const polylinesRef = useRef<Cesium.CustomDataSource | null>(null);
  const pointsRef = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const tripsRef = useRef<Trip[]>([]);
  const startRef = useRef<number>(0);

  const simResult = useStore((s) => s.simResult);
  const networkWays = useStore((s) => s.networkWays);
  const visible = useStore((s) => s.layers.traffic);

  useEffect(() => {
    if (!viewer) return;
    const ds = new Cesium.CustomDataSource("traffic");
    viewer.dataSources.add(ds);
    polylinesRef.current = ds;

    const coll = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(coll);
    pointsRef.current = coll;

    let raf = 0;
    const tick = () => {
      animateTrips(coll, tripsRef.current, startRef.current);
      viewer.scene.requestRender();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      viewer.dataSources.remove(ds, true);
      viewer.scene.primitives.remove(coll);
      polylinesRef.current = null;
      pointsRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    const ds = polylinesRef.current;
    const coll = pointsRef.current;
    if (!ds || !coll) return;

    ds.entities.removeAll();
    coll.removeAll();
    tripsRef.current = [];

    if (!simResult) return;
    renderSegments(ds, simResult, networkWays);
    tripsRef.current = simResult.traffic.trips.slice(0, MAX_TRIPS);
    startRef.current = performance.now();
    for (const _ of tripsRef.current) {
      coll.add({
        position: Cesium.Cartesian3.fromDegrees(0, 0, 0),
        color: Cesium.Color.fromCssColorString("#ffd3ec"),
        pixelSize: 4,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
        outlineWidth: 1,
        show: false,
      });
    }
    viewer?.scene.requestRender();
  }, [simResult, networkWays, viewer]);

  useEffect(() => {
    const ds = polylinesRef.current;
    if (ds) ds.show = visible;
    const coll = pointsRef.current;
    if (coll) coll.show = visible;
    viewer?.scene.requestRender();
  }, [visible, viewer]);

  return null;
}

function renderSegments(
  ds: Cesium.CustomDataSource,
  sim: SimResult,
  networkWays: Map<number, LngLat[][]>,
) {
  for (const seg of sim.traffic.segments) {
    // Αν το sim δεν έστειλε inline path, το λύνουμε από το /api/network
    const lines = seg.path && seg.path.length >= 2 ? [seg.path] : (networkWays.get(seg.wayId) ?? []);
    const ratio = seg.baseFlow > 0 ? seg.newFlow / seg.baseFlow : 1;
    const color = flowColor(ratio);
    for (const path of lines) {
      if (path.length < 2) continue;
      ds.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(path.flatMap(([lng, lat]) => [lng, lat])),
          width: 6,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.22,
            color: Cesium.Color.fromCssColorString(color).withAlpha(0.95),
          }),
          clampToGround: true,
        },
      });
    }
  }
}

function flowColor(ratio: number): string {
  // 0 → πράσινο (λιγότερη κίνηση), 1 → κίτρινο, >1 → κόκκινο
  const r = Math.max(0, Math.min(2, ratio));
  if (r < 1) return lerpHex("#2ee6c9", "#ffd84d", r);
  return lerpHex("#ffd84d", "#ff4b3e", r - 1);
}

function animateTrips(
  coll: Cesium.PointPrimitiveCollection,
  trips: Trip[],
  start: number,
) {
  const now = performance.now();
  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const t = ((now - start) / 1000 - trip.departS) / trip.durationS;
    const p = coll.get(i);
    if (!p) continue;
    if (t < 0 || t > 1) {
      p.show = false;
      continue;
    }
    const pt = sampleTrip(trip, t);
    if (!pt) {
      p.show = false;
      continue;
    }
    p.show = true;
    p.position = Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 2);
  }
}

function sampleTrip(trip: Trip, t: number): [number, number] | null {
  if (trip.path.length < 2) return null;
  const idx = (trip.path.length - 1) * t;
  const i0 = Math.floor(idx);
  const i1 = Math.min(trip.path.length - 1, i0 + 1);
  const f = idx - i0;
  const a = trip.path[i0];
  const b = trip.path[i1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function hexToRgb(h: string): [number, number, number] {
  const m = h.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}
