// Pure field-import normalization. UI, fetch, FileReader, shpjs, and state
// mutation stay in main.js. Future provider adapters should map payloads to
// GeoJSON Features and pass explicit provider context through this module.

import {
  bearingBetweenLngLat,
  bearingToDirection,
  geometryCentroid,
  geometryDistanceMeters,
  hashGeometry,
  hashString,
  normalizeGeometry,
  stableImportedId,
  wgs84RangeViolation,
} from "./geometry.mjs";

export const PROVIDER_IDS = Object.freeze({
  FILE: "file",
  MUNICIPALITY: "municipality",
  PARCEL_BACKDROP: "parcel-backdrop",
  XARVIO: "xarvio",
  WAGRI: "wagri",
});

// Adapter contract for provider integrations:
// { providerId, normalize(payload, context) ->
//   { ok: true, features: GeoJSONFeature[], context, warnings } |
//   { ok: false, error } }

function errorResult(code, message, featureIndex) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(Number.isInteger(featureIndex) ? { featureIndex } : {}),
    },
  };
}

export function parseGeoJsonFeatures(text) {
  let data;
  try {
    data = typeof text === "string" ? JSON.parse(text) : text;
  } catch (error) {
    return errorResult("parse-failed", "GeoJSONを読み取れませんでした。");
  }
  let features = [];
  if (data?.type === "FeatureCollection") features = data.features || [];
  else if (data?.type === "Feature") features = [data];
  else if (data?.type && data.coordinates) {
    features = [{ type: "Feature", geometry: data, properties: {} }];
  }
  return { ok: true, features, warnings: [] };
}

export function polygonFeatures(features) {
  return (Array.isArray(features) ? features : []).filter(
    (feature) => feature?.geometry && ["Polygon", "MultiPolygon"].includes(feature.geometry.type),
  );
}

export function adaptGeoJsonPayload(payload, context = {}) {
  const parsed = parseGeoJsonFeatures(payload);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    features: polygonFeatures(parsed.features),
    context: {
      provider: context.provider || PROVIDER_IDS.FILE,
      originalCrs: context.originalCrs || "EPSG:4326",
      ...context,
    },
    warnings: parsed.warnings,
  };
}

export function adaptMunicipalityParcelPayload(payload, context = {}) {
  const features = polygonFeatures(payload);
  return {
    ok: true,
    features,
    context: {
      provider: context.provider || PROVIDER_IDS.MUNICIPALITY,
      originalCrs: context.originalCrs || "EPSG:4326",
      ...context,
    },
    warnings: [],
  };
}

function wagriRecordId(properties = {}) {
  const keys = ["polygon_uuid", "PolygonUuid", "ID", "LastPolygonUuid", "last_polygon_uuid"];
  for (const key of keys) {
    const value = properties[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function wagriRecordRevision(properties = {}) {
  return String(
    properties.edit_year || properties.EditYear || properties.issue_year || properties.IssueYear || "",
  ).trim();
}

function wagriCoordinate(value) {
  const lng = Number(value?.Longitude ?? value?.longitude ?? value?.Lng ?? value?.lng);
  const lat = Number(value?.Latitude ?? value?.latitude ?? value?.Lat ?? value?.lat);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function wagriLegacyGeometry(record) {
  const polygons = (record?.Polygons || [])
    .map((polygon) => (polygon?.Coordinates || []).map(wagriCoordinate).filter(Boolean))
    .filter((ring) => ring.length >= 3);
  if (!polygons.length) return null;
  if (polygons.length === 1) return { type: "Polygon", coordinates: [polygons[0]] };
  return { type: "MultiPolygon", coordinates: polygons.map((ring) => [ring]) };
}

function neutralWagriFeature(feature, index) {
  const sourceProperties = feature?.properties || {};
  const externalId = wagriRecordId(sourceProperties);
  return {
    type: "Feature",
    geometry: feature?.geometry?.type === "LinearPolygon"
      ? { type: "Polygon", coordinates: feature.geometry.coordinates }
      : feature?.geometry,
    properties: {
      ...sourceProperties,
      type: "public",
      ...(externalId ? { fieldId: externalId } : {}),
      name: sourceProperties.name || sourceProperties.Name || `WAGRI筆ポリゴン${index + 1}`,
      sourceLandType: sourceProperties.land_type ?? sourceProperties.FieldType ?? "",
      sourceRevision: wagriRecordRevision(sourceProperties),
    },
  };
}

// Supports the officially documented FieldPolygonID v2/v3 response, its
// GeoJSON form, and AgriculturalMap3's targetFeatures/LinearPolygon form.
// WAGRI's land_type/FieldType describes paddy/upland land category, not this
// app's spray-safety status, so imported parcels remain neutral/unregistered.
export function adaptWagriFieldPolygonPayload(payload, context = {}) {
  let features;
  if (Array.isArray(payload)) {
    features = payload.map((record) => ({
      type: "Feature",
      geometry: wagriLegacyGeometry(record),
      properties: { ...record, Polygons: undefined },
    }));
  } else if (payload?.type === "FeatureCollection") {
    features = payload.features || [];
  } else if (Array.isArray(payload?.targetFeatures)) {
    features = payload.targetFeatures;
  } else {
    return errorResult("wagri-unsupported-payload", "WAGRI筆ポリゴンの公開レスポンス形式ではありません。");
  }

  const normalized = polygonFeatures(features.map(neutralWagriFeature));
  if (!normalized.length) return errorResult("wagri-no-polygons", "WAGRIレスポンスに筆ポリゴンがありません。");
  return {
    ok: true,
    features: normalized,
    context: {
      ...context,
      provider: PROVIDER_IDS.WAGRI,
      source: context.source || "WAGRI筆ポリゴンAPI",
      sourceCode: context.sourceCode || "wagri:field-polygon",
      originalCrs: context.originalCrs || "EPSG:4326",
      license: context.license || "WAGRI利用規約に従う",
    },
    warnings: [],
  };
}

// xarvio's public boundary endpoint exports KML/SHP/SVG, but does not promise
// a portable UUID attribute inside every exported shape. The caller must bind
// a single parsed boundary to the UUID used in the API request. Multi-field
// archives stay rejected until an official feature-to-UUID mapping is known.
export function adaptXarvioBoundaryPayload(payload, context = {}) {
  const fieldUuid = String(context.fieldUuid || "").trim();
  if (!fieldUuid) return errorResult("xarvio-field-uuid-required", "xarvio圃場UUIDを指定してください。");
  const parsed = parseGeoJsonFeatures(payload);
  if (!parsed.ok) return parsed;
  const polygons = polygonFeatures(parsed.features);
  if (polygons.length !== 1) {
    return errorResult(
      "xarvio-boundary-ambiguous",
      "xarvio境界は1圃場ずつ取り込んでください。複数境界とUUIDの対応は自動推定しません。",
    );
  }
  const source = polygons[0];
  return {
    ok: true,
    features: [{
      ...source,
      properties: {
        ...(source.properties || {}),
        fieldId: fieldUuid,
        ...(context.fieldName ? { name: context.fieldName } : {}),
      },
    }],
    context: {
      ...context,
      provider: PROVIDER_IDS.XARVIO,
      source: context.source || "xarvio FIELD MANAGER boundary export",
      sourceCode: context.sourceCode || "xarvio:field-boundary",
      originalCrs: context.originalCrs || "EPSG:4326",
    },
    warnings: [],
  };
}

export function outerRingLngLat(geometry) {
  const normalized = normalizeGeometry(geometry);
  const ring = normalized?.type === "MultiPolygon"
    ? normalized.coordinates[0]?.[0]
    : normalized?.coordinates?.[0];
  const coords = (ring || []).map(([lng, lat]) => [Number(lng), Number(lat)]);
  if (coords.length > 2) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) coords.pop();
  }
  return coords;
}

export function importedFieldType(rawType, index = 0) {
  const value = String(rawType || "").trim();
  const aliases = {
    spray: "spray",
    organic: "organic",
    noChemical: "noChemical",
    house: "house",
    preharvest: "preharvest",
    water: "water",
    bee: "bee",
    public: "public",
    散布: "spray",
    有機: "organic",
    農薬不使用: "noChemical",
    ハウス: "house",
    収穫前: "preharvest",
    水路: "water",
    公共: "public",
  };
  return aliases[value] || (index === 0 ? "spray" : "noChemical");
}

export function importedPropertyId(props = {}) {
  const keys = ["polygon_uuid", "PolygonUuid", "uuid", "UUID", "fieldId", "field_id", "FIELD_ID", "id", "ID", "LastPolygonUuid", "筆ID", "筆ポリゴンID", "地番"];
  for (const key of keys) {
    const value = props[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function importedStableKey(props, geometry, context = {}) {
  const externalId = importedPropertyId(props);
  const source = context.sourceCode || context.source || context.name || PROVIDER_IDS.FILE;
  return externalId
    ? `${source}:${externalId}`
    : `${source}:geometry:${hashGeometry(geometry) || "unknown"}`;
}

export function importedExternalRefs(props, context = {}) {
  const externalId = importedPropertyId(props);
  if (!externalId) return [];
  return [{
    provider: context.provider || context.sourceCode || PROVIDER_IDS.FILE,
    providerAccount: context.providerAccount || "",
    resourceType: "field",
    externalId,
    revision: String(props.sourceRevision || context.datasetVersion || ""),
  }];
}

export function importedFieldDefaults(type) {
  const defaults = {
    spray: { short: "散布", cultivation: "農薬使用あり", chemicalUse: "あり", organicJas: "なし", notifyPreference: "必要時のみ", contactMethod: "アプリ内通知", harvestWindow: "9月中旬", avoidReason: "散布計画の対象ほ場" },
    organic: { short: "不使", cultivation: "有機JAS", chemicalUse: "なし", organicJas: "あり", notifyPreference: "希望する", contactMethod: "LINE", harvestWindow: "収穫前", avoidReason: "出荷前の農薬影響回避を希望" },
    noChemical: { short: "不使", cultivation: "有機JASではないが農薬不使用", chemicalUse: "なし", organicJas: "なし", notifyPreference: "希望する", contactMethod: "メール", harvestWindow: "7月上旬", avoidReason: "直売向けの農薬不使用表示を守りたい" },
    house: { short: "育苗", cultivation: "農薬使用あり", chemicalUse: "あり", organicJas: "なし", notifyPreference: "必要時のみ", contactMethod: "アプリ内通知", harvestWindow: "育苗中", avoidReason: "換気時間帯の調整が必要" },
    preharvest: { short: "収穫", cultivation: "農薬使用あり", chemicalUse: "あり", organicJas: "なし", notifyPreference: "希望する", contactMethod: "紙", harvestWindow: "3日以内", avoidReason: "収穫直前のため事前連絡を希望" },
    water: { short: "水路", cultivation: "未登録・未回答", chemicalUse: "未回答", organicJas: "未回答", notifyPreference: "必要時のみ", contactMethod: "アプリ内通知", harvestWindow: "なし", avoidReason: "水路近接のため飛散・流入を避けたい" },
    public: { short: "施設", cultivation: "未登録・未回答", chemicalUse: "未回答", organicJas: "未回答", notifyPreference: "未確認", contactMethod: "未確認", harvestWindow: "なし", avoidReason: "人の出入りがある時間帯を確認したい" },
  };
  return defaults[type] || defaults.noChemical;
}

export function buildFieldRecord(feature, index = 0, context = {}, options = {}) {
  const geometry = normalizeGeometry(feature?.geometry);
  if (!geometry) return errorResult("invalid-geometry", `区画${index + 1}のポリゴン形状を読み取れません。`, index);
  const violation = wgs84RangeViolation(geometry);
  if (violation) {
    return errorResult(
      "crs-out-of-range",
      `区画${index + 1}の座標がWGS84の範囲外です（${violation.join(", ")}）。`,
      index,
    );
  }
  const props = feature?.properties || {};
  const name = String(options.name || props.name || props["圃場名"] || props.field || props.NAME || props.label || `取込ほ場${index + 1}`);
  const known = options.resolveKnownField?.(name) || null;
  const type = options.forceType || known?.type || importedFieldType(
    props.type || props["種別"] || context.defaultFieldType,
    index,
  );
  const defaults = importedFieldDefaults(type);
  const stableKey = importedStableKey(props, geometry, context);
  const id = options.idFactory
    ? options.idFactory({ name, type, index, geometry, props, context, stableKey })
    : known?.id || stableImportedId(type, stableKey || `${name}:${index}`);
  const now = options.now || (() => new Date().toISOString());
  return {
    ok: true,
    field: {
      id,
      type,
      name,
      short: defaults.short,
      crop: String(props.crop || props["作物"] || "未登録"),
      cultivation: defaults.cultivation,
      chemicalUse: defaults.chemicalUse,
      organicJas: defaults.organicJas,
      notifyPreference: defaults.notifyPreference,
      contactMethod: defaults.contactMethod,
      publicScope: "概略のみ共有",
      harvestWindow: defaults.harvestWindow,
      avoidReason: defaults.avoidReason,
      seedling: type === "house",
      house: type === "house",
      waterNear: type === "water",
      unregistered: type === "public",
      geo: outerRingLngLat(geometry),
      geometry,
      geometryRevision: hashGeometry(geometry),
      externalRefs: importedExternalRefs(props, context),
      provenance: {
        source: context.source || context.name || "file-import",
        importedAt: now(),
        originalCrs: context.originalCrs || "EPSG:4326",
        stableKey,
        datasetVersion: context.datasetVersion || "",
        license: context.license || "",
      },
      distance: 0,
      direction: type === "spray" ? "中心" : "-",
      notifyTarget: type !== "spray" && type !== "public",
      owner: type === "spray" ? "自分" : "周辺関係者",
    },
  };
}

export function assignSprayRelativeDistances(fields) {
  const next = fields.map((field) => ({ ...field }));
  const sprayField = next.find((field) => field.type === "spray") || next[0];
  if (!sprayField) return next;
  const sprayCenter = geometryCentroid(sprayField.geometry);
  next.forEach((field) => {
    if (field.id === sprayField.id) return;
    const center = geometryCentroid(field.geometry);
    const distance = geometryDistanceMeters(sprayField.geometry, field.geometry);
    field.distance = distance === null ? null : Math.round(distance);
    field.direction = sprayCenter && center
      ? bearingToDirection(bearingBetweenLngLat(sprayCenter, center))
      : "-";
  });
  return next;
}

export function buildFieldsFromFeatures(rawFeatures, context = {}, options = {}) {
  const features = polygonFeatures(rawFeatures);
  if (!features.length) return errorResult("no-polygons", "ポリゴン境界が見つかりません。");
  const fields = [];
  const warnings = [];
  const seen = new Set();
  for (let index = 0; index < features.length; index += 1) {
    const built = buildFieldRecord(features[index], index, context, options);
    if (!built.ok) return built;
    const key = built.field.provenance.stableKey;
    if (seen.has(key)) {
      warnings.push({
        code: "duplicate-stable-key",
        message: `区画${index + 1}は同じ外部IDまたは形状のため重複を除外しました。`,
        featureIndex: index,
      });
      continue;
    }
    seen.add(key);
    fields.push(built.field);
  }
  return { ok: true, fields: assignSprayRelativeDistances(fields), warnings };
}

export function parcelCompatibleId(stableKey) {
  return `parcel-${hashString(stableKey)}`;
}
