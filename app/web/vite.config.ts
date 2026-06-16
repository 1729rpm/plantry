import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Plantry",
        short_name: "Plantry",
        description: "Weekly meal planner for the Mudgal household.",
        theme_color: "#bc5430",
        background_color: "#f7f2e9",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "/index.html",
        // A new deploy's service worker must take control on the next load
        // rather than waiting for every tab to close, so a device cannot keep
        // serving a stale precached CSS bundle after a fix ships. Vite
        // content-hashes the CSS, so any edit changes the precache manifest;
        // skipWaiting activates the new worker immediately and clientsClaim
        // makes it control already-open clients. autoUpdate mode sets these by
        // default; pinning them here keeps the behaviour explicit so it cannot
        // silently regress if registerType or strategies change later.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
