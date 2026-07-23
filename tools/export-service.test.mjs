import test from "node:test";
import assert from "node:assert/strict";

import {
  ExportIOError,
  buildCsv,
  csvCell,
  downloadCsv,
  downloadGeoJson,
  downloadText,
  printHtml,
  serializeGeoJson,
} from "../js/services/export-io.mjs";

test("CSV output keeps the Japanese Excel BOM and quotes every cell", () => {
  const csv = buildCsv([
    ["圃場", "メモ"],
    ["ほ場A", '風速2.3m/s, "実測"'],
    [null, "改行\nあり"],
  ]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(
    csv,
    '\ufeff"圃場","メモ"\n"ほ場A","風速2.3m/s, ""実測"""\n"","改行\nあり"',
  );
});

test("CSV validation rejects non-tabular input", () => {
  assert.throws(
    () => buildCsv([["ok"], "bad"]),
    (error) => error instanceof ExportIOError && error.code === "invalid-csv",
  );
});

test("GeoJSON serialization remains readable and validates the root value", () => {
  const geojson = { type: "FeatureCollection", features: [] };
  assert.equal(JSON.parse(serializeGeoJson(geojson)).type, "FeatureCollection");
  assert.match(serializeGeoJson(geojson), /\n  "features"/);
  assert.throws(
    () => serializeGeoJson(null),
    (error) => error instanceof ExportIOError && error.code === "invalid-geojson",
  );
});

function downloadHarness() {
  const calls = { appended: 0, clicked: 0, removed: 0, revoked: [], blobs: [] };
  const anchor = {
    href: "",
    download: "",
    click() { calls.clicked += 1; },
    remove() { calls.removed += 1; },
  };
  const documentRef = {
    body: { appendChild() { calls.appended += 1; } },
    createElement(tag) {
      assert.equal(tag, "a");
      return anchor;
    },
  };
  const urlApi = {
    createObjectURL(blob) {
      calls.blobs.push(blob);
      return "blob:test";
    },
    revokeObjectURL(url) { calls.revoked.push(url); },
  };
  return { anchor, calls, documentRef, urlApi };
}

test("browser download clicks a temporary link and always revokes its URL", () => {
  const harness = downloadHarness();
  const result = downloadText({
    text: "hello",
    filename: "record.txt",
    documentRef: harness.documentRef,
    urlApi: harness.urlApi,
  });
  assert.equal(harness.anchor.download, "record.txt");
  assert.equal(harness.anchor.href, "blob:test");
  assert.deepEqual(
    [harness.calls.appended, harness.calls.clicked, harness.calls.removed],
    [1, 1, 1],
  );
  assert.deepEqual(harness.calls.revoked, ["blob:test"]);
  assert.equal(result.size, 5);
});

test("CSV and GeoJSON adapters select the intended filename and MIME type", () => {
  const csvHarness = downloadHarness();
  const csvResult = downloadCsv([["圃場"], ["A"]], {
    filename: "history.csv",
    documentRef: csvHarness.documentRef,
    urlApi: csvHarness.urlApi,
  });
  assert.equal(csvResult.filename, "history.csv");
  assert.equal(csvResult.mimeType, "text/csv;charset=utf-8");
  assert.equal(csvHarness.calls.blobs[0].type, "text/csv;charset=utf-8");

  const geoHarness = downloadHarness();
  const geoResult = downloadGeoJson({ type: "FeatureCollection", features: [] }, {
    filename: "route.geojson",
    documentRef: geoHarness.documentRef,
    urlApi: geoHarness.urlApi,
  });
  assert.equal(geoResult.mimeType, "application/geo+json;charset=utf-8");
  assert.equal(geoHarness.calls.blobs[0].type, "application/geo+json;charset=utf-8");
});

test("download failures still remove the link and release the object URL", () => {
  const harness = downloadHarness();
  harness.anchor.click = () => { throw new Error("blocked"); };
  assert.throws(
    () => downloadText({
      text: "hello",
      filename: "record.txt",
      documentRef: harness.documentRef,
      urlApi: harness.urlApi,
    }),
    (error) => error instanceof ExportIOError && error.code === "download-failed",
  );
  assert.equal(harness.calls.removed, 1);
  assert.deepEqual(harness.calls.revoked, ["blob:test"]);
});

test("print output enters print mode and restores the application afterwards", () => {
  const classes = new Set();
  const attributes = {};
  let printed = 0;
  let cleanup;
  const sheet = {
    innerHTML: "",
    setAttribute(name, value) { attributes[name] = value; },
  };
  const body = {
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
    },
  };
  printHtml({
    html: "<article>確認記録</article>",
    sheet,
    body,
    windowRef: { print() { printed += 1; } },
    schedule(callback, delay) {
      assert.equal(delay, 400);
      cleanup = callback;
    },
  });
  assert.equal(sheet.innerHTML, "<article>確認記録</article>");
  assert.equal(attributes["aria-hidden"], "false");
  assert(classes.has("printing"));
  assert.equal(printed, 1);
  cleanup();
  assert(!classes.has("printing"));
  assert.equal(attributes["aria-hidden"], "true");
});
