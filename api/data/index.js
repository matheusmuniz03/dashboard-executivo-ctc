import { getAllDataSources } from "../../lib/storage.js";
import { handleApiError, methodNotAllowed, sendJson } from "../_utils.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  try {
    const data = await getAllDataSources();
    sendJson(response, 200, data);
  } catch (error) {
    handleApiError(response, error);
  }
}
