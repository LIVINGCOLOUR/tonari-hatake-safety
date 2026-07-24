const DATA_MODES = new Set(["local", "hybrid", "supabase"]);

export class SupabaseConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SupabaseConfigurationError";
    this.code = code;
  }
}

function normalizedMode(value) {
  const mode = String(value || "local").trim().toLowerCase();
  return DATA_MODES.has(mode) ? mode : "local";
}

function validProjectUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      || ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}

function validPublishableKey(value) {
  const key = String(value || "").trim();
  return key.startsWith("sb_publishable_")
    || (key.startsWith("eyJ") && key.split(".").length === 3);
}

export function normalizeSupabaseRuntimeConfig(input = {}) {
  const mode = normalizedMode(input.mode);
  const url = String(input.url || "").trim().replace(/\/+$/, "");
  const publishableKey = String(input.publishableKey || "").trim();
  const configured = validProjectUrl(url) && validPublishableKey(publishableKey);

  return Object.freeze({
    mode: configured ? mode : "local",
    requestedMode: mode,
    url,
    publishableKey,
    configured,
  });
}
export function createSupabaseRuntime({
  config,
  library,
  storage,
  fetch: fetchImplementation,
} = {}) {
  const normalized = normalizeSupabaseRuntimeConfig(config);
  if (!normalized.configured || normalized.mode === "local") {
    return Object.freeze({
      enabled: false,
      mode: "local",
      client: null,
      config: normalized,
      reason: normalized.configured ? "local-mode" : "not-configured",
    });
  }
  if (!library || typeof library.createClient !== "function") {
    throw new SupabaseConfigurationError(
      "missing-library",
      "Supabaseクライアントを読み込めません。",
    );
  }

  const options = {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      storage,
    },
    global: {
      headers: {
        "X-Client-Info": "tonari-hatake-safety/0.1",
      },
    },
  };
  if (fetchImplementation) options.global.fetch = fetchImplementation;

  return Object.freeze({
    enabled: true,
    mode: normalized.mode,
    client: library.createClient(
      normalized.url,
      normalized.publishableKey,
      options,
    ),
    config: normalized,
    reason: "",
  });
}
