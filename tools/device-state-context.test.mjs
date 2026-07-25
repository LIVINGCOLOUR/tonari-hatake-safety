import assert from "node:assert/strict";
import test from "node:test";

import {
  contextStateStorageKey,
  DEMO_STATE_CONTEXT,
  deviceStateContext,
} from "../js/services/device-state-context.mjs";

test("未ログインまたは地域未選択はデモ用端末保存を使う", () => {
  const signedOut = deviceStateContext();
  const noWorkspace = deviceStateContext({ userId: "user-a" });

  assert.equal(signedOut.id, DEMO_STATE_CONTEXT);
  assert.equal(noWorkspace.id, DEMO_STATE_CONTEXT);
  assert.equal(contextStateStorageKey("app-state", signedOut), "app-state");
});

test("ログイン済み端末保存は利用者と地域の組み合わせで分離する", () => {
  const areaA = deviceStateContext({ userId: "user-a", workspaceId: "area-a" });
  const areaB = deviceStateContext({ userId: "user-a", workspaceId: "area-b" });
  const otherUser = deviceStateContext({ userId: "user-b", workspaceId: "area-a" });

  const keys = [areaA, areaB, otherUser]
    .map((context) => contextStateStorageKey("app-state", context));
  assert.equal(new Set(keys).size, 3);
  assert.match(keys[0], /user-a/);
  assert.match(keys[0], /area-a/);
});

test("保存キーに使う識別子をエスケープする", () => {
  const context = deviceStateContext({
    userId: "user/name",
    workspaceId: "area?name",
  });
  assert.equal(
    contextStateStorageKey("app-state", context),
    "app-state.account.user%2Fname.workspace.area%3Fname",
  );
});
