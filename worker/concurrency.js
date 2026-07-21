import { errorResponse } from "../functions/_shared/bff.js";

const activeByProvider = new Map();
const RETRY_AFTER_SECONDS = 2;

export function providerConcurrencyLimit(env, name, fallback) {
  const configured = Number(env?.[name]);
  if (!Number.isSafeInteger(configured)) return fallback;
  return Math.max(1, Math.min(configured, 10));
}

function acquire(key, limit) {
  const active = activeByProvider.get(key) || 0;
  if (active >= limit) return null;
  activeByProvider.set(key, active + 1);

  let released = false;
  return () => {
    if (released) return false;
    released = true;
    const current = activeByProvider.get(key) || 0;
    if (current <= 1) activeByProvider.delete(key);
    else activeByProvider.set(key, current - 1);
    return true;
  };
}

function providerBusy() {
  return errorResponse(
    503,
    "provider-busy",
    "外部サービスへの処理が集中しています。時間をおいて再試行してください。",
    { "Retry-After": String(RETRY_AFTER_SECONDS) },
  );
}

function holdSlotUntilBodyEnds(response, release, safetyMs) {
  const reader = response.body.getReader();
  let safetyTimer;
  const releaseOnce = () => {
    const didRelease = release();
    if (didRelease) clearTimeout(safetyTimer);
    return didRelease;
  };

  const body = new ReadableStream({
    start(controller) {
      safetyTimer = setTimeout(() => {
        const error = new Error("provider-concurrency-hold-timeout");
        if (!releaseOnce()) return;
        Promise.resolve(reader.cancel(error)).catch(() => {});
        controller.error(error);
      }, safetyMs);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (!releaseOnce()) return;
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        if (!releaseOnce()) return;
        controller.error(error);
      }
    },
    cancel(reason) {
      releaseOnce();
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function runWithProviderConcurrency(env, options, operation) {
  const limit = providerConcurrencyLimit(env, options.envName, options.defaultLimit);
  const release = acquire(options.key, limit);
  if (!release) return providerBusy();

  let response;
  try {
    response = await operation();
  } catch (error) {
    release();
    throw error;
  }

  if (!options.holdResponseBody || !response.ok || !response.body) {
    release();
    return response;
  }
  return holdSlotUntilBodyEnds(response, release, options.safetyMs);
}

export function resetProviderConcurrencyForTest() {
  activeByProvider.clear();
}

export function activeProviderConcurrencyForTest(key) {
  return activeByProvider.get(key) || 0;
}
