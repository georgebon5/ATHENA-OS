/**
 * Τοποθεσία και πυξίδα. ΚΑΜΙΑ άδεια δεν ζητιέται πριν πατήσει ο χρήστης κουμπί (κανόνας iOS):
 * οι συναρτήσεις αυτές καλούνται μόνο μέσα από click handlers.
 */
import type { LngLat } from "@athena-os/contracts";

/** Πειραιώς 144, μπροστά στο Σεράφειο: προεπιλογή αν ο χρήστης αρνηθεί την τοποθεσία. */
export const SERAFIO: LngLat = [23.7108, 37.9787];

export interface Fix {
  lngLat: LngLat;
  accuracyM: number;
}

export type GeoState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "ok"; fix: Fix }
  | { status: "denied" | "unavailable" };

/** watchPosition υψηλής ακρίβειας· κρατά την καλύτερη θέση. Επιστρέφει stop(). */
export function watchLocation(onState: (s: GeoState) => void): () => void {
  if (!("geolocation" in navigator)) {
    onState({ status: "unavailable" });
    return () => undefined;
  }
  let best: Fix | null = null;
  onState({ status: "searching" });
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const fix: Fix = { lngLat: [pos.coords.longitude, pos.coords.latitude], accuracyM: pos.coords.accuracy };
      // νεότερη θέση κερδίζει, εκτός αν είναι πολύ χειρότερη σε ακρίβεια
      if (!best || fix.accuracyM <= best.accuracyM * 1.5) best = fix;
      onState({ status: "ok", fix: best });
    },
    (err) => {
      if (best) return;
      onState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" });
    },
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

type DOE = DeviceOrientationEvent & { webkitCompassHeading?: number };
type DOEStatic = { requestPermission?: () => Promise<"granted" | "denied"> };

/** iOS 13+: απαιτεί requestPermission() μέσα σε tap. Android: δεν χρειάζεται. */
export async function requestCompassPermission(): Promise<boolean> {
  const ctor = (window as unknown as { DeviceOrientationEvent?: DOEStatic }).DeviceOrientationEvent;
  if (ctor && typeof ctor.requestPermission === "function") {
    try {
      return (await ctor.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return typeof window.DeviceOrientationEvent !== "undefined";
}

/** Πυξίδα της πίσω κάμερας (W3C DeviceOrientation, παράρτημα «compass heading»). */
function headingFromEuler(alpha: number, beta: number, gamma: number): number {
  const d = Math.PI / 180;
  const [x, y, z] = [beta * d, gamma * d, alpha * d];
  const [cY, cZ] = [Math.cos(y), Math.cos(z)];
  const [sX, sY, sZ] = [Math.sin(x), Math.sin(y), Math.sin(z)];
  const vx = -cZ * sY - sZ * sX * cY;
  const vy = -sZ * sY + cZ * sX * cY;
  let h = Math.atan(vx / vy);
  if (vy < 0) h += Math.PI;
  else if (vx < 0) h += 2 * Math.PI;
  return h / d;
}

/** Ακούει την πυξίδα και δίνει κυκλικό μέσο όρο των τελευταίων δειγμάτων. Επιστρέφει stop(). */
export function watchHeading(onHeading: (deg: number) => void): () => void {
  const samples: number[] = [];
  const handler = (ev: Event) => {
    const e = ev as DOE;
    let h: number | null = null;
    if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
      h = e.webkitCompassHeading; // iOS: ήδη από τον βορρά, δεξιόστροφα
    } else if (e.absolute && e.alpha != null && e.beta != null && e.gamma != null) {
      h = headingFromEuler(e.alpha, e.beta, e.gamma);
    }
    if (h == null || Number.isNaN(h)) return;
    samples.push(h);
    if (samples.length > 8) samples.shift();
    const sx = samples.reduce((a, v) => a + Math.sin((v * Math.PI) / 180), 0);
    const cx = samples.reduce((a, v) => a + Math.cos((v * Math.PI) / 180), 0);
    onHeading(((Math.atan2(sx, cx) * 180) / Math.PI + 360) % 360);
  };
  const evName = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
  window.addEventListener(evName, handler);
  return () => window.removeEventListener(evName, handler);
}

export function compassLabel(deg: number): string {
  const names = ["Β", "ΒΑ", "Α", "ΝΑ", "Ν", "ΝΔ", "Δ", "ΒΔ"];
  return names[Math.round(deg / 45) % 8];
}
