const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const TOKYO_OFFSET = "+09:00";
const DEFAULT_NOTE = "Open-Meteoの予報値を自動取得。散布直前に現地実測を記録してください。";

export class WeatherServiceError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "WeatherServiceError";
    this.code = code;
  }
}

function requiredCoordinate(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new WeatherServiceError("invalid-location", `${label}が有効な範囲ではありません。`);
  }
  return number;
}

function wallClockTimestamp(value) {
  if (!value) return Number.NaN;
  const text = String(value);
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
  return Date.parse(hasOffset ? text : `${text}${TOKYO_OFFSET}`);
}

function targetTimestamp(date, timeWindow) {
  const startTime = String(timeWindow || "06:00").split("-")[0].trim() || "06:00";
  const normalizedTime = /^\d{1,2}:\d{2}$/.test(startTime) ? startTime.padStart(5, "0") : "06:00";
  return wallClockTimestamp(`${date}T${normalizedTime}:00`);
}

function valueAt(hourly, key, index) {
  const values = hourly?.[key];
  return Array.isArray(values) ? values[index] : values;
}

function formatTokyoDateTime(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

export function createOpenMeteoUrl({ latitude, longitude } = {}) {
  const validLatitude = requiredCoordinate(latitude, "緯度", -90, 90);
  const validLongitude = requiredCoordinate(longitude, "経度", -180, 180);
  const params = new URLSearchParams({
    latitude: String(validLatitude),
    longitude: String(validLongitude),
    timezone: "Asia/Tokyo",
    wind_speed_unit: "ms",
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    forecast_days: "7",
  });
  return `${OPEN_METEO_URL}?${params.toString()}`;
}

export function pickForecastHour(data, { date, timeWindow } = {}) {
  const hourly = data?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  if (!times.length) return {};
  const target = targetTimestamp(date, timeWindow);
  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const timestamp = wallClockTimestamp(time);
    const diff = Number.isFinite(target) && Number.isFinite(timestamp)
      ? Math.abs(timestamp - target)
      : index;
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });
  return Object.fromEntries(
    Object.keys(hourly).map((key) => [key, valueAt(hourly, key, bestIndex)]),
  );
}

export function degreesToDirection(degrees) {
  const number = Number(degrees);
  if (!Number.isFinite(number)) return "北西";
  const labels = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
  return labels[Math.round(((number % 360) + 360) % 360 / 45) % 8];
}

export function roundOne(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : "";
}

export function buildRainForecast(precipitation, probability) {
  const rain = Number(precipitation || 0);
  const chance = Number(probability);
  if (Number.isFinite(chance) && chance >= 50) return `降水確率${Math.round(chance)}%`;
  if (rain > 0) return `${roundOne(rain)}mmの降水見込み`;
  if (Number.isFinite(chance)) return `降水確率${Math.round(chance)}%`;
  return "なし";
}

export function normalizeOpenMeteoForecast(data, {
  latitude,
  longitude,
  locationLabel,
  date,
  timeWindow,
  now = new Date(),
} = {}) {
  if (!data || typeof data !== "object") {
    throw new WeatherServiceError("invalid-response", "気象APIの応答形式を確認できません。");
  }
  const forecast = pickForecastHour(data, { date, timeWindow });
  const current = data.current || {};
  const directionDegrees = forecast.wind_direction_10m ?? current.wind_direction_10m;
  const speed = forecast.wind_speed_10m ?? current.wind_speed_10m;
  const gust = forecast.wind_gusts_10m ?? current.wind_gusts_10m;
  const temperature = forecast.temperature_2m ?? current.temperature_2m;
  const humidity = forecast.relative_humidity_2m ?? current.relative_humidity_2m;
  const precipitation = forecast.precipitation ?? current.precipitation;
  const precipitationProbability = forecast.precipitation_probability;
  if (![speed, gust, temperature, humidity, precipitation].some((value) => Number.isFinite(Number(value)))) {
    throw new WeatherServiceError("invalid-response", "利用できる気象予報値がありません。");
  }
  return {
    latitude: requiredCoordinate(latitude, "緯度", -90, 90),
    longitude: requiredCoordinate(longitude, "経度", -180, 180),
    locationLabel,
    forecastDirection: degreesToDirection(directionDegrees),
    forecastSpeed: roundOne(speed),
    maxGust: roundOne(gust),
    temperature: roundOne(temperature),
    humidity: Number.isFinite(Number(humidity)) ? Math.round(Number(humidity)) : "",
    rainForecast: buildRainForecast(precipitation, precipitationProbability),
    source: "Open-Meteo Forecast API",
    fetchedAt: formatTokyoDateTime(now),
    forecastTargetTime: forecast.time || current.time || "",
    weatherNotes: DEFAULT_NOTE,
  };
}

export async function fetchOpenMeteoForecast({
  latitude,
  longitude,
  locationLabel,
  date,
  timeWindow,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  signal,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new WeatherServiceError("unavailable", "気象情報を取得する通信機能がありません。");
  }
  const url = createOpenMeteoUrl({ latitude, longitude });
  let response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    throw new WeatherServiceError("network", "気象APIと通信できませんでした。", { cause: error });
  }
  if (!response?.ok) {
    throw new WeatherServiceError("upstream", `気象APIがHTTP ${response?.status || "error"}を返しました。`);
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new WeatherServiceError("invalid-response", "気象APIの応答を読み取れませんでした。", { cause: error });
  }
  return normalizeOpenMeteoForecast(data, {
    latitude,
    longitude,
    locationLabel,
    date,
    timeWindow,
    now,
  });
}
