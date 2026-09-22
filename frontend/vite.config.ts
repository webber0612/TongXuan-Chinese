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
        name: "TongXuan Chinese Diagnostics",
        short_name: "TongXuan",
        start_url: "/diagnostics",
        display: "standalone",
        background_color: "#fffaf2",
        theme_color: "#7b3f00",
        icons: []
      }
    })
  ],
  server: { port: 5173 },
  preview: { port: 4173 }
});
