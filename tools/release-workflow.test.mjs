import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSprayerNextActions,
  buildSprayerWorkflowModel,
  summarizeAdminDashboard,
  buildAdminDashboardMetrics,
  buildAdminTimeline,
} from "../js/domain/dashboard.mjs";

test("通常画面は未対応ログを要求せず、通知と実施記録へ案内する", () => {
  const input = {
    logsEnabled: false,
    unnotifiedRisks: [{ name: "となりの畑", message: "個別連絡" }],
    checks: { weatherForecast: true, wind: true, weatherEnv: true, dips: true },
    actualSpeed: 1,
    planDate: "2026-09-07",
    today: "2026-09-07",
  };
  assert.deepEqual(buildSprayerNextActions(input).map((item) => item.view), ["notify", "report"]);
  const workflow = buildSprayerWorkflowModel({ logsEnabled: false });
  assert.deepEqual(workflow.postSteps.map((item) => item.view), ["report", "history"]);
  assert.ok(buildSprayerNextActions({ ...input, logsEnabled: true }).some((item) => item.view === "drone"));
});

test("通常画面の管理集計はログ未取込を要求せず、通知・気象の未確認を保持する", () => {
  const plan = { date: "2026-09-07", notificationComplete: false, windNeedsAttention: true };
  const input = { date: plan.date, today: plan.date, dayPlans: [plan], regionPlans: [plan] };
  const summary = summarizeAdminDashboard({ ...input, logsEnabled: false });
  assert.equal(summary.droneMissing, 0);
  assert.equal(summary.notifyIncomplete, 1);
  assert.equal(summary.windNeed, 1);
  assert.equal(summary.reportMissing, 1);
  assert.equal(summarizeAdminDashboard({ ...input, logsEnabled: true }).droneMissing, 1);
  const metrics = buildAdminDashboardMetrics({ summary, organicRadius: 100, logsEnabled: false });
  assert.equal(metrics.some((item) => item.label.includes("ログ未取込")), false);
  assert.equal(buildAdminTimeline({ summary, logsEnabled: false }).some((item) => item.detail.includes("ログ未取込")), false);
});


test("当日の確認は気象とチェックの両方を記録し、実施記録とは区別する", async () => {
  const { buildCaseSteps } = await import("../js/domain/dashboard.mjs");
  const incomplete = buildCaseSteps({ view: "checklist", weatherRecorded: true });
  assert.equal(incomplete[2].active, true);
  assert.equal(incomplete[2].recorded, false);
  assert.equal(incomplete[3].recorded, false);
  const complete = buildCaseSteps({ view: "report", weatherRecorded: true, checksRecorded: true, reportDone: true });
  assert.equal(complete[2].recorded, true);
  assert.equal(complete[3].active, true);
  assert.equal(complete[3].recorded, true);
});
