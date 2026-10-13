import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // The firebase chunk (~625 kB, ~185 kB gzipped: Auth + Firestore) is needed by every visit, so splitting it
    // further would not load less; it is cached across deploys.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
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
