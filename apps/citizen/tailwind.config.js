/** @type {import('tailwindcss').Config} */
// Ίδια παλέτα με την κεντρική οθόνη (apps/web), αλλά σε ανοιχτό φόντο: τα κινητά θα είναι και στον ήλιο.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#06090d",
        slab: "#0b0f14",
        paper: "#f3f6f9",
        line: "#dbe3ea",
        muted: "#4a5866",
        athena: "#7bd1ff",
        athenaDeep: "#1f6fa6",
        yes: "#0b7f63",
        no: "#c23a20",
        maybe: "#8a5d00",
        hot: "#ff6a4c",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(6,9,13,0.06), 0 8px 24px rgba(6,9,13,0.08)",
        glow: "0 0 24px rgba(123,209,255,0.45)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.6)", opacity: "0.9" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        rise: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        drop: {
          "0%": { transform: "translateY(-40px) scale(0.6)", opacity: "0" },
          "60%": { transform: "translateY(4px) scale(1.05)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
        rise: "rise 0.45s ease-out both",
        drop: "drop 0.7s cubic-bezier(.2,.9,.3,1.2) both",
      },
    },
  },
  plugins: [],
};
