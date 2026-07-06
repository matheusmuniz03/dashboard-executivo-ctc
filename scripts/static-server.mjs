import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3] || process.env.PORT || 4173);

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
