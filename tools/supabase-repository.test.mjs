import assert from "node:assert/strict";
import test from "node:test";

import {
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
  };
  const row = fieldToRow(field, context);
  assert.equal(row.client_ref, "field-a");
  assert.equal(row.field_type, "organic");
  assert.equal(row.field_data.custom, "kept");
  const restored = rowToField({ ...row, version: 2 });
  assert.equal(restored.id, "field-a");
  assert.equal(restored.custom, "kept");
  assert.equal(restored.remoteVersion, 2);
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
    report: { doneDate: "2026-07-24", actualAmount: "500mL" },
  };
  const planUuid = "00000000-0000-4000-8000-000000000020";
  const weather = weatherToRow(plan, planUuid, context);
  const notice = notificationToRow(plan, "field-a", { ...context, planUuid });
  const report = reportToRow(plan, planUuid, context);
  assert.equal(weather.source_key, "current");
  assert.equal(notice.target_key, "field:field-a");
  assert.equal(notice.response_code, "confirmed");
  assert.equal(report.idempotency_key, "work-record:plan-a");
});
