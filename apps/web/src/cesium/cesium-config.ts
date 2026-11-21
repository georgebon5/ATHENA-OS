// Παγκόσμια ρύθμιση του Cesium για το Vite dev/prod build.
// Το CESIUM_BASE_URL έρχεται από το vite.config.ts via define().
declare const CESIUM_BASE_URL: string;

// Το Cesium ψάχνει το base URL μέσω window.CESIUM_BASE_URL.
if (typeof window !== "undefined") {
  (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL =
    CESIUM_BASE_URL;
}

// Προαιρετικά tokens — αν δεν υπάρχουν, κάνουμε graceful fallback σε OSM.
export const CESIUM_ION_TOKEN =
  (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) ?? "";
export const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";

export const WS_URL =
  // || και όχι ??: το .env.example αφήνει «VITE_WS_URL=» κενό, που πρέπει να σημαίνει default
  (import.meta.env.VITE_WS_URL as string | undefined) ||
  (() => {
    if (typeof window === "undefined") return "ws://localhost:8000/ws";
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    const port =
      (import.meta.env.VITE_GATEWAY_PORT as string | undefined) || "8000";
    return `${proto}://${host}:${port}/ws`;
  })();
