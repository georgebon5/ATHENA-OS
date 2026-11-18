import * as Cesium from "cesium";
import { HEIGHT, SERAFIO_LNGLAT } from "./constants";

export interface FlyToSpec {
  lngLat: [number, number];
  heightM: number;
  headingDeg: number;
  pitchDeg: number;
  durationS: number;
  shot?: string;
}

export interface ShotSpec extends Omit<FlyToSpec, "shot"> {}

/**
 * Σετ έτοιμων κινηματογραφικών λήψεων. Ο agent μπορεί να ζητήσει
 * το όνομα μέσω camera.flyTo { shot: "orbitSerafio" } και εμείς το
 * μεταφράζουμε σε συγκεκριμένη θέση.
 */
export const SHOTS: Record<string, ShotSpec> = {
  orbitSerafio: {
    lngLat: SERAFIO_LNGLAT,
    heightM: HEIGHT.flyover,
    headingDeg: 35,
    pitchDeg: -35,
    durationS: 3.5,
  },
  diveToStreet: {
    lngLat: SERAFIO_LNGLAT,
    heightM: HEIGHT.street,
    headingDeg: 300,
    pitchDeg: -15,
    durationS: 2.5,
  },
  riseToOverview: {
    lngLat: SERAFIO_LNGLAT,
    heightM: HEIGHT.overview,
    headingDeg: 0,
    pitchDeg: -55,
    durationS: 2.5,
  },
  sideBySide: {
    lngLat: [SERAFIO_LNGLAT[0], SERAFIO_LNGLAT[1] - 0.001],
    heightM: HEIGHT.street + 60,
    headingDeg: 45,
    pitchDeg: -20,
    durationS: 2.0,
  },
};

class CameraController {
  private viewer: Cesium.Viewer | null = null;
  private orbitHandle: number | null = null;

  attach(v: Cesium.Viewer) {
    this.viewer = v;
  }

  detach() {
    this.viewer = null;
    if (this.orbitHandle !== null) {
      cancelAnimationFrame(this.orbitHandle);
      this.orbitHandle = null;
    }
  }

  /**
   * Κάνει fly προς την θέση. Αν δοθεί `shot`, το merge-άρει με τα defaults.
   */
  flyTo(spec: FlyToSpec) {
    if (!this.viewer) return;
    const merged: FlyToSpec = spec.shot && SHOTS[spec.shot]
      ? { ...SHOTS[spec.shot], ...spec }
      : spec;

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        merged.lngLat[0],
        merged.lngLat[1],
        merged.heightM,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(merged.headingDeg),
        pitch: Cesium.Math.toRadians(merged.pitchDeg),
        roll: 0,
      },
      duration: Math.max(0.1, merged.durationS),
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }

  /** Αργή περιστροφή γύρω από σημείο για το INTRO */
  startOrbit(lngLat: [number, number], heightM: number, speedDegPerSec = 6) {
    if (!this.viewer) return;
    this.stopOrbit();
    const center = Cesium.Cartesian3.fromDegrees(lngLat[0], lngLat[1], 0);
    let heading = 0;
    let last = performance.now();
    const step = (now: number) => {
      if (!this.viewer) return;
      const dt = (now - last) / 1000;
      last = now;
      heading = (heading + speedDegPerSec * dt) % 360;
      this.viewer.camera.lookAt(
        center,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(heading),
          Cesium.Math.toRadians(-30),
          heightM,
        ),
      );
      this.orbitHandle = requestAnimationFrame(step);
    };
    this.orbitHandle = requestAnimationFrame(step);
  }

  stopOrbit() {
    if (this.orbitHandle !== null) {
      cancelAnimationFrame(this.orbitHandle);
      this.orbitHandle = null;
    }
    this.viewer?.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }

  get viewerRef(): Cesium.Viewer | null {
    return this.viewer;
  }
}

export const cameraController = new CameraController();
