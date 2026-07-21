import { authorizeBff, errorResponse, providerTimeoutMs } from "../functions/_shared/bff.js";
import { onRequestGet as integrationStatus } from "../functions/api/integrations/status.js";
import { onRequestGet as wagriFieldPolygons } from "../functions/api/integrations/wagri/field-polygons.js";
import { onRequestGet as xarvioBoundary } from "../functions/api/integrations/xarvio/boundary.js";
import { runWithProviderConcurrency } from "./concurrency.js";
import { enforceProviderRateLimit } from "./rate-limit.js";

const ROUTES = Object.freeze({
  "/api/integrations/status": { handler: integrationStatus, provider: null },
  "/api/integrations/wagri/field-polygons": {
    handler: wagriFieldPolygons,
    provider: "wagri",
    rateKey: "wagri:field-polygons",
    concurrencyEnv: "WAGRI_MAX_CONCURRENCY",
    defaultConcurrency: 4,
    holdResponseBody: false,
  },
  "/api/integrations/xarvio/boundary": {
    handler: xarvioBoundary,
    provider: "xarvio",
    rateKey: "xarvio:boundary",
    concurrencyEnv: "XARVIO_MAX_CONCURRENCY",
    defaultConcurrency: 2,
    holdResponseBody: true,
  },
});

export async function handleGatewayRequest(request, env = {}) {
  const route = ROUTES[new URL(request.url).pathname];
  if (!route) return errorResponse(404, "route-not-found", "APIが見つかりません。");
  if (request.method !== "GET") {
    return errorResponse(405, "method-not-allowed", "GETリクエストのみ利用できます。", { Allow: "GET" });
  }

  const denied = authorizeBff(request, env);
  if (denied) return denied;
  if (route.provider) {
    const limited = await enforceProviderRateLimit(env, route.rateKey);
    if (limited) return limited;
    const streamTimeoutMs = route.holdResponseBody
      ? providerTimeoutMs(env, "XARVIO_STREAM_TIMEOUT_MS", 30000, 1000, 120000)
      : 0;
    return runWithProviderConcurrency(env, {
      key: route.provider,
      envName: route.concurrencyEnv,
      defaultLimit: route.defaultConcurrency,
      holdResponseBody: route.holdResponseBody,
      safetyMs: streamTimeoutMs + 1000,
    }, () => route.handler({ request, env }));
  }
  return route.handler({ request, env });
}

export default {
  fetch(request, env) {
    return handleGatewayRequest(request, env);
  },
};
