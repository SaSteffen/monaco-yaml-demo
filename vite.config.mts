"use strict";
import { defineConfig } from "vite";
import eslint from "vite-plugin-eslint";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  base: "./" /** Extremely important for the web view */,
  plugins: [svgr(), eslint()],
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    target: "esnext",
    /*
     Monaco is not small, but we leave the limit as is for everything else
     Page will load fast,though since we do not wait for the monaco import to show something
    */
    // chunkSizeWarningLimit: 3200,
    outDir: "dist",
  },
});
//# sourceMappingURL=vite.config.js.map
