// In-page draft retention. Files stay on their original input when possible;
// text values are restored after redraws, never across user/workspace contexts.
export function createTextDraftStore(storage) {
  let drafts = new Map();
  try { drafts = new Map(JSON.parse(storage?.getItem('hatake.textDrafts') || '[]')); } catch { /* Keep in-memory drafts if storage is unavailable. */ }
  const persist = () => { try { storage?.setItem('hatake.textDrafts', JSON.stringify([...drafts])); } catch { /* Existing page input remains available. */ } };
  return {
    set(context, key, value) { drafts.set(JSON.stringify([context, key]), value); persist(); },
    get(context, key) { return drafts.get(JSON.stringify([context, key])); },
    clear(context, key) { drafts.delete(JSON.stringify([context, key])); persist(); },
  };
}
export function captureFormDrafts(root) {
  return [...root.querySelectorAll('form[data-dirty="true"]')].filter(form => form.id).map(form => ({
    id: form.id,
    values: [...form.elements].filter(el => el.name && !['file','submit','button'].includes(el.type)).map(el => ({ name: el.name, type: el.type, value: el.value, checked: el.checked })),
  }));
}
export function restoreFormDrafts(root, drafts) {
  for (const draft of drafts) {
    const form = root.getElementById(draft.id);
    if (!form) continue;
    for (const value of draft.values) {
      const elements = [...form.elements].filter(el => el.name === value.name);
      for (const el of elements) {
        if (['checkbox','radio'].includes(el.type)) { if (el.value === value.value) el.checked = value.checked; }
        else el.value = value.value;
      }
    }
    form.dataset.dirty = 'true';
  }
}
