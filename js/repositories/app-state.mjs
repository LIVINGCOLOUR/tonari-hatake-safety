export const REPOSITORY_PORTS = Object.freeze({
  plans: Object.freeze(["list", "get", "save", "remove", "replaceAll"]),
  fields: Object.freeze(["list", "get", "save", "remove", "replaceAll"]),
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

export function createAggregateEntityRepository({
  getAggregate,
  collectionName,
} = {}) {
  const aggregate = requiredFunction(getAggregate, "集約データ取得処理");
  const key = String(collectionName || "").trim();
  if (!key) {
    throw new RepositoryError("invalid-collection", "Repositoryの対象が設定されていません。");
  }

  function collection() {
    const current = aggregate();
    if (!current || typeof current !== "object") {
      throw new RepositoryError("missing-aggregate", "保存対象のデータを利用できません。");
    }
    if (!Array.isArray(current[key])) current[key] = [];
    return current[key];
  }

  function entityId(entity) {
    const id = String(entity?.id || "").trim();
    if (!id) {
      throw new RepositoryError("invalid-entity", `${key}のIDが設定されていません。`);
    }
    return id;
  }

  return Object.freeze({
    list() {
      return collection().slice();
    },

    get(id) {
      const targetId = String(id || "").trim();
      if (!targetId) return null;
      return collection().find((entity) => String(entity?.id) === targetId) || null;
    },

    save(entity, { position = "end" } = {}) {
      const id = entityId(entity);
      const items = collection();
      const index = items.findIndex((item) => String(item?.id) === id);
      if (index >= 0) {
        items[index] = entity;
      } else if (position === "start") {
        items.unshift(entity);
      } else {
        items.push(entity);
      }
      return entity;
    },

    remove(id) {
      const targetId = String(id || "").trim();
      const items = collection();
      const index = items.findIndex((entity) => String(entity?.id) === targetId);
      if (index < 0) return null;
      return items.splice(index, 1)[0];
    },

    replaceAll(entities) {
      if (!Array.isArray(entities)) {
        throw new RepositoryError("invalid-collection", `${key}の一覧が不正です。`);
      }
      const ids = new Set();
      entities.forEach((entity) => {
        const id = entityId(entity);
        if (ids.has(id)) {
          throw new RepositoryError("duplicate-entity", `${key}に重複したIDがあります：${id}`);
        }
        ids.add(id);
      });
      const current = aggregate();
      current[key] = entities.slice();
      return current[key].slice();
    },
  });
}

export function repositoryErrorMessage(error) {
  if (error instanceof RepositoryError) return error.message;
  return "保存処理に失敗しました。";
}
