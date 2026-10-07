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

export function createAggregateRepositoryBundle({
  getAggregate,
} = {}) {
  const aggregate = requiredFunction(getAggregate, "集約データ取得処理");
  const plans = createAggregateEntityRepository({
    getAggregate: aggregate,
    collectionName: "plans",
  });
  const fields = createAggregateEntityRepository({
    getAggregate: aggregate,
    collectionName: "fields",
  });
  const notifications = createPlanNotificationRepository({
    getPlan: (id) => plans.get(id),
    savePlan: (plan) => plans.save(plan),
  });
  const workRecords = createPlanWorkRecordRepository({
    listPlans: () => plans.list(),
    getPlan: (id) => plans.get(id),
    savePlan: (plan) => plans.save(plan),
  });
  return assertRepositoryPorts({
    plans,
    fields,
    notifications,
    workRecords,
  });
}

export function createPlanNotificationRepository({
  getPlan,
  savePlan,
} = {}) {
  const findPlan = requiredFunction(getPlan, "散布計画取得処理");
  const persistPlan = requiredFunction(savePlan, "散布計画保存処理");

  function requiredId(value, label) {
    const id = String(value || "").trim();
    if (!id) {
      throw new RepositoryError("invalid-notification", `${label}が設定されていません。`);
    }
    return id;
  }

  function planFor(planId) {
    const id = requiredId(planId, "散布計画ID");
    const plan = findPlan(id);
    if (!plan) {
      throw new RepositoryError("missing-plan", `散布計画が見つかりません：${id}`);
    }
    return plan;
  }

  function recordsFor(plan) {
    const deliveries = plan.notificationTargets || {};
    const responses = plan.notificationResponses || {};
    const fieldIds = [...new Set([...Object.keys(deliveries), ...Object.keys(responses)])];
    return fieldIds.map((fieldId) => ({
      id: `${plan.id}:${fieldId}`,
      planId: String(plan.id),
      fieldId,
      delivered: Boolean(deliveries[fieldId]),
      response: responses[fieldId] || "未回答",
    }));
  }

  function recordFor(plan, fieldId) {
    return recordsFor(plan).find((record) => record.fieldId === fieldId) || {
      id: `${plan.id}:${fieldId}`,
      planId: String(plan.id),
      fieldId,
      delivered: false,
      response: "未回答",
    };
  }

  return Object.freeze({
    listByPlan(planId) {
      return recordsFor(planFor(planId));
    },

    saveDelivery(planId, fieldId, delivered = true) {
      const plan = planFor(planId);
      const targetId = requiredId(fieldId, "通知対象圃場ID");
      plan.notificationTargets = {
        ...(plan.notificationTargets || {}),
        [targetId]: Boolean(delivered),
      };
      persistPlan(plan);
      return recordFor(plan, targetId);
    },

    saveResponse(planId, fieldId, response = "未回答") {
      const plan = planFor(planId);
      const targetId = requiredId(fieldId, "通知対象圃場ID");
      const nextResponse = String(response || "未回答");
      plan.notificationResponses = {
        ...(plan.notificationResponses || {}),
        [targetId]: nextResponse,
      };
      persistPlan(plan);
      return recordFor(plan, targetId);
    },
  });
}

export function createPlanWorkRecordRepository({
  listPlans,
  getPlan,
  savePlan,
} = {}) {
  const listAllPlans = requiredFunction(listPlans, "散布計画一覧取得処理");
  const findPlan = requiredFunction(getPlan, "散布計画取得処理");
  const persistPlan = requiredFunction(savePlan, "散布計画保存処理");

  function recordFor(plan) {
    if (!plan) return null;
    const planId = String(plan.id || "").trim();
    if (!planId) {
      throw new RepositoryError("invalid-work-record", "散布計画IDが設定されていません。");
    }
    return {
      id: planId,
      planId,
      ...(plan.report || {}),
    };
  }

  function planFor(planId) {
    const id = String(planId || "").trim();
    if (!id) {
      throw new RepositoryError("invalid-work-record", "作業記録の散布計画IDが設定されていません。");
    }
    const plan = findPlan(id);
    if (!plan) {
      throw new RepositoryError("missing-plan", `散布計画が見つかりません：${id}`);
    }
    return plan;
  }

  return Object.freeze({
    list() {
      return listAllPlans().map(recordFor);
    },

    get(planId) {
      const id = String(planId || "").trim();
      if (!id) return null;
      return recordFor(findPlan(id));
    },

    save(record) {
      const planId = String(record?.planId || record?.id || "").trim();
      const plan = planFor(planId);
      const { id: _id, planId: _planId, ...report } = record || {};
      plan.report = {
        ...(plan.report || {}),
        ...report,
      };
      plan.checks = {
        ...(plan.checks || {}),
        report: Boolean(plan.report.doneDate),
      };
      persistPlan(plan);
      return recordFor(plan);
    },
  });
}

export function repositoryErrorMessage(error) {
  if (error instanceof RepositoryError) return error.message;
  return "保存処理に失敗しました。";
}
