import { errorResponse } from "../server/integrations/bff.js";

const RETRY_AFTER_SECONDS = 60;

export async function enforceProviderRateLimit(env, key) {
  const limiter = env?.INTEGRATION_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== "function") {
    return errorResponse(
      503,
      "rate-limit-unavailable",
      "外部連携の流量制御が利用できません。",
      { "Retry-After": String(RETRY_AFTER_SECONDS) },
    );
  }

  let result;
  try {
    result = await limiter.limit({ key });
  } catch {
    return errorResponse(
      503,
      "rate-limit-unavailable",
      "外部連携の流量制御が利用できません。",
      { "Retry-After": String(RETRY_AFTER_SECONDS) },
    );
  }

  if (!result?.success) {
    return errorResponse(
      429,
      "rate-limit-exceeded",
      "外部連携の利用回数が上限に達しました。時間をおいて再試行してください。",
      { "Retry-After": String(RETRY_AFTER_SECONDS) },
    );
  }
  return null;
}
