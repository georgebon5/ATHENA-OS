import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";
import type { Bus, LngLat } from "@/types/contracts";

interface Props {
  viewer: Cesium.Viewer | null;
}

const BUS_COLOR = Cesium.Color.fromCssColorString("#79b7e4");
/** ~130 km/h: πιο γρήγορη «μετακίνηση» ανάμεσα σε δύο fixes είναι GPS glitch, όχι λεωφορείο. */
const MAX_BUS_MPS = 36;
/** Ουρά: ένα σημείο ανά δευτερόλεπτο, τα τελευταία ~20 s. Με τον ίδιο ρυθμό ξαναμετράμε το έδαφος. */
const SAMPLE_MS = 1000;
const TRAIL_POINTS = 20;

/**
 * Σχεδιάζει τα λεωφορεία της ΟΑΣΑ ως 3D markers με φωτεινή ουρά. Κάθε νέο update
 * γίνεται smooth interpolation από την προηγούμενη θέση σε
 * ~10 δευτερόλεπτα (όσο κι ο ρυθμός ανανέωσης από τον gateway).
 */
export function BusesLayer({ viewer }: Props) {
  const entitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const prevRef = useRef<Map<string, Bus>>(new Map());
  const targetRef = useRef<Map<string, Bus>>(new Map());
  const prevTimeRef = useRef<number>(performance.now());
  const fixAtRef = useRef<Map<string, number>>(new Map()); // πότε δεχτήκαμε το τελευταίο fix κάθε λεωφορείου
  const groundRef = useRef<Map<string, number>>(new Map()); // ύψος εδάφους κάτω από κάθε λεωφορείο
  const trailsRef = useRef<Map<string, Cesium.Cartesian3[]>>(new Map());
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);

  const buses = useStore((s) => s.buses);
  const visible = useStore((s) => s.layers.buses);

  // Mount: φτιάχνουμε το data source ΜΙΑ φορά ανά viewer, μαζί με τον tick.
  useEffect(() => {
    if (!viewer) return;
    const ds = new Cesium.CustomDataSource("buses");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    let raf = 0;
    let lastSample = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(1, (now - prevTimeRef.current) / 10_000);
      const sample = now - lastSample >= SAMPLE_MS;
      if (sample) lastSample = now;
      for (const [id, start] of prevRef.current.entries()) {
        const target = targetRef.current.get(id);
        const entity = entitiesRef.current.get(id);
        if (!entity || !target) continue;
        const lng = start.lngLat[0] + (target.lngLat[0] - start.lngLat[0]) * dt;
        const lat = start.lngLat[1] + (target.lngLat[1] - start.lngLat[1]) * dt;
        const bearing = start.bearing + shortestAngle(start.bearing, target.bearing) * dt;
        if (sample || !groundRef.current.has(id)) {
          const h = groundHeight(viewer.scene, lng, lat, ds.entities.values);
          groundRef.current.set(id, h ?? groundRef.current.get(id) ?? 0);
        }
        const pos = Cesium.Cartesian3.fromDegrees(lng, lat, groundRef.current.get(id)! + 2);
        entity.position = new Cesium.ConstantPositionProperty(pos);
        entity.orientation = new Cesium.ConstantProperty(
          Cesium.Transforms.headingPitchRollQuaternion(
            pos,
            new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(bearing), 0, 0),
          ),
        );
        // Το τελευταίο σημείο της ουράς ακολουθεί το λεωφορείο· κάθε SAMPLE_MS «παγώνει» και ανοίγει νέο.
        const trail = trailsRef.current.get(id);
        if (trail) {
          if (sample || trail.length === 0) trail.push(pos);
          else trail[trail.length - 1] = pos;
          if (trail.length > TRAIL_POINTS) trail.shift();
        }
      }
      viewer.scene.requestRender();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      viewer.dataSources.remove(ds, true);
      entitiesRef.current.clear();
      prevRef.current.clear();
      targetRef.current.clear();
      fixAtRef.current.clear();
      groundRef.current.clear();
      trailsRef.current.clear();
      dsRef.current = null;
    };
  }, [viewer]);

  // Sync: κάθε νέο buses update ενημερώνει τα entities χωρίς να
  // ξαναδημιουργεί το data source.
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;

    // Το tick ξεκινά από τις ΤΡΕΧΟΥΣΕΣ θέσεις των entities και στοχεύει στις νέες.
    const freshPrev = new Map<string, Bus>();
    for (const [id, old] of prevRef.current.entries()) {
      const target = targetRef.current.get(id);
      const t = Math.min(1, (performance.now() - prevTimeRef.current) / 10_000);
      if (target) {
        freshPrev.set(id, {
          id,
          line: old.line,
          lngLat: [
            old.lngLat[0] + (target.lngLat[0] - old.lngLat[0]) * t,
            old.lngLat[1] + (target.lngLat[1] - old.lngLat[1]) * t,
          ],
          bearing: old.bearing + shortestAngle(old.bearing, target.bearing) * t,
        });
      } else {
        freshPrev.set(id, old);
      }
    }
    prevRef.current = freshPrev;

    // Φίλτρο αλμάτων: fix που θέλει > MAX_BUS_MPS από το τελευταίο αποδεκτό αγνοείται (κρατάμε τον παλιό στόχο).
    // Ο χρόνος μετρά από το τελευταίο ΑΠΟΔΕΚΤΟ fix, άρα μια πραγματική μετακίνηση περνά σε λίγα updates.
    const now = performance.now();
    const nextTarget = new Map<string, Bus>();
    for (const b of buses) {
      const last = targetRef.current.get(b.id);
      const lastAt = fixAtRef.current.get(b.id);
      if (last && lastAt !== undefined && distanceM(last.lngLat, b.lngLat) > (MAX_BUS_MPS * (now - lastAt)) / 1000) {
        nextTarget.set(b.id, last);
      } else {
        nextTarget.set(b.id, b);
        fixAtRef.current.set(b.id, now);
      }
    }
    targetRef.current = nextTarget;
    prevTimeRef.current = now;

    const seen = new Set<string>();
    for (const b of buses) {
      seen.add(b.id);
      let ent = entitiesRef.current.get(b.id);
      if (!ent) {
        const trail: Cesium.Cartesian3[] = [];
        trailsRef.current.set(b.id, trail);
        ent = ds.entities.add({
          id: `bus-${b.id}`,
          position: Cesium.Cartesian3.fromDegrees(b.lngLat[0], b.lngLat[1], 2),
          box: {
            dimensions: new Cesium.Cartesian3(12, 3.5, 3),
            material: BUS_COLOR.withAlpha(0.95),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#e5f4ff"),
          },
          polyline: {
            positions: new Cesium.CallbackProperty(() => trail.slice(), false),
            width: 6,
            arcType: Cesium.ArcType.NONE,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.25,
              color: BUS_COLOR.withAlpha(0.8),
            }),
          },
          label: {
            text: b.line,
            font: "600 12px Inter, sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2500), // όχι στον χάρτη
          },
        });
        entitiesRef.current.set(b.id, ent);
        prevRef.current.set(b.id, b);
      }
    }
    // Αφαίρεση όσων δεν υπάρχουν πια
    for (const [id, ent] of entitiesRef.current.entries()) {
      if (!seen.has(id)) {
        ds.entities.remove(ent);
        entitiesRef.current.delete(id);
        prevRef.current.delete(id);
        targetRef.current.delete(id);
        fixAtRef.current.delete(id);
        groundRef.current.delete(id);
        trailsRef.current.delete(id);
      }
    }
  }, [buses]);

  useEffect(() => {
    const ds = dsRef.current;
    if (ds) ds.show = visible;
    viewer?.scene.requestRender();
  }, [visible, viewer]);

  return null;
}

/**
 * Ύψος του ορατού εδάφους (Google 3D tiles ή terrain): η Πειραιώς είναι ~65–85 m πάνω από το ellipsoid,
 * άρα σταθερό ύψος θάβει τα λεωφορεία. undefined όσο το σημείο είναι εκτός οθόνης.
 * ponytail: πιάνει και ταράτσες/δέντρα αν ένα GPS fix πέσει πάνω τους· snap στον δρόμο (network.geojson) αν φανεί στο demo.
 */
function groundHeight(scene: Cesium.Scene, lng: number, lat: number, exclude: Cesium.Entity[]): number | undefined {
  const c = Cesium.Cartographic.fromDegrees(lng, lat);
  const h = scene.sampleHeightSupported ? scene.sampleHeight(c, exclude) : scene.globe.getHeight(c);
  // Το depth picking γυρίζει μερικές φορές σκουπίδια (~-6.3e6 m, «μέσα» στη Γη) αντί για undefined
  return h !== undefined && Math.abs(h) < 1000 ? h : undefined;
}

function distanceM(a: LngLat, b: LngLat): number {
  const mPerDeg = 111_320;
  const dx = (b[0] - a[0]) * mPerDeg * Math.cos((a[1] * Math.PI) / 180);
  const dy = (b[1] - a[1]) * mPerDeg;
  return Math.hypot(dx, dy);
}

function shortestAngle(from: number, to: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}
