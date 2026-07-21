import test from "node:test";
import assert from "node:assert/strict";

import { authorizeBff } from "../functions/_shared/bff.js";
import { onRequestGet as statusGet } from "../functions/api/integrations/status.js";
import {
  onRequestGet as wagriGet,
  resetWagriTokenCacheForTest,
} from "../functions/api/integrations/wagri/field-polygons.js";
import { onRequestGet as xarvioGet } from "../functions/api/integrations/xarvio/boundary.js";

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

test("WAGRI upstream failures are sanitized", async () => {
  resetWagriTokenCacheForTest();
  const response = await wagriGet({
    request: request("/api/integrations/wagri/field-polygons?lat=36&lng=140"),
    env: baseEnv({
      WAGRI_CLIENT_ID: "client-id",
      WAGRI_CLIENT_SECRET: "client-secret",
      __FETCH__: async () => new Response("upstream secret diagnostic", { status: 401 }),
    }),
  });
  const text = await response.text();
  assert.equal(response.status, 502);
  assert.equal(text.includes("upstream secret diagnostic"), false);
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
  assert.equal(response.headers.has("Authorization"), false);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [80, 75, 3, 4]);
});
