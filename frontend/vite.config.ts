import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
// @ts-ignore
import { execSync } from "node:child_process";

let gitCommitHash = "dev";
try {
  gitCommitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  gitCommitHash = "unknown";
}

export default defineConfig({
  base: "/TongXuan-Chinese/",
  define: {
    __GIT_COMMIT_HASH__: JSON.stringify(gitCommitHash),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "TongXuan Chinese",
        short_name: "TongXuan",
        start_url: "/TongXuan-Chinese/",
        scope: "/TongXuan-Chinese/",
        display: "standalone",
        background_color: "#f4f4ed",
        theme_color: "#2e746a",
        icons: []
      }
    })
  ],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } }
  },
  preview: {
    port: 4173,
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } }
  }
});
