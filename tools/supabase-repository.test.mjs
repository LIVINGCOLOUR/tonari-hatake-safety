import assert from "node:assert/strict";
import test from "node:test";

import {
  createSupabaseAppStateRepository,
  fieldToRow,
  notificationToRow,
  planToRow,
  reportToRow,
  rowToField,
  rowToPlan,
  weatherToRow,
} from "../js/repositories/supabase-app-state.mjs";

const context = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  syncedAt: "2026-07-24T00:00:00.000Z",
};

test("圃場を正規化列と元データへ変換できる", () => {
  const field = {
    id: "field-a",
    name: "有機ほ場A",
    type: "organic",
    crop: "小松菜",
    geometry: { type: "Polygon", coordinates: [[[140, 36], [140.1, 36], [140, 36]]] },
    custom: "kept",
    ownerUserId: "00000000-0000-4000-8000-000000000099",
  };
  const row = fieldToRow(field, context);
  assert.equal(row.client_ref, "field-a");
  assert.equal(row.field_type, "organic");
  assert.equal(row.field_data.custom, "kept");
  assert.equal(row.owner_user_id, field.ownerUserId);
  const restored = rowToField({ ...row, version: 2 });
  assert.equal(restored.id, "field-a");
  assert.equal(restored.custom, "kept");
  assert.equal(restored.remoteVersion, 2);
  assert.equal(restored.ownerUserId, field.ownerUserId);
});

test("計画は圃場UUIDへ解決し往復できる", () => {
  const plan = {
    id: "plan-a",
    fieldId: "field-a",
    date: "2026-07-24",
    materialType: "肥料",
    pesticide: "液肥A",
    report: {},
  };
  const fieldUuid = "00000000-0000-4000-8000-000000000010";
  const row = planToRow(plan, context, new Map([["field-a", fieldUuid]]));
  assert.equal(row.operation_type, "fertilizer");
  assert.equal(row.field_id, fieldUuid);
  const restored = rowToPlan({ ...row, version: 3 }, new Map([[fieldUuid, "field-a"]]));
  assert.equal(restored.fieldId, "field-a");
  assert.equal(restored.remoteVersion, 3);
});

test("気象・通知・実施報告に安定した同期キーを付ける", () => {
  const plan = {
    id: "plan-a",
    district: "笠間市",
    weather: { source: "Open-Meteo", windSpeed: 2.4 },
    notificationTargets: { "field-a": true },
    notificationResponses: { "field-a": "確認しました" },
    notificationReplyNotes: { "field-a": "朝7時以降を希望" },
    notificationAcks: { "field-a": "2026-07-24T00:10:00.000Z" },
    report: { doneDate: "2026-07-24", actualAmount: "500mL" },
  };
  const planUuid = "00000000-0000-4000-8000-000000000020";
  const weather = weatherToRow(plan, planUuid, context);
  const notice = notificationToRow(plan, "field-a", { ...context, planUuid });
  const report = reportToRow(plan, planUuid, context);
  assert.equal(weather.source_key, "current");
  assert.equal(notice.target_key, "field:field-a");
  assert.equal(notice.response_code, "confirmed");
  assert.equal(notice.notification_data.replyNote, "朝7時以降を希望");
  assert.equal(notice.notification_data.acknowledgedAt, "2026-07-24T00:10:00.000Z");
  assert.equal(report.idempotency_key, "work-record:plan-a");
});

function versionedClient(updatedRows) {
  return {
    from(table) {
      if (table === "fields") {
        const chain = {
          update() {
            return chain;
          },
          eq() {
            return chain;
          },
          async select() {
            return { data: updatedRows, error: null };
          },
        };
        return chain;
      }
      if (table === "workspaces") {
        return {
          update() {
            return {
              async eq() {
                return { data: [], error: null };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

test("最後に読んだ版と一致する場合だけ圃場を更新する", async () => {
  const repository = createSupabaseAppStateRepository({
    client: versionedClient([{
      id: "00000000-0000-4000-8000-000000000010",
      client_ref: "field-a",
      version: 5,
    }]),
  });
  const result = await repository.save({
    workspaceId: context.workspaceId,
    userId: context.userId,
    state: {
      fields: [{ id: "field-a", name: "圃場A", remoteVersion: 4 }],
      plans: [],
      settings: {},
    },
  });
  assert.equal(result.remoteVersions.fields["field-a"], 5);
});

test("版が一致しない更新は競合として停止する", async () => {
  const repository = createSupabaseAppStateRepository({
    client: versionedClient([]),
  });
  await assert.rejects(
    repository.save({
      workspaceId: context.workspaceId,
      userId: context.userId,
      state: {
        fields: [{ id: "field-a", name: "圃場A", remoteVersion: 4 }],
        plans: [],
        settings: {},
      },
    }),
    (error) => error?.code === "conflict",
  );
});
