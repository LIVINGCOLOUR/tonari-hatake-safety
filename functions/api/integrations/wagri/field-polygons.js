import {
  authorizeBff,
  errorResponse,
  fetchJsonWithTimeout,
  isProviderTimeoutError,
  jsonResponse,
  providerTimeout,
  providerTimeoutMs,
  requiredSecret,
  upstreamFailure,
} from "../../../_shared/bff.js";

let cachedToken = null;
let tokenRequest = null;
const DEFAULT_TIMEOUT_MS = 12000;

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

async function requestWagriAccessToken(env, fetcher) {
  const clientId = requiredSecret(env, "WAGRI_CLIENT_ID", "WAGRI");
  if (!clientId.ok) return clientId;
  const clientSecret = requiredSecret(env, "WAGRI_CLIENT_SECRET", "WAGRI");
  if (!clientSecret.ok) return clientSecret;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId.value,
    client_secret: clientSecret.value,
  });
  const request = new Request("https://api.wagri2.net/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  let result;
  try {
    result = await fetchJsonWithTimeout(
      fetcher,
      request,
      providerTimeoutMs(env, "WAGRI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    );
  } catch (error) {
    if (isProviderTimeoutError(error)) {
      return { ok: false, response: providerTimeout("WAGRI認証API") };
    }
    return { ok: false, response: upstreamFailure("WAGRI認証API") };
  }
  const { response, data: payload } = result;
  if (!response.ok) return { ok: false, response: upstreamFailure("WAGRI認証API", response.status) };
  const value = String(payload?.access_token || "").trim();
  if (!value) return { ok: false, response: upstreamFailure("WAGRI認証API", response.status) };
  const expiresIn = Math.max(60, Math.min(Number(payload.expires_in) || 3600, 43_200));
  cachedToken = { value, expiresAt: Date.now() + expiresIn * 1000 };
  return value;
}

async function wagriAccessToken(env, fetcher) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (!tokenRequest) tokenRequest = requestWagriAccessToken(env, fetcher);
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

export async function onRequestGet({ request, env }) {
  const denied = authorizeBff(request, env);
  if (denied) return denied;
  const url = new URL(request.url);
  const lat = validCoordinate(url.searchParams.get("lat"), -90, 90);
  const lng = validCoordinate(url.searchParams.get("lng"), -180, 180);
  const cmp = url.searchParams.get("cmp") || "1";
  if (lat === null || lng === null || !["0", "1"].includes(cmp)) {
    return errorResponse(400, "invalid-query", "lat、lng、cmp（0または1）を確認してください。");
  }

  const fetcher = env.__FETCH__ || fetch;
  const token = await wagriAccessToken(env, fetcher);
  if (typeof token !== "string") return token.response;
  const upstream = new URL("https://api.wagri2.net/basic/farmland/FieldPolygonID3/Get");
  upstream.searchParams.set("lat", String(lat));
  upstream.searchParams.set("lng", String(lng));
  upstream.searchParams.set("cmp", cmp);
  let result;
  try {
    result = await fetchJsonWithTimeout(
      fetcher,
      new Request(upstream, {
        headers: { "X-Authorization": token, Accept: "application/json" },
      }),
      providerTimeoutMs(env, "WAGRI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
      request.signal,
    );
  } catch (error) {
    if (isProviderTimeoutError(error)) return providerTimeout("WAGRI筆ポリゴンAPI");
    return upstreamFailure("WAGRI筆ポリゴンAPI");
  }
  const { response, data } = result;
  if (!response.ok) return upstreamFailure("WAGRI筆ポリゴンAPI", response.status);
  return jsonResponse({ ok: true, provider: "wagri", fetchedAt: new Date().toISOString(), data });
}

export function resetWagriTokenCacheForTest() {
  cachedToken = null;
  tokenRequest = null;
}
