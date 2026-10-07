import test from 'node:test';
import assert from 'node:assert/strict';
import { copyPlanSettings, revisePlan, changeSchedule, noticeContentChanged } from '../js/domain/plan-lifecycle.mjs';
const plan = () => ({ id:'original', date:'2026-09-08', timeWindow:'06:00-07:00', fieldId:'field', fieldName:'畑', pesticide:'資材', checks:{ wind:true, notice:true }, weather:{ actualSpeed:2, measuredAt:'06:00' }, notificationTargets:{ a:true }, notificationResponses:{ a:'確認しました' }, notificationAcks:{ a:'2026-09-07' }, report:{}, droneLog:{ imported:true }, remoteVersion:8 });
test('複製する設定に実績・版番号・連絡・案件IDを混ぜない', () => { const source=plan(); const before=structuredClone(source); const copy=copyPlanSettings(source); assert.equal(copy.fieldId,'field'); for(const key of ['id','date','checks','weather','notificationTargets','notificationResponses','notificationAcks','droneLog','remoteVersion','report']) assert.equal(key in copy,false,key); assert.deepEqual(source,before); });
test('延期は新日程を反映し、以前の連絡と確認は履歴へ移す', () => { const source=plan(); const next=changeSchedule(source,{kind:'延期',date:'2026-09-10',timeWindow:'08:00-09:00'},'t1'); assert.equal(next.date,'2026-09-10'); assert.equal(next.noticeRevision,1); assert.equal(next.notificationTargets.a,false); assert.deepEqual(next.notificationAcks,{}); assert.equal(next.weather.actualSpeed,''); assert.equal(next.checks.wind,false); assert.equal(next.noticeHistory[0].acknowledgements.a,'2026-09-07'); assert.equal(source.date,'2026-09-08'); });
test('再開後にも再連絡が必要で、以前の変更連絡を流用しない', () => { let next=changeSchedule(plan(),{kind:'中止'},'t1'); next.notificationTargets.a=true; next.notificationAcks.a='t2'; next=changeSchedule(next,{kind:'再開',date:'2026-09-12',timeWindow:'10:00-11:00'},'t3'); assert.equal(next.date,'2026-09-12'); assert.equal(next.cancellation,null); assert.equal(next.noticeRevision,2); assert.equal(next.notificationTargets.a,false); assert.deepEqual(next.notificationAcks,{}); assert.equal(next.noticeHistory[1].acknowledgements.a,'t2'); });
test('一般の日時・資材変更でも再連絡になり、備考だけでは変更版にしない', () => { const old=plan(); assert.equal(noticeContentChanged(old,{...old,notes:'メモ'}),false); const edited={...old,pesticide:'別の資材'}; assert.equal(noticeContentChanged(old,edited),true); const next=revisePlan(old,edited,'変更'); assert.equal(next.notificationTargets.a,false); assert.equal(next.noticeHistory[0].schedule.pesticide,'資材'); });
test('日時不明の再開と実施済み案件の変更は拒否', () => { assert.throws(()=>changeSchedule(plan(),{kind:'再開'})); assert.throws(()=>changeSchedule({...plan(),report:{doneDate:'2026-09-08'}},{kind:'中止'})); });

test('日程変更後は以前の予報値も消す', () => {
  const source = plan();
  source.weather.forecastSpeed = 2.5;
  source.weather.forecastTargetTime = '2026-09-08T06:00';
  const revised = changeSchedule(source, { kind:'延期', date:'2026-09-10' });
  assert.equal(revised.weather.forecastSpeed, '');
  assert.equal(revised.weather.forecastTargetTime, '');
});
