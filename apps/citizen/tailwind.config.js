/** @type {import('tailwindcss').Config} */
// Ίδια ταυτότητα «golden hour» με την κεντρική οθόνη (apps/web). Σκούρο φόντο με υψηλή αντίθεση:
// κείμενο #ffffff πάνω σε #031b35, και σκούρο κείμενο πάνω στα φωτεινά κουμπιά.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#031b35",
        ink: "#031b35",
        slab: "#052648",
        card: "#072c52",
        paper: "#06284c",
        line: "#1b4d80",
        chalk: "#ffffff",
        muted: "#a9c7e3",
        holo: "#79b7e4",
        plasma: "#ffffff",
        athena: "#79b7e4",
        athenaDeep: "#79b7e4",
        yes: "#2ee6c9",
        no: "#ff4b3e",
        maybe: "#ffd84d",
        hot: "#ff4b3e",
        solar: "#ffd84d",
      },
      fontFamily: {
        sans: ["Fira Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Fira Sans Extra Condensed", "Fira Sans", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(121, 183, 228,0.14) inset, 0 18px 50px -20px rgba(0,0,0,0.9)",
        glow: "0 0 24px rgba(121, 183, 228,0.45)",
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
        spin: { to: { transform: "rotate(360deg)" } },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        breathe: {
          "0%,100%": { opacity: "0.7", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
        rise: "rise 0.45s ease-out both",
        drop: "drop 0.7s cubic-bezier(.2,.9,.3,1.2) both",
        "spin-slow": "spin 12s linear infinite",
        shimmer: "shimmer 3.5s linear infinite",
        breathe: "breathe 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
