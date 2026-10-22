// Notice revisions are application records, not evidence of external delivery.
const settings = ['fieldId','fieldIdSource','fieldName','district','crop','materialType','pesticide','purpose','method','operator','contact','droneModel','aircraftRegistration','pilot','assistant','sprayDevice','nozzle','plannedAltitude','plannedSpeed','pesticideRegistration','preHarvestDays','amount','dilution','rateUnit','ratePer10a','areaHa','sprayWidthM','sprayArea','notes','timeWindow'];
const noticeKeys = ['date','timeWindow','fieldId','fieldName','pesticide','materialType','purpose','operator','contact','sprayArea'];
export function copyPlanSettings(source) {
  return Object.fromEntries(settings.filter(key => source[key] !== undefined).map(key => [key, structuredClone(source[key])]));
}
export function noticeContentChanged(before, after) {
  return noticeKeys.some(key => String(before[key] ?? '') !== String(after[key] ?? ''));
}
export function noticeSnapshot(plan) {
  return Object.fromEntries(noticeKeys.map(key => [key, plan[key] ?? '']));
}
// まだ誰にも連絡・返信の記録がない予定は、内容を直しても「変更のお知らせ」にしない
export function hasNoticeActivity(plan) {
  return Boolean((plan.noticeHistory || []).length
    || Object.values(plan.notificationTargets || {}).some(Boolean)
    || Object.keys(plan.noticeDeliveryRecords || {}).length
    || Object.keys(plan.notificationAcks || {}).length
    || Object.values(plan.notificationResponses || {}).some(value => value && value !== '未回答'));
}
export function revisePlan(before, after, kind, at = new Date().toISOString()) {
  const next = structuredClone(after);
  const revision = Number(before.noticeRevision || 0);
  next.noticeHistory = [...(before.noticeHistory || []), {
    revision, archivedAt: at, kind: before.noticeKind || '予定',
    schedule: noticeSnapshot(before), cancellation: structuredClone(before.cancellation || null),
    deliveries: structuredClone(before.notificationTargets || {}),
    deliveryRecords: structuredClone(before.noticeDeliveryRecords || {}),
    responses: structuredClone(before.notificationResponses || {}),
    acknowledgements: structuredClone(before.notificationAcks || {}),
    replyNotes: structuredClone(before.notificationReplyNotes || {}),
  }];
  next.noticeRevision = revision + 1;
  next.noticeKind = kind;
  next.noticeChangedAt = at;
  const ids = new Set([...Object.keys(before.notificationTargets || {}), ...Object.keys(before.notificationResponses || {}), ...Object.keys(before.notificationAcks || {})]);
  next.notificationTargets = Object.fromEntries([...ids].map(id => [id, false]));
  next.notificationResponses = Object.fromEntries([...ids].map(id => [id, '未回答']));
  next.notificationAcks = {};
  next.notificationReplyNotes = {};
  next.noticeDeliveryRecords = {};
  next.checks = { ...next.checks, notice: false };
  if (next.cancellation) next.cancellation.notifiedFieldIds = [];
  // Field measurements and forecasts belong to one location and schedule.
  if (['延期','再開','中止'].includes(kind) || ['date','timeWindow','fieldId'].some(key => before[key] !== next[key])) {
    next.checks = Object.fromEntries(Object.keys(next.checks || {}).map(key => [key, false]));
    next.weather = { ...next.weather, forecastDirection: '', forecastSpeed: '', maxGust: '', temperature: '', humidity: '', rainForecast: '', forecastTargetTime: '', actualSpeed: '', actualDirection: '', measuredAt: '', measuredPlace: '', measurementMethod: '', measuredBy: '', weatherConfirmed: false, fetchedAt: '', source: '' };
    next.droneLog = null;
  }
  return next;
}
export function changeSchedule(plan, { kind, date = '', timeWindow = '', reason = '', reasonDetail = '' }, at = new Date().toISOString()) {
  if (plan.report?.doneDate) throw new Error('実施記録がある予定は変更できません。次の作業は新しい予定として追加してください。');
  if (!['中止','延期','再開'].includes(kind)) throw new Error('変更の種類を確認してください。');
  if (kind === '再開' && (!date || !timeWindow.trim())) throw new Error('再開する日付と時間帯を入力してください。');
  const next = structuredClone(plan);
  // 延期のお知らせで伝えた新しい日程どおりに再開するときは、その連絡記録を引き継ぐ（同じ相手へ同じ日程を伝え直さない）
  const announced = plan.cancellation?.state === 'postponed' && plan.cancellation.newDate === date && (plan.cancellation.newTimeWindow || '') === timeWindow;
  if (kind === '再開' && announced) {
    next.status = 'planned';
    next.cancellation = null;
    next.noticeChangedAt = at;
    return next;
  }
  if (kind === '再開') {
    next.date = date;
    next.timeWindow = timeWindow;
    next.status = 'planned';
    next.cancellation = null;
  } else {
    const state = kind === '延期' ? 'postponed' : 'cancelled';
    next.status = state;
    next.cancellation = { state, reason, reasonDetail, decidedAt: at, originalDate: plan.cancellation?.originalDate || plan.date, originalTimeWindow: plan.cancellation?.originalTimeWindow || plan.timeWindow, newDate: kind === '延期' ? date : '', newTimeWindow: kind === '延期' ? timeWindow : '', notifiedFieldIds: [] };
    if (kind === '延期' && date) { next.date = date; next.timeWindow = timeWindow || ''; }
  }
  return revisePlan(plan, next, kind, at);
}
