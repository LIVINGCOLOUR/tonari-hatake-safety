// Versioned persistence envelope + canonical field references.
// Pure module: no localStorage / DOM. main.js supplies the raw string and
// wires the result into its existing normalizeState pipeline.
//
// On-disk shape (localStorage value):
//   { schemaVersion: 4, revision: N, savedAt: ISO, data: <app state> }
// Legacy shape (v3 and earlier) was the bare <app state> blob with no envelope.

export const SCHEMA_VERSION = 4;

// --- envelope read / migrate ---------------------------------------------

function isEnvelope(parsed) {
  return (
    parsed &&
    typeof parsed === "object" &&
    typeof parsed.schemaVersion === "number" &&
    parsed.data &&
    typeof parsed.data === "object"
  );
}

function looksLikeState(parsed) {
  return (
    parsed &&
    typeof parsed === "object" &&
    ("fields" in parsed || "plans" in parsed || "role" in parsed || "profile" in parsed)
  );
}

// v3 (bare blob) -> v4. Non-destructive: every existing key is carried over.
// Field geometry and plan.fieldId are filled in by dedicated helpers once
// normalizeState has hydrated the fields (they need the sample geometry merge),
// so this step only guarantees no information is dropped.
function migrateV3toV4(data) {
  const next = { ...data };
  next.migratedFrom = next.migratedFrom || "v3";
  next.migratedAt = next.migratedAt || new Date().toISOString();
  return next;
}

// Parse a raw localStorage string into { schemaVersion, revision, data },
// running every migration up to SCHEMA_VERSION. Returns null when the value is
// empty or unparseable so the caller can fall back to sample data.
export function parseStoredState(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return null;
  }
  return migrateToCurrent(parsed);
}

export function migrateToCurrent(parsed) {
  let schemaVersion;
  let revision;
  let data;
  if (isEnvelope(parsed)) {
    schemaVersion = parsed.schemaVersion;
    revision = Number.isFinite(parsed.revision) ? parsed.revision : 0;
    data = parsed.data;
  } else if (looksLikeState(parsed)) {
    // Legacy bare blob: treat as the last pre-envelope schema (v3).
    schemaVersion = 3;
    revision = 0;
    data = parsed;
  } else {
    return null;
  }
  if (schemaVersion < 4) {
    data = migrateV3toV4(data);
    schemaVersion = 4;
  }
  return { schemaVersion, revision, data };
}

// Build the next envelope to persist. Pure: returns a fresh object and never
// mutates the passed-in data.
export function nextEnvelope(data, prevRevision = 0) {
  const revision = (Number.isFinite(prevRevision) ? prevRevision : 0) + 1;
  return {
    schemaVersion: SCHEMA_VERSION,
    revision,
    savedAt: new Date().toISOString(),
    data,
  };
}

// --- canonical field references ------------------------------------------

// Exact, unambiguous name match. Returns null for zero or multiple matches so
// callers never silently pick one of several same-named fields.
export function resolveFieldByName(name, fields) {
  const list = Array.isArray(fields) ? fields : [];
  const key = String(name ?? "").trim();
  if (!key) return null;
  const matches = list.filter((field) => String(field.name ?? "").trim() === key);
  return matches.length === 1 ? matches[0] : null;
}

// One-time migration: give every plan a canonical fieldId derived from its
// fieldName snapshot. Order of preference:
//   1. an already-valid fieldId (left untouched)
//   2. a unique name match
//   3. otherwise unresolved (fieldId = null) -> treated safe-side at risk time
// Pure: returns a new plans array.
export function migratePlanFieldRefs(plans, fields) {
  const list = Array.isArray(fields) ? fields : [];
  return (Array.isArray(plans) ? plans : []).map((plan) => {
    if (plan.fieldId && list.some((field) => field.id === plan.fieldId)) {
      return plan;
    }
    const byName = resolveFieldByName(plan.fieldName, list);
    if (byName) {
      return { ...plan, fieldId: byName.id, fieldIdSource: "name" };
    }
    return { ...plan, fieldId: null, fieldIdSource: "unresolved" };
  });
}

// Strict runtime resolver. Never falls back to another field: an unresolved
// reference is reported as such so callers can treat it as 要確認/参照切れ
// instead of computing risk against the wrong field.
export function planSprayField(plan, fields) {
  const list = Array.isArray(fields) ? fields : [];
  if (plan && plan.fieldId) {
    const field = list.find((item) => item.id === plan.fieldId);
    if (field) return { field, resolved: true, reason: "id" };
    return { field: null, resolved: false, reason: "missing-field" };
  }
  return { field: null, resolved: false, reason: "no-field-id" };
}
