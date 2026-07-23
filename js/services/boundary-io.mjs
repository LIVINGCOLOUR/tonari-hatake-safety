import { adaptGeoJsonPayload } from "../domain/import.mjs";

export class BoundaryIOError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "BoundaryIOError";
    this.code = code;
  }
}

function ensureCatalogEntry(entry, index) {
  const code = String(entry?.code || "").trim();
  const name = String(entry?.name || "").trim();
  const file = String(entry?.file || "").trim();
  if (!code || !name || !file || /[\\/]/.test(file)) {
    return {
      ok: false,
      warning: { code: "invalid-catalog-entry", index, message: "市町村カタログの項目を読み飛ばしました。" },
    };
  }
  return { ok: true, entry: { ...entry, code, name, file } };
}

function extensionOf(name) {
  const match = String(name || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] || "";
}

function flattenFeatureCollections(parsed) {
  const collections = Array.isArray(parsed) ? parsed : [parsed];
  return collections.flatMap((collection) => (
    Array.isArray(collection?.features) ? collection.features : []
  ));
}

function requireShapefileTools(parseZip) {
  if (typeof parseZip !== "function") {
    throw new BoundaryIOError("parser-unavailable", "Shapefile読込機能を準備できませんでした。");
  }
}

export function listZipEntryNames(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minimumEocdOffset = Math.max(0, bytes.byteLength - 65557);
  let eocdOffset = -1;
  for (let offset = bytes.byteLength - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (view.getUint32(offset, true) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new BoundaryIOError("invalid-zip", "ZIPのファイル一覧を確認できませんでした。");
  }
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder("utf-8");
  const names = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== centralSignature) {
      throw new BoundaryIOError("invalid-zip", "ZIPの中央ディレクトリを確認できませんでした。");
    }
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > bytes.byteLength) {
      throw new BoundaryIOError("invalid-zip", "ZIP内のファイル名を確認できませんでした。");
    }
    names.push(decoder.decode(bytes.subarray(nameStart, nameEnd)));
    offset = nameEnd + extraLength + commentLength;
  }
  return names;
}

async function parseShapefileZip(buffer, { parseZip, listZipEntries } = {}) {
  requireShapefileTools(parseZip);
  let entries;
  try {
    entries = typeof listZipEntries === "function"
      ? await listZipEntries(buffer)
      : listZipEntryNames(buffer);
  } catch (error) {
    throw new BoundaryIOError("invalid-zip", "ZIPの内容を確認できませんでした。", { cause: error });
  }
  const names = Array.isArray(entries) ? entries.map((name) => String(name).toLowerCase()) : [];
  if (!names.some((name) => name.endsWith(".prj"))) {
    throw new BoundaryIOError(
      "missing-prj",
      "座標系を確認するため、.prjを含むShapefile ZIPを選択してください。",
    );
  }
  let parsed;
  try {
    parsed = await parseZip(buffer);
  } catch (error) {
    throw new BoundaryIOError("invalid-shapefile", "Shapefile ZIPを解析できませんでした。", { cause: error });
  }
  const features = flattenFeatureCollections(parsed);
  if (!features.length) {
    throw new BoundaryIOError("empty-shapefile", "Shapefile ZIPに圃場境界が見つかりませんでした。");
  }
  return features;
}

export function parseGeoJsonBoundary(text) {
  const result = adaptGeoJsonPayload(text);
  if (!result.ok) {
    throw new BoundaryIOError("invalid-geojson", result.error.message);
  }
  if (!result.features.length) {
    throw new BoundaryIOError("empty-geojson", "GeoJSONに圃場境界が見つかりませんでした。");
  }
  return result.features;
}

export async function fetchBoundaryCatalog({
  url = "data/boundaries/index.json",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new BoundaryIOError("unavailable", "境界カタログを取得する通信機能がありません。");
  }
  let response;
  try {
    response = await fetchImpl(url, { cache: "no-store" });
  } catch (error) {
    throw new BoundaryIOError("network", "境界カタログを取得できませんでした。", { cause: error });
  }
  if (!response?.ok) {
    throw new BoundaryIOError("upstream", `境界カタログがHTTP ${response?.status || "error"}を返しました。`);
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new BoundaryIOError("invalid-catalog", "境界カタログのJSONを読み取れませんでした。", { cause: error });
  }
  if (!Array.isArray(data?.municipalities)) {
    throw new BoundaryIOError("invalid-catalog", "境界カタログに市町村一覧がありません。");
  }
  const warnings = [];
  const entries = data.municipalities.flatMap((entry, index) => {
    const checked = ensureCatalogEntry(entry, index);
    if (!checked.ok) {
      warnings.push(checked.warning);
      return [];
    }
    return [checked.entry];
  });
  return { entries, warnings };
}

export async function readBoundaryFile(file, shapefileTools = {}) {
  if (!file) throw new BoundaryIOError("missing-file", "境界ファイルを選択してください。");
  const extension = extensionOf(file.name);
  if (extension === ".shp") {
    throw new BoundaryIOError(
      "single-shp",
      "単独の.shpは座標系を確認できません。.prjを含むZIPを選択してください。",
    );
  }
  if (extension === ".zip") {
    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (error) {
      throw new BoundaryIOError("file-read", "ZIPファイルを読み取れませんでした。", { cause: error });
    }
    return {
      features: await parseShapefileZip(buffer, shapefileTools),
      format: "shapefile",
      originalCrs: "PRJからEPSG:4326へ変換",
    };
  }
  if (![".geojson", ".json"].includes(extension)) {
    throw new BoundaryIOError("unsupported-file", "GeoJSONまたはShapefile ZIPを選択してください。");
  }
  let text;
  try {
    text = await file.text();
  } catch (error) {
    throw new BoundaryIOError("file-read", "GeoJSONファイルを読み取れませんでした。", { cause: error });
  }
  return {
    features: parseGeoJsonBoundary(text),
    format: "geojson",
    originalCrs: "EPSG:4326",
  };
}

export async function fetchBoundaryEntry(entry, {
  basePath = "data/boundaries/",
  fetchImpl = globalThis.fetch,
  parseZip,
  listZipEntries,
} = {}) {
  const checked = ensureCatalogEntry(entry, 0);
  if (!checked.ok) {
    throw new BoundaryIOError("invalid-entry", "境界カタログの対象項目が不正です。");
  }
  if (typeof fetchImpl !== "function") {
    throw new BoundaryIOError("unavailable", "境界ファイルを取得する通信機能がありません。");
  }
  const target = `${basePath}${encodeURIComponent(checked.entry.file)}`;
  let response;
  try {
    response = await fetchImpl(target, { cache: "no-store" });
  } catch (error) {
    throw new BoundaryIOError("network", `${checked.entry.name}の境界を取得できませんでした。`, { cause: error });
  }
  if (!response?.ok) {
    throw new BoundaryIOError("upstream", `${checked.entry.name}の境界がHTTP ${response?.status || "error"}を返しました。`);
  }
  const extension = extensionOf(checked.entry.file);
  if (extension === ".zip") {
    let buffer;
    try {
      buffer = await response.arrayBuffer();
    } catch (error) {
      throw new BoundaryIOError("response-read", "境界ZIPを読み取れませんでした。", { cause: error });
    }
    return {
      features: await parseShapefileZip(buffer, { parseZip, listZipEntries }),
      format: "shapefile",
      originalCrs: "PRJからEPSG:4326へ変換",
      entry: checked.entry,
    };
  }
  if (![".geojson", ".json"].includes(extension)) {
    throw new BoundaryIOError("unsupported-entry", "カタログの境界形式に対応していません。");
  }
  let text;
  try {
    text = await response.text();
  } catch (error) {
    throw new BoundaryIOError("response-read", "境界GeoJSONを読み取れませんでした。", { cause: error });
  }
  return {
    features: parseGeoJsonBoundary(text),
    format: "geojson",
    originalCrs: "EPSG:4326",
    entry: checked.entry,
  };
}

export function boundaryErrorMessage(error) {
  if (error instanceof BoundaryIOError) return error.message;
  return "境界ファイルを読み込めませんでした。形式を確認してください。";
}
