/** @type {import('tailwindcss').Config} */
// ATHENA OS · «golden hour» design system: η Αθήνα στο ηλιοβασίλεμα. Τα παλιά ονόματα (ink, athena, cool, hot…) δείχνουν
// στη νέα παλέτα, ώστε κάθε component να ακολουθεί αυτόματα.
const holo = "#ff5fb8";
const plasma = "#ffa043";
const aurora = "#2ee6c9";
const solar = "#ffd84d";
const flare = "#ff4b3e";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0c0614",
        ink: "#0c0614",
        abyss: "#120a1c",
        slab: "#160c22",
        rail: "#241433",
        chalk: "#fff1ea",
        holo,
        plasma,
        aurora,
        solar,
        flare,
        athena: holo,
        athenaDeep: "#e0489c",
        cool: aurora,
        warn: solar,
        hot: flare,
      },
      fontFamily: {
        display: ["Fira Sans Extra Condensed", "Fira Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Fira Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(255,95,184,0.35)",
        glowStrong: "0 0 48px rgba(255,95,184,0.55)",
        plasma: "0 0 32px rgba(255,160,67,0.45)",
      },
      keyframes: {
        breathe: {
          "0%,100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.6)", opacity: "0.9" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
        spinRev: { to: { transform: "rotate(-360deg)" } },
        scan: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(2400%)", opacity: "0" },
        },
        flicker: {
          "0%": { opacity: "0" },
          "8%": { opacity: "0.9" },
          "12%": { opacity: "0.25" },
          "20%": { opacity: "1" },
          "26%": { opacity: "0.6" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        rise: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        breathe: "breathe 3.4s ease-in-out infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        "spin-slow": "spin 14s linear infinite",
        "spin-slower": "spinRev 22s linear infinite",
        "spin-fast": "spin 3.2s linear infinite",
        scan: "scan 2.4s cubic-bezier(.4,0,.2,1) 1",
        flicker: "flicker 0.7s steps(1) 1 both",
        shimmer: "shimmer 3.5s linear infinite",
        blink: "blink 1.1s steps(1) infinite",
        rise: "rise 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};
