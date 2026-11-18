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
        athena: "#7bd1ff",
        athenaDeep: "#2d7fb8",
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
      },
      animation: {
        breathe: "breathe 3.4s ease-in-out infinite",
        pulseRing: "pulseRing 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};
