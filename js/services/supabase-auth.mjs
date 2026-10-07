export class SupabaseAuthError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "SupabaseAuthError";
    this.code = code;
  }
}

function requiredClient(client) {
  if (!client?.auth || typeof client.auth.getSession !== "function") {
    throw new SupabaseAuthError("missing-client", "認証サービスを利用できません。");
  }
  return client;
}

function resultData(result, operation) {
  if (result?.error) {
    throw new SupabaseAuthError(
      `${operation}-failed`,
      "認証処理を完了できませんでした。",
      { cause: result.error },
    );
  }
  return result?.data || null;
}

function normalizedEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SupabaseAuthError("invalid-email", "メールアドレスを確認してください。");
  }
  return email;
}

export function magicLinkRedirectUrl(currentUrl) {
  try {
    return new URL("./app.html?auth=magic-link", String(currentUrl || "")).href;
  } catch (error) {
    throw new SupabaseAuthError(
      "invalid-redirect",
      "ログイン後の戻り先を設定できません。",
      { cause: error },
    );
  }
}

// アプリへの戻り先はSupabaseのURL Configurationへ登録する。
// Google CloudのリダイレクトURIはSupabase側の/auth/v1/callback。
export function oauthRedirectUrl(currentUrl) {
  try {
    return new URL("./app.html?auth=google", String(currentUrl || "")).href;
  } catch (error) {
    throw new SupabaseAuthError(
      "invalid-redirect",
      "ログイン後の戻り先を設定できません。",
      { cause: error },
    );
  }
}

export function createSupabaseAuthService({ client, redirectUrl, oauthRedirect } = {}) {
  const supabaseClient = requiredClient(client);
  const googleRedirect = oauthRedirect || redirectUrl;

  return Object.freeze({
    async session() {
      const data = resultData(await supabaseClient.auth.getSession(), "session");
      return data?.session || null;
    },

    async sendMagicLink(email) {
      const data = resultData(
        await supabaseClient.auth.signInWithOtp({
          email: normalizedEmail(email),
          options: {
            emailRedirectTo: redirectUrl,
            shouldCreateUser: true,
          },
        }),
        "magic-link",
      );
      return data;
    },

    // Googleでログインする。メールのマジックリンクと併用し、どちらでも
    // 同じ auth.users.id（＝RLSが見る auth.uid()）へ集約される。
    async signInWithGoogle() {
      const data = resultData(
        await supabaseClient.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: googleRedirect },
        }),
        "google-sign-in",
      );
      return data;
    },

    async signOut() {
      resultData(await supabaseClient.auth.signOut({ scope: "local" }), "sign-out");
    },

    onAuthStateChange(callback) {
      if (typeof callback !== "function") {
        throw new SupabaseAuthError("invalid-listener", "認証変更の処理が設定されていません。");
      }
      const result = supabaseClient.auth.onAuthStateChange((event, session) => {
        callback({ event, session });
      });
      return () => result?.data?.subscription?.unsubscribe?.();
    },

    async saveProfile(profile, equipmentTemplate = {}) {
      const session = await this.session();
      if (!session?.user?.id) {
        throw new SupabaseAuthError("authentication-required", "ログインしてください。");
      }
      const row = {
        id: session.user.id,
        display_name: String(profile?.name || ""),
        organization_name: String(profile?.organizationName || ""),
        municipality: String(profile?.municipality || ""),
        district: String(profile?.district || ""),
        address_detail: String(profile?.addressDetail || ""),
        phone: String(profile?.phone || ""),
        email: String(profile?.email || session.user.email || ""),
        preferred_contact_method: String(profile?.preferredContactMethod || "email"),
        affiliation: String(profile?.affiliation || ""),
        visibility: profile?.visibility || {},
        profile_data: {
          registered: Boolean(profile?.registered),
          role: profile?.role || null,
          roles: profile?.roles || [],
          lineId: String(profile?.lineId || ""),
          targetMunicipalities: profile?.targetMunicipalities || [],
          sprayer: profile?.sprayer || {},
          neighbor: profile?.neighbor || {},
          admin: profile?.admin || {},
          equipmentTemplate,
        },
      };
      const result = await supabaseClient
        .from("profiles")
        .upsert(row, { onConflict: "id" })
        .select()
        .single();
      return resultData(result, "profile-save");
    },

    async loadProfile() {
      const session = await this.session();
      if (!session?.user?.id) {
        throw new SupabaseAuthError("authentication-required", "ログインしてください。");
      }
      const result = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      const row = resultData(result, "profile-load") || {};
      const data = row.profile_data || {};
      return {
        profile: {
          registered: Boolean(data.registered),
          role: data.role || null,
          roles: data.roles || [],
          lineId: String(data.lineId || ""),
          name: row.display_name || "",
          organizationName: row.organization_name || "",
          municipality: row.municipality || "",
          district: row.district || "",
          addressDetail: row.address_detail || "",
          phone: row.phone || "",
          email: row.email || session.user.email || "",
          preferredContactMethod: row.preferred_contact_method || "email",
          affiliation: row.affiliation || "",
          visibility: row.visibility || {},
          targetMunicipalities: data.targetMunicipalities || [],
          sprayer: data.sprayer || {},
          neighbor: data.neighbor || {},
          admin: data.admin || {},
        },
        equipmentTemplate: data.equipmentTemplate || {},
      };
    },

    async memberships() {
      const session = await this.session();
      if (!session?.user?.id) {
        throw new SupabaseAuthError("authentication-required", "ログインしてください。");
      }
      const result = await supabaseClient
        .from("workspace_memberships")
        .select("workspace_id, role, status, workspaces(id, slug, name, prefecture, municipality, district, settings)")
        .eq("user_id", session.user.id)
        .eq("status", "active");
      return resultData(result, "membership-list") || [];
    },

    async accountDeletionRequest() {
      const session = await this.session();
      if (!session?.user?.id) {
        throw new SupabaseAuthError("authentication-required", "ログインしてください。");
      }
      const result = await supabaseClient
        .from("account_deletion_requests")
        .select("status, requested_at, cancelled_at, completed_at, updated_at")
        .eq("user_id", session.user.id)
        .maybeSingle();
      return resultData(result, "account-deletion-status");
    },

    async requestAccountDeletion(confirmation) {
      const result = await supabaseClient.rpc("request_account_deletion", {
        p_confirmation: String(confirmation || "").trim(),
      });
      return resultData(result, "account-deletion-request");
    },

    async cancelAccountDeletion() {
      const result = await supabaseClient.rpc("cancel_account_deletion");
      return resultData(result, "account-deletion-cancel");
    },

    async createWorkspace(input) {
      const result = await supabaseClient.rpc("create_workspace_for_user", {
        p_name: String(input?.name || ""),
        p_prefecture: String(input?.prefecture || ""),
        p_municipality: String(input?.municipality || ""),
        p_district: String(input?.district || ""),
        p_role: input?.role || "sprayer",
      });
      return resultData(result, "workspace-create");
    },

    async joinMunicipality(code, roles) {
      return resultData(await supabaseClient.rpc('join_municipality', {p_code:code,p_roles:roles}), 'municipality-join');
    },

    async municipalSchedule(code) {
      return resultData(await supabaseClient.rpc('municipal_schedule', {p_code:code}), 'municipal-schedule') || [];
    },

    async addWorkspaceRole(workspaceId, role) {
      const session = await this.session();
      if (!session?.user?.id) {
        throw new SupabaseAuthError("authentication-required", "ログインしてください。");
      }
      if (!["sprayer", "neighbor"].includes(role)) {
        throw new SupabaseAuthError("invalid-role", "利用区分を確認してください。");
      }
      const result = await supabaseClient.rpc("add_my_workspace_role", {p_workspace_id: workspaceId, p_role: role});
      return resultData(result, "membership-save");
    },

    async setMyWorkspaceRoles(workspaceId, roles) {
      if (!Array.isArray(roles) || !roles.length || roles.some(role => !['sprayer','neighbor'].includes(role))) {
        throw new SupabaseAuthError('invalid-role', '散布者・周辺関係者から選んでください。');
      }
      return resultData(await supabaseClient.rpc('set_my_workspace_roles', {p_workspace_id: workspaceId, p_roles: roles}), 'membership-save');
    },

    async isAppAdministrator() {
      return resultData(await supabaseClient.rpc('is_app_administrator'), 'app-administrator') === true;
    },

    async assignRegionalAdministrator(workspaceId, userId, enabled) {
      return resultData(await supabaseClient.rpc('assign_regional_administrator', {
        p_workspace_id: workspaceId, p_user_id: userId, p_enabled: enabled,
      }), 'administrator-assignment');
    },

    async workspaceParticipants(workspaceId) {
      return resultData(await supabaseClient.from("workspace_memberships")
        .select("user_id,role,status").eq("workspace_id", workspaceId).eq("status", "active"), "participants") || [];
    },

    async createInvite(workspaceId, role, email) {
      if (!['sprayer','neighbor'].includes(role)) throw new SupabaseAuthError('invalid-role', '地域管理はアプリ管理者から直接付与します。');
      return resultData(await supabaseClient.rpc("create_workspace_invite", {
        p_workspace_id: workspaceId, p_role: role,
        p_email: email ? normalizedEmail(email) : null, p_max_uses: 1,
      }), "create-invite");
    },

    async acceptInvite(token) {
      const result = await supabaseClient.rpc("accept_workspace_invite", {
        p_token: String(token || "").trim(),
      });
      return resultData(result, "invite-accept");
    },
  });
}
