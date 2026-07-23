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

export function errorResponse(status, code, message, extraHeaders = {}) {
  return jsonResponse({ ok: false, error: { code, message } }, status, extraHeaders);
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

export class ProviderTimeoutError extends Error {
  constructor(phase, timeoutMs) {
    super("provider-request-timeout");
    this.name = "ProviderTimeoutError";
    this.phase = phase;
    this.timeoutMs = timeoutMs;
  }
}

export function isProviderTimeoutError(error) {
  return error instanceof ProviderTimeoutError || error?.name === "ProviderTimeoutError";
}

export function providerTimeoutMs(env, name, fallbackMs, minMs = 1000, maxMs = 30000) {
  const configured = Number(env?.[name]);
  if (!Number.isSafeInteger(configured) || configured <= 0) return fallbackMs;
  return Math.max(minMs, Math.min(configured, maxMs));
}

async function runWithTimeout(operation, timeoutMs, parentSignal) {
  const controller = new AbortController();
  let settled = false;
  let phase = "headers";
  let timeoutError = null;
  let rejectTimeout;
  const timeoutPromise = new Promise((resolve, reject) => {
    rejectTimeout = reject;
  });
  const timeout = setTimeout(() => {
    if (settled) return;
    timeoutError = new ProviderTimeoutError(phase, timeoutMs);
    controller.abort(timeoutError);
    rejectTimeout(timeoutError);
  }, timeoutMs);
  const abortFromParent = () => controller.abort(parentSignal.reason);
  if (parentSignal) {
    if (parentSignal.aborted) abortFromParent();
    else parentSignal.addEventListener("abort", abortFromParent, { once: true });
  }
  try {
    return await Promise.race([
      operation(controller.signal, (nextPhase) => { phase = nextPhase; }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (timeoutError) throw timeoutError;
    throw error;
  } finally {
    settled = true;
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export function fetchWithTimeout(fetcher, request, timeoutMs = 12000, parentSignal) {
  return runWithTimeout(
    (signal) => fetcher(request, { signal }),
    timeoutMs,
    parentSignal,
  );
}

export function fetchJsonWithTimeout(fetcher, request, timeoutMs = 12000, parentSignal) {
  return runWithTimeout(async (signal, setPhase) => {
    const response = await fetcher(request, { signal });
    if (!response.ok) return { response, data: null };
    setPhase("json");
    return { response, data: await response.json() };
  }, timeoutMs, parentSignal);
}

export function upstreamFailure(provider, status) {
  const safeStatus = Number.isInteger(status) ? status : 502;
  return errorResponse(502, "provider-request-failed", `${provider}からデータを取得できませんでした。`, {
    "X-Upstream-Status": String(safeStatus),
  });
}

export function providerTimeout(provider) {
  return errorResponse(504, "provider-timeout", `${provider}の応答が制限時間を超えました。`, {
    "Retry-After": "5",
  });
}

export function providerResponseTooLarge(provider, maxBytes) {
  return errorResponse(
    502,
    "provider-response-too-large",
    `${provider}の応答が上限（${maxBytes} bytes）を超えました。`,
  );
}

export function responseByteLimit(env, name, fallbackBytes) {
  const configured = Number(env?.[name]);
  if (!Number.isSafeInteger(configured) || configured <= 0) return fallbackBytes;
  return Math.min(configured, 25 * 1024 * 1024);
}

export function contentLengthExceeds(response, maxBytes) {
  const length = responseContentLength(response);
  return length !== null && length > maxBytes;
}

export function responseContentLength(response) {
  const value = response.headers.get("Content-Length");
  if (!value) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 ? length : null;
}

// Keeps the upstream body streaming while terminating a missing/misreported
// Content-Length response if it crosses the configured safety cap.
export function byteLimitedStream(body, maxBytes, timeoutMs = 30000, expectedBytes = null) {
  if (!body) return null;
  const reader = body.getReader();
  let received = 0;
  let finished = false;
  let timeout;
  const clearDeadline = () => clearTimeout(timeout);
  const fail = (controller, error) => {
    if (finished) return;
    finished = true;
    clearDeadline();
    Promise.resolve(reader.cancel(error)).catch(() => {});
    controller.error(error);
  };
  return new ReadableStream({
    start(controller) {
      timeout = setTimeout(() => {
        fail(controller, new ProviderTimeoutError("body", timeoutMs));
      }, timeoutMs);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (finished) return;
        if (done) {
          if (expectedBytes !== null && received !== expectedBytes) {
            fail(controller, new Error("provider-response-truncated"));
            return;
          }
          finished = true;
          clearDeadline();
          controller.close();
          return;
        }
        received += value.byteLength;
        if (received > maxBytes) {
          fail(controller, new Error("provider-response-too-large"));
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        if (finished) return;
        finished = true;
        clearDeadline();
        controller.error(error);
      }
    },
    cancel(reason) {
      if (finished) return undefined;
      finished = true;
      clearDeadline();
      return reader.cancel(reason);
    },
  });
}

export function uuidIsValid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
