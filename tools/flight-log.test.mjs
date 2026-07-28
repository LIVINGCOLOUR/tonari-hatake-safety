import test from "node:test";
import assert from "node:assert/strict";
import { MAX_POINTS, parseSampleFlightLog, SAMPLE_FORMAT } from "../js/domain/flight-log.mjs";

const validLog = {
  sampleFormat: SAMPLE_FORMAT,
  points: [
    { x: 1, y: 2, altitude: 2.1, sprayOn: false },
    { x: 2, y: 3, altitude: 2.4, sprayOn: true, outside: true },
  ],
};

test("サンプル飛行ログを正規化する", () => {
  const input = JSON.stringify(validLog);
  const result = parseSampleFlightLog(input);
  assert.equal(result.ok, true);
  assert.equal(result.log.points.length, 2);
  assert.equal(result.log.sprayOnPoints, 1);
  assert.equal(result.log.sprayOnSegments, 1);
  assert.equal(result.log.outsideFlight, true);
  assert.equal(result.log.sampleFormat, SAMPLE_FORMAT);
});

test("別形式と壊れた飛行点を拒否する", () => {
  assert.equal(parseSampleFlightLog("not-json").ok, false);
  assert.equal(parseSampleFlightLog(JSON.stringify({ ...validLog, sampleFormat: "other" })).ok, false);
  assert.equal(parseSampleFlightLog(JSON.stringify({ ...validLog, points: [] })).ok, false);
  assert.equal(parseSampleFlightLog(JSON.stringify({ ...validLog, points: [{ x: 1 }] })).ok, false);
  assert.equal(parseSampleFlightLog(JSON.stringify({ ...validLog, points: Array.from({ length: MAX_POINTS + 1 }, () => validLog.points[0]) })).ok, false);
});

test("入力オブジェクト相当の値を変更しない", () => {
  const before = JSON.stringify(validLog);
  parseSampleFlightLog(before);
  assert.equal(JSON.stringify(validLog), before);
});

test("連続する散布ON点を一つの区間として数える", () => {
  const result = parseSampleFlightLog(JSON.stringify({
    sampleFormat: SAMPLE_FORMAT,
    points: [
      { x: 0, y: 0, altitude: 2, sprayOn: false },
      { x: 1, y: 0, altitude: 2, sprayOn: true },
      { x: 2, y: 0, altitude: 2, sprayOn: true },
      { x: 3, y: 0, altitude: 2, sprayOn: false },
      { x: 4, y: 0, altitude: 2, sprayOn: true },
    ],
  }));
  assert.equal(result.ok, true);
  assert.equal(result.log.sprayOnPoints, 3);
  assert.equal(result.log.sprayOnSegments, 2);
});
