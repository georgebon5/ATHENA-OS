import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Το citizen app σερβίρεται από τον gateway στο /c (ένα origin, ένα tunnel).
// Στο dev, ο Vite κάνει proxy τα /api, /media, /ws στον gateway.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gateway = env.VITE_GATEWAY_PROXY || "http://localhost:8000";
  return {
    base: "/c/",
    plugins: [react()],
    server: {
      port: 5174,
      host: true,
      proxy: {
        "/api": gateway,
        "/media": gateway,
        "/ws": { target: gateway.replace(/^http/, "ws"), ws: true },
      },
    },
    build: {
      target: "es2019",
      cssCodeSplit: false,
      reportCompressedSize: true,
    },
  };
});
