import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { createSupabaseAppStateRepository } from "../js/repositories/supabase-app-state.mjs";
import { createSupabaseStorageService } from "../js/services/supabase-storage.mjs";

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Remote verification requires Supabase URL, publishable key, and a temporary service role environment value.");
}

const suffix = crypto.randomUUID().replaceAll("-", "");
const email = `tonari-adapter-${suffix}@example.com`;
const password = `Tn!9${crypto.randomUUID().replaceAll("-", "")}`;
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let userId = "";
let workspaceId = "";

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  const workspace = await client.rpc("create_workspace_with_admin", {
    p_name: "Adapter temporary test",
    p_prefecture: "茨城県",
    p_municipality: "笠間市",
    p_district: "test",
  });
  if (workspace.error) throw workspace.error;
  workspaceId = workspace.data;

  const storage = createSupabaseStorageService({ client });
  const repository = createSupabaseAppStateRepository({
    client,
    storageService: storage,
  });
  const state = {
    profile: { registered: true, role: "sprayer", name: "試験者" },
    equipmentTemplate: {},
    settings: { regionName: "同期試験地域" },
    fields: [{
      id: "field-adapter-e2e",
      name: "同期試験圃場",
      type: "spray",
      crop: "水稲",
      visibilityLevel: "private",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [140.25, 36.34],
          [140.251, 36.34],
          [140.251, 36.341],
          [140.25, 36.341],
          [140.25, 36.34],
        ]],
      },
      geometryRevision: "adapter-e2e",
    }],
    plans: [{
      id: "plan-adapter-e2e",
      fieldId: "field-adapter-e2e",
      fieldName: "同期試験圃場",
      date: "2026-07-24",
      timeWindow: "06:00-07:00",
      district: "笠間市",
      operator: "試験者",
      materialType: "農薬",
      pesticide: "試験資材",
      purpose: "同期確認",
      visibilityLevel: "private",
      weather: { source: "Open-Meteo", windSpeed: 2.1, windDirection: "北" },
      checks: { label: true, weatherForecast: true },
      notificationTargets: { "field-adapter-e2e": true },
      notificationResponses: { "field-adapter-e2e": "確認しました" },
      report: {
        doneDate: "2026-07-24",
        actualAmount: "500mL",
        photoName: "adapter-test.png",
        photoData: "data:image/png;base64,aGVsbG8=",
      },
      droneLog: {
        vendor: "test-provider",
        model: "test-model",
        imported: true,
        points: [
          { x: 1, y: 1, altitude: 2, sprayOn: true },
          { x: 2, y: 2, altitude: 2, sprayOn: true },
        ],
      },
    }],
  };

  const saved = await repository.save({ workspaceId, userId, state });
  assert.equal(saved.fields, 1);
  assert.equal(saved.plans, 1);
  assert.equal(saved.assetsSaved, 2);
  assert.equal(saved.assetsPending, 0);

  const loaded = await repository.load({ workspaceId, localState: state });
  assert.equal(loaded.workspace.fields[0].id, "field-adapter-e2e");
  assert.equal(loaded.workspace.plans[0].id, "plan-adapter-e2e");
  assert.equal(loaded.workspace.plans[0].checks.label, true);
  assert.equal(
    loaded.workspace.plans[0].notificationResponses["field-adapter-e2e"],
    "確認しました",
  );
  assert.equal(loaded.workspace.plans[0].report.actualAmount, "500mL");

  const versionedState = {
    ...state,
    fields: loaded.workspace.fields,
    plans: loaded.workspace.plans.map((plan) => ({
      ...plan,
      report: { ...(plan.report || {}), photoData: undefined },
      droneLog: { ...(plan.droneLog || {}), points: undefined },
    })),
  };
  await repository.save({ workspaceId, userId, state: versionedState });
  await assert.rejects(
    repository.save({ workspaceId, userId, state: versionedState }),
    (error) => error?.code === "conflict",
  );

  const assets = await client
    .from("app_assets")
    .select("id, bucket_id, object_path")
    .eq("workspace_id", workspaceId);
  if (assets.error) throw assets.error;
  assert.equal(assets.data.length, 2);
  const logs = await client
    .from("flight_logs")
    .select("id")
    .eq("workspace_id", workspaceId);
  if (logs.error) throw logs.error;
  assert.equal(logs.data.length, 1);

  console.log("Supabase adapter round-trip checks passed.");
} finally {
  if (workspaceId) {
    const assets = await admin
      .from("app_assets")
      .select("bucket_id, object_path")
      .eq("workspace_id", workspaceId);
    if (!assets.error) {
      const byBucket = new Map();
      assets.data.forEach((asset) => {
        const records = byBucket.get(asset.bucket_id) || [];
        records.push(asset);
        byBucket.set(asset.bucket_id, records);
      });
      for (const [bucket, records] of byBucket) {
        await admin.storage.from(bucket).remove(records.map((record) => record.object_path));
      }
    }
    await admin.from("workspaces").delete().eq("id", workspaceId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}
