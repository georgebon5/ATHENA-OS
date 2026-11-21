/** @type {import('tailwindcss').Config} */
// ATHENA OS · minimal dark design system (à la Linear / Vercel).
// Μία παλέτα κοντά στο ουδέτερο + ΕΝΑ restrained cool accent.
// Τα legacy ονόματα (holo, plasma, aurora, athena…) χαρτογραφούνται στο ίδιο token
// ώστε κανένα component να μη χρειάζεται refactor.
const accent = "#7FB2FF";         // soft cold blue — το μοναδικό «χρώμα» του UI
const accentDeep = "#4F86D5";
const success = "#5EE0B0";        // μόνο για positive deltas σε νούμερα
const warn = "#E6C06B";           // μόνο για warn
const danger = "#E66B6B";         // μόνο για αρνητικά deltas / errors

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Νέα ονόματα
        void: "#08090B",
        ink: "#08090B",
        abyss: "#0B0C0F",
        slab: "#111216",
        rail: "#1A1C21",
        chalk: "#F5F5F7",
        accent,
        accentDeep,
        success,
        warn,
        danger,
        // Legacy ονόματα — όλα δείχνουν στο ουδέτερο / accent
        holo: accent,
        plasma: accent,
        aurora: success,
        solar: warn,
        flare: danger,
        athena: accent,
        athenaDeep: accentDeep,
        cool: success,
        hot: danger,
      },
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 8px 32px -8px rgba(0,0,0,0.6)",
        cardStrong: "0 20px 60px -12px rgba(0,0,0,0.8)",
        glow: "0 0 0 1px rgba(127,178,255,0.3)",
        glowStrong: "0 0 0 1px rgba(127,178,255,0.5)",
        plasma: "0 8px 32px -8px rgba(0,0,0,0.6)",
      },
      keyframes: {
        breathe: {
          "0%,100%": { transform: "scale(1)", opacity: "0.88" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.8)", opacity: "0.5" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
        spinRev: { to: { transform: "rotate(-360deg)" } },
        scan: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "15%": { opacity: "0.6" },
          "100%": { transform: "translateY(2400%)", opacity: "0" },
        },
        flicker: {
          "0%": { opacity: "0.5" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        rise: {
          "0%": { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        breathe: "breathe 4s ease-in-out infinite",
        pulseRing: "pulseRing 2s ease-out infinite",
        "spin-slow": "spin 14s linear infinite",
        "spin-slower": "spinRev 22s linear infinite",
        "spin-fast": "spin 3.2s linear infinite",
        scan: "scan 2.4s cubic-bezier(.4,0,.2,1) 1",
        flicker: "flicker 0.3s ease-out both",
        shimmer: "shimmer 3.5s linear infinite",
        blink: "blink 1.1s steps(1) infinite",
        rise: "rise 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};
