import test from "node:test";
import assert from "node:assert/strict";

import {
  SYNC_BOUNDARY,
  SYNC_PAYLOAD_VERSION,
  SyncBoundaryError,
  applyRemoteSyncPayload,
  buildRemoteSyncPayload,
  extractDeviceState,
  validateRemoteSyncPayload,
} from "../js/domain/sync.mjs";

function sampleState() {
  return {
    role: "neighbor",
    activePlanId: "p1",
    activeFieldId: "f1",
    boundaryMunicipality: "08216",
    boundaryPinned: true,
    profile: {
      registered: true,
      role: "neighbor",
      name: "利用者A",
      phone: "090-0000-0000",
      boundaryLoadStatus: { "08216": "loaded" },
    },
    equipmentTemplate: { droneModel: "機体A" },
    settings: { regionName: "笠間地域", notifyRadius: 360 },
    plans: [{
      id: "p1",
      notificationTargets: { f1: true },
      notificationResponses: { f1: "確認しました" },
      droneLog: {
        imported: true,
        vendor: "vendor-a",
        points: [{ lng: 140.3, lat: 36.3, sprayOn: true }],
      },
      report: {
        doneDate: "2026-07-23",
        photoName: "report.jpg",
        photoData: "data:image/jpeg;base64,AAAA",
      },
    }],
    fields: [{
      id: "f1",
      geometry: { type: "Polygon", coordinates: [[[140, 36], [141, 36], [141, 37], [140, 36]]] },
      externalRefs: [{ provider: "wagri", externalId: "parcel-1", revision: "2026" }],
      provenance: { source: "wagri", stableKey: "wagri:parcel-1" },
    }],
    unknownLegacyKey: { keep: true },
  };
}

test("sync boundary separates account, workspace, and device-owned state", () => {
  assert.deepEqual(SYNC_BOUNDARY.account, ["profile", "equipmentTemplate"]);
  assert(SYNC_BOUNDARY.workspace.includes("plans"));
  assert(SYNC_BOUNDARY.workspace.includes("fields"));
  assert(SYNC_BOUNDARY.device.includes("profile.boundaryLoadStatus"));
});

test("remote payload keeps operational provenance but excludes device state and inline assets", () => {
  const state = sampleState();
  const payload = buildRemoteSyncPayload(state);
  assert.equal(payload.syncVersion, SYNC_PAYLOAD_VERSION);
  assert.equal(payload.account.profile.name, "利用者A");
  assert.equal(payload.account.profile.boundaryLoadStatus, undefined);
  assert.equal(payload.workspace.settings.regionName, "笠間地域");
  assert.equal(payload.workspace.fields[0].externalRefs[0].provider, "wagri");
  assert.equal(payload.workspace.fields[0].provenance.stableKey, "wagri:parcel-1");
  assert.equal(payload.workspace.plans[0].notificationResponses.f1, "確認しました");
  assert.equal(payload.workspace.plans[0].report.doneDate, "2026-07-23");
  assert.equal(payload.workspace.plans[0].report.photoData, undefined);
  assert.equal(payload.workspace.plans[0].droneLog.points, undefined);
  assert.equal(payload.role, undefined);
  assert.equal(payload.activePlanId, undefined);
  assert.deepEqual(payload.assets.map((asset) => asset.kind), ["report-photo", "flight-track"]);
  assert.equal(payload.assets[1].pointCount, 1);
  assert.equal(state.plans[0].report.photoData, "data:image/jpeg;base64,AAAA");
  assert.equal(state.plans[0].droneLog.points.length, 1);
});

test("device state extraction is explicit and does not include shared records", () => {
  const device = extractDeviceState(sampleState());
  assert.deepEqual(device, {
    role: "neighbor",
    activePlanId: "p1",
    activeFieldId: "f1",
    boundaryMunicipality: "08216",
    boundaryPinned: true,
    profileBoundaryLoadStatus: { "08216": "loaded" },
  });
  assert.equal(device.plans, undefined);
  assert.equal(device.settings, undefined);
});

test("applying remote state preserves device selections and cached inline assets", () => {
  const local = sampleState();
  const remote = buildRemoteSyncPayload({
    ...sampleState(),
    profile: { registered: true, role: "sprayer", name: "更新後" },
    settings: { regionName: "更新地域", notifyRadius: 400 },
    plans: [{
      id: "p1",
      droneLog: { imported: true, vendor: "vendor-b" },
      report: { doneDate: "2026-07-24", photoName: "report.jpg" },
    }],
    fields: [{ id: "f2", externalRefs: [], provenance: { source: "manual" } }],
  });
  const merged = applyRemoteSyncPayload(local, remote);
  assert.equal(merged.profile.name, "更新後");
  assert.equal(merged.profile.boundaryLoadStatus["08216"], "loaded");
  assert.equal(merged.settings.regionName, "更新地域");
  assert.equal(merged.role, "neighbor");
  assert.equal(merged.activePlanId, "p1");
  assert.equal(merged.boundaryMunicipality, "08216");
  assert.equal(merged.unknownLegacyKey.keep, true);
  assert.equal(merged.plans[0].report.doneDate, "2026-07-24");
  assert.equal(merged.plans[0].report.photoData, "data:image/jpeg;base64,AAAA");
  assert.equal(merged.plans[0].droneLog.points.length, 1);
  assert.equal(merged.fields[0].id, "f2");
  assert.equal(local.profile.name, "利用者A");
});

test("sync payload validation rejects unknown versions and malformed collections", () => {
  assert.throws(
    () => validateRemoteSyncPayload(null),
    (error) => error instanceof SyncBoundaryError && error.code === "invalid-sync-payload",
  );
  assert.throws(
    () => validateRemoteSyncPayload({ syncVersion: 99, account: {}, workspace: { plans: [], fields: [] } }),
    (error) => error instanceof SyncBoundaryError && error.code === "unsupported-sync-version",
  );
  assert.throws(
    () => validateRemoteSyncPayload({
      syncVersion: SYNC_PAYLOAD_VERSION,
      account: {},
      workspace: { plans: {}, fields: [] },
    }),
    (error) => error instanceof SyncBoundaryError && error.code === "invalid-sync-payload",
  );
});
