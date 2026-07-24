import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationFiles = [
  "supabase/migrations/202607240001_initial_schema.sql",
  "supabase/migrations/202607240002_rls_and_audit.sql",
  "supabase/migrations/202607240003_private_storage.sql",
  "supabase/migrations/202607240004_sync_keys.sql",
  "supabase/migrations/202607240005_fix_invite_conflict.sql",
  "supabase/migrations/202607240006_fix_insert_returning_rls.sql",
];

const migrations = await Promise.all(
  migrationFiles.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")),
);
const [schemaSql, rlsSql, storageSql, syncKeysSql, inviteFixSql, returningRlsSql] = migrations;
const allSql = migrations.join("\n").toLowerCase();

const sharedTables = [
  "profiles",
  "workspaces",
  "workspace_memberships",
  "workspace_invites",
  "fields",
  "field_access_grants",
  "operation_plans",
  "weather_records",
  "plan_checks",
  "notification_targets",
  "work_records",
  "app_assets",
  "flight_logs",
  "audit_events",
];

test("initial migration defines every remote ownership boundary", () => {
  sharedTables.forEach((table) => {
    assert.match(
      schemaSql,
      new RegExp(`create\\s+table\\s+public\\.${table}\\s*\\(`, "i"),
      `missing table: ${table}`,
    );
  });
});

test("every application table enables row level security", () => {
  sharedTables.forEach((table) => {
    assert.match(
      rlsSql,
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
      `RLS is not enabled: ${table}`,
    );
  });
});

test("workspace role and relationship helpers are security definer functions", () => {
  [
    "is_workspace_member",
    "is_workspace_admin",
    "can_read_field",
    "can_manage_field",
    "can_read_plan",
    "can_manage_plan",
  ].forEach((name) => {
    const start = rlsSql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}`, "i"));
    assert.notEqual(start, -1, `missing authorization helper: ${name}`);
    const body = rlsSql.slice(start, start + 600);
    assert.match(body, /security\s+definer/i, `${name} must be SECURITY DEFINER`);
    assert.match(body, /set\s+search_path/i, `${name} must pin search_path`);
  });
});

test("anonymous users receive no application table grants", () => {
  assert.match(rlsSql, /revoke\s+all\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon/i);
  assert.doesNotMatch(rlsSql, /grant\s+.+\s+on\s+public\.[a-z_]+\s+to\s+anon/i);
});

test("browser migrations never mention a service role credential", () => {
  assert.doesNotMatch(allSql, /service[_-]?role/);
  assert.doesNotMatch(allSql, /supabase_service/);
});

test("geometry tables use PostGIS with spatial indexes", () => {
  assert.match(schemaSql, /create\s+extension\s+if\s+not\s+exists\s+postgis/i);
  assert.match(schemaSql, /fields_geometry_gix[\s\S]+using\s+gist\s*\(\s*geometry\s*\)/i);
  assert.match(schemaSql, /flight_logs_track_gix[\s\S]+using\s+gist\s*\(\s*track\s*\)/i);
});

test("forecast, human confirmation, and field measurement stay distinct", () => {
  assert.match(
    schemaSql,
    /record_type\s+in\s*\(\s*'forecast',\s*'operator_confirmation',\s*'field_measurement'\s*\)/i,
  );
});

test("remote writes carry concurrency and idempotency controls", () => {
  ["fields", "operation_plans", "work_records"].forEach((table) => {
    const start = schemaSql.search(new RegExp(`create\\s+table\\s+public\\.${table}`, "i"));
    const body = schemaSql.slice(start, start + 2200);
    assert.match(body, /version\s+bigint/i, `${table} is missing version`);
  });
  assert.match(schemaSql, /operation_plans[\s\S]+idempotency_key/i);
  assert.match(schemaSql, /notification_targets[\s\S]+idempotency_key/i);
  assert.match(schemaSql, /work_records[\s\S]+idempotency_key/i);
});

test("report assets and flight logs are private, size-limited buckets", () => {
  assert.match(storageSql, /'report-assets'[\s\S]+false[\s\S]+10485760/i);
  assert.match(storageSql, /'flight-logs'[\s\S]+false[\s\S]+26214400/i);
  assert.match(storageSql, /storage\.objects\s+for\s+insert/i);
  assert.match(storageSql, /storage\.objects\s+for\s+select/i);
  assert.match(storageSql, /storage_path_owner\(name\)\s*=\s*auth\.uid\(\)/i);
});

test("membership indexes support RLS lookups", () => {
  assert.match(
    schemaSql,
    /workspace_memberships_user_idx[\s\S]+user_id,\s*status,\s*workspace_id/i,
  );
});

test("repeated sync does not duplicate notifications, weather, or flight logs", () => {
  assert.match(syncKeysSql, /weather_records\s*\(plan_id,\s*record_type,\s*source_key\)/i);
  assert.match(syncKeysSql, /notification_targets\s*\(plan_id,\s*target_key\)/i);
  assert.match(syncKeysSql, /flight_logs\s*\(plan_id,\s*provider,\s*source_key\)/i);
  assert.match(syncKeysSql, /policy\s+app_assets_update_owner_or_admin/i);
});

test("invite acceptance uses the named membership constraint", () => {
  assert.match(inviteFixSql, /on\s+conflict\s+on\s+constraint\s+workspace_memberships_pkey/i);
  assert.doesNotMatch(inviteFixSql, /on\s+conflict\s*\(\s*workspace_id/i);
});

test("insert returning can read newly owned fields and plans", () => {
  assert.match(returningRlsSql, /owner_user_id\s*=\s*auth\.uid\(\)/i);
  assert.match(returningRlsSql, /created_by\s*=\s*auth\.uid\(\)/i);
  assert.doesNotMatch(
    returningRlsSql,
    /create\s+policy\s+fields_select_allowed[\s\S]+using\s*\(\s*public\.can_read_field/i,
  );
});
