import test from "node:test";
import assert from "node:assert/strict";

import { resetWagriTokenCacheForTest } from "../functions/api/integrations/wagri/field-polygons.js";
import { handleGatewayRequest } from "../worker/integrations-gateway.js";

const BFF_TOKEN = "test-bff-token-with-enough-entropy";

function request(path, init = {}) {
  return new Request(`https://integrations.example.test${path}`, {
    headers: { "X-Tonari-BFF-Token": BFF_TOKEN },
    ...init,
  });
}

function baseEnv(overrides = {}) {
  return {
    INTEGRATIONS_ENABLED: "true",
    BFF_ACCESS_TOKEN: BFF_TOKEN,
    INTEGRATION_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
  };
}

test("gateway rejects unknown routes and unsupported methods", async () => {
  const missing = await handleGatewayRequest(request("/api/integrations/missing"), baseEnv());
  assert.equal(missing.status, 404);
  const wrongMethod = await handleGatewayRequest(request("/api/integrations/status", { method: "POST" }), baseEnv());
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("Allow"), "GET");
});

test("gateway fails closed before rate limiting when integrations are disabled", async () => {
  let limitCalls = 0;
  const response = await handleGatewayRequest(request("/api/integrations/wagri/field-polygons?lat=36&lng=140"), {
    INTEGRATION_RATE_LIMITER: { limit: async () => { limitCalls += 1; } },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "integration-disabled");
  assert.equal(limitCalls, 0);
});

test("gateway allows an in-limit WAGRI request and uses a provider-specific key", async () => {
  resetWagriTokenCacheForTest();
  const keys = [];
  let providerCalls = 0;
  const response = await handleGatewayRequest(
    request("/api/integrations/wagri/field-polygons?lat=36&lng=140"),
    baseEnv({
      WAGRI_CLIENT_ID: "client-id",
      WAGRI_CLIENT_SECRET: "client-secret",
      INTEGRATION_RATE_LIMITER: {
        limit: async ({ key }) => { keys.push(key); return { success: true }; },
      },
      __FETCH__: async (upstream) => {
        providerCalls += 1;
        if (upstream.url.endsWith("/token")) {
          return Response.json({ access_token: "wagri-token", expires_in: 3600 });
        }
        return Response.json([]);
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(keys, ["wagri:field-polygons"]);
  assert.equal(providerCalls, 2);
});

test("gateway returns 429 without calling a provider after the limit", async () => {
  let providerCalls = 0;
  const response = await handleGatewayRequest(
    request("/api/integrations/xarvio/boundary?fieldUuid=8c154be2-6a01-4ed0-84c4-07b8399886cb"),
    baseEnv({
      XARVIO_ACCESS_TOKEN: "xarvio-token",
      INTEGRATION_RATE_LIMITER: { limit: async () => ({ success: false }) },
      __FETCH__: async () => { providerCalls += 1; },
    }),
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal((await response.json()).error.code, "rate-limit-exceeded");
  assert.equal(providerCalls, 0);
});

test("gateway fails closed when the rate-limit binding is missing or throws", async () => {
  const path = "/api/integrations/xarvio/boundary?fieldUuid=8c154be2-6a01-4ed0-84c4-07b8399886cb";
  const missing = await handleGatewayRequest(request(path), baseEnv({ INTEGRATION_RATE_LIMITER: undefined }));
  const failed = await handleGatewayRequest(request(path), baseEnv({
    INTEGRATION_RATE_LIMITER: { limit: async () => { throw new Error("binding unavailable"); } },
  }));
  assert.deepEqual([missing.status, failed.status], [503, 503]);
  const payloads = await Promise.all([missing.json(), failed.json()]);
  assert.deepEqual(payloads.map((payload) => payload.error.code), [
    "rate-limit-unavailable",
    "rate-limit-unavailable",
  ]);
});
