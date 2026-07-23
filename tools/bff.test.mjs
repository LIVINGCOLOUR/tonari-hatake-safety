import test from "node:test";
import assert from "node:assert/strict";

import {
  authorizeBff,
  byteLimitedStream,
  fetchJsonWithTimeout,
  fetchWithTimeout,
  providerTimeoutMs,
  ProviderTimeoutError,
} from "../server/integrations/bff.js";
import { onRequestGet as statusGet } from "../server/integrations/routes/status.js";
import {
  onRequestGet as wagriGet,
  resetWagriTokenCacheForTest,
} from "../server/integrations/routes/wagri-field-polygons.js";
import { onRequestGet as xarvioGet } from "../server/integrations/routes/xarvio-boundary.js";

const BFF_TOKEN = "test-bff-token-with-enough-entropy";

function request(path, token = BFF_TOKEN) {
  return new Request(`https://example.test${path}`, {
    headers: token ? { "X-Tonari-BFF-Token": token } : {},
  });
}

function baseEnv(overrides = {}) {
  return {
    INTEGRATIONS_ENABLED: "true",
    BFF_ACCESS_TOKEN: BFF_TOKEN,
    ...overrides,
  };
}

test("BFF guard fails closed when disabled, misconfigured, or unauthorized", async () => {
  assert.equal(authorizeBff(request("/"), {}).status, 503);
  assert.equal(authorizeBff(request("/"), { INTEGRATIONS_ENABLED: "true" }).status, 503);
  assert.equal(authorizeBff(request("/", "short"), {
    INTEGRATIONS_ENABLED: "true",
    BFF_ACCESS_TOKEN: "short",
  }).status, 503);
  const response = authorizeBff(request("/", "wrong"), baseEnv());
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "bff-unauthorized");
});

test("provider timeout settings are bounded and invalid values use the fallback", () => {
  assert.equal(providerTimeoutMs({}, "TIMEOUT", 12000), 12000);
  assert.equal(providerTimeoutMs({ TIMEOUT: "invalid" }, "TIMEOUT", 12000), 12000);
  assert.equal(providerTimeoutMs({ TIMEOUT: "10" }, "TIMEOUT", 12000), 1000);
  assert.equal(providerTimeoutMs({ TIMEOUT: "999999" }, "TIMEOUT", 12000), 30000);
  assert.equal(providerTimeoutMs({ TIMEOUT: "45000" }, "TIMEOUT", 30000, 1000, 120000), 45000);
});

test("provider timeout covers response headers and JSON body parsing", async () => {
  const neverResponds = (upstream, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  await assert.rejects(
    fetchWithTimeout(neverResponds, request("/upstream"), 20),
    (error) => error instanceof ProviderTimeoutError && error.phase === "headers",
  );

  const response = Response.json({ ok: true });
  response.json = () => new Promise(() => {});
  await assert.rejects(
    fetchJsonWithTimeout(async () => response, request("/upstream"), 20),
    (error) => error instanceof ProviderTimeoutError && error.phase === "json",
  );
});

test("caller cancellation is not classified as a provider timeout", async () => {
  const controller = new AbortController();
  const callerError = new Error("caller-aborted");
  controller.abort(callerError);
  await assert.rejects(
    fetchWithTimeout(async (upstream, { signal }) => { throw signal.reason; }, request("/upstream"), 1000, controller.signal),
    (error) => error === callerError && !(error instanceof ProviderTimeoutError),
  );
});

test("stream timeout errors the response and cancels the upstream reader", async () => {
  let cancelled = false;
  const upstream = new ReadableStream({
    cancel(reason) {
      cancelled = reason instanceof ProviderTimeoutError && reason.phase === "body";
    },
  });
  const response = new Response(byteLimitedStream(upstream, 1024, 20));
  await assert.rejects(
    response.arrayBuffer(),
    (error) => error instanceof ProviderTimeoutError && error.phase === "body",
  );
  assert.equal(cancelled, true);
});

test("WAGRI timeout responses are sanitized and retryable", async () => {
  resetWagriTokenCacheForTest();
  const response = await wagriGet({
    request: request("/api/integrations/wagri/field-polygons?lat=36&lng=140"),
    env: baseEnv({
      WAGRI_CLIENT_ID: "client-id",
      WAGRI_CLIENT_SECRET: "client-secret",
      __FETCH__: async () => { throw new ProviderTimeoutError("headers", 12000); },
    }),
  });
  const payload = await response.json();
  assert.equal(response.status, 504);
  assert.equal(response.headers.get("Retry-After"), "5");
  assert.equal(payload.error.code, "provider-timeout");
  assert.equal(JSON.stringify(payload).includes("api.wagri2.net"), false);
});

test("concurrent WAGRI calls share one token exchange", async () => {
  resetWagriTokenCacheForTest();
  let tokenCalls = 0;
  let dataCalls = 0;
  const fetcher = async (upstream) => {
    if (upstream.url.endsWith("/token")) {
      tokenCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return Response.json({ access_token: "shared-token", expires_in: 3600 });
    }
    dataCalls += 1;
    return Response.json([]);
  };
  const env = baseEnv({
    WAGRI_CLIENT_ID: "client-id",
    WAGRI_CLIENT_SECRET: "client-secret",
    __FETCH__: fetcher,
  });
  const contexts = [36, 36.001].map((lat) => ({
    request: request(`/api/integrations/wagri/field-polygons?lat=${lat}&lng=140`),
    env,
  }));
  const responses = await Promise.all(contexts.map(wagriGet));
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(tokenCalls, 1);
  assert.equal(dataCalls, 2);
});

test("status reports provider readiness without returning secret values", async () => {
  const response = statusGet({
    request: request("/api/integrations/status"),
    env: baseEnv({
      WAGRI_CLIENT_ID: "client-id",
      WAGRI_CLIENT_SECRET: "client-secret",
      XARVIO_ACCESS_TOKEN: "xarvio-secret",
    }),
  });
  assert.equal(response.status, 200);
  const text = await response.text();
  const payload = JSON.parse(text);
  assert.deepEqual(payload.providers, { wagri: true, xarvio: true });
  assert.equal(text.includes("client-secret"), false);
  assert.equal(text.includes("xarvio-secret"), false);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("WAGRI route validates coordinates before requesting a token", async () => {
  let calls = 0;
  const response = await wagriGet({
    request: request("/api/integrations/wagri/field-polygons?lat=999&lng=140"),
    env: baseEnv({ __FETCH__: async () => { calls += 1; } }),
  });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("WAGRI route exchanges client credentials and forwards only the access token", async () => {
  resetWagriTokenCacheForTest();
  const calls = [];
  const fetcher = async (upstream) => {
    calls.push(upstream);
    if (calls.length === 1) {
      return Response.json({ access_token: "wagri-access-token", token_type: "bearer", expires_in: 3600 });
    }
    return Response.json([{ polygon_uuid: "parcel-1", Polygons: [] }]);
  };
  const response = await wagriGet({
    request: request("/api/integrations/wagri/field-polygons?lat=36.345&lng=140.303&cmp=1"),
    env: baseEnv({
      WAGRI_CLIENT_ID: "client-id",
      WAGRI_CLIENT_SECRET: "client-secret",
      __FETCH__: fetcher,
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "POST");
  const tokenBody = await calls[0].clone().text();
  assert.match(tokenBody, /grant_type=client_credentials/);
  assert.match(tokenBody, /client_id=client-id/);
  assert.equal(calls[1].headers.get("X-Authorization"), "wagri-access-token");
  assert.equal(calls[1].url.includes("client-secret"), false);
  const payload = await response.json();
  assert.equal(payload.provider, "wagri");
  assert.equal(payload.data[0].polygon_uuid, "parcel-1");
});

test("WAGRI upstream statuses and diagnostics are sanitized", async () => {
  for (const status of [401, 403, 429, 500]) {
    resetWagriTokenCacheForTest();
    const response = await wagriGet({
      request: request("/api/integrations/wagri/field-polygons?lat=36&lng=140"),
      env: baseEnv({
        WAGRI_CLIENT_ID: "client-id",
        WAGRI_CLIENT_SECRET: "client-secret",
        __FETCH__: async () => new Response("upstream secret diagnostic", {
          status,
          headers: { "X-Provider-Diagnostic": "secret-header" },
        }),
      }),
    });
    const text = await response.text();
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("X-Upstream-Status"), String(status));
    assert.equal(response.headers.has("X-Provider-Diagnostic"), false);
    assert.equal(text.includes("upstream secret diagnostic"), false);
  }
});

test("WAGRI rejects malformed token and field JSON without leaking details", async () => {
  for (const tokenResponse of [
    () => new Response("{broken-token-json", { status: 200 }),
    () => Response.json({ expires_in: 3600 }),
  ]) {
    resetWagriTokenCacheForTest();
    const response = await wagriGet({
      request: request("/api/integrations/wagri/field-polygons?lat=36&lng=140"),
      env: baseEnv({
        WAGRI_CLIENT_ID: "client-id",
        WAGRI_CLIENT_SECRET: "client-secret",
        __FETCH__: async () => tokenResponse(),
      }),
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, "provider-request-failed");
  }

  resetWagriTokenCacheForTest();
  let calls = 0;
  const response = await wagriGet({
    request: request("/api/integrations/wagri/field-polygons?lat=36&lng=140"),
    env: baseEnv({
      WAGRI_CLIENT_ID: "client-id",
      WAGRI_CLIENT_SECRET: "client-secret",
      __FETCH__: async () => {
        calls += 1;
        if (calls === 1) return Response.json({ access_token: "valid-token", expires_in: 3600 });
        return new Response("{broken-field-json", { status: 200 });
      },
    }),
  });
  const text = await response.text();
  assert.equal(response.status, 502);
  assert.equal(text.includes("broken-field-json"), false);
});

test("xarvio route validates UUID before calling upstream", async () => {
  let calls = 0;
  const response = await xarvioGet({
    request: request("/api/integrations/xarvio/boundary?fieldUuid=not-a-uuid"),
    env: baseEnv({
      XARVIO_ACCESS_TOKEN: "xarvio-token",
      __FETCH__: async () => { calls += 1; },
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("xarvio route proxies one SHP boundary without exposing the token", async () => {
  const fieldUuid = "8c154be2-6a01-4ed0-84c4-07b8399886cb";
  let upstreamRequest;
  const response = await xarvioGet({
    request: request(`/api/integrations/xarvio/boundary?fieldUuid=${fieldUuid}`),
    env: baseEnv({
      XARVIO_ACCESS_TOKEN: "xarvio-token",
      __FETCH__: async (requestValue) => {
        upstreamRequest = requestValue;
        return new Response(new Uint8Array([80, 75, 3, 4]), { status: 200 });
      },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(upstreamRequest.headers.get("Authorization"), "Bearer xarvio-token");
  assert.equal(upstreamRequest.url.includes(fieldUuid), true);
  assert.equal(upstreamRequest.url.includes("format=shp"), true);
  assert.equal(response.headers.get("Content-Type"), "application/zip");
  assert.equal(response.headers.get("X-Tonari-Max-Bytes"), String(10 * 1024 * 1024));
  assert.equal(response.headers.has("Authorization"), false);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [80, 75, 3, 4]);
});

test("xarvio route rejects a declared response larger than the configured cap", async () => {
  const fieldUuid = "8c154be2-6a01-4ed0-84c4-07b8399886cb";
  const response = await xarvioGet({
    request: request(`/api/integrations/xarvio/boundary?fieldUuid=${fieldUuid}`),
    env: baseEnv({
      XARVIO_ACCESS_TOKEN: "xarvio-token",
      XARVIO_MAX_BOUNDARY_BYTES: "3",
      __FETCH__: async () => new Response(new Uint8Array([80, 75, 3, 4]), {
        headers: { "Content-Length": "4" },
      }),
    }),
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "provider-response-too-large");
});

test("xarvio route terminates a chunked response that crosses the byte cap", async () => {
  const fieldUuid = "8c154be2-6a01-4ed0-84c4-07b8399886cb";
  const response = await xarvioGet({
    request: request(`/api/integrations/xarvio/boundary?fieldUuid=${fieldUuid}`),
    env: baseEnv({
      XARVIO_ACCESS_TOKEN: "xarvio-token",
      XARVIO_MAX_BOUNDARY_BYTES: "3",
      __FETCH__: async () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([80, 75]));
          controller.enqueue(new Uint8Array([3, 4]));
          controller.close();
        },
      })),
    }),
  });
  assert.equal(response.status, 200);
  await assert.rejects(response.arrayBuffer(), /provider-response-too-large/);
});

test("xarvio route errors a response truncated below its declared length", async () => {
  const fieldUuid = "8c154be2-6a01-4ed0-84c4-07b8399886cb";
  const response = await xarvioGet({
    request: request(`/api/integrations/xarvio/boundary?fieldUuid=${fieldUuid}`),
    env: baseEnv({
      XARVIO_ACCESS_TOKEN: "xarvio-token",
      __FETCH__: async () => new Response(new Uint8Array([80, 75, 3, 4]), {
        headers: { "Content-Length": "5", "Content-Type": "application/zip" },
      }),
    }),
  });
  assert.equal(response.status, 200);
  await assert.rejects(response.arrayBuffer(), /provider-response-truncated/);
});

test("xarvio route rejects empty and non-archive success responses", async () => {
  const fieldUuid = "8c154be2-6a01-4ed0-84c4-07b8399886cb";
  const contexts = [
    new Response(null, { status: 200 }),
    new Response("login page", { status: 200, headers: { "Content-Type": "text/html" } }),
  ].map((upstream) => ({
    request: request(`/api/integrations/xarvio/boundary?fieldUuid=${fieldUuid}`),
    env: baseEnv({
      XARVIO_ACCESS_TOKEN: "xarvio-token",
      __FETCH__: async () => upstream,
    }),
  }));
  const responses = await Promise.all(contexts.map(xarvioGet));
  assert.deepEqual(responses.map((response) => response.status), [502, 502]);
  const errors = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(errors.map((payload) => payload.error.code), [
    "provider-request-failed",
    "provider-request-failed",
  ]);
});
