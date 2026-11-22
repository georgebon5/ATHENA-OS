import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Διαβάζει το LLM_API_KEY από το .env στη ρίζα του monorepo */
function loadLlmKey(): string {
  try {
    const envPath = resolve(__dirname, "../../.env");
    const content = readFileSync(envPath, "utf-8");
    return content.match(/^LLM_API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  } catch { return ""; }
}

const ATHENA_SYSTEM = `Είσαι η ATHENA, η τεχνητή νοημοσύνη του Δήμου Αθηναίων. Απαντάς ΠΑΝΤΑ στα ελληνικά.
Είσαι ενημερωτική και δίνεις χρήσιμες λεπτομέρειες (2-3 προτάσεις). Η απάντησή σου εμφανίζεται ως υπότιτλος στον 3D χάρτη.
Η περιοχή σου: Πειραιώς / Γκάζι / Κεραμεικός / Θησείο.

Ο χρήστης μπορεί να σου δώσει context σε JSON (αριθμό αναφορών, κατηγορίες, σοβαρότητα). Χρησιμοποίησέ τα στην απάντηση.

Αποφάσισε τι ενέργεια ταιριάζει:
- "simulate": θέλει να δει σενάριο αλλαγής (δρόμος, λωρίδα, δέντρα, πεζοδρόμηση, ποδηλατόδρομος)
- "thermal": ρωτά για θερμοκρασία, καύσωνα, hotspot, σκιά, ήλιο
- "sense": αναφέρεται σε πρόβλημα πόλης (λακκούβα, σκουπίδια, φωτισμός)
- "reports": θέλει να δει αναφορές, αιτήματα, επείγοντα, τα πιο σοβαρά
- "impact": θέλει να δει αντίκτυπο, αποτελέσματα, εξοικονόμηση, ROI, στατιστικά, KPIs, απόδοση
- "chat": οτιδήποτε άλλο (χαιρετισμός, γενική ερώτηση)

Αν η ενέργεια είναι "reports", δώσε συνοπτική ανάλυση (πόσα, τι κατηγορίες, ποια η πιο σοβαρή).

Απάντησε ΜΟΝΟ με JSON (χωρίς markdown): {"text": "...", "action": "simulate"|"thermal"|"sense"|"reports"|"impact"|"chat", "mood": "neutral"|"alert"|"proud"}`;

/** Vite plugin: POST /api/athena-chat → Claude API (server-side, key ασφαλές) */
function athenaAgentPlugin(): Plugin {
  const apiKey = loadLlmKey();
  return {
    name: "athena-agent",
    configureServer(server) {
      server.middlewares.use("/api/athena-chat", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        if (!apiKey) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "LLM_API_KEY not set" }));
          return;
        }
        let body = "";
        req.on("data", (c: Buffer) => { body += c.toString(); });
        req.on("end", async () => {
          try {
            const { text, context } = JSON.parse(body) as { text: string; context?: string };
            const userContent = context ? `${text}\n\n[Τρέχουσα κατάσταση: ${context}]` : text;
            const r = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 200,
                system: ATHENA_SYSTEM,
                messages: [{ role: "user", content: userContent }],
              }),
            });
            if (!r.ok) {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: "LLM API error", status: r.status }));
              return;
            }
            const data = await r.json() as { content: { type: string; text: string }[] };
            let raw = data.content?.[0]?.text ?? "";
            // Strip markdown code fences if present
            raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            const parsed = JSON.parse(raw);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(parsed));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

// Το Cesium χρειάζεται τα static assets (workers, widgets, assets, ThirdParty)
// να εξυπηρετούνται από το /cesium/ στο runtime.
export default defineConfig({
  plugins: [
    react(),
    athenaAgentPlugin(),
    viteStaticCopy({
      targets: [
        { src: "node_modules/cesium/Build/Cesium/Workers", dest: "cesium" },
        { src: "node_modules/cesium/Build/Cesium/ThirdParty", dest: "cesium" },
        { src: "node_modules/cesium/Build/Cesium/Assets", dest: "cesium" },
        { src: "node_modules/cesium/Build/Cesium/Widgets", dest: "cesium" },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium/"),
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/ckan-proxy": {
        target: "https://opendata.cityofathens.gr",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ckan-proxy/, ""),
        secure: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 4096,
  },
});
