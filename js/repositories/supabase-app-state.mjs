import {
  SYNC_PAYLOAD_VERSION,
  buildRemoteSyncPayload,
  validateRemoteSyncPayload,
} from "../domain/sync.mjs";
import { flightTrackAsset, reportPhotoAsset } from "../services/supabase-storage.mjs";

export class SupabaseRepositoryError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "SupabaseRepositoryError";
    this.code = code;
  }
}

const allowedFieldTypes = new Set([
  "spray", "organic", "noChemical", "house", "preharvest",
  "water", "bee", "public", "other",
]);
const allowedPlanStatuses = new Set([
  "draft", "planned", "in_progress", "completed", "postponed", "cancelled",
]);
const responseToCode = new Map([
  ["未回答", "unanswered"],
  ["確認しました", "confirmed"],
  ["時間変更希望", "change_requested"],
  ["電話希望", "call_requested"],
  ["収穫日につき要相談", "harvest_consultation"],
]);
const codeToResponse = new Map([
  ["unanswered", "未回答"],
  ["confirmed", "確認しました"],
  ["change_requested", "時間変更希望"],
  ["call_requested", "電話希望"],
  ["harvest_consultation", "収穫日につき要相談"],
]);

function clone(value, fallback) {
  if (value === undefined) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function required(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new SupabaseRepositoryError("missing-value", `${label}が設定されていません。`);
  }
  return normalized;
}

function resultData(result, operation) {
  if (result?.error) {
    throw new SupabaseRepositoryError(
      `${operation}-failed`,
      "クラウドとの同期を完了できませんでした。",
      { cause: result.error },
    );
  }
  return result?.data || [];
}

function dateOrNull(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function visibilityLevel(value) {
  return ["private", "related", "workspace"].includes(value) ? value : "related";
}

function operationType(plan) {
  const value = `${plan?.materialType || ""} ${plan?.operationType || ""}`.toLowerCase();
  if (value.includes("肥料") || value.includes("fertilizer")) return "fertilizer";
  if (value.includes("農薬") || value.includes("除草") || value.includes("pesticide")) return "pesticide";
  return "other";
}

function planStatus(plan) {
  if (plan?.report?.doneDate) return "completed";
  const value = String(plan?.status || "").toLowerCase();
  return allowedPlanStatuses.has(value) ? value : "planned";
}

export function fieldToRow(field, context) {
  return {
    workspace_id: required(context?.workspaceId, "地域"),
    client_ref: required(field?.id, "圃場ID"),
    owner_user_id: required(context?.userId, "利用者"),
    name: String(field?.name || "名称未設定"),
    field_type: allowedFieldTypes.has(field?.type) ? field.type : "other",
    crop: String(field?.crop || "未登録"),
    cultivation: String(field?.cultivation || "未登録・未回答"),
    chemical_use: String(field?.chemicalUse || "未回答"),
    organic_jas: String(field?.organicJas || "未回答"),
    notify_preference: String(field?.notifyPreference || "未確認"),
    contact_method: String(field?.contactMethod || "未確認"),
    harvest_window: String(field?.harvestWindow || "未登録"),
    avoid_reason: String(field?.avoidReason || ""),
    visibility_level: visibilityLevel(field?.visibilityLevel),
    geometry: field?.geometry || null,
    geometry_revision: String(field?.geometryRevision || "missing"),
    external_refs: arrayValue(field?.externalRefs),
    provenance: objectValue(field?.provenance),
    field_data: clone(field, {}),
  };
}

export function rowToField(row) {
  return {
    ...clone(objectValue(row?.field_data), {}),
    id: String(row?.client_ref || ""),
    name: String(row?.name || ""),
    type: allowedFieldTypes.has(row?.field_type) ? row.field_type : "other",
    crop: String(row?.crop || "未登録"),
    cultivation: String(row?.cultivation || "未登録・未回答"),
    chemicalUse: String(row?.chemical_use || "未回答"),
    organicJas: String(row?.organic_jas || "未回答"),
    notifyPreference: String(row?.notify_preference || "未確認"),
    contactMethod: String(row?.contact_method || "未確認"),
    harvestWindow: String(row?.harvest_window || "未登録"),
    avoidReason: String(row?.avoid_reason || ""),
    visibilityLevel: visibilityLevel(row?.visibility_level),
    geometry: row?.geometry || row?.field_data?.geometry || null,
    geometryRevision: String(row?.geometry_revision || "missing"),
    externalRefs: arrayValue(row?.external_refs),
    provenance: objectValue(row?.provenance),
    remoteVersion: Number(row?.version || 1),
  };
}

export function planToRow(plan, context, fieldUuidByClientRef = new Map()) {
  return {
    workspace_id: required(context?.workspaceId, "地域"),
    client_ref: required(plan?.id, "計画ID"),
    field_id: fieldUuidByClientRef.get(String(plan?.fieldId || "")) || null,
    created_by: required(context?.userId, "利用者"),
    operation_type: operationType(plan),
    status: planStatus(plan),
    planned_date: dateOrNull(plan?.date),
    time_window: String(plan?.timeWindow || ""),
    district: String(plan?.district || ""),
    operator_display_name: String(plan?.operator || ""),
    material_name: String(plan?.pesticide || plan?.materialName || ""),
    purpose: String(plan?.purpose || ""),
    visibility_level: visibilityLevel(plan?.visibilityLevel),
    plan_data: clone(plan, {}),
    idempotency_key: `plan:${required(plan?.id, "計画ID")}`,
  };
}

export function rowToPlan(row, fieldClientRefByUuid = new Map()) {
  const plan = clone(objectValue(row?.plan_data), {});
  return {
    ...plan,
    id: String(row?.client_ref || ""),
    fieldId: fieldClientRefByUuid.get(String(row?.field_id || "")) || plan.fieldId || null,
    date: row?.planned_date || plan.date || "",
    timeWindow: String(row?.time_window || plan.timeWindow || ""),
    district: String(row?.district || plan.district || ""),
    operator: String(row?.operator_display_name || plan.operator || ""),
    pesticide: String(row?.material_name || plan.pesticide || ""),
    purpose: String(row?.purpose || plan.purpose || ""),
    status: String(row?.status || plan.status || "planned"),
    visibilityLevel: visibilityLevel(row?.visibility_level),
    remoteVersion: Number(row?.version || 1),
  };
}

export function weatherToRow(plan, planUuid, context) {
  const weather = objectValue(plan?.weather);
  return {
    workspace_id: required(context?.workspaceId, "地域"),
    plan_id: required(planUuid, "計画"),
    record_type: "forecast",
    source_key: "current",
    recorded_by: context?.userId || null,
    source: String(weather.source || "Open-Meteo"),
    wind_direction: String(weather.windDirection || weather.direction || ""),
    wind_speed_mps: numberOrNull(weather.windSpeed),
    gust_mps: numberOrNull(weather.gust),
    temperature_c: numberOrNull(weather.temperature),
    humidity_percent: numberOrNull(weather.humidity),
    precipitation_mm: numberOrNull(weather.precipitation),
    location_label: String(weather.locationLabel || plan?.district || ""),
    weather_data: clone(weather, {}),
  };
}

export function notificationToRow(plan, fieldClientRef, context) {
  const response = String(plan?.notificationResponses?.[fieldClientRef] || "未回答");
  const delivered = Boolean(plan?.notificationTargets?.[fieldClientRef]);
  return {
    workspace_id: required(context?.workspaceId, "地域"),
    plan_id: required(context?.planUuid, "計画"),
    field_id: context?.fieldUuid || null,
    target_key: `field:${required(fieldClientRef, "通知対象圃場")}`,
    channel: String(context?.channel || "line"),
    delivery_status: delivered ? "delivered" : "pending",
    delivered_at: delivered ? context?.syncedAt || new Date().toISOString() : null,
    response_code: responseToCode.get(response) || "other",
    response_message: responseToCode.has(response) ? "" : response,
    responded_at: response !== "未回答" ? context?.syncedAt || new Date().toISOString() : null,
    response_by: response !== "未回答" ? context?.userId || null : null,
    notification_data: { clientFieldRef: fieldClientRef },
    idempotency_key: `notification:${plan.id}:${fieldClientRef}`,
  };
}

export function reportToRow(plan, planUuid, context) {
  const report = objectValue(plan?.report);
  return {
    workspace_id: required(context?.workspaceId, "地域"),
    plan_id: required(planUuid, "計画"),
    submitted_by: required(context?.userId, "利用者"),
    status: report.doneDate ? "submitted" : "draft",
    completed_date: dateOrNull(report.doneDate),
    completed_time_window: String(report.doneTime || report.timeWindow || ""),
    actual_area_ha: numberOrNull(report.actualAreaHa || plan?.areaHa),
    actual_amount: String(report.actualAmount || ""),
    incident_status: String(report.incidentStatus || "none"),
    inquiry_status: String(report.inquiryStatus || "none"),
    report_data: clone(report, {}),
    idempotency_key: `work-record:${plan.id}`,
    submitted_at: report.doneDate ? context?.syncedAt || new Date().toISOString() : null,
  };
}

function mergeRelatedRows(plans, related) {
  const byUuid = new Map(plans.map((entry) => [entry.uuid, entry.plan]));
  arrayValue(related.checks).forEach((row) => {
    const plan = byUuid.get(String(row.plan_id));
    if (plan) plan.checks = { ...(plan.checks || {}), [row.check_key]: Boolean(row.is_checked) };
  });
  arrayValue(related.weather).forEach((row) => {
    const plan = byUuid.get(String(row.plan_id));
    if (plan && row.record_type === "forecast") {
      plan.weather = { ...objectValue(plan.weather), ...clone(objectValue(row.weather_data), {}) };
    }
  });
  arrayValue(related.notifications).forEach((row) => {
    const plan = byUuid.get(String(row.plan_id));
    const fieldRef = String(row.notification_data?.clientFieldRef || "").trim();
    if (!plan || !fieldRef) return;
    plan.notificationTargets = {
      ...(plan.notificationTargets || {}),
      [fieldRef]: ["sent", "delivered"].includes(row.delivery_status),
    };
    plan.notificationResponses = {
      ...(plan.notificationResponses || {}),
      [fieldRef]: row.response_code === "other"
        ? String(row.response_message || "未回答")
        : (codeToResponse.get(row.response_code) || "未回答"),
    };
  });
  arrayValue(related.reports).forEach((row) => {
    const plan = byUuid.get(String(row.plan_id));
    if (!plan) return;
    plan.report = {
      ...objectValue(plan.report),
      ...clone(objectValue(row.report_data), {}),
      doneDate: row.completed_date || row.report_data?.doneDate || "",
      actualAmount: String(row.actual_amount || row.report_data?.actualAmount || ""),
    };
  });
  return plans.map((entry) => entry.plan);
}

async function rowsForPlanIds(client, table, planIds) {
  if (!planIds.length) return [];
  return resultData(await client.from(table).select("*").in("plan_id", planIds), `${table}-load`);
}

export function createSupabaseAppStateRepository({ client, storageService = null } = {}) {
  if (!client || typeof client.from !== "function") {
    throw new SupabaseRepositoryError("missing-client", "クラウド保存サービスを利用できません。");
  }

  return Object.freeze({
    async load({ workspaceId, localState = {} } = {}) {
      const id = required(workspaceId, "地域");
      const queries = await Promise.all([
        client.from("workspaces").select("*").eq("id", id).limit(1),
        client.from("fields").select("*").eq("workspace_id", id).is("archived_at", null),
        client.from("operation_plans").select("*").eq("workspace_id", id).is("archived_at", null),
      ]);
      const workspaceRows = resultData(queries[0], "workspace-load");
      const fieldRows = resultData(queries[1], "fields-load");
      const planRows = resultData(queries[2], "plans-load");
      const fields = arrayValue(fieldRows).map(rowToField);
      const fieldClientRefByUuid = new Map(
        arrayValue(fieldRows).map((row) => [String(row.id), String(row.client_ref)]),
      );
      const planEntries = arrayValue(planRows).map((row) => ({
        uuid: String(row.id),
        plan: rowToPlan(row, fieldClientRefByUuid),
      }));
      const planIds = planEntries.map((entry) => entry.uuid);
      const [checks, weather, notifications, reports] = await Promise.all([
        rowsForPlanIds(client, "plan_checks", planIds),
        rowsForPlanIds(client, "weather_records", planIds),
        rowsForPlanIds(client, "notification_targets", planIds),
        rowsForPlanIds(client, "work_records", planIds),
      ]);
      const workspace = arrayValue(workspaceRows)[0] || {};
      return validateRemoteSyncPayload({
        syncVersion: SYNC_PAYLOAD_VERSION,
        account: {
          profile: clone(objectValue(localState.profile), {}),
          equipmentTemplate: clone(objectValue(localState.equipmentTemplate), {}),
        },
        workspace: {
          settings: clone(objectValue(workspace.settings), {}),
          fields,
          plans: mergeRelatedRows(planEntries, { checks, weather, notifications, reports }),
        },
        assets: [],
      });
    },

    async save({ workspaceId, userId, state } = {}) {
      const context = {
        workspaceId: required(workspaceId, "地域"),
        userId: required(userId, "利用者"),
        syncedAt: new Date().toISOString(),
      };
      const payload = buildRemoteSyncPayload(state);
      const fieldRows = payload.workspace.fields.map((field) => fieldToRow(field, context));
      const savedFields = fieldRows.length
        ? resultData(
          await client.from("fields")
            .upsert(fieldRows, { onConflict: "workspace_id,client_ref" })
            .select("id, client_ref"),
          "fields-save",
        )
        : [];
      const fieldUuidByClientRef = new Map(
        arrayValue(savedFields).map((row) => [String(row.client_ref), String(row.id)]),
      );
      const planRows = payload.workspace.plans.map((plan) => planToRow(plan, context, fieldUuidByClientRef));
      const savedPlans = planRows.length
        ? resultData(
          await client.from("operation_plans")
            .upsert(planRows, { onConflict: "workspace_id,client_ref" })
            .select("id, client_ref"),
          "plans-save",
        )
        : [];
      const planUuidByClientRef = new Map(
        arrayValue(savedPlans).map((row) => [String(row.client_ref), String(row.id)]),
      );
      const checks = [];
      const weather = [];
      const notifications = [];
      const reports = [];
      payload.workspace.plans.forEach((plan) => {
        const planUuid = planUuidByClientRef.get(String(plan.id));
        if (!planUuid) return;
        Object.entries(objectValue(plan.checks)).forEach(([key, checked]) => checks.push({
          plan_id: planUuid,
          check_key: key,
          is_checked: Boolean(checked),
          checked_by: checked ? context.userId : null,
          checked_at: checked ? context.syncedAt : null,
        }));
        weather.push(weatherToRow(plan, planUuid, context));
        const targets = new Set([
          ...Object.keys(objectValue(plan.notificationTargets)),
          ...Object.keys(objectValue(plan.notificationResponses)),
        ]);
        targets.forEach((fieldRef) => notifications.push(notificationToRow(plan, fieldRef, {
          ...context,
          planUuid,
          fieldUuid: fieldUuidByClientRef.get(fieldRef) || null,
        })));
        reports.push(reportToRow(plan, planUuid, context));
      });
      const results = await Promise.all([
        checks.length
          ? client.from("plan_checks").upsert(checks, { onConflict: "plan_id,check_key" })
          : Promise.resolve({ data: [] }),
        weather.length
          ? client.from("weather_records").upsert(weather, { onConflict: "plan_id,record_type,source_key" })
          : Promise.resolve({ data: [] }),
        notifications.length
          ? client.from("notification_targets").upsert(notifications, { onConflict: "plan_id,target_key" })
          : Promise.resolve({ data: [] }),
        reports.length
          ? client.from("work_records")
            .upsert(reports, { onConflict: "plan_id" })
            .select("id, plan_id")
          : Promise.resolve({ data: [] }),
        client.from("workspaces").update({ settings: payload.workspace.settings }).eq("id", context.workspaceId),
      ]);
      ["checks-save", "weather-save", "notifications-save", "reports-save", "settings-save"]
        .forEach((operation, index) => resultData(results[index], operation));
      let savedAssets = 0;
      if (storageService) {
        const reportUuidByPlanUuid = new Map(
          arrayValue(results[3]?.data).map((row) => [String(row.plan_id), String(row.id)]),
        );
        for (const plan of arrayValue(state?.plans)) {
          const planUuid = planUuidByClientRef.get(String(plan?.id || ""));
          if (!planUuid) continue;
          if (plan?.report?.photoData) {
            const reportUuid = reportUuidByPlanUuid.get(planUuid);
            if (reportUuid) {
              const photo = reportPhotoAsset(plan.report.photoData);
              await storageService.upload({
                bucketId: "report-assets",
                workspaceId: context.workspaceId,
                userId: context.userId,
                ownerType: "work_record",
                ownerId: reportUuid,
                assetKind: "report_photo",
                ...photo,
                metadata: { fileName: String(plan.report.photoName || "") },
              });
              savedAssets += 1;
            }
          }
          if (Array.isArray(plan?.droneLog?.points) && plan.droneLog.points.length) {
            const track = flightTrackAsset(plan.droneLog.points);
            const asset = await storageService.upload({
              bucketId: "flight-logs",
              workspaceId: context.workspaceId,
              userId: context.userId,
              ownerType: "plan",
              ownerId: planUuid,
              assetKind: "flight_track",
              ...track,
              metadata: {
                provider: String(plan.droneLog.vendor || "manual"),
                model: String(plan.droneLog.model || ""),
              },
            });
            resultData(
              await client.from("flight_logs").upsert({
                workspace_id: context.workspaceId,
                plan_id: planUuid,
                imported_by: context.userId,
                provider: String(plan.droneLog.vendor || "manual"),
                external_id: String(plan.droneLog.externalId || "") || null,
                source_key: "current",
                point_count: plan.droneLog.points.length,
                asset_id: asset.id,
                log_data: {
                  ...clone(plan.droneLog, {}),
                  points: undefined,
                },
              }, { onConflict: "plan_id,provider,source_key" }),
              "flight-log-save",
            );
            savedAssets += 1;
          }
        }
      }
      return {
        savedAt: context.syncedAt,
        fields: savedFields.length,
        plans: savedPlans.length,
        assetsPending: Math.max(0, payload.assets.length - savedAssets),
        assetsSaved: savedAssets,
      };
    },
  });
}
