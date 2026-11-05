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
    // Remove Hanzi Writer's bundled CDN fallback; every production caller supplies
    // charDataLoader, and an unexpected fallback must remain same-origin.
    {
      name: "local-hanzi-writer-fallback",
      enforce: "pre",
      transform(code, id) {
        if (!/[\\/]hanzi-writer[\\/]dist[\\/]index\.esm\.js$/.test(id)) return;
        const remote = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@${VERSION}/${char}.json";
        if (!code.includes(remote)) throw new Error("Hanzi Writer CDN fallback changed; update local loader boundary");
        return code.replace(remote, "/TongXuan-Chinese/hanzi/${char}.json");
      }
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html}", "audio/**/*.{mp3,json}", "hanzi/*.json", "manifest.webmanifest"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
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
