import { createSessionToken, isAuthConfigured, validateCredentials } from "../../lib/auth.js";
import { handleApiError, methodNotAllowed, readJsonBody, sendJson } from "../_utils.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    if (!isAuthConfigured()) {
      sendJson(response, 503, {
        error: "AUTH_NOT_CONFIGURED",
        message: "Autenticação administrativa não configurada. Defina ADMIN_USER e ADMIN_PASSWORD."
      });
      return;
    }

    const body = await readJsonBody(request);
    const result = validateCredentials(String(body.login || ""), String(body.password || ""));

    if (!result.ok) {
      sendJson(response, 401, {
        error: "INVALID_CREDENTIALS",
        message: "Login ou senha inválidos."
      });
      return;
    }

    const token = createSessionToken(result.user);
    sendJson(response, 200, {
      token,
      user: result.user,
      message: "Login realizado com sucesso."
    });
  } catch (error) {
    handleApiError(response, error);
  }
}
