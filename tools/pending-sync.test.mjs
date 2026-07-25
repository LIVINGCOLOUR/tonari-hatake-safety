import assert from "node:assert/strict";
import test from "node:test";

import { createPendingSyncStore } from "../js/services/pending-sync.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    raw: values,
  };
}

test("未送信状態を地域と利用者の組み合わせごとに保持する", () => {
  const storage = memoryStorage();
  const store = createPendingSyncStore({
    storage,
    now: () => "2026-07-25T01:02:03.000Z",
  });

  store.write({ workspaceId: "area-a", userId: "user-a", queueId: "queue-a" });

  assert.deepEqual(store.read("area-a", "user-a"), {
    version: 1,
    queueId: "queue-a",
    workspaceId: "area-a",
    userId: "user-a",
    queuedAt: "2026-07-25T01:02:03.000Z",
    updatedAt: "2026-07-25T01:02:03.000Z",
    attempts: 0,
    lastError: "",
  });
  assert.equal(store.read("area-a", "user-b"), null);
});

test("新しい未送信を古い送信完了で消さない", () => {
  const storage = memoryStorage();
  let timestamp = 0;
  const store = createPendingSyncStore({
    storage,
    now: () => `2026-07-25T01:02:0${timestamp++}.000Z`,
  });

  store.write({ workspaceId: "area-a", userId: "user-a", queueId: "queue-old" });
  store.write({ workspaceId: "area-a", userId: "user-a", queueId: "queue-new" });

  assert.equal(store.clearIfMatches("area-a", "user-a", "queue-old"), false);
  assert.equal(store.read("area-a", "user-a").queueId, "queue-new");
  assert.equal(store.clearIfMatches("area-a", "user-a", "queue-new"), true);
  assert.equal(store.read("area-a", "user-a"), null);
});

test("失敗回数を記録し、壊れた保存値は未送信として扱わない", () => {
  const storage = memoryStorage();
  const store = createPendingSyncStore({ storage, now: () => "2026-07-25T02:00:00.000Z" });
  store.write({ workspaceId: "area-a", userId: "user-a", queueId: "queue-a" });
  store.markAttempt("area-a", "user-a", "queue-a", new Error("offline"));

  assert.equal(store.read("area-a", "user-a").attempts, 1);
  assert.equal(store.read("area-a", "user-a").lastError, "offline");

  const [key] = storage.raw.keys();
  storage.setItem(key, "{broken");
  assert.equal(store.read("area-a", "user-a"), null);
});

test("新しい編集でも初回未送信時刻と再試行回数を引き継ぐ", () => {
  const storage = memoryStorage();
  const timestamps = [
    "2026-07-25T01:00:00.000Z",
    "2026-07-25T01:05:00.000Z",
    "2026-07-25T01:10:00.000Z",
  ];
  const store = createPendingSyncStore({ storage, now: () => timestamps.shift() });

  store.write({ workspaceId: "area-a", userId: "user-a", queueId: "queue-a" });
  store.markAttempt("area-a", "user-a", "queue-a", "offline");
  store.write({ workspaceId: "area-a", userId: "user-a", queueId: "queue-b" });

  const marker = store.read("area-a", "user-a");
  assert.equal(marker.queueId, "queue-b");
  assert.equal(marker.queuedAt, "2026-07-25T01:00:00.000Z");
  assert.equal(marker.updatedAt, "2026-07-25T01:10:00.000Z");
  assert.equal(marker.attempts, 1);
  assert.equal(marker.lastError, "offline");
});

test("未送信マーカーの保存失敗は同期処理へ例外を漏らさない", () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {
      throw new Error("locked");
    },
  };
  const store = createPendingSyncStore({ storage });

  assert.doesNotThrow(() => store.write({
    workspaceId: "area-a",
    userId: "user-a",
    queueId: "queue-a",
  }));
  assert.equal(store.clearIfMatches("area-a", "user-a", "queue-a"), false);
});
