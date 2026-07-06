import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBuild } from "./validate-build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const files = [
  "index.html"
];

const directories = [
  "assets",
  "config",
  "src"
];

const dataFiles = [
  "data/generated-data.json",
  "data/generated-data.js"
];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyFileOrDirectory(relativePath) {
  const from = path.join(root, relativePath);
  const to = path.join(dist, relativePath);
  if (!(await exists(from))) {
    throw new Error(`Arquivo obrigatório não encontrado: ${relativePath}`);
  }
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFileOrDirectory(file);
}

for (const directory of directories) {
  await copyFileOrDirectory(directory);
}

for (const file of dataFiles) {
  await copyFileOrDirectory(file);
}

await validateBuild(dist);

console.log("Build concluído em dist/");
