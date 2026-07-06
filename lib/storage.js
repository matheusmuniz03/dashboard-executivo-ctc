import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_SOURCES, getDataSourceDefinition, getRecordCount, inferDataShape } from "./data-sources.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultBlobPrefix = "ctc-dashboard/data";

function getLocalStoreDir() {
  return process.env.DATA_STORE_DIR || path.join(root, ".tmp", "data-store");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonContent(content) {
  return JSON.parse(String(content).replace(/^\uFEFF/, ""));
}

function blobKey(name) {
  const prefix = process.env.DATA_BLOB_PREFIX || defaultBlobPrefix;
  return `${prefix}/${name}.json`;
}

function localStorePath(name) {
  return path.join(getLocalStoreDir(), `${name}.json`);
}

function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function canWriteLocalStore() {
  return !isBlobConfigured() && process.env.VERCEL !== "1";
}

async function readJsonFile(relativePath) {
  const content = await readFile(path.join(root, relativePath), "utf8");
  return parseJsonContent(content);
}

async function readSeedValue(definition) {
  return readJsonFile(definition.path);
}

async function getBlobApi() {
  try {
    return await import("@vercel/blob");
  } catch (error) {
    var message = "@vercel/blob não está instalado. Rode npm install ou confirme o package.json antes do deploy.";
    var wrapped = new Error(message);
    wrapped.cause = error;
    wrapped.code = "BLOB_PACKAGE_MISSING";
    throw wrapped;
  }
}

async function readBlobWrapper(name) {
  if (!isBlobConfigured()) {
    return null;
  }

  const key = blobKey(name);
  const { list } = await getBlobApi();
  const result = await list({ prefix: key, limit: 100 });
  const blob = (result.blobs || []).find((item) => item.pathname === key);
  if (!blob) {
    return null;
  }

  const separator = blob.url.includes("?") ? "&" : "?";
  const response = await fetch(`${blob.url}${separator}v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao ler ${name} no Vercel Blob: HTTP ${response.status}`);
  }
  return response.json();
}

async function readLocalWrapper(name) {
  if (!canWriteLocalStore()) {
    return null;
  }

  try {
    const content = await readFile(localStorePath(name), "utf8");
    return parseJsonContent(content);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readSavedWrapper(name) {
  if (isBlobConfigured()) {
    return readBlobWrapper(name);
  }
  return readLocalWrapper(name);
}

function normalizeWrapper(definition, wrapper) {
  const value = wrapper && Object.prototype.hasOwnProperty.call(wrapper, "value")
    ? wrapper.value
    : wrapper;
  return {
    name: definition.name,
    label: definition.label,
    path: definition.path,
    dashboardKey: definition.dashboardKey,
    description: definition.description,
    type: inferDataShape(value),
    recordCount: getRecordCount(value),
    updatedAt: wrapper && wrapper.updatedAt ? wrapper.updatedAt : null,
    updatedBy: wrapper && wrapper.updatedBy ? wrapper.updatedBy : null,
    source: wrapper && wrapper.updatedAt ? wrapper.source || getStorageStatus().mode : "seed",
    value
  };
}

export function getStorageStatus() {
  if (isBlobConfigured()) {
    return {
      mode: "vercel-blob",
      configured: true,
      writable: true,
      message: "Vercel Blob configurado"
    };
  }

  if (canWriteLocalStore()) {
    return {
      mode: "local-dev",
      configured: false,
      writable: true,
      message: "Vercel Blob não configurado; usando armazenamento local de desenvolvimento"
    };
  }

  return {
    mode: "seed-readonly",
    configured: false,
    writable: false,
    message: "Storage não configurado; usando apenas os JSONs locais como fallback"
  };
}

export function listDataSources() {
  return DATA_SOURCES.map((source) => ({ ...source }));
}

export async function getDataSource(name) {
  const definition = getDataSourceDefinition(name);
  if (!definition) {
    var error = new Error(`Base não encontrada: ${name}`);
    error.code = "DATA_SOURCE_NOT_FOUND";
    throw error;
  }

  const saved = await readSavedWrapper(name);
  if (saved) {
    return normalizeWrapper(definition, saved);
  }

  const seedValue = await readSeedValue(definition);
  return normalizeWrapper(definition, {
    value: seedValue,
    updatedAt: null,
    updatedBy: null,
    source: "seed"
  });
}

export async function getAllDataSources() {
  const sources = [];
  for (const definition of DATA_SOURCES) {
    sources.push(await getDataSource(definition.name));
  }
  return {
    storage: getStorageStatus(),
    sources
  };
}

export async function saveDataSource(name, payload, options = {}) {
  const definition = getDataSourceDefinition(name);
  if (!definition) {
    var notFound = new Error(`Base não encontrada: ${name}`);
    notFound.code = "DATA_SOURCE_NOT_FOUND";
    throw notFound;
  }

  const wrapper = {
    name,
    value: clone(payload),
    updatedAt: new Date().toISOString(),
    updatedBy: options.updatedBy || "admin",
    source: isBlobConfigured() ? "vercel-blob" : "local-dev"
  };

  if (isBlobConfigured()) {
    const { put } = await getBlobApi();
    await put(blobKey(name), JSON.stringify(wrapper, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8"
    });
    return normalizeWrapper(definition, wrapper);
  }

  if (canWriteLocalStore()) {
    await mkdir(getLocalStoreDir(), { recursive: true });
    await writeFile(localStorePath(name), JSON.stringify(wrapper, null, 2), "utf8");
    return normalizeWrapper(definition, wrapper);
  }

  var error = new Error("Storage não configurado para gravação. Configure BLOB_READ_WRITE_TOKEN na Vercel.");
  error.code = "STORAGE_NOT_CONFIGURED";
  throw error;
}

export async function hasLocalStore(name) {
  try {
    await stat(localStorePath(name));
    return true;
  } catch {
    return false;
  }
}
