import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { BRAND } from "./brand.config";

// Base path for asset URLs. GitHub Pages serves a project site under
// /<repo>/, so the CI build sets VITE_BASE=/StallOrigins/. Defaults to "/"
// for local dev and root-hosted deploys.
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: BRAND.name,
        short_name: BRAND.shortName,
        description: BRAND.description,
        theme_color: BRAND.themeColor,
        background_color: "#ffffff",
        display: "standalone",
        // Relative paths so the app works under any base (root or /<repo>/).
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cache map tiles so repeat views cost zero requests and work offline.
        // Matches any configured raster tile host (see src/map/tileSource.ts).
        runtimeCaching: [
          {
            // Match tile requests like .../{z}/{x}/{y}.png on any tile host.
            urlPattern: /\/\d+\/\d+\/\d+\.(png|jpg|webp)(\?.*)?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
