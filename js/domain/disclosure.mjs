const ROLE_VIEWS = Object.freeze({
  sprayer: Object.freeze(["dashboard", "plans", "map", "drone", "notify", "checklist", "weather", "report", "history", "profile"]),
  neighbor: Object.freeze(["dashboard", "map", "fields", "profile"]),
  admin: Object.freeze(["dashboard", "admin", "profile"]),
});

export function allowedViewsForRole(role) {
  return [...(ROLE_VIEWS[role] || ROLE_VIEWS.sprayer)];
}

export function isSelfOwned(field, currentUserId) {
  if (!field || field.ownerUserId == null) return true;
  return String(field.ownerUserId) === String(currentUserId || "local-demo-user");
}

export function fieldDisclosure(field, viewerRole, currentUserId) {
  try {
    if (isSelfOwned(field, currentUserId)) return "full";
    const visibility = ["private", "related", "workspace"].includes(field?.visibilityLevel)
      ? field.visibilityLevel
      : "related";
    if (visibility === "workspace") return "full";
    if (viewerRole === "admin" && visibility === "related") return "full";
    return "masked";
  } catch {
    return "masked";
  }
}

export function normalizeVisibilityLevel(value) {
  if (["private", "related", "workspace"].includes(value)) return value;
  if (["selfOnly", "自分のみ", "非公開"].includes(value)) return "private";
  if (["managerOnly", "municipalityJa", "地域管理者まで詳細共有", "自治体・JA共有"].includes(value)) return "workspace";
  if (["notificationTargetsOnly", "relatedOnly", "通知対象に詳細共有"].includes(value)) return "related";
  return "related";
}

export function maskedFieldLabel(field) {
  const labels = {
    organic: "農薬不使用ほ場（詳細非公開）",
    noChemical: "農薬不使用ほ場（詳細非公開）",
    preharvest: "収穫前の圃場（詳細非公開）",
    house: "育苗・ハウス（詳細非公開）",
    water: "水源・水路",
    bee: "養蜂（詳細非公開）",
  };
  return labels[field?.type] || "登録済み圃場（詳細非公開）";
}

export function notifyPreferenceAllows({
  pref,
  isDownwind = false,
  windDirectionKnown = true,
  isAgrochemical = true,
  isOrganicLike = false,
  distance = null,
  organicRadius = 300,
} = {}) {
  if (distance === null || distance === undefined || !Number.isFinite(Number(distance))) return true;
  const meters = Number(distance);
  let allowed = true;
  if (pref === "downwindOnly") allowed = !windDirectionKnown || Boolean(isDownwind);
  else if (pref === "agrochemicalOnly") allowed = Boolean(isAgrochemical);
  else if (pref === "nearbyOnly") allowed = meters <= Number(organicRadius);
  else if (pref === "asNeeded") allowed = false;
  else if (pref !== "allNearby" && pref != null && pref !== "") allowed = true;
  if (isOrganicLike && meters <= Number(organicRadius)) allowed = true;
  return allowed;
}


// Memberships are already scoped to the signed-in user by the auth service.
// The local sample workspace permits all roles; cloud workspaces fail closed.
export function switchableRoles({ signedIn = false, workspaceId = "", memberships = [] } = {}) {
  const roles = Object.keys(ROLE_VIEWS);
  if (!signedIn) return roles;
  return roles.filter(role => memberships.some(item =>
    item.workspace_id === workspaceId && item.status === "active" && item.role === role));
}

export function selectAvailableRole(roles, preferred, fallback) {
  return roles.includes(preferred) ? preferred : roles.includes(fallback) ? fallback : roles[0] || null;
}
