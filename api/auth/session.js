import { readBearerToken, verifySessionToken } from "../../lib/auth.js";
import { methodNotAllowed, sendJson } from "../_utils.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const auth = verifySessionToken(readBearerToken(request));
  if (!auth.ok) {
    sendJson(response, 401, {
      error: "UNAUTHENTICATED",
      message: "Usuário não autenticado."
    });
    return;
  }

  sendJson(response, 200, {
    user: auth.user,
    authenticated: true
  });
}
