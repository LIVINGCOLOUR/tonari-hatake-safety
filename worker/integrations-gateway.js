import { authorizeBff, errorResponse } from "../functions/_shared/bff.js";
import { onRequestGet as integrationStatus } from "../functions/api/integrations/status.js";
import { onRequestGet as wagriFieldPolygons } from "../functions/api/integrations/wagri/field-polygons.js";
import { onRequestGet as xarvioBoundary } from "../functions/api/integrations/xarvio/boundary.js";
import { enforceProviderRateLimit } from "./rate-limit.js";

const ROUTES = Object.freeze({
  "/api/integrations/status": { handler: integrationStatus, rateKey: null },
  "/api/integrations/wagri/field-polygons": { handler: wagriFieldPolygons, rateKey: "wagri:field-polygons" },
  "/api/integrations/xarvio/boundary": { handler: xarvioBoundary, rateKey: "xarvio:boundary" },
});

export async function handleGatewayRequest(request, env = {}) {
  const route = ROUTES[new URL(request.url).pathname];
  if (!route) return errorResponse(404, "route-not-found", "APIが見つかりません。");
  if (request.method !== "GET") {
    return errorResponse(405, "method-not-allowed", "GETリクエストのみ利用できます。", { Allow: "GET" });
  }

  const denied = authorizeBff(request, env);
  if (denied) return denied;
  if (route.rateKey) {
    const limited = await enforceProviderRateLimit(env, route.rateKey);
    if (limited) return limited;
  }
  return route.handler({ request, env });
}

export default {
  fetch(request, env) {
    return handleGatewayRequest(request, env);
  },
};
