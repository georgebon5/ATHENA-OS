import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useStore } from "@/store/useStore";

interface Props {
  viewer: Cesium.Viewer | null;
}

type CamPos = {
  lng: number; lat: number; heightM: number;
  headingDeg: number; pitchDeg: number; durationS: number;
};

const BEAT_CAM: Partial<Record<string, CamPos>> = {
  INTRO:    { lng: 23.7083, lat: 37.9820, heightM: 1800, headingDeg: -20, pitchDeg: -38, durationS: 4.0 },
  SENSE:    { lng: 23.7083, lat: 37.9774, heightM: 230,  headingDeg: 10,  pitchDeg: -28, durationS: 2.8 },
  SIMULATE: { lng: 23.7083, lat: 37.9790, heightM: 430,  headingDeg: -5,  pitchDeg: -40, durationS: 2.2 },
  ENGAGE:   { lng: 23.7100, lat: 37.9795, heightM: 700,  headingDeg:  5,  pitchDeg: -44, durationS: 2.2 },
  DECISION: { lng: 23.7083, lat: 37.9810, heightM: 1100, headingDeg:  0,  pitchDeg: -50, durationS: 2.8 },
  CLOSE:    { lng: 23.7083, lat: 37.9820, heightM: 1800, headingDeg: -20, pitchDeg: -38, durationS: 3.5 },
};

function flyTo(viewer: Cesium.Viewer, c: CamPos) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, c.heightM),
    orientation: {
      heading: Cesium.Math.toRadians(c.headingDeg),
      pitch:   Cesium.Math.toRadians(c.pitchDeg),
      roll: 0,
    },
    duration: c.durationS,
    easingFunction: Cesium.EasingFunction.SINUSOIDAL_IN_OUT,
  });
}

export function CameraDirector({ viewer }: Props) {
  const beat = useStore((s) => s.beat);
  const didInit = useRef(false);

  // Cinematic startup fly to Σεράφειο/Πειραιώς on viewer ready
  useEffect(() => {
    if (!viewer || didInit.current) return;
    didInit.current = true;
    flyTo(viewer, BEAT_CAM.INTRO!);
  }, [viewer]);

  // Follow each beat change
  useEffect(() => {
    if (!viewer) return;
    const c = BEAT_CAM[beat];
    if (c) flyTo(viewer, c);
  }, [beat, viewer]);

  return null;
}
