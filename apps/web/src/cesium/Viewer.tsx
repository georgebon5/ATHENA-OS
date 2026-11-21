import { useEffect, useRef } from "react";
import "./cesium-config";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { CESIUM_ION_TOKEN, GOOGLE_MAPS_API_KEY } from "./cesium-config";
import { SERAFIO_LNGLAT, HEIGHT } from "./constants";
import { cameraController } from "./cameraShots";
import { useStore } from "@/store/useStore";

const SENSOR_FILTER = {
  normal: "none",
  flir:   "grayscale(1) invert(1) sepia(1) saturate(6) hue-rotate(293deg) contrast(1.35) brightness(0.88)",
  nvg:    "grayscale(1) brightness(1.6) contrast(1.9) sepia(1) hue-rotate(72deg) saturate(3.5)",
};

interface Props {
  onReady?: (viewer: Cesium.Viewer) => void;
}

/**
 * Τα layers (θερμικό 2 m, δέντρα σεναρίου, κάμερα «close» 50 m…) υποθέτουν έδαφος στο 0 m του ellipsoid,
 * αλλά στα 3D tiles ο δρόμος στο Σεράφειο είναι ~72 m (median 25 σημείων άξονα δρόμων σε ακτίνα 300 m,
 * sampleHeightMostDetailed 21/11). Κατεβάζουμε όλο το tileset τόσο, ώστε ο δρόμος να πέσει στο ~0.
 * ponytail: ένα offset για όλη την περιοχή: ±5 m γύρω από το Σεράφειο, ±20 m στις άκρες του bbox (λόφοι).
 * Για ακρίβεια παντού: ύψη σχετικά με το έδαφος (heightReference) σε κάθε layer.
 */
const TILES_GROUND_M = 72;

function lowerToStreetLevel(tileset: Cesium.Cesium3DTileset) {
  const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
    Cesium.Cartesian3.fromDegrees(SERAFIO_LNGLAT[0], SERAFIO_LNGLAT[1]),
    new Cesium.Cartesian3(),
  );
  tileset.modelMatrix = Cesium.Matrix4.fromTranslation(
    Cesium.Cartesian3.multiplyByScalar(up, -TILES_GROUND_M, up),
  );
}

/**
 * ESRI World Imagery — δορυφορικό HD, χωρίς API key.
 * Σκοτεινότερο, λιγότερο κορεσμένο: τα ολογραφικά layers (κυκλοφορία, θερμικό, ψήφοι) «λάμπουν» από πάνω.
 */
function buildSatelliteLayer(): Cesium.ImageryLayer {
  return new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maximumLevel: 19,
      credit: new Cesium.Credit(
        "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        false,
      ),
    }),
    { brightness: 0.78, contrast: 1.18, saturation: 0.6, gamma: 1.05 },
  );
}

export function CesiumViewer({ onReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const sensorMode = useStore((s) => s.sensorMode);

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
      skyBox: new Cesium.SkyBox({
        sources: {
          positiveX: "https://cesium.com/downloads/cesiumjs/releases/1.147/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
          negativeX: "https://cesium.com/downloads/cesiumjs/releases/1.147/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg",
          positiveY: "https://cesium.com/downloads/cesiumjs/releases/1.147/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg",
          negativeY: "https://cesium.com/downloads/cesiumjs/releases/1.147/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg",
          positiveZ: "https://cesium.com/downloads/cesiumjs/releases/1.147/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg",
          negativeZ: "https://cesium.com/downloads/cesiumjs/releases/1.147/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg",
        },
      }),
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      baseLayer: buildSatelliteLayer(),
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });

    viewerRef.current = viewer;
    const scene = viewer.scene;

    // ── Φωτισμός & ατμόσφαιρα ─────────────────────────────────────────────
    scene.globe.enableLighting = true;
    scene.globe.dynamicAtmosphereLighting = true;
    scene.globe.dynamicAtmosphereLightingFromSun = true;
    scene.globe.showGroundAtmosphere = true;
    scene.globe.atmosphereLightIntensity = 10.0;

    scene.fog.enabled = true;
    scene.fog.density = 0.0006;
    scene.fog.minimumBrightness = 0.3;

    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.hueShift = -0.03;
      scene.skyAtmosphere.saturationShift = 0.1;
      scene.skyAtmosphere.brightnessShift = 0.05;
    }

    // Σκιές ηλίου: κλειστές by default (το shadow pass ξαναζωγραφίζει όλα τα 3D tiles κάθε frame).
    // Τις ανάβει το SunClock μόλις έρθει time.set (π.χ. «καύσωνας Ιουλίου»). Χωρίς soft = φθηνότερες.
    viewer.shadows = false;
    scene.shadowMap.enabled = false;
    scene.shadowMap.softShadows = false;
    scene.shadowMap.size = 2048;

    // Anti-aliasing
    scene.postProcessStages.fxaa.enabled = true;

    // ── Overlay: ονόματα δρόμων (ESRI Reference) ─────────────────────────
    const labelsLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 19,
        credit: new Cesium.Credit("Esri", false),
      }),
    );
    labelsLayer.alpha = 0.5;

    // ── 3D Assets (async, προαιρετικά) ───────────────────────────────────
    (async () => {
      // 16 = default Cesium. 8 = ένα επίπεδο λεπτομέρειας πάνω, αλλά περισσότερα tiles/FPS κόστος
      // + cache/collision που βάζει το createGooglePhotorealistic3DTileset και χάνονται στο fromIonAssetId
      const detail = {
        maximumScreenSpaceError: 16,
        cacheBytes: 1536 * 1024 * 1024,
        maximumCacheOverflowBytes: 1024 * 1024 * 1024,
        enableCollision: true,
      };
      try {
        if (GOOGLE_MAPS_API_KEY || CESIUM_ION_TOKEN) {
          // Google Photorealistic 3D Tiles — με δικό μας key, αλλιώς μέσω Cesium ion (asset 2275207).
          // Τα EEA Google projects παίρνουν 403 απευθείας, άρα στην Ελλάδα δουλεύει μόνο το ion.
          // fromIonAssetId και όχι createGooglePhotorealistic3DTileset χωρίς key: εκείνο μοιράζεται ένα cached
          // Resource και το διπλό mount του StrictMode σκάει με «The Resource is already being fetched».
          const tileset = GOOGLE_MAPS_API_KEY
            ? await Cesium.createGooglePhotorealistic3DTileset({ key: GOOGLE_MAPS_API_KEY }, detail)
            : await Cesium.Cesium3DTileset.fromIonAssetId(2275207, detail);
          if (viewer.isDestroyed()) {
            tileset.destroy();
            return;
          }
          lowerToStreetLevel(tileset);
          scene.primitives.add(tileset);
          // Τα Google tiles έχουν δικό τους έδαφος: κρύβουμε όλη τη σφαίρα (satellite + labels), όπως
          // προτείνει το Cesium — αλλιώς ζωγραφίζεται και κατεβαίνει imagery κάτω από τα tiles χωρίς να φαίνεται
          scene.globe.show = false;
          return;
        }
      } catch (err) {
        console.warn("[cesium] Google 3D tiles failed, fallback σε OSM Buildings:", err);
      }
      if (!CESIUM_ION_TOKEN) return;
      // Fallback: OSM Buildings (γκρι, χωρίς textures). Χωρίς World Terrain: όπως και τα Google tiles,
      // κατεβαίνουν στο επίπεδο του δρόμου ώστε τα layers να κάθονται στο 0 m της επίπεδης σφαίρας.
      const buildings = await Cesium.Cesium3DTileset.fromIonAssetId(96188).catch(() => null);
      if (viewer.isDestroyed() || !buildings) return;
      lowerToStreetLevel(buildings);
      scene.primitives.add(buildings);
    })();

    // ── Αρχική κάμερα: Σεράφειο fly-in ───────────────────────────────────
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        SERAFIO_LNGLAT[0],
        SERAFIO_LNGLAT[1] - 0.005,
        HEIGHT.overview,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-40),
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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 transition-[filter] duration-700"
      style={{ filter: SENSOR_FILTER[sensorMode] }}
    />
  );
}
