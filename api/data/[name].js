import { readBearerToken, verifySessionToken } from "../../lib/auth.js";
import { getDataSource, saveDataSource } from "../../lib/storage.js";
import { getRouteName, handleApiError, methodNotAllowed, readJsonBody, sendJson } from "../_utils.js";

export default async function handler(request, response) {
  const name = getRouteName(request);

  try {
    if (request.method === "GET") {
      sendJson(response, 200, await getDataSource(name));
      return;
    }

    if (request.method === "PUT" || request.method === "POST") {
      const auth = verifySessionToken(readBearerToken(request));
      if (!auth.ok) {
        sendJson(response, 401, {
          error: "UNAUTHENTICATED",
          message: "Usuário não autenticado."
        });
        return;
      }

      const body = await readJsonBody(request);
      if (!Object.prototype.hasOwnProperty.call(body, "value")) {
        sendJson(response, 400, {
          error: "INVALID_PAYLOAD",
          message: "Envie um JSON com a propriedade value."
        });
        return;
      }

      sendJson(response, 200, await saveDataSource(name, body.value, { updatedBy: auth.user }));
      return;
    }

    methodNotAllowed(response, ["GET", "PUT", "POST"]);
  } catch (error) {
    handleApiError(response, error);
  }
}
