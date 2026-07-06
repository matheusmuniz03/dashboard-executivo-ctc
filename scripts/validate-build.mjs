import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const defaultRoot = path.resolve(process.argv[2] || "dist");
const deployTextExtensions = new Set([".html", ".css", ".js", ".json"]);
const forbiddenPatterns = [
  { label: "file://", pattern: /file:\/\//i },
  { label: "localhost", pattern: /localhost/i },
  { label: "127.0.0.1", pattern: /127\.0\.0\.1/i },
  { label: "caminho local Windows", pattern: /[A-Z]:\\/i }
];

const requiredFiles = [
  "index.html",
  "src/app.js",
  "src/styles.css",
  "config/config-globals.js",
  "config/dashboard-config.json",
  "data/generated-data.json",
  "data/generated-data.js",
  "assets/logos/ctc.svg"
];

export async function validateBuild(buildRoot = defaultRoot) {
  const root = path.resolve(buildRoot);
  const missing = [];

  for (const relativePath of requiredFiles) {
    const filePath = path.join(root, relativePath);
    try {
      await stat(filePath);
    } catch {
      missing.push(relativePath);
    }
  }

  if (missing.length) {
    throw new Error(`Arquivos ausentes no build: ${missing.join(", ")}`);
  }

  const indexHtml = await readFile(path.join(root, "index.html"), "utf8");
  const assetRefs = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const unresolvedRefs = [];

  for (const ref of assetRefs) {
    if (/^(https?:)?\/\//i.test(ref) || ref.startsWith("#")) {
      continue;
    }
    const cleanRef = ref.split("?")[0];
    const refPath = cleanRef.startsWith("/")
      ? path.join(root, cleanRef)
      : path.join(root, cleanRef);
    try {
      await stat(refPath);
    } catch {
      unresolvedRefs.push(ref);
    }
  }

  if (unresolvedRefs.length) {
    throw new Error(`Referências quebradas no index.html: ${unresolvedRefs.join(", ")}`);
  }

  const deployFiles = await listFiles(root);
  const forbiddenHits = [];

  for (const file of deployFiles) {
    const ext = path.extname(file).toLowerCase();
    if (!deployTextExtensions.has(ext)) {
      continue;
    }

    const content = await readFile(file, "utf8");
    for (const item of forbiddenPatterns) {
      if (item.pattern.test(content)) {
        forbiddenHits.push(`${path.relative(root, file)} contém ${item.label}`);
      }
    }
  }

  if (forbiddenHits.length) {
    throw new Error(`Referências locais encontradas no build:\n${forbiddenHits.join("\n")}`);
  }

  const sourceDataPath = path.join(root, "data", "source");
  try {
    await stat(sourceDataPath);
    throw new Error("A pasta data/source não deve ser publicada no dist.");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  return true;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateBuild(defaultRoot)
    .then(() => console.log(`Build validado em ${defaultRoot}`))
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}
