import assert from "node:assert/strict";
import test from "node:test";

import { createRemoteSyncCoordinator, SYNC_STATUS } from "../js/services/remote-sync.mjs";

test("短時間の変更は最新状態だけを保存する", async () => {
  const timers = [];
  const saved = [];
  const coordinator = createRemoteSyncCoordinator({
    saveRemote: async (payload) => saved.push(payload),
    debounceMs: 10,
    setTimer(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimer() {},
  });
  coordinator.schedule({ revision: 1 });
  coordinator.schedule({ revision: 2 });
  await timers.at(-1)();
  await coordinator.flush();
  assert.deepEqual(saved, [{ revision: 2 }]);
  assert.equal(coordinator.status(), SYNC_STATUS.SYNCED);
});

test("保存失敗を状態として通知し再試行できる", async () => {
  let attempts = 0;
  const coordinator = createRemoteSyncCoordinator({
    saveRemote: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return { ok: true };
    },
    debounceMs: 0,
  });
  await assert.rejects(coordinator.flush({ revision: 1 }), /offline/);
  assert.equal(coordinator.status(), SYNC_STATUS.ERROR);
  await coordinator.flush({ revision: 1 });
  assert.equal(coordinator.status(), SYNC_STATUS.SYNCED);
});

test("別端末による更新競合は通常の通信失敗と区別する", async () => {
  const statuses = [];
  const coordinator = createRemoteSyncCoordinator({
    saveRemote: async () => {
      const error = new Error("stale");
      error.code = "conflict";
      throw error;
    },
    debounceMs: 0,
    onStatus: ({ status }) => statuses.push(status),
  });
  await assert.rejects(coordinator.flush({ revision: 1 }), /stale/);
  assert.equal(coordinator.status(), SYNC_STATUS.CONFLICT);
  assert.deepEqual(statuses, [SYNC_STATUS.SYNCING, SYNC_STATUS.CONFLICT]);
});

test("送信単位のIDを待機・完了状態へ引き継ぐ", async () => {
  const queued = [];
  const statuses = [];
  const ids = ["queue-a", "queue-b"];
  const coordinator = createRemoteSyncCoordinator({
    saveRemote: async (payload) => ({ revision: payload.revision }),
    debounceMs: 0,
    createQueueId: () => ids.shift(),
    onQueued: ({ queueId, payload }) => queued.push({ queueId, payload }),
    onStatus: ({ status, queueId }) => statuses.push({ status, queueId }),
  });

  await coordinator.flush({ revision: 1 });
  await coordinator.flush({ revision: 2 });

  assert.deepEqual(queued, [
    { queueId: "queue-a", payload: { revision: 1 } },
    { queueId: "queue-b", payload: { revision: 2 } },
  ]);
  assert.deepEqual(statuses, [
    { status: SYNC_STATUS.SYNCING, queueId: "queue-a" },
    { status: SYNC_STATUS.SYNCED, queueId: "queue-a" },
    { status: SYNC_STATUS.SYNCING, queueId: "queue-b" },
    { status: SYNC_STATUS.SYNCED, queueId: "queue-b" },
  ]);
});
