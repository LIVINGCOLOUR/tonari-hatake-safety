import test from "node:test";
import assert from "node:assert/strict";

import {
  REPOSITORY_PORTS,
  RepositoryError,
  assertRepositoryPorts,
  createAggregateEntityRepository,
  createAggregateRepositoryBundle,
  createLocalStorageAppStateRepository,
  createPlanNotificationRepository,
  createPlanWorkRecordRepository,
} from "../js/repositories/app-state.mjs";
import {
  SCHEMA_VERSION,
  nextEnvelope,
  parseStoredState,
} from "../js/domain/state.mjs";
import { exerciseRepositoryContract } from "./repository-contract.mjs";

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = next; },
    value() { return value; },
  };
}

function repository(storage) {
  return createLocalStorageAppStateRepository({
    storage,
    key: "app-state",
    parseStoredState,
    nextEnvelope,
  });
}

test("repository ports name the future plan, field, notification, and work-record boundaries", () => {
  assert.deepEqual(Object.keys(REPOSITORY_PORTS), [
    "plans",
    "fields",
    "notifications",
    "workRecords",
  ]);
  assert(REPOSITORY_PORTS.notifications.includes("saveResponse"));
  assert(REPOSITORY_PORTS.workRecords.includes("save"));
});

test("repository port validation reports every missing operation", () => {
  assert.throws(
    () => assertRepositoryPorts({ plans: { list() {} } }),
    (error) => error instanceof RepositoryError
      && error.code === "invalid-ports"
      && error.message.includes("plans.get")
      && error.message.includes("fields.list")
      && error.message.includes("notifications.saveResponse")
      && error.message.includes("workRecords.save"),
  );
});

test("aggregate repository bundle satisfies the shared application contract", () => {
  const state = {
    plans: [{
      id: "p1",
      name: "Plan 1",
      checks: {},
      notificationTargets: {},
      notificationResponses: {},
      report: {},
    }],
    fields: [{ id: "f1", name: "Field 1" }],
  };
  const repositories = createAggregateRepositoryBundle({
    getAggregate: () => state,
  });
  const finalState = exerciseRepositoryContract(repositories);
  assert.deepEqual(finalState.plans.map((plan) => plan.id), ["p1"]);
  assert.deepEqual(finalState.fields.map((field) => field.id), ["f1"]);
  assert.equal(finalState.workRecords[0].doneDate, "2026-07-23");
});

test("local repository loads a legacy bare state without changing it", () => {
  const legacy = { role: "sprayer", plans: [{ id: "p1" }], custom: { keep: true } };
  const storage = memoryStorage(JSON.stringify(legacy));
  const repo = repository(storage);
  const loaded = repo.load();
  assert.equal(loaded.schemaVersion, SCHEMA_VERSION);
  assert.equal(loaded.revision, 0);
  assert.equal(loaded.data.custom.keep, true);
  assert.equal(repo.currentRevision(), 0);
  assert.equal(storage.value(), JSON.stringify(legacy));
});

test("local repository preserves the v4 envelope and increments revisions", () => {
  const initial = nextEnvelope({ role: "neighbor", fields: [] }, 6);
  const storage = memoryStorage(JSON.stringify(initial));
  const repo = repository(storage);
  assert.equal(repo.load().revision, 7);
  const saved = repo.save({ role: "admin", fields: [{ id: "f1" }] });
  const persisted = JSON.parse(storage.value());
  assert.equal(saved.revision, 8);
  assert.equal(persisted.schemaVersion, SCHEMA_VERSION);
  assert.equal(persisted.revision, 8);
  assert.equal(persisted.data.role, "admin");
  assert.equal(persisted.data.fields[0].id, "f1");
  assert.equal(repo.currentRevision(), 8);
});

test("malformed stored data falls back to no state and starts at revision zero", () => {
  const storage = memoryStorage("{broken");
  const repo = repository(storage);
  assert.equal(repo.load(), null);
  assert.equal(repo.currentRevision(), 0);
  assert.equal(repo.save({ plans: [] }).revision, 1);
});

test("failed writes do not advance the repository revision", () => {
  const storage = {
    getItem() { return JSON.stringify(nextEnvelope({ plans: [] }, 2)); },
    setItem() { throw new Error("quota"); },
  };
  const repo = repository(storage);
  assert.equal(repo.load().revision, 3);
  assert.throws(
    () => repo.save({ plans: [{ id: "p1" }] }),
    (error) => error instanceof RepositoryError && error.code === "write-failed",
  );
  assert.equal(repo.currentRevision(), 3);
});

test("a stale repository cannot overwrite a newer tab revision", () => {
  const storage = memoryStorage(JSON.stringify(nextEnvelope({ plans: [] }, 3)));
  const firstTab = repository(storage);
  const staleTab = repository(storage);
  assert.equal(firstTab.load().revision, 4);
  assert.equal(staleTab.load().revision, 4);
  firstTab.save({ plans: [{ id: "newer" }] });
  assert.throws(
    () => staleTab.save({ plans: [{ id: "stale" }] }),
    (error) => error instanceof RepositoryError
      && error.code === "conflict"
      && error.message.includes("再読み込み"),
  );
  assert.equal(JSON.parse(storage.value()).data.plans[0].id, "newer");
  assert.equal(staleTab.currentRevision(), 4);
});

test("storage read failures are separated from an empty repository", () => {
  const repo = repository({
    getItem() { throw new Error("blocked"); },
    setItem() {},
  });
  assert.throws(
    () => repo.load(),
    (error) => error instanceof RepositoryError && error.code === "read-failed",
  );
});

test("aggregate entity repository lists, selects, inserts, and updates by stable id", () => {
  const state = { plans: [{ id: "p1", name: "first" }] };
  const plans = createAggregateEntityRepository({
    getAggregate: () => state,
    collectionName: "plans",
  });
  const listed = plans.list();
  listed.push({ id: "outside" });
  assert.deepEqual(state.plans.map((plan) => plan.id), ["p1"]);
  assert.equal(plans.get("p1").name, "first");

  plans.save({ id: "p2", name: "second" }, { position: "start" });
  plans.save({ id: "p1", name: "updated" });
  assert.deepEqual(state.plans.map((plan) => plan.id), ["p2", "p1"]);
  assert.equal(plans.get("p1").name, "updated");
});

test("aggregate entity repository removes and atomically replaces collections", () => {
  const state = { fields: [{ id: "f1" }, { id: "f2" }] };
  const fields = createAggregateEntityRepository({
    getAggregate: () => state,
    collectionName: "fields",
  });
  assert.equal(fields.remove("missing"), null);
  assert.equal(fields.remove("f1").id, "f1");
  assert.deepEqual(fields.replaceAll([{ id: "f3" }, { id: "f4" }]).map((field) => field.id), ["f3", "f4"]);
  assert.deepEqual(state.fields.map((field) => field.id), ["f3", "f4"]);
  assert.throws(
    () => fields.replaceAll([{ id: "same" }, { id: "same" }]),
    (error) => error instanceof RepositoryError && error.code === "duplicate-entity",
  );
  assert.deepEqual(state.fields.map((field) => field.id), ["f3", "f4"]);
});

test("aggregate entity repository validates ids and initializes a missing collection", () => {
  const state = {};
  const plans = createAggregateEntityRepository({
    getAggregate: () => state,
    collectionName: "plans",
  });
  assert.deepEqual(plans.list(), []);
  assert.deepEqual(state.plans, []);
  assert.throws(
    () => plans.save({ name: "missing id" }),
    (error) => error instanceof RepositoryError && error.code === "invalid-entity",
  );
});

test("notification repository reads the legacy embedded delivery and response maps", () => {
  const plans = new Map([
    ["p1", {
      id: "p1",
      notificationTargets: { f1: true, f2: false },
      notificationResponses: { f1: "確認しました", f3: "電話希望" },
    }],
  ]);
  const notifications = createPlanNotificationRepository({
    getPlan: (id) => plans.get(id),
    savePlan: (plan) => plans.set(plan.id, plan),
  });
  assert.deepEqual(notifications.listByPlan("p1"), [
    {
      id: "p1:f1",
      planId: "p1",
      fieldId: "f1",
      delivered: true,
      response: "確認しました",
    },
    {
      id: "p1:f2",
      planId: "p1",
      fieldId: "f2",
      delivered: false,
      response: "未回答",
    },
    {
      id: "p1:f3",
      planId: "p1",
      fieldId: "f3",
      delivered: false,
      response: "電話希望",
    },
  ]);
});

test("notification repository saves delivery and marks a replied notice as delivered", () => {
  const plan = { id: "p1", notificationTargets: {}, notificationResponses: {} };
  let saves = 0;
  const notifications = createPlanNotificationRepository({
    getPlan: (id) => id === plan.id ? plan : null,
    savePlan: () => { saves += 1; },
  });
  assert.deepEqual(notifications.saveDelivery("p1", "f1"), {
    id: "p1:f1",
    planId: "p1",
    fieldId: "f1",
    delivered: true,
    response: "未回答",
  });
  assert.deepEqual(notifications.saveResponse("p1", "f2", "電話希望"), {
    id: "p1:f2",
    planId: "p1",
    fieldId: "f2",
    delivered: false,
    response: "電話希望",
  });
  assert.equal(saves, 2);
  assert.equal(plan.notificationTargets.f1, true);
  assert.equal(plan.notificationTargets.f2, undefined);
  assert.equal(plan.notificationResponses.f2, "電話希望");
});

test("notification repository validates plan and field identifiers", () => {
  const notifications = createPlanNotificationRepository({
    getPlan: () => null,
    savePlan() {},
  });
  assert.throws(
    () => notifications.listByPlan("missing"),
    (error) => error instanceof RepositoryError && error.code === "missing-plan",
  );
  assert.throws(
    () => notifications.saveDelivery("", "f1"),
    (error) => error instanceof RepositoryError && error.code === "invalid-notification",
  );
  const existing = createPlanNotificationRepository({
    getPlan: () => ({ id: "p1" }),
    savePlan() {},
  });
  assert.throws(
    () => existing.saveResponse("p1", "", "確認しました"),
    (error) => error instanceof RepositoryError && error.code === "invalid-notification",
  );
});

test("work-record repository presents embedded reports as plan-linked records", () => {
  const plans = [
    { id: "p1", report: { doneDate: "2026-07-23", actualAmount: "600mL/10a" } },
    { id: "p2", report: {} },
  ];
  const records = createPlanWorkRecordRepository({
    listPlans: () => plans,
    getPlan: (id) => plans.find((plan) => plan.id === id),
    savePlan() {},
  });
  assert.deepEqual(records.list(), [
    {
      id: "p1",
      planId: "p1",
      doneDate: "2026-07-23",
      actualAmount: "600mL/10a",
    },
    { id: "p2", planId: "p2" },
  ]);
  assert.equal(records.get("p1").actualAmount, "600mL/10a");
  assert.equal(records.get("missing"), null);
  assert.equal(records.get(""), null);
});

test("work-record repository saves reports and keeps the report check in sync", () => {
  const plan = {
    id: "p1",
    checks: { notice: true, report: false },
    report: { incident: "なし" },
  };
  let saves = 0;
  const records = createPlanWorkRecordRepository({
    listPlans: () => [plan],
    getPlan: (id) => id === plan.id ? plan : null,
    savePlan: () => { saves += 1; },
  });
  const saved = records.save({
    id: "p1",
    planId: "p1",
    doneDate: "2026-07-23",
    doneTime: "06:30",
    actualAmount: "600mL/10a",
  });
  assert.equal(saved.doneDate, "2026-07-23");
  assert.equal(plan.report.incident, "なし");
  assert.equal(plan.report.actualAmount, "600mL/10a");
  assert.equal(plan.checks.notice, true);
  assert.equal(plan.checks.report, true);
  assert.equal(saves, 1);

  records.save({ planId: "p1", doneDate: "" });
  assert.equal(plan.checks.report, false);
});

test("work-record repository validates adapters, records, and missing plans", () => {
  assert.throws(
    () => createPlanWorkRecordRepository({}),
    (error) => error instanceof RepositoryError && error.code === "invalid-adapter",
  );
  const records = createPlanWorkRecordRepository({
    listPlans: () => [],
    getPlan: () => null,
    savePlan() {},
  });
  assert.throws(
    () => records.save({}),
    (error) => error instanceof RepositoryError && error.code === "invalid-work-record",
  );
  assert.throws(
    () => records.save({ planId: "missing" }),
    (error) => error instanceof RepositoryError && error.code === "missing-plan",
  );
});
