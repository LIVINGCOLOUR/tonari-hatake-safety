export const SYNC_PAYLOAD_VERSION = 1;

// 遠隔保存へ送る情報と、このブラウザだけに残す情報の境界。
// workspace は共有可能な保存領域を表すが、一般公開を意味しない。
// 実際の取得時には、地域への所属、ロール、記録ごとの公開範囲をサーバーで検証する。
export const SYNC_BOUNDARY = Object.freeze({
  account: Object.freeze([
    "profile",
    "equipmentTemplate",
  ]),
  workspace: Object.freeze([
    "settings",
    "plans",
    "fields",
  ]),
  device: Object.freeze([
    "role",
    "activePlanId",
    "activeFieldId",
    "boundaryMunicipality",
    "boundaryPinned",
    "profile.boundaryLoadStatus",
  ]),
});

export class SyncBoundaryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SyncBoundaryError";
    this.code = code;
  }
}

function cloneJson(value, fallback) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new SyncBoundaryError("invalid-sync-value", "同期対象にJSON化できない値が含まれています。");
  }
}

function objectValue(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function accountProfile(profile) {
  const next = cloneJson(objectValue(profile), {});
  delete next.boundaryLoadStatus;
  return next;
}

// 写真本体と飛行点列は通常JSONから分離し、オブジェクト保存が必要な資産として記録する。
// これにより、実運用の写真や高頻度テレメトリーで地域データ本体が肥大化するのを防ぐ。
function inlineAssetSize(value) {
  return typeof value === "string" ? value.length : 0;
}

function splitWorkspacePlans(plans) {
  const assets = [];
  const records = cloneJson(arrayValue(plans), []).map((plan) => {
    const next = { ...plan };
    if (next.report && typeof next.report === "object") {
      next.report = { ...next.report };
      if (next.report.photoData) {
        assets.push({
          id: `work-record:${String(next.id)}:photo`,
          ownerType: "workRecord",
          ownerId: String(next.id),
          kind: "report-photo",
          name: String(next.report.photoName || ""),
          inlineBytes: inlineAssetSize(next.report.photoData),
          state: "upload-required",
        });
        delete next.report.photoData;
      }
    }
    if (next.droneLog && typeof next.droneLog === "object") {
      next.droneLog = { ...next.droneLog };
      if (Array.isArray(next.droneLog.points) && next.droneLog.points.length) {
        assets.push({
          id: `plan:${String(next.id)}:flight-track`,
          ownerType: "plan",
          ownerId: String(next.id),
          kind: "flight-track",
          pointCount: next.droneLog.points.length,
          state: "upload-required",
        });
        delete next.droneLog.points;
      }
    }
    return next;
  });
  return { records, assets };
}

export function buildRemoteSyncPayload(state) {
  const source = objectValue(state);
  const workspacePlans = splitWorkspacePlans(source.plans);
  return {
    syncVersion: SYNC_PAYLOAD_VERSION,
    account: {
      profile: accountProfile(source.profile),
      equipmentTemplate: cloneJson(objectValue(source.equipmentTemplate), {}),
    },
    workspace: {
      settings: cloneJson(objectValue(source.settings), {}),
      plans: workspacePlans.records,
      fields: cloneJson(arrayValue(source.fields), []),
    },
    assets: workspacePlans.assets,
  };
}

// 選択中の計画・圃場などは利用者の作業端末に属し、地域共有データへ含めない。
export function extractDeviceState(state) {
  const source = objectValue(state);
  return {
    role: source.role ?? null,
    activePlanId: source.activePlanId ?? null,
    activeFieldId: source.activeFieldId ?? null,
    boundaryMunicipality: source.boundaryMunicipality ?? null,
    boundaryPinned: Boolean(source.boundaryPinned),
    profileBoundaryLoadStatus: cloneJson(
      objectValue(source.profile)?.boundaryLoadStatus || {},
      {},
    ),
  };
}

export function validateRemoteSyncPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SyncBoundaryError("invalid-sync-payload", "同期データの形式が不正です。");
  }
  if (payload.syncVersion !== SYNC_PAYLOAD_VERSION) {
    throw new SyncBoundaryError(
      "unsupported-sync-version",
      `未対応の同期データ形式です：${String(payload.syncVersion ?? "未設定")}`,
    );
  }
  if (!payload.account || typeof payload.account !== "object" || Array.isArray(payload.account)) {
    throw new SyncBoundaryError("invalid-sync-payload", "アカウント同期データが不正です。");
  }
  if (!payload.workspace || typeof payload.workspace !== "object" || Array.isArray(payload.workspace)) {
    throw new SyncBoundaryError("invalid-sync-payload", "地域同期データが不正です。");
  }
  if (!Array.isArray(payload.workspace.plans) || !Array.isArray(payload.workspace.fields)) {
    throw new SyncBoundaryError("invalid-sync-payload", "計画または圃場の同期データが不正です。");
  }
  if (payload.assets !== undefined && !Array.isArray(payload.assets)) {
    throw new SyncBoundaryError("invalid-sync-payload", "添付資産の同期データが不正です。");
  }
  return payload;
}

// オブジェクト保存が未実装の間は、遠隔JSONに含まれない写真・飛行点列を
// 端末キャッシュから復元する。本番では資産参照の取得処理へ置き換える。
function mergeInlineAssetCache(localPlans, remotePlans) {
  const localById = new Map(arrayValue(localPlans).map((plan) => [String(plan?.id || ""), plan]));
  return cloneJson(remotePlans, []).map((plan) => {
    const local = localById.get(String(plan?.id || ""));
    if (!local) return plan;
    const next = { ...plan };
    if (local.report?.photoData && !next.report?.photoData) {
      next.report = {
        ...(next.report || {}),
        photoData: local.report.photoData,
        photoName: next.report?.photoName || local.report.photoName || "",
      };
    }
    if (Array.isArray(local.droneLog?.points) && !Array.isArray(next.droneLog?.points)) {
      next.droneLog = {
        ...(next.droneLog || {}),
        points: cloneJson(local.droneLog.points, []),
      };
    }
    return next;
  });
}

export function applyRemoteSyncPayload(localState, payload) {
  const remote = validateRemoteSyncPayload(payload);
  const local = cloneJson(objectValue(localState), {});
  const device = extractDeviceState(local);
  const remoteProfile = cloneJson(objectValue(remote.account.profile), {});

  return {
    ...local,
    profile: {
      ...remoteProfile,
      boundaryLoadStatus: device.profileBoundaryLoadStatus,
    },
    equipmentTemplate: cloneJson(objectValue(remote.account.equipmentTemplate), {}),
    settings: cloneJson(objectValue(remote.workspace.settings), {}),
    plans: mergeInlineAssetCache(local.plans, remote.workspace.plans),
    fields: cloneJson(remote.workspace.fields, []),
    role: device.role,
    activePlanId: device.activePlanId,
    activeFieldId: device.activeFieldId,
    boundaryMunicipality: device.boundaryMunicipality,
    boundaryPinned: device.boundaryPinned,
  };
}

export function applyRemoteVersions(localState, remoteVersions = {}) {
  const local = cloneJson(objectValue(localState), {});
  const fieldVersions = objectValue(remoteVersions.fields);
  const planVersions = objectValue(remoteVersions.plans);
  local.fields = arrayValue(local.fields).map((field) => ({
    ...field,
    remoteVersion: Number(fieldVersions[String(field?.id || "")] || field?.remoteVersion || 0),
  }));
  local.plans = arrayValue(local.plans).map((plan) => ({
    ...plan,
    remoteVersion: Number(planVersions[String(plan?.id || "")] || plan?.remoteVersion || 0),
  }));
  return local;
}
