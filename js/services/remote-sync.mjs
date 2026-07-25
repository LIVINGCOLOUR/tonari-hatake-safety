export const SYNC_STATUS = Object.freeze({
  LOCAL: "local",
  IDLE: "idle",
  SYNCING: "syncing",
  SYNCED: "synced",
  CONFLICT: "conflict",
  ERROR: "error",
});

export class RemoteSyncError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "RemoteSyncError";
    this.code = code;
  }
}

export function createRemoteSyncCoordinator({
  saveRemote,
  debounceMs = 800,
  onStatus = () => {},
  onQueued = () => {},
  createQueueId = () => globalThis.crypto?.randomUUID?.()
    || `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (typeof saveRemote !== "function") {
    throw new RemoteSyncError("missing-save", "クラウド保存処理が設定されていません。");
  }

  let timer = null;
  let queued = null;
  let inFlight = null;
  let status = SYNC_STATUS.IDLE;

  function publish(next, detail = {}) {
    status = next;
    onStatus({ status, ...detail });
  }

  function queue(payload) {
    const item = { payload, queueId: createQueueId() };
    queued = item;
    onQueued(item);
    return item;
  }

  async function drain() {
    if (inFlight) return inFlight;
    if (!queued) return null;
    const current = queued;
    queued = null;
    publish(SYNC_STATUS.SYNCING, { queueId: current.queueId });
    inFlight = Promise.resolve()
      .then(() => saveRemote(current.payload))
      .then((result) => {
        publish(SYNC_STATUS.SYNCED, { result, queueId: current.queueId });
        return result;
      })
      .catch((error) => {
        publish(
          error?.code === "conflict" ? SYNC_STATUS.CONFLICT : SYNC_STATUS.ERROR,
          { error, queueId: current.queueId },
        );
        throw error;
      })
      .finally(() => {
        inFlight = null;
        if (queued) {
          timer = setTimer(() => {
            timer = null;
            drain().catch(() => {});
          }, 0);
        }
      });
    return inFlight;
  }

  return Object.freeze({
    schedule(payload) {
      queue(payload);
      if (timer) clearTimer(timer);
      timer = setTimer(() => {
        timer = null;
        drain().catch(() => {});
      }, debounceMs);
    },

    async flush(payload) {
      if (payload !== undefined) queue(payload);
      if (timer) {
        clearTimer(timer);
        timer = null;
      }
      if (inFlight) await inFlight.catch(() => {});
      return drain();
    },

    cancel() {
      if (timer) clearTimer(timer);
      timer = null;
      queued = null;
      publish(SYNC_STATUS.IDLE);
    },

    status() {
      return status;
    },
  });
}
