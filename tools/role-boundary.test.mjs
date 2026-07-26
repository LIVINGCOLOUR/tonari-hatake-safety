import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedViewsForRole,
  fieldDisclosure,
  isSelfOwned,
  maskedFieldLabel,
  normalizeVisibilityLevel,
  notifyPreferenceAllows,
} from "../js/domain/disclosure.mjs";

test("プロフィールの公開範囲キーを圃場の3段階へ安全に変換する", () => {
  assert.equal(normalizeVisibilityLevel("selfOnly"), "private");
  assert.equal(normalizeVisibilityLevel("notificationTargetsOnly"), "related");
  assert.equal(normalizeVisibilityLevel("relatedOnly"), "related");
  assert.equal(normalizeVisibilityLevel("managerOnly"), "workspace");
  assert.equal(normalizeVisibilityLevel("municipalityJa"), "workspace");
  assert.equal(normalizeVisibilityLevel("unknown-future-value"), "related");
});

test("周辺農家は近隣通知の管理画面を開けない", () => {
  assert.equal(allowedViewsForRole("neighbor").includes("notify"), false);
});

test("地域管理はダッシュボード・一覧・プロフィールだけを開ける", () => {
  assert.deepEqual(allowedViewsForRole("admin"), ["dashboard", "admin", "profile"]);
});

test("所有者未設定の旧データは自分の圃場として扱う", () => {
  assert.equal(isSelfOwned({ ownerUserId: null }, "user-a"), true);
});

test("他者所有の圃場は自分の圃場として扱わない", () => {
  assert.equal(isSelfOwned({ ownerUserId: "user-b" }, "user-a"), false);
});

test("privateの他者圃場は散布者にも地域管理にも伏せる", () => {
  const field = { ownerUserId: "user-b", visibilityLevel: "private" };
  assert.equal(fieldDisclosure(field, "sprayer", "user-a"), "masked");
  assert.equal(fieldDisclosure(field, "admin", "user-a"), "masked");
});

test("relatedは地域管理へ、workspaceは散布者へ詳細を開示する", () => {
  assert.equal(fieldDisclosure({ ownerUserId: "b", visibilityLevel: "related" }, "admin", "a"), "full");
  assert.equal(fieldDisclosure({ ownerUserId: "b", visibilityLevel: "workspace" }, "sprayer", "a"), "full");
});

test("伏せ字表示に固有名を含めない", () => {
  assert.equal(maskedFieldLabel({ type: "organic", name: "山田ほ場" }), "農薬不使用ほ場（詳細非公開）");
});

test("重点距離内の農薬不使用ほ場は必要時のみ設定でも通知する", () => {
  assert.equal(notifyPreferenceAllows({ pref: "asNeeded", isOrganicLike: true, distance: 250, organicRadius: 300 }), true);
});

test("一般圃場の必要時のみ設定は自動通知しない", () => {
  assert.equal(notifyPreferenceAllows({ pref: "asNeeded", distance: 250, organicRadius: 300 }), false);
});

test("風下のみ設定は風下でなければ通知しない", () => {
  assert.equal(notifyPreferenceAllows({ pref: "downwindOnly", isDownwind: false, distance: 250 }), false);
});

test("風向未取得では風下のみ設定を通知候補から落とさない", () => {
  assert.equal(notifyPreferenceAllows({ pref: "downwindOnly", windDirectionKnown: false, distance: 250 }), true);
});

test("距離不明と未知設定は通知する側に倒す", () => {
  assert.equal(notifyPreferenceAllows({ pref: "asNeeded", distance: null }), true);
  assert.equal(notifyPreferenceAllows({ pref: "future-value", distance: 500 }), true);
});

test("散布者には計画・通知・報告の主要導線がある", () => {
  const views = allowedViewsForRole("sprayer");
  assert.equal(views.includes("plans"), true);
  assert.equal(views.includes("notify"), true);
  assert.equal(views.includes("report"), true);
});

test("自分の圃場はprivateでも自分には詳細表示する", () => {
  assert.equal(fieldDisclosure({ ownerUserId: "user-a", visibilityLevel: "private" }, "neighbor", "user-a"), "full");
});

test("relatedの他者圃場は散布者には伏せる", () => {
  assert.equal(fieldDisclosure({ ownerUserId: "user-b", visibilityLevel: "related" }, "sprayer", "user-a"), "masked");
});

test("近接時のみ設定は重点距離の外では通知しない", () => {
  assert.equal(notifyPreferenceAllows({ pref: "nearbyOnly", distance: 450, organicRadius: 300 }), false);
});

test("農薬散布のみ設定は肥料散布を通知しない", () => {
  assert.equal(notifyPreferenceAllows({ pref: "agrochemicalOnly", isAgrochemical: false, distance: 120 }), false);
});
