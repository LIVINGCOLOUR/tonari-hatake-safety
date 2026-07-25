import assert from "node:assert/strict";
import test from "node:test";

import {
  SupabaseConfigurationError,
  createSupabaseRuntime,
  normalizeSupabaseRuntimeConfig,
} from "../js/services/supabase-client.mjs";
import {
  SupabaseAuthError,
  createSupabaseAuthService,
  magicLinkRedirectUrl,
} from "../js/services/supabase-auth.mjs";

test("runtime remains local until both public values are configured", () => {
  assert.deepEqual(
    normalizeSupabaseRuntimeConfig({ mode: "supabase", url: "", publishableKey: "" }),
    {
      mode: "local",
      requestedMode: "supabase",
      url: "",
      publishableKey: "",
      configured: false,
    },
  );
  const runtime = createSupabaseRuntime({
    config: { mode: "supabase" },
  });
  assert.equal(runtime.enabled, false);
  assert.equal(runtime.reason, "not-configured");
});

test("runtime accepts publishable and legacy anon keys without exposing secrets", () => {
  const modern = normalizeSupabaseRuntimeConfig({
    mode: "hybrid",
    url: "https://example.supabase.co/",
    publishableKey: "sb_publishable_example",
  });
  assert.equal(modern.configured, true);
  assert.equal(modern.url, "https://example.supabase.co");
  assert.equal(modern.mode, "hybrid");

  const legacy = normalizeSupabaseRuntimeConfig({
    mode: "supabase",
    url: "http://127.0.0.1:54321",
    publishableKey: "eyJheader.payload.signature",
  });
  assert.equal(legacy.configured, true);
});

test("enabled runtime creates one official client with safe auth defaults", () => {
  const calls = [];
  const client = {};
  const runtime = createSupabaseRuntime({
    config: {
      mode: "hybrid",
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    },
    library: {
      createClient(...args) {
        calls.push(args);
        return client;
      },
    },
    storage: { getItem() {}, setItem() {}, removeItem() {} },
  });
  assert.equal(runtime.client, client);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://example.supabase.co");
  assert.equal(calls[0][1], "sb_publishable_example");
  assert.equal(calls[0][2].auth.persistSession, true);
  assert.equal(calls[0][2].auth.detectSessionInUrl, true);
});

test("enabled runtime fails clearly when the library is unavailable", () => {
  assert.throws(
    () => createSupabaseRuntime({
      config: {
        mode: "supabase",
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_example",
      },
    }),
    (error) => error instanceof SupabaseConfigurationError && error.code === "missing-library",
  );
});

function authClient({ session = null, authError = null, profileRow = null } = {}) {
  const calls = [];
  const query = {
    upsert(value) {
      calls.push(["upsert", value]);
      return this;
    },
    select() {
      return this;
    },
    single() {
      return Promise.resolve({ data: profileRow || { id: session?.user?.id }, error: null });
    },
    eq(key, value) {
      calls.push(["eq", key, value]);
      return this;
    },
    then(resolve) {
      resolve({ data: [], error: null });
    },
  };
  return {
    calls,
    auth: {
      getSession: async () => ({ data: { session }, error: authError }),
      signInWithOtp: async (input) => {
        calls.push(["otp", input]);
        return { data: {}, error: null };
      },
      signOut: async (input) => {
        calls.push(["signOut", input]);
        return { data: {}, error: null };
      },
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
    from(table) {
      calls.push(["from", table]);
      return query;
    },
    rpc(name, args) {
      calls.push(["rpc", name, args]);
      return Promise.resolve({ data: "workspace-id", error: null });
    },
  };
}

test("magic link validates email before transmitting it", async () => {
  const client = authClient();
  const service = createSupabaseAuthService({
    client,
    redirectUrl: "https://example.test/app.html",
  });
  await assert.rejects(
    () => service.sendMagicLink("invalid"),
    (error) => error instanceof SupabaseAuthError && error.code === "invalid-email",
  );
  await service.sendMagicLink(" USER@example.test ");
  const call = client.calls.find(([name]) => name === "otp");
  assert.equal(call[1].email, "user@example.test");
  assert.equal(call[1].options.emailRedirectTo, "https://example.test/app.html");
});

test("magic link returns to the canonical profile page after pretty URL redirects", () => {
  assert.equal(
    magicLinkRedirectUrl("https://tonari-hatake-safety.pages.dev/app#profile"),
    "https://tonari-hatake-safety.pages.dev/app.html?auth=magic-link",
  );
  assert.equal(
    magicLinkRedirectUrl("http://127.0.0.1:4178/app.html#dashboard"),
    "http://127.0.0.1:4178/app.html?auth=magic-link",
  );
  assert.throws(
    () => magicLinkRedirectUrl("not-a-url"),
    (error) => error instanceof SupabaseAuthError && error.code === "invalid-redirect",
  );
});

test("profile save requires a session and maps private data explicitly", async () => {
  const anonymous = createSupabaseAuthService({ client: authClient() });
  await assert.rejects(
    () => anonymous.saveProfile({ name: "未認証" }),
    (error) => error instanceof SupabaseAuthError
      && error.code === "authentication-required",
  );

  const client = authClient({
    session: { user: { id: "user-1", email: "user@example.test" } },
  });
  const service = createSupabaseAuthService({ client });
  await service.saveProfile({
    name: "利用者",
    municipality: "笠間市",
    visibility: { phone: "private" },
    sprayer: { defaultMethod: "ドローン" },
  });
  const upsert = client.calls.find(([name]) => name === "upsert");
  assert.equal(upsert[1].id, "user-1");
  assert.equal(upsert[1].display_name, "利用者");
  assert.equal(upsert[1].email, "user@example.test");
  assert.deepEqual(upsert[1].visibility, { phone: "private" });
  assert.deepEqual(upsert[1].profile_data.sprayer, { defaultMethod: "ドローン" });
});

test("profile load restores role details and equipment without device state", async () => {
  const client = authClient({
    session: { user: { id: "user-1", email: "user@example.test" } },
    profileRow: {
      id: "user-1",
      display_name: "利用者",
      municipality: "笠間市",
      preferred_contact_method: "line",
      visibility: { phone: "private" },
      profile_data: {
        registered: true,
        role: "sprayer",
        sprayer: { defaultMethod: "ドローン" },
        equipmentTemplate: { droneModel: "機体A" },
      },
    },
  });
  const service = createSupabaseAuthService({ client });
  const account = await service.loadProfile();
  assert.equal(account.profile.registered, true);
  assert.equal(account.profile.role, "sprayer");
  assert.equal(account.profile.name, "利用者");
  assert.deepEqual(account.profile.visibility, { phone: "private" });
  assert.deepEqual(account.equipmentTemplate, { droneModel: "機体A" });
  assert.equal("activePlanId" in account.profile, false);
});
