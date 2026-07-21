import test from "node:test";
import assert from "node:assert/strict";

import {
  SCHEMA_VERSION,
  migratePlanFieldRefs,
  nextEnvelope,
  parseStoredState,
  planSprayField,
  resolveFieldByName,
} from "../js/domain/state.mjs";
import {
  geometriesIntersect,
  geometryDistanceMeters,
  hashGeometry,
  normalizeGeometry,
  polygonFromRing,
  stableImportedId,
  wgs84RangeViolation,
} from "../js/domain/geometry.mjs";

const polygon = (west, south, east, north, holes = []) => ({
  type: "Polygon",
  coordinates: [[
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ], ...holes],
});

test("legacy bare state migrates into a versioned envelope without data loss", () => {
  const legacy = { role: "sprayer", custom: { keep: true }, fields: [], plans: [] };
  const migrated = parseStoredState(JSON.stringify(legacy));
  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.revision, 0);
  assert.equal(migrated.data.custom.keep, true);
  assert.equal(migrated.data.migratedFrom, "v3");

  const saved = nextEnvelope(migrated.data, migrated.revision);
  assert.equal(saved.revision, 1);
  assert.equal(saved.schemaVersion, SCHEMA_VERSION);
  assert.equal(saved.data.custom.keep, true);
});

test("fieldName migrates only when the name uniquely identifies a field", () => {
  const fields = [
    { id: "field-a", name: "A", type: "spray" },
    { id: "field-b", name: "B", type: "spray" },
  ];
  const [resolved, missing] = migratePlanFieldRefs(
    [{ id: "p1", fieldName: "A" }, { id: "p2", fieldName: "C" }],
    fields,
  );
  assert.equal(resolved.fieldId, "field-a");
  assert.equal(missing.fieldId, null);
  assert.equal(planSprayField(missing, fields).resolved, false);
});

test("same-named fields remain unresolved instead of selecting the first", () => {
  const fields = [
    { id: "field-a", name: "同名", type: "spray" },
    { id: "field-b", name: "同名", type: "spray" },
  ];
  assert.equal(resolveFieldByName("同名", fields), null);
  const [plan] = migratePlanFieldRefs([{ id: "p1", fieldName: "同名" }], fields);
  assert.equal(plan.fieldId, null);
  assert.equal(plan.fieldIdSource, "unresolved");
});

test("touching and overlapping polygons have zero boundary distance", () => {
  const a = polygon(140, 36, 140.001, 36.001);
  const touching = polygon(140.001, 36, 140.002, 36.001);
  const overlapping = polygon(140.0005, 36.0005, 140.002, 36.002);
  assert.equal(geometryDistanceMeters(a, touching), 0);
  assert.equal(geometryDistanceMeters(a, overlapping), 0);
});

test("MultiPolygon uses every component", () => {
  const multi = {
    type: "MultiPolygon",
    coordinates: [
      polygon(139, 35, 139.001, 35.001).coordinates,
      polygon(140, 36, 140.001, 36.001).coordinates,
    ],
  };
  const target = polygon(140.0005, 36.0005, 140.002, 36.002);
  assert.equal(geometryDistanceMeters(multi, target), 0);
  assert.equal(normalizeGeometry(multi).coordinates.length, 2);
});

test("a polygon inside a hole is not treated as intersecting", () => {
  const hole = [[
    [140.001, 36.001], [140.003, 36.001], [140.003, 36.003],
    [140.001, 36.003], [140.001, 36.001],
  ]];
  const withHole = polygon(140, 36, 140.004, 36.004, hole);
  const insideHole = polygon(140.0015, 36.0015, 140.0025, 36.0025);
  assert.ok(geometryDistanceMeters(withHole, insideHole) > 0);
  assert.equal(normalizeGeometry(withHole).coordinates.length, 2);
});

test("out-of-range coordinates are rejected", () => {
  const invalid = polygon(200, 36, 201, 37);
  assert.deepEqual(wgs84RangeViolation(invalid), [200, 36]);
});

test("the same imported geometry and source produce a stable id", () => {
  const geometry = polygon(140, 36, 140.001, 36.001);
  const stableKey = `municipality:08216:geometry:${hashGeometry(geometry)}`;
  assert.equal(stableImportedId("spray", stableKey), stableImportedId("spray", stableKey));
});

test("different sources produce different ids for the same geometry", () => {
  const geometry = polygon(140, 36, 140.001, 36.001);
  const suffix = `geometry:${hashGeometry(geometry)}`;
  assert.notEqual(
    stableImportedId("spray", `municipality:08216:${suffix}`),
    stableImportedId("spray", `file:import.zip:${suffix}`),
  );
});

test("hashGeometry ignores float noise below the rounding precision", () => {
  const base = polygon(140.123456, 36.123456, 140.124456, 36.124456);
  const noisy = {
    type: "Polygon",
    coordinates: [base.coordinates[0].map(([lng, lat]) => [lng + 4e-9, lat - 4e-9])],
  };
  assert.equal(hashGeometry(base), hashGeometry(noisy));
});

test("disjoint polygons report the boundary gap in metres", () => {
  // 0.001° of longitude at ~36°N is about 90m.
  const a = polygon(140, 36, 140.001, 36.001);
  const b = polygon(140.002, 36, 140.003, 36.001);
  const distance = geometryDistanceMeters(a, b);
  assert.ok(distance > 80 && distance < 100, `expected ~90m, got ${distance}`);
  assert.ok(Math.abs(geometryDistanceMeters(a, b) - geometryDistanceMeters(b, a)) < 1e-6);
  assert.equal(geometriesIntersect(a, b), false);
});

test("a plan pointing at a deleted field reports missing-field, not another field", () => {
  const fields = [{ id: "field-a", name: "A", type: "spray" }];
  const result = planSprayField({ id: "p1", fieldId: "gone" }, fields);
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "missing-field");
  assert.equal(result.field, null);
});

test("a v4 envelope round-trips without re-running the legacy migration", () => {
  const envelope = { schemaVersion: SCHEMA_VERSION, revision: 7, data: { fields: [], plans: [] } };
  const parsed = parseStoredState(JSON.stringify(envelope));
  assert.equal(parsed.schemaVersion, SCHEMA_VERSION);
  assert.equal(parsed.revision, 7);
  assert.equal(parsed.data.migratedFrom, undefined);
  const next = nextEnvelope(parsed.data, parsed.revision);
  assert.equal(next.revision, 8);
});

// The shipped demo state: open `geo` rings, plans referencing fields only by
// name, and plan-drone-2 pointing at 「笠間デモほ場F」 which has no field.
test("legacy sample-like state migrates safely end to end", () => {
  const sprayRing = [
    [140.312185, 36.387676], [140.313201, 36.387447],
    [140.313059, 36.386499], [140.312043, 36.386695],
  ];
  const neighborRing = [
    [140.312043, 36.386532], [140.313059, 36.386303],
    [140.312937, 36.385159], [140.311881, 36.385388],
  ];
  const legacy = {
    role: "sprayer",
    activePlanId: "plan-drone-1",
    fields: [
      { id: "spray-field-a", name: "笠間デモほ場A", type: "spray", geo: sprayRing },
      { id: "no-chemical-field-b", name: "農薬不使用ほ場B", type: "noChemical", geo: neighborRing },
    ],
    plans: [
      { id: "plan-drone-1", fieldName: "笠間デモほ場A" },
      { id: "plan-drone-2", fieldName: "笠間デモほ場F" },
    ],
  };
  const stored = parseStoredState(JSON.stringify(legacy));
  assert.equal(stored.schemaVersion, SCHEMA_VERSION);

  const [p1, p2] = migratePlanFieldRefs(stored.data.plans, stored.data.fields);
  assert.equal(p1.fieldId, "spray-field-a");
  assert.equal(p1.fieldIdSource, "name");
  assert.equal(p2.fieldId, null);
  assert.equal(planSprayField(p2, stored.data.fields).reason, "no-field-id");

  const sprayGeometry = polygonFromRing(sprayRing);
  const neighborGeometry = polygonFromRing(neighborRing);
  assert.equal(hashGeometry(sprayGeometry), hashGeometry(polygonFromRing(sprayRing)));
  const distance = geometryDistanceMeters(sprayGeometry, neighborGeometry);
  assert.ok(distance > 5 && distance < 40, `adjacent demo fields should be tens of metres apart, got ${distance}`);
  assert.equal(geometriesIntersect(sprayGeometry, neighborGeometry), false);
});
