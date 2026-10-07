import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTextDraftStore } from '../js/services/form-drafts.mjs';

test('下書きは利用者・地域・予定・版・宛先をまたいで混ざらない', () => {
  const store = createTextDraftStore();
  store.set('userA:regionA:planA:1', 'notice:line:fieldA', '書きかけ');
  assert.equal(store.get('userA:regionA:planA:1', 'notice:line:fieldA'), '書きかけ');
  for (const context of ['userB:regionA:planA:1', 'userA:regionB:planA:1', 'userA:regionA:planB:1', 'userA:regionA:planA:2']) {
    assert.equal(store.get(context, 'notice:line:fieldA'), undefined);
  }
  assert.equal(store.get('userA:regionA:planA:1', 'notice:line:fieldB'), undefined);
});

test('再読込後も下書きを復元でき、保存障害時もページ内の入力を保つ', () => {
  let serialized;
  const storage = { getItem: () => serialized, setItem: (_, value) => { serialized = value; } };
  createTextDraftStore(storage).set('context', 'recipient', '相談');
  assert.equal(createTextDraftStore(storage).get('context', 'recipient'), '相談');
  const unavailable = createTextDraftStore({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  unavailable.set('context', 'recipient', '相談');
  assert.equal(unavailable.get('context', 'recipient'), '相談');
});
