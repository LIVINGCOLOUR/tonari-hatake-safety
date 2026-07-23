export const REPOSITORY_PORTS = Object.freeze({
  plans: Object.freeze(["list", "get", "save", "remove"]),
  fields: Object.freeze(["list", "get", "save", "remove"]),
  notifications: Object.freeze(["listByPlan", "saveDelivery", "saveResponse"]),
  workRecords: Object.freeze(["list", "get", "save"]),
});

export class RepositoryError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "RepositoryError";
    this.code = code;
  }
}

function requiredFunction(value, name) {
  if (typeof value !== "function") {
    throw new RepositoryError("invalid-adapter", `${name}が設定されていません。`);
  }
  return value;
}

export function assertRepositoryPorts(repositories) {
  const missing = [];
  Object.entries(REPOSITORY_PORTS).forEach(([name, methods]) => {
    methods.forEach((method) => {
      if (typeof repositories?.[name]?.[method] !== "function") {
        missing.push(`${name}.${method}`);
      }
    });
  });
  if (missing.length) {
    throw new RepositoryError(
      "invalid-ports",
      `Repository契約を満たしていません：${missing.join(", ")}`,
    );
  }
  return repositories;
}

export function createLocalStorageAppStateRepository({
  storage,
  key,
  parseStoredState,
  nextEnvelope,
  serialize = JSON.stringify,
} = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new RepositoryError("invalid-storage", "保存先を利用できません。");
  }
  const storageKey = String(key || "").trim();
  if (!storageKey) {
    throw new RepositoryError("invalid-storage", "保存キーが設定されていません。");
  }
  const parse = requiredFunction(parseStoredState, "保存データ解析処理");
  const envelopeFor = requiredFunction(nextEnvelope, "保存形式生成処理");
  const stringify = requiredFunction(serialize, "保存データ変換処理");
  let revision = 0;

  return Object.freeze({
    load() {
      let raw;
      try {
        raw = storage.getItem(storageKey);
      } catch (error) {
        throw new RepositoryError("read-failed", "保存データを読み込めません。", { cause: error });
      }
      const stored = parse(raw);
      revision = stored?.revision || 0;
      return stored;
    },

    save(data) {
      let persisted;
      try {
        persisted = parse(storage.getItem(storageKey));
      } catch (error) {
        throw new RepositoryError("read-failed", "保存前の更新状態を確認できません。", { cause: error });
      }
      const persistedRevision = persisted?.revision || 0;
      if (persistedRevision !== revision) {
        throw new RepositoryError(
          "conflict",
          "別の画面でデータが更新されています。再読み込みして最新状態を確認してください。",
        );
      }
      const envelope = envelopeFor(data, revision);
      let serialized;
      try {
        serialized = stringify(envelope);
        storage.setItem(storageKey, serialized);
      } catch (error) {
        throw new RepositoryError("write-failed", "保存データを書き込めません。", { cause: error });
      }
      revision = envelope.revision;
      return envelope;
    },

    currentRevision() {
      return revision;
    },
  });
}

export function repositoryErrorMessage(error) {
  if (error instanceof RepositoryError) return error.message;
  return "保存処理に失敗しました。";
}
