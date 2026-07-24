export const SYNC_STATUS = Object.freeze({
  LOCAL: "local",
  IDLE: "idle",
  SYNCING: "syncing",
  SYNCED: "synced",
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

  async function drain() {
    if (inFlight) return inFlight;
    if (!queued) return null;
    const current = queued;
    queued = null;
    publish(SYNC_STATUS.SYNCING);
    inFlight = Promise.resolve()
      .then(() => saveRemote(current))
      .then((result) => {
        publish(SYNC_STATUS.SYNCED, { result });
        return result;
      })
      .catch((error) => {
        publish(SYNC_STATUS.ERROR, { error });
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
      queued = payload;
      if (timer) clearTimer(timer);
      timer = setTimer(() => {
        timer = null;
        drain().catch(() => {});
      }, debounceMs);
    },

    async flush(payload) {
      if (payload !== undefined) queued = payload;
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
