import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_DELETION_CONFIRMATION,
  AccountOperationsError,
  accountExportFilename,
  buildAccountExport,
  validDeletionConfirmation,
} from "../js/services/account-operations.mjs";

test("account export contains portable app data but removes secret-like keys", () => {
  const result = buildAccountExport({
    user: {
      id: "user-1",
      email: "user@example.test",
      access_token: "do-not-export",
      accessToken: "do-not-export",
      apiKey: "do-not-export",
    },
    profile: {
      name: "利用者",
      nested: { refresh_token: "do-not-export", phone: "090" },
    },
    memberships: [{ workspace_id: "workspace-1", role: "sprayer" }],
    activeWorkspaceId: "workspace-1",
    deviceState: {
      plans: [{ id: "plan-1" }],
      secret: "do-not-export",
    },
    exportedAt: "2026-07-25T12:00:00.000Z",
  });
  assert.equal(result.version, 1);
  assert.equal(result.account.id, "user-1");
  assert.equal(result.account.email, "user@example.test");
  assert.equal(result.account.access_token, undefined);
  assert.equal(result.account.accessToken, undefined);
  assert.equal(result.account.apiKey, undefined);
  assert.equal(result.account.profile.nested.refresh_token, undefined);
  assert.equal(result.account.profile.nested.phone, "090");
  assert.equal(result.deviceState.secret, undefined);
  assert.deepEqual(result.deviceState.plans, [{ id: "plan-1" }]);
});

test("account export requires an authenticated user and valid time", () => {
  assert.throws(
    () => buildAccountExport(),
    (error) => error instanceof AccountOperationsError
      && error.code === "authentication-required",
  );
  assert.throws(
    () => buildAccountExport({ user: { id: "user-1" }, exportedAt: "invalid" }),
    (error) => error instanceof AccountOperationsError
      && error.code === "invalid-export-time",
  );
});

test("account deletion confirmation must match the displayed phrase exactly", () => {
  assert.equal(validDeletionConfirmation(ACCOUNT_DELETION_CONFIRMATION), true);
  assert.equal(validDeletionConfirmation(` ${ACCOUNT_DELETION_CONFIRMATION} `), true);
  assert.equal(validDeletionConfirmation("退会"), false);
  assert.equal(accountExportFilename("2026-07-25T12:00:00Z"), "tonari-hatake-safety-backup-2026-07-25.json");
});
