import { copyFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(frontend, "node_modules", "hanzi-writer-data");
const destination = join(frontend, "public", "hanzi");
const order = JSON.parse(await readFile(resolve(frontend, "..", "shared", "curriculum", "book1-character-order.json"), "utf8"));
const simplified = JSON.parse(await readFile(join(frontend, "scripts", "book1-simplified-map.json"), "utf8"));
const traditional = new Set(order.stages.flatMap((stage) => stage.lessons.flatMap((lesson) => lesson.characters)));
const characters = new Set([...traditional, ...[...traditional].map((character) => simplified[character] ?? character)]);

if (traditional.size !== 246 || [...traditional].some((character) => [...character].length !== 1)) {
  throw new Error(`Expected 246 unique single-character TBCL level-1 entries; found ${traditional.size}`);
}
const unknown = Object.keys(simplified).filter((character) => !traditional.has(character));
if (unknown.length) throw new Error(`Simplified map contains characters outside Book 1: ${unknown.join("、")}`);

const missing = [];
for (const character of characters) {
  try { await readFile(join(source, `${character}.json`)); }
  catch { missing.push(character); }
}
if (missing.length) throw new Error(`hanzi-writer-data is missing: ${missing.join("、")}`);

await mkdir(destination, { recursive: true });
for (const character of characters) await copyFile(join(source, `${character}.json`), join(destination, `${character}.json`));
await copyFile(join(source, "ARPHICPL.TXT"), join(destination, "LICENSE"));
console.log(`Copied ${characters.size} Book 1 stroke files and Arphic license.`);
