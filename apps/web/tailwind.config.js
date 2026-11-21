/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#06090d",
        slab: "#0b0f14",
        rail: "#121820",
        chalk: "#e8edf2",
        // Παλέτα Δήμου Αθηναίων (cityofathens.gr): navy #05315D, μπλε #0A51A0, γαλάζιο #79B7E4, λευκό
        athena: "#79b7e4",
        athenaDeep: "#0a51a0",
        holo: "#79b7e4",
        plasma: "#ffffff",
        void: "#05315d",
        solar: "#0a51a0",
        hot: "#ff6a4c",
        cool: "#55e6c1",
        warn: "#ffcc5c",
      },
      fontFamily: {
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 24px rgba(123,209,255,0.35)",
        glowStrong: "0 0 48px rgba(123,209,255,0.55)",
        card: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(123,209,255,0.08) inset",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        breathe: {
          "0%,100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.6)", opacity: "0.9" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        breathe: "breathe 3.4s ease-in-out infinite",
        pulseRing: "pulseRing 1.6s ease-out infinite",
        scan: "scan 2.6s linear infinite",
        float: "float 5s ease-in-out infinite",
        fadeUp: "fadeUp 0.3s ease-out forwards",
      },
    },
  },
  plugins: [],
};
