import test from "node:test";
import assert from "node:assert/strict";

import {
  REPOSITORY_PORTS,
  RepositoryError,
  assertRepositoryPorts,
  createLocalStorageAppStateRepository,
} from "../js/repositories/app-state.mjs";
import {
  SCHEMA_VERSION,
  nextEnvelope,
  parseStoredState,
} from "../js/domain/state.mjs";

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
