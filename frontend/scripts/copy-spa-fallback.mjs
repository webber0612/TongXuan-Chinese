import { copyFile, mkdir } from "node:fs/promises";

const indexPath = new URL("../dist/index.html", import.meta.url);

// 404 fallback for unknown paths
await copyFile(indexPath, new URL("../dist/404.html", import.meta.url));

// Pre-create directory index.html for all known SPA routes
// This prevents GitHub Pages from serving 404 status codes on direct navigation or refresh
const routes = [
  "parent-dashboard",
  "practice",
  "curriculum",
  "course-zero",
  "first-lesson",
  "learning-session",
  "tutor",
  "admin/commercialization",
  "diagnostics",
  "settings",
  "me",
  "kids"
];

for (const route of routes) {
  const targetDir = new URL(`../dist/${route}/`, import.meta.url);
  await mkdir(targetDir, { recursive: true });
  await copyFile(indexPath, new URL(`../dist/${route}/index.html`, import.meta.url));
}
