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
  pointInRing,
  pointSegmentDistance,
  polygonAreaHectares,
  polygonFromRing,
  projectLngLatToLocalMeters,
  stableImportedId,
  unprojectLocalMetersToLngLat,
  wgs84RangeViolation,
} from "../js/domain/geometry.mjs";
import {
  formatAmountValue,
  formatTotalAmount,
  plannedTotalAmount,
  trimNumber,
} from "../js/domain/spray.mjs";
import {
  buildPrescription,
  buildPrescriptionZones,
  detectRateField,
  parsePrescriptionText,
  prescriptionClassOf,
  prescriptionZonesFeatureCollection,
} from "../js/domain/prescription.mjs";
import {
  buildCoverageGrid,
  calculateGridCoverage,
  coverageMapData,
  coveragePlanHasLog,
  estimateCoverage,
  resetCoverageGridCacheForTest,
} from "../js/domain/coverage.mjs";

const polygon = (west, south, east, north, holes = []) => ({
  type: "Polygon",
  coordinates: [[
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ], ...holes],
});

test("spray amount calculations keep 10a and hectare units consistent", () => {
  assert.deepEqual(
    plannedTotalAmount({ ratePer10a: "250", areaHa: "0.8", rateUnit: "mL" }),
    { value: 2000, unit: "mL" },
  );
  assert.equal(formatAmountValue(2000, "mL"), "2L");
  assert.equal(formatAmountValue(1250, "g"), "1.25kg");
  assert.equal(formatTotalAmount({ ratePer10a: 80, areaHa: 0.25, rateUnit: "g" }), "200g");
  assert.equal(formatTotalAmount({ ratePer10a: "", areaHa: 1 }), "\u2014");
  assert.equal(trimNumber(1.236), "1.24");
});

test("coverage geometry helpers preserve coordinates and planar distances", () => {
  const origin = [140.3, 36.3];
  const coordinate = [140.301, 36.302];
  const projected = projectLngLatToLocalMeters(coordinate, origin);
  const restored = unprojectLocalMetersToLngLat(projected, origin);
  assert.ok(Math.abs(restored[0] - coordinate[0]) < 1e-10);
  assert.ok(Math.abs(restored[1] - coordinate[1]) < 1e-10);
  assert.equal(pointInRing([5, 5], [[0, 0], [10, 0], [10, 10], [0, 10]]), true);
  assert.equal(pointSegmentDistance([5, 3], [0, 0], [10, 0]), 3);
});

test("prescription area subtracts holes and adds MultiPolygon parts", () => {
  const outer = polygon(140, 36, 140.002, 36.002);
  const hole = [[
    [140.0005, 36.0005], [140.0015, 36.0005], [140.0015, 36.0015],
    [140.0005, 36.0015], [140.0005, 36.0005],
  ]];
  const withHole = polygon(140, 36, 140.002, 36.002, hole);
  const outerArea = polygonAreaHectares(outer);
  const holeArea = polygonAreaHectares(withHole);
  assert.ok(holeArea > 0 && holeArea < outerArea);
  const multiArea = polygonAreaHectares({
    type: "MultiPolygon",
    coordinates: [outer.coordinates, outer.coordinates],
  });
  assert.ok(Math.abs(multiArea - outerArea * 2) < 1e-9);
});

test("prescription parsing creates provider-neutral rate statistics", () => {
  const features = [
    { type: "Feature", properties: { targetRate: 80 }, geometry: polygon(140, 36, 140.001, 36.001) },
    { type: "Feature", properties: { targetRate: 120 }, geometry: polygon(140.001, 36, 140.002, 36.001) },
  ];
  assert.equal(detectRateField(features[0].properties), "targetRate");
  const prescription = buildPrescription(features, "test", "kg/ha", "2026-07-23 10:00");
  assert.equal(prescription.count, 2);
  assert.equal(prescription.min, 80);
  assert.equal(prescription.max, 120);
  assert.equal(prescription.avg, 100);
  assert.equal(prescription.importedAt, "2026-07-23 10:00");
  assert.ok(prescription.totalAreaHa > 0);
  const parsed = parsePrescriptionText(JSON.stringify({ type: "FeatureCollection", unit: "kg/ha", features }), "json");
  assert.equal(parsed.unit, "kg/ha");
});

test("prescription zones are deterministic and carry map-only presentation properties", () => {
  const ring = polygon(140, 36, 140.002, 36.002).coordinates[0];
  const prescription = buildPrescriptionZones(ring, 4, 100, "kg/ha", "fertilizer", "now");
  assert.equal(prescription.count, 4);
  assert.equal(prescription.editable, true);
  assert.equal(prescription.features[0].properties.rate, 100);
  assert.equal(prescriptionClassOf(100, 80, 120, 5), 2);
  const colors = ["a", "b", "c", "d", "e"];
  const collection = prescriptionZonesFeatureCollection(prescription, colors);
  assert.equal(collection.features.length, 4);
  assert.equal(collection.features[0].properties._color, "a");
  assert.equal(collection.features[0].properties._rate, 100);
});

test("coverage grid measures sprayed and unsprayed cells from a flight track", () => {
  resetCoverageGridCacheForTest();
  const ringLngLat = polygon(140, 36, 140.0003, 36.0003).coordinates[0];
  const input = {
    fieldId: "coverage-field",
    ringLngLat,
    sprayWidthMetres: 4,
    imported: true,
    track: [
      { coordinates: [140, 36.00015], sprayOn: true },
      { coordinates: [140.00015, 36.00015], sprayOn: true },
      { coordinates: [140.0003, 36.00015], sprayOn: true },
    ],
  };
  const grid = buildCoverageGrid(input);
  assert.ok(grid.cells.length > 0);
  const partial = calculateGridCoverage(input, 1);
  const complete = calculateGridCoverage(input);
  assert.ok(partial.sprayedCells > 0);
  assert.ok(complete.sprayedCells >= partial.sprayedCells);
  assert.ok(complete.coveragePct > 0 && complete.coveragePct < 100);
  assert.equal(coveragePlanHasLog(input), true);
  const summary = estimateCoverage(input);
  assert.equal(summary.hasLog, true);
  assert.equal(summary.coveragePct, complete.coveragePct);
  assert.equal(summary.unsprayedCells, complete.totalCells - complete.sprayedCells);
});

test("coverage map data preserves playback marker and spray-off tracks", () => {
  const input = {
    fieldId: "coverage-map-field",
    ringLngLat: polygon(140, 36, 140.0003, 36.0003).coordinates[0],
    sprayWidthMetres: 4,
    imported: true,
    track: [
      { coordinates: [140, 36.00015], sprayOn: false },
      { coordinates: [140.00015, 36.00015], sprayOn: false },
      { coordinates: [140.0003, 36.00015], sprayOn: false },
    ],
  };
  const data = coverageMapData(input, 1);
  assert.equal(data.idx, 1);
  assert.deepEqual(data.marker.features[0].geometry.coordinates, input.track[1].coordinates);
  assert.equal(data.gc.sprayedCells, 0);
  assert.equal(data.cells.features.length, data.gc.totalCells);
  assert.deepEqual(estimateCoverage({ ...input, imported: false }), { hasLog: false });
});

test("invalid track points keep playback indexes without bridging spray segments", () => {
  const input = {
    fieldId: "coverage-invalid-track",
    ringLngLat: polygon(140, 36, 140.0003, 36.0003).coordinates[0],
    sprayWidthMetres: 4,
    imported: true,
    track: [
      { coordinates: [140, 36.00015], sprayOn: true },
      { coordinates: [Number.NaN, 36.00015], sprayOn: true },
      { coordinates: [140.0003, 36.00015], sprayOn: true },
    ],
  };
  const data = coverageMapData(input, 1);
  assert.equal(data.idx, 1);
  assert.equal(data.marker.features.length, 0);
  assert.equal(data.gc.sprayedCells, 0);
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
