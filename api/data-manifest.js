import { listDataSources, getStorageStatus } from "../lib/storage.js";
import { methodNotAllowed, sendJson } from "./_utils.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  sendJson(response, 200, {
    storage: getStorageStatus(),
    sources: listDataSources()
  });
}
