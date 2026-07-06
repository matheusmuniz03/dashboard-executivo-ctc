import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createSessionToken, isAuthConfigured, readBearerToken, validateCredentials, verifySessionToken } from "../lib/auth.js";
import { getAllDataSources, getDataSource, getStorageStatus, listDataSources, saveDataSource } from "../lib/storage.js";

const root = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3] || process.env.PORT || 4173);

async function loadLocalEnvFiles() {
  for (const fileName of [".env.local", ".env"]) {
    try {
      const content = await readFile(path.join(root, fileName), "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
          return;
        }
        const index = trimmed.indexOf("=");
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      });
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

await loadLocalEnvFiles();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".csv": "text/csv; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function isInsideRoot(filePath) {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function handleApiError(response, error) {
  if (error && error.code === "DATA_SOURCE_NOT_FOUND") {
    sendJson(response, 404, { error: error.code, message: error.message });
    return;
  }
  if (error && error.code === "STORAGE_NOT_CONFIGURED") {
    sendJson(response, 503, { error: error.code, message: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    sendJson(response, 400, { error: "INVALID_JSON", message: "JSON inválido." });
    return;
  }
  sendJson(response, 500, {
    error: "INTERNAL_ERROR",
    message: error && error.message ? error.message : "Erro interno."
  });
}

async function handleApiRequest(request, response, parsedUrl) {
  try {
    const pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

    if (pathname === "/api/auth/login") {
      if (request.method !== "POST") {
        sendJson(response, 405, { error: "METHOD_NOT_ALLOWED", message: "Método não permitido." });
        return;
      }
      if (!isAuthConfigured()) {
        sendJson(response, 503, {
          error: "AUTH_NOT_CONFIGURED",
          message: "Autenticação administrativa não configurada. Defina ADMIN_USER e ADMIN_PASSWORD."
        });
        return;
      }
      const body = await readJsonBody(request);
      const auth = validateCredentials(String(body.login || ""), String(body.password || ""));
      if (!auth.ok) {
        sendJson(response, 401, { error: "INVALID_CREDENTIALS", message: "Login ou senha inválidos." });
        return;
      }
      sendJson(response, 200, { token: createSessionToken(auth.user), user: auth.user });
      return;
    }

    if (pathname === "/api/auth/session") {
      if (request.method !== "GET") {
        sendJson(response, 405, { error: "METHOD_NOT_ALLOWED", message: "Método não permitido." });
        return;
      }
      const auth = verifySessionToken(readBearerToken(request));
      if (!auth.ok) {
        sendJson(response, 401, { error: "UNAUTHENTICATED", message: "Usuário não autenticado." });
        return;
      }
      sendJson(response, 200, { user: auth.user, authenticated: true });
      return;
    }

    if (pathname === "/api/data-manifest") {
      sendJson(response, 200, { storage: getStorageStatus(), sources: listDataSources() });
      return;
    }

    if (pathname === "/api/data") {
      if (request.method !== "GET") {
        sendJson(response, 405, { error: "METHOD_NOT_ALLOWED", message: "Método não permitido." });
        return;
      }
      sendJson(response, 200, await getAllDataSources());
      return;
    }

    if (pathname.startsWith("/api/data/")) {
      const name = decodeURIComponent(pathname.slice("/api/data/".length));
      if (request.method === "GET") {
        sendJson(response, 200, await getDataSource(name));
        return;
      }
      if (request.method === "PUT" || request.method === "POST") {
        const auth = verifySessionToken(readBearerToken(request));
        if (!auth.ok) {
          sendJson(response, 401, { error: "UNAUTHENTICATED", message: "Usuário não autenticado." });
          return;
        }
        const body = await readJsonBody(request);
        if (!Object.prototype.hasOwnProperty.call(body, "value")) {
          sendJson(response, 400, { error: "INVALID_PAYLOAD", message: "Envie um JSON com a propriedade value." });
          return;
        }
        sendJson(response, 200, await saveDataSource(name, body.value, { updatedBy: auth.user }));
        return;
      }
    }

    sendJson(response, 404, { error: "API_NOT_FOUND", message: "Endpoint não encontrado." });
  } catch (error) {
    handleApiError(response, error);
  }
}

async function resolveRequestPath(url) {
  const parsedUrl = new URL(url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  let filePath = path.join(root, pathname);

  if (!isInsideRoot(filePath)) {
    return { status: 403 };
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    if (!path.extname(pathname)) {
      filePath = path.join(root, "index.html");
    }
  }

  if (!isInsideRoot(filePath)) {
    return { status: 403 };
  }

  return { status: 200, filePath };
}

const server = createServer(async (request, response) => {
  try {
    const parsedUrl = new URL(request.url || "/", `http://localhost:${port}`);
    if (parsedUrl.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, parsedUrl);
      return;
    }

    const result = await resolveRequestPath(request.url || "/");
    if (result.status === 403) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Acesso negado");
      return;
    }

    const body = await readFile(result.filePath);
    const ext = path.extname(result.filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Arquivo não encontrado");
  }
});

server.listen(port, () => {
  console.log(`Servidor local em http://localhost:${port}/`);
  console.log(`Raiz: ${root}`);
});
