export const DEMO_STATE_CONTEXT = "demo";

export function deviceStateContext({ userId, workspaceId } = {}) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedWorkspaceId = String(workspaceId || "").trim();
  if (!normalizedUserId || !normalizedWorkspaceId) {
    return Object.freeze({
      id: DEMO_STATE_CONTEXT,
      userId: "",
      workspaceId: "",
    });
  }
  return Object.freeze({
    id: `${normalizedUserId}:${normalizedWorkspaceId}`,
    userId: normalizedUserId,
    workspaceId: normalizedWorkspaceId,
  });
}

export function contextStateStorageKey(baseKey, context) {
  const normalizedBaseKey = String(baseKey || "").trim();
  if (!normalizedBaseKey) throw new TypeError("端末保存の基本キーが必要です。");
  if (!context || context.id === DEMO_STATE_CONTEXT) return normalizedBaseKey;
  return `${normalizedBaseKey}.account.${encodeURIComponent(context.userId)}.workspace.${encodeURIComponent(context.workspaceId)}`;
}
