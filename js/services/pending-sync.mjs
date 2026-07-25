const DEFAULT_PREFIX = "tonariHatakeSafety.pendingCloudSync.";

function normalizeMarker(value) {
  if (!value || value.version !== 1 || !value.queueId || !value.workspaceId || !value.userId) {
    return null;
  }
  return {
    version: 1,
    queueId: String(value.queueId),
    workspaceId: String(value.workspaceId),
    userId: String(value.userId),
    queuedAt: String(value.queuedAt || ""),
    updatedAt: String(value.updatedAt || value.queuedAt || ""),
    attempts: Math.max(0, Number(value.attempts) || 0),
    lastError: String(value.lastError || ""),
  };
}

export function createPendingSyncStore({
  storage,
  prefix = DEFAULT_PREFIX,
  now = () => new Date().toISOString(),
} = {}) {
  if (!storage) throw new TypeError("未送信状態の保存先が必要です。");

  function key(workspaceId, userId) {
    return `${prefix}${encodeURIComponent(String(workspaceId || ""))}.${encodeURIComponent(String(userId || ""))}`;
  }

  function read(workspaceId, userId) {
    try {
      return normalizeMarker(JSON.parse(storage.getItem(key(workspaceId, userId)) || "null"));
    } catch {
      return null;
    }
  }

  function write({ workspaceId, userId, queueId }) {
    const timestamp = now();
    const current = read(workspaceId, userId);
    const marker = {
      version: 1,
      queueId: String(queueId),
      workspaceId: String(workspaceId),
      userId: String(userId),
      queuedAt: current?.queuedAt || timestamp,
      updatedAt: timestamp,
      attempts: current?.attempts || 0,
      lastError: current?.lastError || "",
    };
    try {
      storage.setItem(key(workspaceId, userId), JSON.stringify(marker));
      return marker;
    } catch {
      return current;
    }
  }

  function markAttempt(workspaceId, userId, queueId, error = "") {
    const current = read(workspaceId, userId);
    if (!current || current.queueId !== String(queueId)) return current;
    const marker = {
      ...current,
      updatedAt: now(),
      attempts: current.attempts + 1,
      lastError: String(error?.message || error || ""),
    };
    try {
      storage.setItem(key(workspaceId, userId), JSON.stringify(marker));
      return marker;
    } catch {
      return current;
    }
  }

  function clearIfMatches(workspaceId, userId, queueId) {
    const current = read(workspaceId, userId);
    if (!current || current.queueId !== String(queueId)) return false;
    try {
      storage.removeItem(key(workspaceId, userId));
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({ read, write, markAttempt, clearIfMatches });
}
