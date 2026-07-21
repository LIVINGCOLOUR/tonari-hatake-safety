import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVIDER_IDS,
  adaptGeoJsonPayload,
  adaptMunicipalityParcelPayload,
  adaptWagriFieldPolygonPayload,
  adaptXarvioBoundaryPayload,
  buildFieldRecord,
  buildFieldsFromFeatures,
  importedPropertyId,
  outerRingLngLat,
  parcelCompatibleId,
  parseGeoJsonFeatures,
} from "../js/domain/import.mjs";

const polygon = (west = 140, south = 36, east = 140.001, north = 36.001) => ({
  type: "Polygon",
  coordinates: [[
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ]],
});

const feature = (properties = {}, geometry = polygon()) => ({
  type: "Feature",
  geometry,
  properties,
});

test("provider ids remain stable across provider adapters", () => {
  assert.equal(PROVIDER_IDS.XARVIO, "xarvio");
  assert.equal(PROVIDER_IDS.WAGRI, "wagri");
  assert.equal(PROVIDER_IDS.MUNICIPALITY, "municipality");
});

test("WAGRI FieldPolygonID v2/v3 records become neutral canonical polygons", () => {
  const adapted = adaptWagriFieldPolygonPayload([{
    polygon_uuid: "wagri-001",
    land_type: 100,
    issue_year: 2025,
    edit_year: 2026,
    Polygons: [{ Coordinates: [
      { Longitude: "140.0", Latitude: "36.0" },
      { Longitude: "140.001", Latitude: "36.0" },
      { Longitude: "140.001", Latitude: "36.001" },
      { Longitude: "140.0", Latitude: "36.0" },
    ] }],
  }], { provider: "file" });
  assert.equal(adapted.ok, true);
  assert.equal(adapted.context.provider, "wagri");
  assert.equal(adapted.features[0].properties.type, "public");
  assert.equal(adapted.features[0].properties.fieldId, "wagri-001");
  assert.equal(adapted.features[0].properties.sourceLandType, 100);

  const built = buildFieldsFromFeatures(adapted.features, adapted.context, {
    now: () => "2026-07-21T00:00:00.000Z",
  });
  assert.equal(built.fields[0].type, "public");
  assert.equal(built.fields[0].externalRefs[0].externalId, "wagri-001");
  assert.equal(built.fields[0].externalRefs[0].revision, "2026");
  assert.equal(built.fields[0].notifyTarget, false);
});

test("WAGRI GeoJSON and AgriculturalMap3 LinearPolygon forms are supported", () => {
  const geojson = adaptWagriFieldPolygonPayload({
    type: "FeatureCollection",
    features: [feature({ polygon_uuid: "geo-001", land_type: 200 })],
  });
  assert.equal(geojson.features[0].properties.fieldId, "geo-001");

  const integrated = adaptWagriFieldPolygonPayload({
    targetFeatures: [{
      type: "Feature",
      geometry: { type: "LinearPolygon", coordinates: polygon().coordinates },
      properties: { ID: "map-001", FieldType: 100, IssueYear: 2025, EditYear: 2026 },
    }],
  });
  assert.equal(integrated.ok, true);
  assert.equal(integrated.features[0].geometry.type, "Polygon");
  assert.equal(integrated.features[0].properties.fieldId, "map-001");
  assert.equal(integrated.features[0].properties.sourceRevision, "2026");
});

test("WAGRI rejects undocumented containers and empty polygon payloads", () => {
  assert.equal(adaptWagriFieldPolygonPayload({ data: [] }).error.code, "wagri-unsupported-payload");
  assert.equal(adaptWagriFieldPolygonPayload([]).error.code, "wagri-no-polygons");
});

test("xarvio binds one parsed boundary to the explicit API field UUID", () => {
  const adapted = adaptXarvioBoundaryPayload(feature({ crop: "rice" }), {
    provider: "file",
    fieldUuid: "8c154be2-6a01-4ed0-84c4-07b8399886cb",
    fieldName: "北側ほ場",
    datasetVersion: "etag-1",
  });
  assert.equal(adapted.ok, true);
  assert.equal(adapted.context.provider, "xarvio");
  assert.equal(adapted.features[0].properties.fieldId, "8c154be2-6a01-4ed0-84c4-07b8399886cb");
  assert.equal(adapted.features[0].properties.name, "北側ほ場");
  const built = buildFieldsFromFeatures(adapted.features, adapted.context, { forceType: "spray" });
  assert.equal(built.fields[0].externalRefs[0].provider, "xarvio");
  assert.equal(built.fields[0].externalRefs[0].revision, "etag-1");
});

test("xarvio refuses missing UUIDs and ambiguous multi-boundary exports", () => {
  assert.equal(adaptXarvioBoundaryPayload(feature()).error.code, "xarvio-field-uuid-required");
  const ambiguous = adaptXarvioBoundaryPayload({
    type: "FeatureCollection",
    features: [feature(), feature({}, polygon(141, 36, 141.001, 36.001))],
  }, { fieldUuid: "field-1" });
  assert.equal(ambiguous.error.code, "xarvio-boundary-ambiguous");
});

test("GeoJSON parser accepts collection, feature, and bare geometry", () => {
  const collection = parseGeoJsonFeatures(JSON.stringify({
    type: "FeatureCollection",
    features: [feature({ id: "a" })],
  }));
  const single = parseGeoJsonFeatures(JSON.stringify(feature({ id: "b" })));
  const bare = parseGeoJsonFeatures(JSON.stringify(polygon()));
  assert.equal(collection.features.length, 1);
  assert.equal(single.features[0].properties.id, "b");
  assert.equal(bare.features[0].geometry.type, "Polygon");
  assert.equal(parseGeoJsonFeatures("{").error.code, "parse-failed");
});

test("adapters normalize only known payload containers and preserve context", () => {
  const geo = adaptGeoJsonPayload(JSON.stringify(feature()), { source: "sample.geojson" });
  assert.equal(geo.ok, true);
  assert.equal(geo.context.provider, "file");
  assert.equal(geo.context.source, "sample.geojson");

  const municipality = adaptMunicipalityParcelPayload([feature()], { sourceCode: "municipality:08216" });
  assert.equal(municipality.ok, true);
  assert.equal(municipality.context.provider, "municipality");
  assert.equal(municipality.features.length, 1);
});

test("property ids include Japanese parcel identifiers", () => {
  assert.equal(importedPropertyId({ "筆ID": "parcel-001" }), "parcel-001");
  assert.equal(importedPropertyId({ "筆ポリゴンID": 42 }), "42");
  assert.equal(importedPropertyId({ "地番": "10-2" }), "10-2");
});

test("field record keeps exact stable ids, external refs, and provenance", () => {
  const result = buildFieldRecord(
    feature({ "圃場名": "対象ほ場", "種別": "散布", "作物": "水稲", "筆ID": "parcel-001" }),
    0,
    {
      source: "fixture.geojson",
      sourceCode: "file:fixture.geojson",
      provider: "file",
      datasetVersion: "2026-07",
    },
    { now: () => "2026-07-21T00:00:00.000Z" },
  );
  assert.equal(result.ok, true);
  assert.equal(result.field.id, "imported-spray-f8738972");
  assert.equal(result.field.name, "対象ほ場");
  assert.equal(result.field.crop, "水稲");
  assert.equal(result.field.provenance.stableKey, "file:fixture.geojson:parcel-001");
  assert.equal(result.field.provenance.importedAt, "2026-07-21T00:00:00.000Z");
  assert.deepEqual(result.field.externalRefs, [{
    provider: "file",
    providerAccount: "",
    resourceType: "field",
    externalId: "parcel-001",
    revision: "2026-07",
  }]);
});

test("known-field resolver preserves curated demo ids without core knowledge", () => {
  const result = buildFieldRecord(
    feature({ name: "Demo A", type: "spray" }),
    0,
    { sourceCode: "municipality:demo" },
    { resolveKnownField: (name) => name === "Demo A" ? { id: "spray-field-a", type: "spray" } : null },
  );
  assert.equal(result.field.id, "spray-field-a");
});

test("parcel id remains compatible with Phase 1 localStorage", () => {
  assert.equal(parcelCompatibleId("parcel-backdrop:parcel-001"), "parcel-503ec78a");
});

test("batch import is deterministic and removes duplicate stable keys", () => {
  const input = [
    feature({ name: "A", type: "spray", id: "same" }),
    feature({ name: "A duplicate", type: "spray", id: "same" }),
  ];
  const options = { now: () => "2026-07-21T00:00:00.000Z" };
  const first = buildFieldsFromFeatures(input, { sourceCode: "file:test" }, options);
  const second = buildFieldsFromFeatures(input, { sourceCode: "file:test" }, options);
  assert.deepEqual(first, second);
  assert.equal(first.fields.length, 1);
  assert.equal(first.warnings[0].code, "duplicate-stable-key");
});

test("invalid geometry, out-of-range CRS, and missing polygons return typed errors", () => {
  const invalid = buildFieldsFromFeatures([feature({}, { type: "Polygon", coordinates: [] })]);
  const outOfRange = buildFieldsFromFeatures([feature({}, polygon(200, 36, 201, 37))]);
  const empty = buildFieldsFromFeatures([{ type: "Feature", geometry: { type: "Point", coordinates: [140, 36] } }]);
  assert.equal(invalid.error.code, "invalid-geometry");
  assert.equal(outOfRange.error.code, "crs-out-of-range");
  assert.equal(empty.error.code, "no-polygons");
});

test("spray-relative distance and direction are assigned from canonical geometry", () => {
  const result = buildFieldsFromFeatures([
    feature({ name: "Spray", type: "spray", id: "spray" }, polygon(140, 36, 140.001, 36.001)),
    feature({ name: "East", type: "organic", id: "east" }, polygon(140.002, 36, 140.003, 36.001)),
  ], { sourceCode: "file:distance" }, { now: () => "2026-07-21T00:00:00.000Z" });
  assert.equal(result.ok, true);
  assert.ok(result.fields[1].distance > 80 && result.fields[1].distance < 100);
  assert.equal(result.fields[1].direction, "東");
});

test("outer ring keeps legacy open-ring representation for Polygon and MultiPolygon", () => {
  const ring = outerRingLngLat(polygon());
  const multi = outerRingLngLat({ type: "MultiPolygon", coordinates: [polygon().coordinates] });
  assert.equal(ring.length, 4);
  assert.deepEqual(multi, ring);
});
