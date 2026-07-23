import test from "node:test";
import assert from "node:assert/strict";

import {
  BoundaryIOError,
  boundaryErrorMessage,
  fetchBoundaryCatalog,
  fetchBoundaryEntry,
  listZipEntryNames,
  parseGeoJsonBoundary,
  readBoundaryFile,
} from "../js/services/boundary-io.mjs";

const polygonFeature = {
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [[[140, 36], [140.001, 36], [140.001, 36.001], [140, 36.001], [140, 36]]],
  },
  properties: { name: "Test field" },
};

const geoJsonText = JSON.stringify({ type: "FeatureCollection", features: [polygonFeature] });
const file = (name, { text = geoJsonText, buffer = new ArrayBuffer(8) } = {}) => ({
  name,
  text: async () => text,
  arrayBuffer: async () => buffer,
});

function zipDirectoryWith(names) {
  const encoder = new TextEncoder();
  const encodedNames = names.map((name) => encoder.encode(name));
  const centralSize = encodedNames.reduce((total, name) => total + 46 + name.length, 0);
  const bytes = new Uint8Array(centralSize + 22);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  encodedNames.forEach((name) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 28, name.length, true);
    bytes.set(name, offset + 46);
    offset += 46 + name.length;
  });
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, encodedNames.length, true);
  view.setUint16(offset + 10, encodedNames.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, 0, true);
  return bytes.buffer;
}

test("boundary catalog keeps valid local filenames and reports invalid entries", async () => {
  const loaded = await fetchBoundaryCatalog({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        municipalities: [
          { code: "08216", name: "笠間市", file: "kasama.geojson" },
          { code: "bad", name: "Bad", file: "../outside.geojson" },
        ],
      }),
    }),
  });
  assert.deepEqual(loaded.entries.map((entry) => entry.code), ["08216"]);
  assert.equal(loaded.warnings[0].code, "invalid-catalog-entry");
});

test("GeoJSON boundary parsing delegates geometry validation to the import adapter", () => {
  assert.equal(parseGeoJsonBoundary(geoJsonText).length, 1);
  assert.throws(
    () => parseGeoJsonBoundary("{broken"),
    (error) => error instanceof BoundaryIOError && error.code === "invalid-geojson",
  );
});

test("local boundary files distinguish GeoJSON, unsupported files, and unsafe shapefiles", async () => {
  const loaded = await readBoundaryFile(file("fields.geojson"));
  assert.equal(loaded.format, "geojson");
  assert.equal(loaded.features.length, 1);

  await assert.rejects(
    readBoundaryFile(file("fields.shp")),
    (error) => error instanceof BoundaryIOError && error.code === "single-shp",
  );
  await assert.rejects(
    readBoundaryFile(file("fields.csv")),
    (error) => error instanceof BoundaryIOError && error.code === "unsupported-file",
  );
});

test("Shapefile ZIP requires PRJ and flattens parsed feature collections", async () => {
  const tools = {
    listZipEntries: async () => ["fields.shp", "fields.dbf", "fields.prj"],
    parseZip: async () => ({ type: "FeatureCollection", features: [polygonFeature] }),
  };
  const loaded = await readBoundaryFile(file("fields.zip"), tools);
  assert.equal(loaded.format, "shapefile");
  assert.equal(loaded.features.length, 1);
  assert.match(loaded.originalCrs, /EPSG:4326/);

  await assert.rejects(
    readBoundaryFile(file("no-prj.zip"), {
      ...tools,
      listZipEntries: async () => ["fields.shp", "fields.dbf"],
    }),
    (error) => error instanceof BoundaryIOError && error.code === "missing-prj",
  );
});

test("ZIP central-directory inspection finds PRJ without expanding the archive", () => {
  assert.deepEqual(
    listZipEntryNames(zipDirectoryWith(["fields.shp", "fields.dbf", "fields.prj"])),
    ["fields.shp", "fields.dbf", "fields.prj"],
  );
  assert.throws(
    () => listZipEntryNames(new ArrayBuffer(8)),
    (error) => error instanceof BoundaryIOError && error.code === "invalid-zip",
  );
});

test("catalog boundary fetch shares parsing and sanitizes transport failures", async () => {
  const entry = { code: "08216", name: "笠間市", file: "kasama.geojson" };
  const loaded = await fetchBoundaryEntry(entry, {
    fetchImpl: async (url, options) => {
      assert.equal(url, "data/boundaries/kasama.geojson");
      assert.equal(options.cache, "no-store");
      return { ok: true, text: async () => geoJsonText };
    },
  });
  assert.equal(loaded.features.length, 1);
  assert.equal(loaded.entry.code, "08216");

  await assert.rejects(
    fetchBoundaryEntry(entry, { fetchImpl: async () => ({ ok: false, status: 404 }) }),
    (error) => error instanceof BoundaryIOError && error.code === "upstream",
  );
  assert.equal(
    boundaryErrorMessage(new Error("internal path")),
    "境界ファイルを読み込めませんでした。形式を確認してください。",
  );
});
