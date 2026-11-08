import { defineConfig, type Connect, type Plugin, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { headTags, pageMeta, prerenderBody, prerenderFile, PRERENDERED } from "./src/lib/pageMeta";

/** Two pages (R-16): index.html = the static landing page at "/", app.html = the app for every other path.
 *  Firebase Hosting does this with a rewrite (firebase.json); this plugin does the same in dev and preview. */
function appFallback(): Plugin {
  const rewrite = (outDir?: string): Connect.NextHandleFunction => (req, _res, next) => {
    const path = (req.url ?? "/").split("?")[0];
    const isFile = /\.[a-z0-9]+$/i.test(path) || path.startsWith("/@") || path.startsWith("/src/") || path.startsWith("/node_modules/");
    if (["/glossary", "/model", "/data", "/evals"].includes(path)) req.url = `${path}.html`; // generated semantic pages
    else if (outDir && !isFile && existsSync(resolve(outDir, prerenderFile(path)))) req.url = `/${prerenderFile(path)}`; // preview: built pages
    else if (path !== "/" && !isFile) req.url = "/app.html";
    next();
  };
  return {
    name: "app-fallback",
    configureServer: (server) => void server.middlewares.use(rewrite()),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite(server.config.build.outDir)),
  };
}

/** One HTML file per public app page (lib/pageMeta.ts): the app shell with the page's own title, description and
 *  canonical address, and a short text in #root until the app has loaded. Without them search engines see the
 *  same empty shell on every page (Search Console: "Discovered - currently not indexed", "Duplicate"). */
function prerenderPages(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "prerender-pages",
    apply: "build",
    configResolved: (c) => void (config = c),
    closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      const shell = readFileSync(resolve(outDir, "app.html"), "utf8");
      if (!shell.includes("<title>Wardrobe Diary</title>") || !shell.includes('<div id="root"></div>')) {
        throw new Error("prerender-pages: app.html no longer has the expected <title> and #root");
      }
      for (const route of PRERENDERED) {
        const meta = pageMeta(route);
        const html = shell
          .replace("<title>Wardrobe Diary</title>", headTags(meta))
          .replace('<div id="root"></div>', `<div id="root">${prerenderBody(route)}</div>`);
        const file = resolve(outDir, prerenderFile(meta.canonical!));
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), appFallback(), prerenderPages()],
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
          // Tap-to-select (R-50): transformers.js and the ONNX runtime, loaded only when the owner selects a garment.
          if (/node_modules\/(@huggingface|onnxruntime-web|onnxruntime-common)\//.test(id)) return "segmenter";
          return "vendor";
        },
      },
    },
  },
});
