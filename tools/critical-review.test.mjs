import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAdminDashboard } from '../js/domain/dashboard.mjs';
import { notificationToRow } from '../js/repositories/supabase-app-state.mjs';
test('同じ予定に確認事項が重なっても予定数は一件', () => {
  const summary = summarizeAdminDashboard({ date:'2026-09-08', today:'2026-09-08', dayPlans:[{ date:'2026-09-08', highRisk:true, notificationComplete:false, windNeedsAttention:true, altitudeNeedsAttention:true }] });
  assert.equal(summary.attentionPlans, 1);
});
test('クラウド連絡行に変更版と実際の連絡日時を保存する', () => {
  const row = notificationToRow({ id:'p', noticeRevision:2, notificationTargets:{f:true}, noticeDeliveryRecords:{f:{at:'2026-09-08T01:00:00Z',method:'電話'}} }, 'f', {workspaceId:'w',planUuid:'p',syncedAt:'2026-09-08T02:00:00Z'});
  assert.equal(row.notification_data.noticeRevision, 2);
  assert.equal(row.delivered_at, '2026-09-08T01:00:00Z');
  assert.equal(row.notification_data.deliveryRecord.method, '電話');
});
