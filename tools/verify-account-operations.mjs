import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "Remote verification requires Supabase URL, publishable key, and a temporary service role environment value.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userIds = [];

async function createTestClient(label) {
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const email = `tonari-account-${label}-${suffix}@example.com`;
  const password = `Tn!9${crypto.randomUUID().replaceAll("-", "")}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userIds.push(created.data.user.id);

  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return { client, userId: created.data.user.id };
}

try {
  const owner = await createTestClient("owner");
  const outsider = await createTestClient("outsider");

  const invalid = await owner.client.rpc("request_account_deletion", {
    p_confirmation: "退会",
  });
  assert.ok(invalid.error, "An incomplete confirmation unexpectedly created a request");

  const requested = await owner.client.rpc("request_account_deletion", {
    p_confirmation: "退会を申請",
  });
  if (requested.error) throw requested.error;
  assert.equal(requested.data.status, "pending");
  assert.equal(requested.data.user_id, owner.userId);

  const ownStatus = await owner.client
    .from("account_deletion_requests")
    .select("user_id, status")
    .maybeSingle();
  if (ownStatus.error) throw ownStatus.error;
  assert.equal(ownStatus.data.user_id, owner.userId);
  assert.equal(ownStatus.data.status, "pending");

  const outsiderStatus = await outsider.client
    .from("account_deletion_requests")
    .select("user_id, status")
    .maybeSingle();
  if (outsiderStatus.error) throw outsiderStatus.error;
  assert.equal(outsiderStatus.data, null);

  const directInsert = await owner.client
    .from("account_deletion_requests")
    .insert({ user_id: owner.userId, status: "completed" });
  assert.ok(directInsert.error, "Direct request insertion was unexpectedly allowed");

  const directUpdate = await owner.client
    .from("account_deletion_requests")
    .update({ status: "completed" })
    .eq("user_id", owner.userId);
  assert.ok(directUpdate.error, "Direct request update was unexpectedly allowed");

  const directDelete = await owner.client
    .from("account_deletion_requests")
    .delete()
    .eq("user_id", owner.userId);
  assert.ok(directDelete.error, "Direct request deletion was unexpectedly allowed");

  const cancelled = await owner.client.rpc("cancel_account_deletion");
  if (cancelled.error) throw cancelled.error;
  assert.equal(cancelled.data.status, "cancelled");
  assert.equal(cancelled.data.user_id, owner.userId);

  const duplicateCancel = await owner.client.rpc("cancel_account_deletion");
  assert.ok(duplicateCancel.error, "A non-pending request was cancelled twice");

  const requestedAgain = await owner.client.rpc("request_account_deletion", {
    p_confirmation: "退会を申請",
  });
  if (requestedAgain.error) throw requestedAgain.error;
  assert.equal(requestedAgain.data.status, "pending");

  const cancelledAgain = await owner.client.rpc("cancel_account_deletion");
  if (cancelledAgain.error) throw cancelledAgain.error;
  assert.equal(cancelledAgain.data.status, "cancelled");

  console.log("Supabase account operation checks passed.");
} finally {
  for (const userId of userIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}
