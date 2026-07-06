export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export function methodNotAllowed(response, methods) {
  response.setHeader("Allow", methods.join(", "));
  sendJson(response, 405, { error: "METHOD_NOT_ALLOWED", message: "Método não permitido." });
}

export async function readJsonBody(request) {
  if (request.body && Buffer.isBuffer(request.body)) {
    return JSON.parse(request.body.toString("utf8") || "{}");
  }
  if (request.body && typeof request.body === "object") {
    return request.body;
  }
  if (typeof request.body === "string") {
    return JSON.parse(request.body || "{}");
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

export function getRouteName(request) {
  if (request.query && request.query.name) {
    return Array.isArray(request.query.name) ? request.query.name[0] : request.query.name;
  }

  const parsed = new URL(request.url || "/", "http://localhost");
  const parts = parsed.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] || "");
}

export function handleApiError(response, error) {
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
