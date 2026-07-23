import { polygonAreaHectares } from "./geometry.mjs";

const RATE_KEYS = [
  "rate", "rx", "rxrate", "dose", "dosage", "amount", "qty", "quantity",
  "target", "targetrate", "value", "n_rate", "nrate", "施用量", "施肥量", "散布量", "目標",
];

export function detectRateField(properties) {
  const keys = Object.keys(properties || {});
  const isNumeric = (key) => (
    properties[key] !== "" && properties[key] !== null && Number.isFinite(Number(properties[key]))
  );
  const lowerKeys = keys.map((key) => String(key).toLowerCase());
  for (const candidate of RATE_KEYS) {
    const index = lowerKeys.indexOf(candidate);
    if (index >= 0 && isNumeric(keys[index])) return keys[index];
  }
  for (const key of keys) {
    if (/(rate|rx|dose|dosage|amount|施用|施肥|散布|目標)/i.test(key) && isNumeric(key)) return key;
  }
  return keys.find(isNumeric) || null;
}

export function buildPrescription(features, name, unit, importedAt = "") {
  const polygons = (features || []).filter(
    (feature) => feature?.geometry && ["Polygon", "MultiPolygon"].includes(feature.geometry.type),
  );
  if (!polygons.length) throw new Error("ポリゴンのGeoJSONが見つかりません。");
  const rateField = detectRateField(polygons[0].properties || {});
  if (!rateField) throw new Error("施用量（rate）の数値項目が見つかりません。");

  const rates = polygons
    .map((feature) => Number(feature.properties[rateField]))
    .filter(Number.isFinite);
  const min = rates.length ? Math.min(...rates) : 0;
  const max = rates.length ? Math.max(...rates) : 0;
  const average = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
  let totalAmount = 0;
  let totalAreaHa = 0;
  polygons.forEach((feature) => {
    const areaHa = polygonAreaHectares(feature.geometry);
    const rate = Number(feature.properties[rateField]);
    totalAreaHa += areaHa;
    if (Number.isFinite(rate)) totalAmount += areaHa * rate;
  });

  return {
    name: name || "処方マップ",
    rateField,
    unit: unit || "",
    features: polygons,
    count: polygons.length,
    min,
    max,
    avg: Number(average.toFixed(1)),
    totalAmount: Number(totalAmount.toFixed(1)),
    totalAreaHa: Number(totalAreaHa.toFixed(2)),
    importedAt,
  };
}

export function parsePrescriptionText(text, name, importedAt = "") {
  const data = JSON.parse(text);
  let features = [];
  if (data.type === "FeatureCollection") features = data.features || [];
  else if (data.type === "Feature") features = [data];
  else if (data.type && data.coordinates) {
    features = [{ type: "Feature", geometry: data, properties: {} }];
  }
  const unit = String(data.unit || data.properties?.unit || "");
  return buildPrescription(features, name, unit, importedAt);
}

export function prescriptionClassOf(rate, min, max, classCount) {
  if (!Number.isFinite(rate) || !Number.isInteger(classCount) || classCount < 1) return 0;
  const range = max - min || 1;
  return Math.min(classCount - 1, Math.max(0, Math.floor(((rate - min) / range) * classCount)));
}

export function prescriptionZonesFeatureCollection(prescription, colors) {
  if (!prescription) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: prescription.features.map((feature) => {
      const rate = Number(feature.properties[prescription.rateField]);
      return {
        type: "Feature",
        geometry: feature.geometry,
        properties: {
          _color: colors[prescriptionClassOf(rate, prescription.min, prescription.max, colors.length)],
          _rate: Number.isFinite(rate) ? rate : null,
        },
      };
    }),
  };
}

export function buildPrescriptionZones(ring, zones, baseRate, unit, material, importedAt = "") {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const longitudes = ring.map((coord) => coord[0]);
  const latitudes = ring.map((coord) => coord[1]);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const count = Math.max(2, Math.min(8, Math.round(zones) || 4));
  const parsedRate = Number(baseRate);
  const rate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : 100;
  const features = [];
  for (let index = 0; index < count; index += 1) {
    const northEdge = north - ((north - south) * index) / count;
    const southEdge = north - ((north - south) * (index + 1)) / count;
    features.push({
      type: "Feature",
      properties: { zone: index + 1, rate },
      geometry: {
        type: "Polygon",
        coordinates: [[[west, northEdge], [east, northEdge], [east, southEdge], [west, southEdge], [west, northEdge]]],
      },
    });
  }
  const prescription = buildPrescription(
    features,
    `処方マップ（${material || "可変施肥"}）`,
    unit || "kg/ha",
    importedAt,
  );
  prescription.editable = true;
  prescription.material = material || "化学肥料";
  return prescription;
}
