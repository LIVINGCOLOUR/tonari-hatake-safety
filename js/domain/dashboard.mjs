function count(items, predicate) {
  return (items || []).filter(predicate).length;
}

export function rankDashboardPlans(items = [], { attentionOnly = false, limit = 5 } = {}) {
  return items
    .filter((item) => !attentionOnly || Number(item.score || 0) > 0)
    .slice()
    .sort((a, b) => (
      Number(b.score || 0) - Number(a.score || 0)
      || `${a.date || ""} ${a.timeWindow || ""}`.localeCompare(`${b.date || ""} ${b.timeWindow || ""}`)
    ))
    .slice(0, limit);
}

export function rankNeighborNotices(notices = [], { limit = Number.POSITIVE_INFINITY } = {}) {
  const responseRank = (response) => (response === "未回答" ? 0 : response === "確認しました" ? 2 : 1);
  return notices
    .slice()
    .sort((a, b) => (
      responseRank(a.response) - responseRank(b.response)
      || `${a.plan?.date || ""} ${a.plan?.timeWindow || ""}`.localeCompare(
        `${b.plan?.date || ""} ${b.plan?.timeWindow || ""}`,
      )
    ))
    .slice(0, limit);
}

export function buildSprayerNextActions({
  logsEnabled = true,
  pendingReplies = [],
  unnotifiedRisks = [],
  checks = {},
  actualSpeed,
  droneImported = false,
  reportDone = false,
  planDate = "",
  today = "",
} = {}) {
  const actions = pendingReplies.map((reply) => ({
    title: `${reply.fieldName}から${reply.response}`,
    detail: reply.note || "内容を確認して調整してください。",
    view: "notify",
  }));
  actions.push(...unnotifiedRisks.slice(0, 2).map((risk) => ({
    title: `${risk.name}へ通知`,
    detail: risk.message,
    view: "notify",
  })));
  if (!checks.weatherForecast) {
    actions.push({
      title: "API予報を取得",
      detail: "Open-Meteoの予報値を散布予定時刻に合わせて取得します。",
      view: "weather",
    });
  }
  if (!actualSpeed || !checks.wind) {
    actions.push({
      title: "散布直前に風速を実測",
      detail: "現地の風向・風速、測定場所、測定者を記録します。",
      view: "weather",
    });
  }
  if (!checks.weatherEnv) {
    actions.push({
      title: "散布者確認を記録",
      detail: "予報と実測を見た上で、確認済みチェックを入れます。",
      view: "weather",
    });
  }
  if (!checks.dips) {
    actions.push({
      title: "DIPS飛行計画を確認",
      detail: "V1では確認記録としてチェックを残します。",
      view: "checklist",
    });
  }
  if (logsEnabled && !droneImported) {
    actions.push({
      title: "散布後にドローンログ取込",
      detail: "飛行ルート、高度、散布ON/OFFログを記録に紐付けます。",
      view: "drone",
    });
  }
  if (!reportDone && planDate <= today) {
    actions.push({
      title: "実施後報告を作成",
      detail: "実施日時、気象、問い合わせ有無を散布者控えとして残します。",
      view: "report",
    });
  }
  return actions;
}

export function buildSprayerWorkflowModel({
  logsEnabled = true,
  plan = {},
  progress = { done: 0, total: 0, percent: 0 },
  riskCount = 0,
  notificationSummary = "",
  notificationComplete = false,
  weatherSummary = "",
  droneSummary = "",
  actions = [],
} = {}) {
  return {
    actions,
    preSteps: [
      {
        title: "計画登録",
        detail: `${plan.fieldName || ""} / ${plan.timeWindow || ""}`,
        done: Boolean(plan.fieldName && plan.pesticide),
        view: "plans",
      },
      {
        title: "周辺確認",
        detail: `${riskCount}件の確認項目`,
        done: Boolean(plan.checks?.organic && plan.checks?.sensitive),
        view: "map",
      },
      {
        title: "近隣通知",
        detail: `${notificationSummary}${Number(plan.replyNeed || 0) ? `（返信 ${Number(plan.replyNeed)}件）` : ""}`,
        done: notificationComplete,
        view: "notify",
      },
      {
        title: "気象確認",
        detail: weatherSummary,
        done: Boolean(plan.checks?.weatherEnv && plan.checks?.wind),
        view: "weather",
      },
      {
        title: "散布前チェック",
        detail: `${progress.done}/${progress.total}項目`,
        done: progress.percent >= 85,
        view: "checklist",
      },
    ],
    postSteps: [
      ...(logsEnabled ? [{
        title: "飛行ログ",
        detail: droneSummary,
        done: Boolean(plan.droneLog?.imported),
        view: "drone",
      }] : []),
      {
        title: "実施後報告",
        detail: plan.report?.doneDate ? "提出済み" : "未提出",
        done: Boolean(plan.report?.doneDate),
        view: "report",
      },
      {
        title: "作業履歴",
        detail: plan.report?.doneDate ? "履歴に反映済み" : "報告保存後に反映",
        done: Boolean(plan.report?.doneDate),
        view: "history",
      },
    ],
  };
}

export function buildSprayerTimeline({
  plan = {},
  riskCount = 0,
  notificationSummary = "",
  weatherSummary = "",
} = {}) {
  return [
    { title: "散布計画登録", detail: `${plan.date || ""} ${plan.timeWindow || ""} / ${plan.operator || ""}` },
    { title: "周辺確認", detail: `${riskCount}件の周辺確認項目` },
    { title: "近隣通知", detail: notificationSummary },
    { title: "風向・風速確認", detail: weatherSummary },
    { title: "実施後報告", detail: plan.report?.doneDate ? `${plan.report.doneDate} 提出済み` : "未提出" },
    { title: "作業履歴", detail: plan.report?.doneDate ? "履歴に反映済み" : "実施後報告の保存後に反映" },
  ];
}

export function buildNeighborTimeline({ field = {}, notices = [] } = {}) {
  const visibility = field.visibilityLevel === "private" ? "最小限" : field.visibilityLevel === "workspace" ? "地域管理者にも共有" : "通知対象に共有";
  return [
    {
      title: "自分の圃場",
      detail: `${field.name || ""} / ${field.cultivation || "未登録"} / ${field.notifyPreference || "通知未確認"}`,
    },
    { title: "公開範囲", detail: visibility },
    { title: "確認記録なし", detail: `${count(notices, (notice) => notice.response === "未回答")}件` },
    { title: "次の操作", detail: "通知への返信、連絡方法、公開範囲を確認します。" },
  ];
}

export function buildAdminTimeline({ logsEnabled = true, prefecture = "", municipality = "", summary = {} } = {}) {
  return [
    { title: "地域条件", detail: `${prefecture} ${municipality}`.trim() },
    {
      title: "対象日",
      detail: `${summary.date || ""} / 予定 ${summary.planned || 0}件・実施済み ${summary.done || 0}件`,
    },
    {
      title: "確認キュー",
      detail: `通知未完了 ${summary.notifyIncomplete || 0}件 / 報告未提出 ${summary.reportMissing || 0}件${logsEnabled ? ` / ドローンログ未取込 ${summary.droneMissing || 0}件` : ""}`,
    },
    { title: "航空写真表示", detail: "黄が散布予定、緑が実施済み、赤が追加確認対象です。" },
    { title: "位置づけ", detail: "散布の許可・承認ではなく、記録状況と追加確認対象の一覧です。" },
  ];
}

export function summarizeAdminDashboard({
  logsEnabled = true,
  date,
  today,
  dayPlans = [],
  regionPlans = [],
} = {}) {
  const planned = count(dayPlans, (plan) => !plan.reportDone && !plan.cancelled);
  const done = count(dayPlans, (plan) => plan.reportDone);
  const attention = count(dayPlans, (plan) => plan.highRisk);
  const notifyIncomplete = count(dayPlans, (plan) => !plan.notificationComplete);
  const organicNear = count(dayPlans, (plan) => plan.organicNear);
  const windNeed = count(dayPlans, (plan) => !plan.cancelled && plan.windNeedsAttention);
  const droneMissing = logsEnabled ? count(dayPlans, (plan) => !plan.cancelled && !plan.droneImported) : 0;
  const altitudeNeed = count(dayPlans, (plan) => !plan.cancelled && plan.altitudeNeedsAttention);
  const inquiry = count(regionPlans, (plan) => plan.hasInquiry);
  const unregisteredNear = count(dayPlans, (plan) => plan.unregisteredNear);
  const reportMissing = count(regionPlans, (plan) => plan.date <= today && !plan.reportDone && !plan.cancelled);
  const replyNeed = regionPlans.reduce((total, plan) => total + Number(plan.replyNeed || 0), 0);
  const readiness = dayPlans.length
    ? Math.round(dayPlans.reduce((sum, plan) => sum + Number(plan.readiness || 0), 0) / dayPlans.length)
    : 100;
  return {
    date,
    planned,
    done,
    attention,
    attentionPlans: count(dayPlans, plan => plan.highRisk || !plan.notificationComplete || plan.hasInquiry || (!plan.cancelled && (plan.windNeedsAttention || plan.altitudeNeedsAttention || (logsEnabled && !plan.droneImported) || (plan.date <= today && !plan.reportDone)))),
    notifyIncomplete,
    organicNear,
    windNeed,
    droneMissing,
    altitudeNeed,
    inquiry,
    unregisteredNear,
    reportMissing,
    replyNeed,
    readiness,
    total: dayPlans.length,
  };
}

export function buildSprayerDashboardMetrics({
  plans = [],
  today,
  tomorrow,
  organicRadius,
  activeReadiness,
} = {}) {
  const todayPlans = count(plans, (plan) => plan.date === today && !plan.cancelled);
  const tomorrowPlans = count(plans, (plan) => plan.date === tomorrow && !plan.cancelled);
  const notifyIncomplete = count(plans, (plan) => !plan.notificationComplete);
  const organicNear = count(plans, (plan) => plan.organicNear);
  const windNeed = count(plans, (plan) => plan.windNeedsAttention);
  const reportMissing = count(plans, (plan) => plan.date <= today && !plan.reportDone && !plan.cancelled);
  const highRisk = count(plans, (plan) => plan.highRisk);
  const replyNeed = plans.reduce((total, plan) => total + Number(plan.replyNeed || 0), 0);
  return [
    { label: "今日の散布予定", value: `${todayPlans}件`, note: today, alert: false },
    { label: "明日の散布予定", value: `${tomorrowPlans}件`, note: tomorrow, alert: false },
    { label: "通知未完了", value: `${notifyIncomplete}件`, note: "近隣通知", alert: notifyIncomplete > 0 },
    { label: `有機ほ場${organicRadius}m以内`, value: `${organicNear}件`, note: "周辺確認", alert: organicNear > 0 },
    { label: "風向・風速要確認", value: `${windNeed}件`, note: "気象メモ", alert: windNeed > 0 },
    { label: "実施後報告未提出", value: `${reportMissing}件`, note: "散布者控え", alert: reportMissing > 0 },
    { label: "追加確認が必要な予定", value: `${highRisk}件`, note: "管理者確認", alert: highRisk > 0 },
    { label: "近隣からの返信", value: `${replyNeed}件`, note: "要調整", alert: replyNeed > 0 },
    { label: "表示中の確認進捗", value: `${activeReadiness}`, note: "説明用指標", alert: activeReadiness < 70 },
  ];
}

export function buildNeighborDashboardMetrics({ notices = [], field = {} } = {}) {
  const pending = count(notices, (notice) => notice.response === "未回答");
  const consulting = count(
    notices,
    (notice) => notice.response !== "未回答" && notice.response !== "確認しました",
  );
  return [
    { label: "確認記録なし", value: `${pending}件`, note: "確認・返信は任意", alert: false },
    { label: "近日散布予定", value: `${notices.length}件`, note: "自分に関係", alert: notices.length > 0 },
    { label: "相談中", value: `${consulting}件`, note: "返信履歴", alert: consulting > 0 },
    { label: "公開範囲", value: field.visibilityLevel === "private" ? "最小限" : field.visibilityLevel === "workspace" ? "地域管理者にも共有" : "通知対象に共有", note: "圃場情報", alert: false },
    {
      label: "通知希望",
      value: field.notifyPreference || "未確認",
      note: field.name,
      alert: field.notifyPreference === "未確認",
    },
  ];
}

export function buildAdminDashboardMetrics({ logsEnabled = true, summary, organicRadius } = {}) {
  return [
    { label: "対象日の散布予定", value: `${summary.planned}件`, note: summary.date, alert: false },
    { label: "通知未完了", value: `${summary.notifyIncomplete}件`, note: "近隣通知", alert: summary.notifyIncomplete > 0 },
    { label: "風向・風速要確認", value: `${summary.windNeed}件`, note: "気象条件", alert: summary.windNeed > 0 },
    { label: "実施後報告未提出", value: `${summary.reportMissing}件`, note: "散布者控え", alert: summary.reportMissing > 0 },
    { label: `有機ほ場${organicRadius}m以内`, value: `${summary.organicNear}件`, note: "周辺確認", alert: summary.organicNear > 0 },
    ...(logsEnabled ? [{ label: "ドローンログ未取込", value: `${summary.droneMissing}件`, note: "飛行ログ", alert: summary.droneMissing > 0 }] : []),
    { label: "高度要確認", value: `${summary.altitudeNeed}件`, note: "作業軌跡", alert: summary.altitudeNeed > 0 },
    { label: "問い合わせあり", value: `${summary.inquiry}件`, note: "実施後報告", alert: summary.inquiry > 0 },
    { label: "追加確認が必要な予定", value: `${summary.attention}件`, note: "管理者確認", alert: summary.attention > 0 },
  ];
}

export function buildAdminQueueItems(summary) {
  return [
    { key: "notifyIncomplete", label: "通知未完了", count: summary.notifyIncomplete },
    { key: "windNeed", label: "風向風速要確認", count: summary.windNeed },
    { key: "reportMissing", label: "報告未提出", count: summary.reportMissing },
    { key: "droneMissing", label: "ドローンログ未取込", count: summary.droneMissing },
    { key: "altitudeNeed", label: "高度要確認", count: summary.altitudeNeed },
    { key: "inquiry", label: "問い合わせあり", count: summary.inquiry },
    { key: "unregisteredNear", label: "未登録圃場近接", count: summary.unregisteredNear },
  ];
}


export function buildCaseSteps({ view, planSaved = false, notificationComplete = false, weatherRecorded = false, checksRecorded = false, reportDone = false } = {}) {
  return [
    { view: "plans", label: "1 予定を登録", recorded: planSaved, active: view === "plans" },
    { view: "notify", label: "2 近隣へ連絡", recorded: notificationComplete, active: ["notify", "map"].includes(view) },
    { view: "weather", label: "3 当日の確認", recorded: weatherRecorded && checksRecorded, active: ["weather", "checklist"].includes(view) },
    { view: "report", label: "4 実施を記録", recorded: reportDone, active: view === "report" },
  ];
}
