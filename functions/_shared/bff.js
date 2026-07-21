const JSON_HEADERS = Object.freeze({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function errorResponse(status, code, message) {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

function fixedTimeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function authorizeBff(request, env = {}) {
  if (env.INTEGRATIONS_ENABLED !== "true") {
    return errorResponse(503, "integration-disabled", "外部連携は無効です。");
  }
  if (!env.BFF_ACCESS_TOKEN || String(env.BFF_ACCESS_TOKEN).length < 32) {
    return errorResponse(503, "integration-misconfigured", "外部連携のアクセス制御が未設定です。");
  }
  const supplied = request.headers.get("X-Tonari-BFF-Token");
  if (!fixedTimeEqual(supplied, env.BFF_ACCESS_TOKEN)) {
    return errorResponse(401, "bff-unauthorized", "外部連携APIを利用できません。");
  }
  return null;
}

export function requiredSecret(env, name, providerLabel) {
  const value = String(env?.[name] || "").trim();
  if (!value) {
    return {
      ok: false,
      response: errorResponse(503, "provider-not-configured", `${providerLabel}の認証情報が未設定です。`),
    };
  }
  return { ok: true, value };
}

export async function fetchWithTimeout(fetcher, request, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function upstreamFailure(provider, status) {
  const safeStatus = Number.isInteger(status) ? status : 502;
  return errorResponse(502, "provider-request-failed", `${provider}からデータを取得できませんでした。`, {
    "X-Upstream-Status": String(safeStatus),
  });
}

export function uuidIsValid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
