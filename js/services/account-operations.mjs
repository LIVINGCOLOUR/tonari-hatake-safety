export const ACCOUNT_EXPORT_VERSION = 1;
export const ACCOUNT_DELETION_CONFIRMATION = "退会を申請";

const SECRET_KEY_PATTERN = /token|password|secret|api.?key|cookie|credential|authorization/i;

export class AccountOperationsError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "AccountOperationsError";
    this.code = code;
  }
}

function portableValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) {
    throw new AccountOperationsError(
      "cyclic-data",
      "循環参照を含むため、データを書き出せません。",
    );
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => portableValue(item, seen));
    seen.delete(value);
    return result;
  }
  const result = {};
  Object.entries(value).forEach(([key, item]) => {
    if (SECRET_KEY_PATTERN.test(key)) return;
    result[key] = portableValue(item, seen);
  });
  seen.delete(value);
  return result;
}

export function buildAccountExport({
  user,
  profile,
  memberships = [],
  activeWorkspaceId = "",
  deviceState,
  exportedAt = new Date().toISOString(),
} = {}) {
  if (!user?.id) {
    throw new AccountOperationsError(
      "authentication-required",
      "ログインしてからデータを書き出してください。",
    );
  }
  const timestamp = new Date(exportedAt);
  if (Number.isNaN(timestamp.getTime())) {
    throw new AccountOperationsError(
      "invalid-export-time",
      "書き出し時刻を確認できません。",
    );
  }
  return portableValue({
    format: "tonari-hatake-safety-account-export",
    version: ACCOUNT_EXPORT_VERSION,
    exportedAt: timestamp.toISOString(),
    account: {
      id: user.id,
      email: user.email || "",
      profile: profile || {},
    },
    workspace: {
      activeWorkspaceId: String(activeWorkspaceId || ""),
      memberships,
    },
    deviceState: deviceState || {},
  });
}

export function accountExportFilename(exportedAt = new Date()) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt);
  if (Number.isNaN(date.getTime())) return "tonari-hatake-safety-backup.json";
  return `tonari-hatake-safety-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function validDeletionConfirmation(value) {
  return String(value || "").trim() === ACCOUNT_DELETION_CONFIRMATION;
}
