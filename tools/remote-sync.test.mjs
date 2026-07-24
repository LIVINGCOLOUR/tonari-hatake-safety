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
