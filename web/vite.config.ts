import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Two pages (R-16): index.html = the static landing page at "/", app.html = the app for every other path.
 *  Firebase Hosting does this with a rewrite (firebase.json); this plugin does the same in dev and preview. */
function appFallback(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = (req.url ?? "/").split("?")[0];
    const isFile = /\.[a-z0-9]+$/i.test(path) || path.startsWith("/@") || path.startsWith("/src/") || path.startsWith("/node_modules/");
    if (["/glossary", "/model", "/data", "/evals"].includes(path)) req.url = `${path}.html`; // generated semantic pages
    else if (path !== "/" && !isFile) req.url = "/app.html";
    next();
  };
  return {
    name: "app-fallback",
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

export default defineConfig({
  plugins: [react(), appFallback()],
  appType: "mpa",
  build: {
    // The firebase chunk (~625 kB, ~185 kB gzipped: Auth + Firestore) is needed by every visit, so splitting it
    // further would not load less; it is cached across deploys.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: { index: "index.html", app: "app.html", glossary: "glossary.html", model: "model.html", data: "data.html", evals: "evals.html" },
      output: {
        // Libraries in their own files (R-18): they change rarely, so browsers keep them cached across deploys
        // of the app's own code. Pages are split separately by the lazy imports in App.tsx.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Storage is only for uploads (loaded on demand in firebase.ts), so it gets its own file.
          if (/node_modules\/(@firebase\/storage|firebase\/storage)\//.test(id)) return "firebase-storage";
          if (/node_modules\/(@firebase|firebase|idb|re2js)\//.test(id)) return "firebase";
          if (/node_modules\/(@observablehq|d3-|d3\/|internmap|delaunator|robust-predicates|interval-tree-1d|isoformat|binary-search-bounds)/.test(id)) return "plot";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          return "vendor";
        },
      },
    },
  },
});
