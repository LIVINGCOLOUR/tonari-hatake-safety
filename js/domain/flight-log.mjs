const SAMPLE_FORMAT = "tonari-flight-log/v1";
const MAX_POINTS = 5000;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = finiteNumber(point.x);
  const y = finiteNumber(point.y);
  const altitude = finiteNumber(point.altitude);
  if (x === null || y === null || altitude === null || typeof point.sprayOn !== "boolean") return null;
  return {
    x,
    y,
    altitude,
    sprayOn: point.sprayOn,
    altitudeCheck: Boolean(point.altitudeCheck),
    outside: Boolean(point.outside),
  };
}

export function parseSampleFlightLog(text) {
  let source;
  try {
    source = JSON.parse(String(text || ""));
  } catch {
    return { ok: false, reason: "JSONを読み取れません。" };
  }
  if (source?.sampleFormat !== SAMPLE_FORMAT) {
    return { ok: false, reason: "対応していないログ形式です。" };
  }
  if (!Array.isArray(source.points) || source.points.length < 2) {
    return { ok: false, reason: "飛行点が不足しています。" };
  }
  if (source.points.length > MAX_POINTS) {
    return { ok: false, reason: `飛行点が多すぎます（上限${MAX_POINTS}点）。` };
  }
  const points = source.points.map(normalizePoint);
  if (points.some((point) => point === null)) {
    return { ok: false, reason: "飛行点の座標・高度・散布状態を確認してください。" };
  }
  const log = {
    vendor: String(source.vendor || "DJI"),
    model: String(source.model || "DJI AGRAS（機種未指定）"),
    sdkStatus: "実機API/SDKは未接続（サンプル様式を取込済み）",
    aircraftRegistration: String(source.aircraftRegistration || "未記録"),
    remoteId: String(source.remoteId || "未記録"),
    pilot: String(source.pilot || "未記録"),
    sprayDevice: String(source.sprayDevice || "液剤散布装置"),
    imported: true,
    importedAt: new Date().toISOString(),
    startedAt: String(source.startedAt || "未記録"),
    endedAt: String(source.endedAt || "未記録"),
    sprayOnPoints: points.filter((point) => point.sprayOn).length,
    sprayOnSegments: points.reduce((total, point, index) => total + (point.sprayOn && !points[index - 1]?.sprayOn ? 1 : 0), 0),
    outsideFlight: points.some((point) => point.outside),
    sampleFormat: SAMPLE_FORMAT,
    sourceNote: String(source.sourceNote || "DJI AGRAS想定のサンプル様式。実機ログの自動解析ではありません。"),
    points,
  };
  return { ok: true, log };
}

export { MAX_POINTS, SAMPLE_FORMAT };
