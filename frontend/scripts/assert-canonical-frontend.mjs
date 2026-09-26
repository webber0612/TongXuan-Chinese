import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.resolve(root, "src");
const archiveRoot = path.resolve(root, "archive", "previews");
const distRoot = path.resolve(root, "dist");
const codeExtensions = [".tsx", ".ts", ".jsx", ".js"];
const historicalComponents = [
  "DesignPreviewPage",
  "DesignPreviewBPage",
  "DesignPreviewPixelPage",
  "DesignPreviewReferencePage",
  "DesignPreviewDirectionsPage",
  "LearningDeskPreviewPage",
  "LearningCalendarPreviewPage",
];

function isWithin(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function resolveLocalPath(specifier, importer) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = path.extname(base)
    ? [base]
    : [...codeExtensions.map((extension) => `${base}${extension}`), ...codeExtensions.map((extension) => path.join(base, `index${extension}`))];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function localImports(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const imports = [];
  const collect = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);
  return imports;
}

const activeArchiveSource = walkFiles(archiveRoot).filter((filePath) => filePath.toLowerCase().endsWith(".tsx"));
if (activeArchiveSource.length > 0) {
  throw new Error(`Executable archived React sources remain: ${activeArchiveSource.map((filePath) => path.relative(root, filePath)).join(", ")}`);
}

const visited = new Set();
function visit(filePath) {
  const absolute = path.resolve(filePath);
  if (isWithin(archiveRoot, absolute)) throw new Error(`Production import graph reaches archived source: ${path.relative(root, absolute)}`);
  if (!isWithin(sourceRoot, absolute) || visited.has(absolute)) return;
  visited.add(absolute);
  for (const specifier of localImports(absolute)) {
    const dependency = resolveLocalPath(specifier, absolute);
    if (!dependency) continue;
    if (isWithin(archiveRoot, dependency)) throw new Error(`Production import graph reaches archived source: ${path.relative(root, dependency)}`);
    if (codeExtensions.includes(path.extname(dependency))) visit(dependency);
    else if (path.extname(dependency) === ".css") scanCssImports(dependency);
  }
}

function scanCssImports(filePath, seen = new Set()) {
  const absolute = path.resolve(filePath);
  if (seen.has(absolute)) return;
  seen.add(absolute);
  const content = fs.readFileSync(absolute, "utf8");
  const references = [
    ...content.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gi),
    ...content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi),
  ].map((match) => match[1].trim()).filter((value) => value.startsWith("."));
  for (const reference of references) {
    const dependency = path.resolve(path.dirname(absolute), reference);
    if (isWithin(archiveRoot, dependency)) throw new Error(`Production CSS reaches archived source: ${path.relative(root, dependency)}`);
    if (fs.existsSync(dependency) && path.extname(dependency) === ".css") scanCssImports(dependency, seen);
  }
}
visit(path.resolve(sourceRoot, "main.tsx"));

for (const requiredModule of ["AppShell.tsx", "pages/ChildPortalPage.tsx", "pages/LessonPlayerPage.tsx"]) {
  const absolute = path.resolve(sourceRoot, requiredModule);
  if (!visited.has(absolute)) throw new Error(`Production entry graph does not include ${path.relative(root, absolute)}.`);
}

const productionAssets = walkFiles(distRoot).filter((filePath) => /\.(js|html|css|json|webmanifest|svg|xml)$/i.test(filePath));
if (productionAssets.length === 0) throw new Error("Production build assets were not found in frontend/dist.");
for (const filePath of productionAssets) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const componentName of historicalComponents) {
    if (content.includes(componentName)) throw new Error(`Production bundle contains archived component ${componentName}: ${path.relative(root, filePath)}`);
  }
  if (/frontend[\\/]archive[\\/]|archive\/previews/i.test(content)) throw new Error(`Production bundle contains an archive path: ${path.relative(root, filePath)}`);
}

console.log(`Canonical frontend verified: ${visited.size} production modules, no archived React source in the import graph or bundle.`);
