import { useEffect, useRef } from "react";
import "./cesium-config";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { CESIUM_ION_TOKEN, GOOGLE_MAPS_API_KEY } from "./cesium-config";
import { SERAFIO_LNGLAT, HEIGHT } from "./constants";
import { cameraController } from "./cameraShots";

interface Props {
  onReady?: (viewer: Cesium.Viewer) => void;
}

/**
 * Το πυρήνας του demo — ένας Cesium viewer στην Πειραιώς με κινηματογραφική
 * αισθητική. Κρύβουμε όλο το default chrome μέσω CSS· εδώ ρυθμίζουμε
 * lighting, fog, atmosphere και το base imagery/terrain.
 */
export function CesiumViewer({ onReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewerRef.current) return;

    if (CESIUM_ION_TOKEN) {
      Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;
    }

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      vrButton: false,
      selectionIndicator: false,
      infoBox: false,
      shouldAnimate: true,
      skyBox: false,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      // Default imagery = OSM (δεν θέλει token). Αν υπάρχει Google key,
      // το Photorealistic 3D Tiles καλύπτει την πόλη από πάνω.
      baseLayer: new Cesium.ImageryLayer(
        new Cesium.OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        }),
        {},
      ),
    });

    viewerRef.current = viewer;
    const scene = viewer.scene;
    scene.globe.enableLighting = true;
    scene.globe.dynamicAtmosphereLighting = true;
    scene.globe.showGroundAtmosphere = true;
    scene.fog.enabled = true;
    scene.fog.density = 0.0008;
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.hueShift = -0.05;
      scene.skyAtmosphere.saturationShift = 0.05;
      scene.skyAtmosphere.brightnessShift = -0.08;
    }
    scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b0f14");
    scene.backgroundColor = Cesium.Color.fromCssColorString("#06090d");

    // Αν υπάρχει κλειδί Google, βάλε Photorealistic 3D Tiles.
    // Αλλιώς πέφτει σε Cesium OSM Buildings (μέσω Ion asset 96188).
    (async () => {
      try {
        if (GOOGLE_MAPS_API_KEY) {
          const tileset = await Cesium.createGooglePhotorealistic3DTileset({
            key: GOOGLE_MAPS_API_KEY,
          });
          scene.primitives.add(tileset);
        } else if (CESIUM_ION_TOKEN) {
          const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
          scene.primitives.add(tileset);
        }
      } catch (err) {
        console.warn("[cesium] 3D tileset load failed, συνεχίζουμε με terrain", err);
      }
    })();

    // Κινηματογραφική εισαγωγή: κοιτάμε στο Σεράφειο από ψηλά
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        SERAFIO_LNGLAT[0],
        SERAFIO_LNGLAT[1] - 0.004,
        HEIGHT.overview,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
    });

    cameraController.attach(viewer);
    onReady?.(viewer);

    return () => {
      cameraController.detach();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [onReady]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
