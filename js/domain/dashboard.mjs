function count(items, predicate) {
  return (items || []).filter(predicate).length;
}

export function summarizeAdminDashboard({
  date,
  today,
  dayPlans = [],
  regionPlans = [],
} = {}) {
  const planned = count(dayPlans, (plan) => !plan.reportDone);
  const done = count(dayPlans, (plan) => plan.reportDone);
  const attention = count(dayPlans, (plan) => plan.highRisk);
  const notifyIncomplete = count(dayPlans, (plan) => !plan.notificationComplete);
  const organicNear = count(dayPlans, (plan) => plan.organicNear);
  const windNeed = count(dayPlans, (plan) => plan.windNeedsAttention);
  const droneMissing = count(dayPlans, (plan) => !plan.droneImported);
  const altitudeNeed = count(dayPlans, (plan) => plan.altitudeNeedsAttention);
  const inquiry = count(regionPlans, (plan) => plan.hasInquiry);
  const unregisteredNear = count(dayPlans, (plan) => plan.unregisteredNear);
  const reportMissing = count(regionPlans, (plan) => plan.date <= today && !plan.reportDone);
  const replyNeed = regionPlans.reduce((total, plan) => total + Number(plan.replyNeed || 0), 0);
  const readiness = dayPlans.length
    ? Math.round(dayPlans.reduce((sum, plan) => sum + Number(plan.readiness || 0), 0) / dayPlans.length)
    : 100;
  return {
    date,
    planned,
    done,
    attention,
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
  const todayPlans = count(plans, (plan) => plan.date === today);
  const tomorrowPlans = count(plans, (plan) => plan.date === tomorrow);
  const notifyIncomplete = count(plans, (plan) => !plan.notificationComplete);
  const organicNear = count(plans, (plan) => plan.organicNear);
  const windNeed = count(plans, (plan) => plan.windNeedsAttention);
  const reportMissing = count(plans, (plan) => plan.date <= today && !plan.reportDone);
  const highRisk = count(plans, (plan) => plan.highRisk);
  return [
    { label: "今日の散布予定", value: `${todayPlans}件`, note: today, alert: false },
    { label: "明日の散布予定", value: `${tomorrowPlans}件`, note: tomorrow, alert: false },
    { label: "通知未完了", value: `${notifyIncomplete}件`, note: "近隣通知", alert: notifyIncomplete > 0 },
    { label: `有機ほ場${organicRadius}m以内`, value: `${organicNear}件`, note: "周辺確認", alert: organicNear > 0 },
    { label: "風向・風速要確認", value: `${windNeed}件`, note: "気象メモ", alert: windNeed > 0 },
    { label: "実施後報告未提出", value: `${reportMissing}件`, note: "散布者控え", alert: reportMissing > 0 },
    { label: "追加確認が必要な予定", value: `${highRisk}件`, note: "管理者確認", alert: highRisk > 0 },
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
    { label: "未返信通知", value: `${pending}件`, note: "通知インボックス", alert: pending > 0 },
    { label: "近日散布予定", value: `${notices.length}件`, note: "自分に関係", alert: notices.length > 0 },
    { label: "時間変更・電話相談", value: `${consulting}件`, note: "返信履歴", alert: consulting > 0 },
    { label: "公開範囲", value: field.publicScope || "概略のみ共有", note: "圃場情報", alert: false },
    {
      label: "通知希望",
      value: field.notifyPreference || "未確認",
      note: field.name,
      alert: field.notifyPreference === "未確認",
    },
  ];
}

export function buildAdminDashboardMetrics({ summary, organicRadius } = {}) {
  return [
    { label: "対象日の散布予定", value: `${summary.planned}件`, note: summary.date, alert: false },
    { label: "通知未完了", value: `${summary.notifyIncomplete}件`, note: "近隣通知", alert: summary.notifyIncomplete > 0 },
    { label: "風向・風速要確認", value: `${summary.windNeed}件`, note: "気象条件", alert: summary.windNeed > 0 },
    { label: "実施後報告未提出", value: `${summary.reportMissing}件`, note: "散布者控え", alert: summary.reportMissing > 0 },
    { label: `有機ほ場${organicRadius}m以内`, value: `${summary.organicNear}件`, note: "周辺確認", alert: summary.organicNear > 0 },
    { label: "ドローンログ未取込", value: `${summary.droneMissing}件`, note: "飛行ログ", alert: summary.droneMissing > 0 },
    { label: "高度要確認", value: `${summary.altitudeNeed}件`, note: "作業軌跡", alert: summary.altitudeNeed > 0 },
    { label: "問い合わせあり", value: `${summary.inquiry}件`, note: "実施後報告", alert: summary.inquiry > 0 },
    { label: "追加確認が必要な予定", value: `${summary.attention}件`, note: "管理者確認", alert: summary.attention > 0 },
  ];
}

export function buildAdminQueueItems(summary) {
  return [
    { label: "通知未完了", count: summary.notifyIncomplete },
    { label: "風向風速要確認", count: summary.windNeed },
    { label: "報告未提出", count: summary.reportMissing },
    { label: "ドローンログ未取込", count: summary.droneMissing },
    { label: "高度要確認", count: summary.altitudeNeed },
    { label: "問い合わせあり", count: summary.inquiry },
    { label: "未登録圃場近接", count: summary.unregisteredNear },
  ];
}
