import test from "node:test";
import assert from "node:assert/strict";

import {
  WeatherServiceError,
  buildRainForecast,
  createOpenMeteoUrl,
  degreesToDirection,
  fetchOpenMeteoForecast,
  normalizeOpenMeteoForecast,
  pickForecastHour,
} from "../js/services/weather.mjs";

const responseData = {
  current: {
    time: "2026-07-23T05:45",
    temperature_2m: 20,
    relative_humidity_2m: 70,
    precipitation: 0,
    wind_speed_10m: 1,
    wind_direction_10m: 0,
    wind_gusts_10m: 2,
  },
  hourly: {
    time: ["2026-07-23T05:00", "2026-07-23T06:00", "2026-07-23T07:00"],
    temperature_2m: [19, 21.24, 22],
    relative_humidity_2m: [75, 68.4, 65],
    precipitation_probability: [10, 55, 20],
    precipitation: [0, 0.2, 0],
    wind_speed_10m: [1, 2.34, 3],
    wind_direction_10m: [0, 92, 180],
    wind_gusts_10m: [2, 4.56, 5],
  },
};

test("Open-Meteo request validates coordinates and requests spray-relevant values", () => {
  const url = new URL(createOpenMeteoUrl({ latitude: 36.345, longitude: 140.304 }));
  assert.equal(url.hostname, "api.open-meteo.com");
  assert.equal(url.searchParams.get("timezone"), "Asia/Tokyo");
  assert.equal(url.searchParams.get("wind_speed_unit"), "ms");
  assert.match(url.searchParams.get("hourly"), /wind_gusts_10m/);
  assert.throws(
    () => createOpenMeteoUrl({ latitude: 120, longitude: 140 }),
    (error) => error instanceof WeatherServiceError && error.code === "invalid-location",
  );
});

test("forecast selection uses the planned local wall-clock time", () => {
  const forecast = pickForecastHour(responseData, {
    date: "2026-07-23",
    timeWindow: "06:10-07:00",
  });
  assert.equal(forecast.time, "2026-07-23T06:00");
  assert.equal(forecast.wind_speed_10m, 2.34);
});

test("Open-Meteo response becomes a provider-neutral weather record", () => {
  const record = normalizeOpenMeteoForecast(responseData, {
    latitude: 36.345,
    longitude: 140.304,
    locationLabel: "笠間市",
    date: "2026-07-23",
    timeWindow: "06:10-07:00",
    now: new Date("2026-07-23T00:30:00Z"),
  });
  assert.equal(record.forecastDirection, "東");
  assert.equal(record.forecastSpeed, 2.3);
  assert.equal(record.maxGust, 4.6);
  assert.equal(record.temperature, 21.2);
  assert.equal(record.humidity, 68);
  assert.equal(record.rainForecast, "降水確率55%");
  assert.equal(record.fetchedAt, "2026-07-23 09:30");
  assert.equal(record.forecastTargetTime, "2026-07-23T06:00");
  assert.equal(record.source, "Open-Meteo Forecast API");
});

test("weather conversion helpers retain compass and rain semantics", () => {
  assert.equal(degreesToDirection(359), "北");
  assert.equal(degreesToDirection(225), "南西");
  assert.equal(buildRainForecast(0.4, 20), "0.4mmの降水見込み");
  assert.equal(buildRainForecast(0, 20), "降水確率20%");
});

test("weather fetch isolates network, upstream, and malformed-response failures", async () => {
  const base = {
    latitude: 36.345,
    longitude: 140.304,
    locationLabel: "笠間市",
    date: "2026-07-23",
    timeWindow: "06:00-07:00",
  };
  const record = await fetchOpenMeteoForecast({
    ...base,
    now: new Date("2026-07-23T00:30:00Z"),
    fetchImpl: async () => ({ ok: true, json: async () => responseData }),
  });
  assert.equal(record.forecastSpeed, 2.3);

  await assert.rejects(
    fetchOpenMeteoForecast({ ...base, fetchImpl: async () => { throw new Error("offline"); } }),
    (error) => error instanceof WeatherServiceError && error.code === "network",
  );
  await assert.rejects(
    fetchOpenMeteoForecast({ ...base, fetchImpl: async () => ({ ok: false, status: 503 }) }),
    (error) => error instanceof WeatherServiceError && error.code === "upstream",
  );
  await assert.rejects(
    fetchOpenMeteoForecast({ ...base, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
    (error) => error instanceof WeatherServiceError && error.code === "invalid-response",
  );
});
