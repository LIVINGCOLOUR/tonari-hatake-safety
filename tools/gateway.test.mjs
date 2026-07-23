import test from "node:test";
import assert from "node:assert/strict";

import { resetWagriTokenCacheForTest } from "../server/integrations/routes/wagri-field-polygons.js";
import {
  activeProviderConcurrencyForTest,
  providerConcurrencyLimit,
  resetProviderConcurrencyForTest,
  runWithProviderConcurrency,
} from "../worker/concurrency.js";
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

test.beforeEach(() => {
  resetProviderConcurrencyForTest();
});

test("provider concurrency settings use safe defaults and bounds", () => {
  assert.equal(providerConcurrencyLimit({}, "LIMIT", 4), 4);
  assert.equal(providerConcurrencyLimit({ LIMIT: "invalid" }, "LIMIT", 4), 4);
  assert.equal(providerConcurrencyLimit({ LIMIT: "0" }, "LIMIT", 4), 1);
  assert.equal(providerConcurrencyLimit({ LIMIT: "99" }, "LIMIT", 4), 10);
});

test("provider concurrency admits up to the limit and releases after completion", async () => {
  let markStarted;
  let finishFirst;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const firstBarrier = new Promise((resolve) => { finishFirst = resolve; });
  const options = {
    key: "wagri",
    envName: "WAGRI_MAX_CONCURRENCY",
    defaultLimit: 1,
    holdResponseBody: false,
    safetyMs: 1000,
  };
  const first = runWithProviderConcurrency({}, options, async () => {
    markStarted();
    await firstBarrier;
    return Response.json({ ok: true });
  });
  await started;
  assert.equal(activeProviderConcurrencyForTest("wagri"), 1);

  const busy = await runWithProviderConcurrency({}, options, async () => Response.json({ ok: true }));
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get("Retry-After"), "2");
  assert.equal((await busy.json()).error.code, "provider-busy");

  finishFirst();
  assert.equal((await first).status, 200);
  assert.equal(activeProviderConcurrencyForTest("wagri"), 0);
  const next = await runWithProviderConcurrency({}, options, async () => Response.json({ ok: true }));
  assert.equal(next.status, 200);
});

test("provider concurrency releases after an operation throws", async () => {
  const options = {
    key: "wagri",
    envName: "WAGRI_MAX_CONCURRENCY",
    defaultLimit: 1,
    holdResponseBody: false,
    safetyMs: 1000,
  };
  await assert.rejects(
    runWithProviderConcurrency({}, options, async () => { throw new Error("provider failed"); }),
    /provider failed/,
  );
  assert.equal(activeProviderConcurrencyForTest("wagri"), 0);
});

test("streaming concurrency holds a slot until close and releases on cancel", async () => {
  let closeFirst;
  const firstBody = new ReadableStream({
    start(controller) { closeFirst = () => controller.close(); },
  });
  const options = {
    key: "xarvio",
    envName: "XARVIO_MAX_CONCURRENCY",
    defaultLimit: 1,
    holdResponseBody: true,
    safetyMs: 1000,
  };
  const first = await runWithProviderConcurrency({}, options, async () => new Response(firstBody));
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 1);
  closeFirst();
  await first.arrayBuffer();
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 0);

  const cancelBody = new ReadableStream({});
  const cancelled = await runWithProviderConcurrency({}, options, async () => new Response(cancelBody));
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 1);
  await cancelled.body.cancel("client-disconnected");
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 0);
});

test("streaming concurrency safety deadline releases a stalled body", async () => {
  const stalled = new ReadableStream({});
  const response = await runWithProviderConcurrency({}, {
    key: "xarvio",
    envName: "XARVIO_MAX_CONCURRENCY",
    defaultLimit: 1,
    holdResponseBody: true,
    safetyMs: 20,
  }, async () => new Response(stalled));
  await assert.rejects(response.arrayBuffer(), /provider-concurrency-hold-timeout/);
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 0);
});

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

test("gateway releases the WAGRI slot after malformed field JSON", async () => {
  resetWagriTokenCacheForTest();
  let calls = 0;
  const response = await handleGatewayRequest(
    request("/api/integrations/wagri/field-polygons?lat=36&lng=140"),
    baseEnv({
      WAGRI_CLIENT_ID: "client-id",
      WAGRI_CLIENT_SECRET: "client-secret",
      WAGRI_MAX_CONCURRENCY: "1",
      __FETCH__: async () => {
        calls += 1;
        if (calls === 1) return Response.json({ access_token: "wagri-token", expires_in: 3600 });
        return new Response("{broken-field-json", { status: 200 });
      },
    }),
  );
  assert.equal(response.status, 502);
  assert.equal(activeProviderConcurrencyForTest("wagri"), 0);
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

test("gateway keeps a xarvio slot until the ZIP stream finishes", async () => {
  let upstreamController;
  let providerCalls = 0;
  const env = baseEnv({
    XARVIO_ACCESS_TOKEN: "xarvio-token",
    XARVIO_MAX_CONCURRENCY: "1",
    __FETCH__: async () => {
      providerCalls += 1;
      return new Response(new ReadableStream({
        start(controller) { upstreamController = controller; },
      }), { headers: { "Content-Type": "application/zip" } });
    },
  });
  const path = "/api/integrations/xarvio/boundary?fieldUuid=8c154be2-6a01-4ed0-84c4-07b8399886cb";
  const first = await handleGatewayRequest(request(path), env);
  assert.equal(first.status, 200);
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 1);

  const busy = await handleGatewayRequest(request(path), env);
  assert.equal(busy.status, 503);
  assert.equal((await busy.json()).error.code, "provider-busy");
  assert.equal(providerCalls, 1);

  upstreamController.enqueue(new Uint8Array([80, 75, 3, 4]));
  upstreamController.close();
  assert.deepEqual([...new Uint8Array(await first.arrayBuffer())], [80, 75, 3, 4]);
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 0);
});

test("gateway releases the xarvio slot on upstream stream failure", async () => {
  let upstreamController;
  const env = baseEnv({
    XARVIO_ACCESS_TOKEN: "xarvio-token",
    XARVIO_MAX_CONCURRENCY: "1",
    __FETCH__: async () => new Response(new ReadableStream({
      start(controller) { upstreamController = controller; },
    }), { headers: { "Content-Type": "application/zip" } }),
  });
  const path = "/api/integrations/xarvio/boundary?fieldUuid=8c154be2-6a01-4ed0-84c4-07b8399886cb";
  const response = await handleGatewayRequest(request(path), env);
  upstreamController.enqueue(new Uint8Array([80, 75]));
  upstreamController.error(new Error("upstream-disconnected"));
  await assert.rejects(response.arrayBuffer(), /upstream-disconnected/);
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 0);
});

test("gateway propagates client cancellation and releases the xarvio slot", async () => {
  let upstreamCancelled = false;
  const env = baseEnv({
    XARVIO_ACCESS_TOKEN: "xarvio-token",
    XARVIO_MAX_CONCURRENCY: "1",
    __FETCH__: async () => new Response(new ReadableStream({
      cancel() { upstreamCancelled = true; },
    }), { headers: { "Content-Type": "application/zip" } }),
  });
  const path = "/api/integrations/xarvio/boundary?fieldUuid=8c154be2-6a01-4ed0-84c4-07b8399886cb";
  const response = await handleGatewayRequest(request(path), env);
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 1);
  await response.body.cancel("client-disconnected");
  assert.equal(upstreamCancelled, true);
  assert.equal(activeProviderConcurrencyForTest("xarvio"), 0);
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
