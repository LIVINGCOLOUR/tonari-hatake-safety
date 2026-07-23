const CSV_MIME_TYPE = "text/csv;charset=utf-8";
const GEOJSON_MIME_TYPE = "application/geo+json;charset=utf-8";

export class ExportIOError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "ExportIOError";
    this.code = code;
  }
}

export function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(rows, { bom = true, lineEnding = "\n" } = {}) {
  if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row))) {
    throw new ExportIOError("invalid-csv", "CSVの行データが不正です。");
  }
  const csv = rows.map((row) => row.map(csvCell).join(",")).join(lineEnding);
  return `${bom ? "\ufeff" : ""}${csv}`;
}

export function serializeGeoJson(value, { space = 2 } = {}) {
  if (!value || typeof value !== "object") {
    throw new ExportIOError("invalid-geojson", "GeoJSONのデータが不正です。");
  }
  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    throw new ExportIOError("invalid-geojson", "GeoJSONを出力用に変換できません。", { cause: error });
  }
}

export function downloadText({
  text,
  filename,
  mimeType = "text/plain;charset=utf-8",
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  BlobCtor = globalThis.Blob,
} = {}) {
  if (typeof text !== "string" || !String(filename || "").trim()) {
    throw new ExportIOError("invalid-download", "出力内容またはファイル名が不正です。");
  }
  if (!documentRef?.createElement || !documentRef?.body?.appendChild
    || typeof urlApi?.createObjectURL !== "function"
    || typeof urlApi?.revokeObjectURL !== "function"
    || typeof BlobCtor !== "function") {
    throw new ExportIOError("unsupported-download", "このブラウザではファイルを保存できません。");
  }

  const blob = new BlobCtor([text], { type: mimeType });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    documentRef.body.appendChild(link);
    link.click();
  } catch (error) {
    throw new ExportIOError("download-failed", "ファイルの保存を開始できませんでした。", { cause: error });
  } finally {
    link.remove?.();
    urlApi.revokeObjectURL(url);
  }
  return { filename, mimeType, size: blob.size };
}

export function downloadCsv(rows, options = {}) {
  return downloadText({
    ...options,
    text: buildCsv(rows, options),
    mimeType: options.mimeType || CSV_MIME_TYPE,
  });
}

export function downloadGeoJson(value, options = {}) {
  return downloadText({
    ...options,
    text: serializeGeoJson(value, options),
    mimeType: options.mimeType || GEOJSON_MIME_TYPE,
  });
}

export function printHtml({
  html,
  sheet,
  body = globalThis.document?.body,
  windowRef = globalThis.window,
  schedule = globalThis.setTimeout,
  cleanupDelay = 400,
  printingClass = "printing",
} = {}) {
  if (typeof html !== "string" || !sheet || !body?.classList
    || typeof windowRef?.print !== "function" || typeof schedule !== "function") {
    throw new ExportIOError("unsupported-print", "このブラウザでは印刷を開始できません。");
  }

  sheet.innerHTML = html;
  sheet.setAttribute?.("aria-hidden", "false");
  body.classList.add(printingClass);
  try {
    windowRef.print();
  } catch (error) {
    body.classList.remove(printingClass);
    sheet.setAttribute?.("aria-hidden", "true");
    throw new ExportIOError("print-failed", "印刷画面を開けませんでした。", { cause: error });
  }

  schedule(() => {
    body.classList.remove(printingClass);
    sheet.setAttribute?.("aria-hidden", "true");
  }, cleanupDelay);
}

export function exportErrorMessage(error) {
  if (error instanceof ExportIOError) return error.message;
  return "出力処理に失敗しました。もう一度お試しください。";
}
