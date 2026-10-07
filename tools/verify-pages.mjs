const baseUrl = process.argv[2] || "http://127.0.0.1:4177";
const port = process.argv[3] || "9238";

async function inspectPage(path, expression, viewport = { width: 1440, height: 960 }, waitMs = 1800) {
  const url = `${baseUrl}${path}`;
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Could not create target for ${url}`);
  const target = await targetResponse.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let messageId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map(arg => arg.description || arg.value).join(" "));
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  function command(method, params = {}) {
    const id = ++messageId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  await command("Runtime.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    ...viewport,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 560,
  });
  await command("Page.navigate", { url });
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  if (path.startsWith("/app.html") || path.startsWith("/app?")) {
    await command("Runtime.evaluate", {
      expression: `new Promise((resolve) => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
          if (document.documentElement.dataset.appReady === "true" || Date.now() - startedAt >= 15000) {
            clearInterval(timer);
            resolve(true);
          }
        }, 100);
      })`,
      awaitPromise: true,
      returnByValue: true,
    });
  }
  await command("Runtime.evaluate", {
    expression: `new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if ([...document.images].every((item) => item.complete) || Date.now() - startedAt >= 10000) {
          clearInterval(timer);
          resolve(true);
        }
      }, 100);
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  const evaluated = await command("Runtime.evaluate", { expression: `(${expression})()`, returnByValue: true });
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`, { method: "PUT" });
  socket.close();
  return { value: evaluated.result.value, errors };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (!process.argv.includes("--case-only")) {
const landingDesktop = await inspectPage("/", `() => ({
  title: document.title,
  imageFailures: [...document.images].filter((image) => !image.complete || !image.naturalWidth).map((image) => image.src),
  overflow: document.documentElement.scrollWidth - innerWidth,
  roleLinks: [...document.querySelectorAll('.role-card a')].map((link) => link.getAttribute('href')),
  featureLinks: [...document.querySelectorAll('.feature-item a')].map((link) => link.getAttribute('href')),
  featureStatuses: [...document.querySelectorAll('.feature-item .feature-status')].map((item) => item.textContent.trim()),
  featureDescriptions: [...document.querySelectorAll('.feature-item > p')].map((item) => item.textContent.trim()),
})`);
assert(landingDesktop.value.title.includes("となりの畑セーフティ（仮称）"), "Landing page title is missing");
assert(landingDesktop.value.imageFailures.length === 0, `Broken landing images: ${landingDesktop.value.imageFailures.join(", ")}`);
assert(landingDesktop.value.overflow <= 0, `Desktop landing page overflows by ${landingDesktop.value.overflow}px`);
assert(landingDesktop.value.roleLinks.length === 3, "Landing page must expose all three role demos");
assert(landingDesktop.value.featureLinks.length === 2, "Only capabilities with an available demo view should link to demos");
assert(landingDesktop.value.featureLinks.every((href) => href?.startsWith("app.html?demo=1&role=sprayer#")), "Capability links must open an available sprayer demo view");
assert(landingDesktop.value.featureStatuses.filter((status) => status === "現在のデモ").length === 1, "Landing page must identify the currently available workflow");
assert(landingDesktop.value.featureStatuses.filter((status) => status === "実装中").length === 3, "Landing page must mark in-progress capabilities (log import, district posting, org account)");
assert(landingDesktop.value.featureStatuses.filter((status) => status === "将来構想").length === 2, "Landing page must separate future drone capabilities");
assert(landingDesktop.value.featureDescriptions.some((description) => description.includes("実ファイルを入手して形式を検証してから対応")), "Landing page must not present DJI log import as implemented");
assert(landingDesktop.value.featureDescriptions.some((description) => description.includes("実証済みの機体から段階的に対応")), "Landing page must not imply universal live telemetry support");
assert(landingDesktop.errors.length === 0, `Landing runtime errors: ${landingDesktop.errors.join(", ")}`);

// Browser zoom-out increases the CSS viewport. Keep the hero copy from being
// squeezed by viewport-relative spacing at those effective widths.
const landingZoomedOut = await inspectPage("/", `() => {
  const title = document.querySelector('.hero h1');
  const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
  return {
    contentWidth: title.getBoundingClientRect().width,
    titleLines: Math.round(title.getBoundingClientRect().height / lineHeight),
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
}`, { width: 2268, height: 1125 });
assert(landingZoomedOut.value.contentWidth >= 600, `Zoomed-out hero width collapsed to ${landingZoomedOut.value.contentWidth}px`);
assert(landingZoomedOut.value.titleLines <= 2, `Zoomed-out hero title wrapped to ${landingZoomedOut.value.titleLines} lines`);
assert(landingZoomedOut.value.overflow <= 0, `Zoomed-out landing page overflows by ${landingZoomedOut.value.overflow}px`);

const landingTablet = await inspectPage("/", `() => ({
  overflow: document.documentElement.scrollWidth - innerWidth,
  navButtonVisible: getComputedStyle(document.querySelector('#navToggle')).display !== 'none',
})`, { width: 1024, height: 768 });
assert(landingTablet.value.overflow <= 0, `Tablet landing page overflows by ${landingTablet.value.overflow}px`);
assert(landingTablet.value.navButtonVisible, "Tablet navigation should collapse before links become crowded");

const landingMobile = await inspectPage("/", `() => ({
  overflow: document.documentElement.scrollWidth - innerWidth,
  navButtonVisible: getComputedStyle(document.querySelector('#navToggle')).display !== 'none',
  navOpened: (() => {
    document.querySelector('#navToggle').click();
    return document.querySelector('#siteNav').classList.contains('open')
      && document.querySelector('#navToggle').getAttribute('aria-expanded') === 'true';
  })(),
})`, { width: 390, height: 844 });
assert(landingMobile.value.overflow <= 0, `Mobile landing page overflows by ${landingMobile.value.overflow}px`);
assert(landingMobile.value.navButtonVisible, "Mobile navigation button is not visible");
assert(landingMobile.value.navOpened, "Mobile navigation does not open");

const landingNarrow = await inspectPage("/", `() => ({
  overflow: document.documentElement.scrollWidth - innerWidth,
  signalHidden: getComputedStyle(document.querySelector('.hero-signal')).display === 'none',
})`, { width: 360, height: 800 });
assert(landingNarrow.value.overflow <= 0, `Narrow mobile landing page overflows by ${landingNarrow.value.overflow}px`);
assert(landingNarrow.value.signalHidden, "Narrow mobile hero should prioritize primary content over the stage signal");

const expectedNavigation = {
  sprayer: ["プロフィール登録", "トップ", "散布計画", "圃場マップ", "気象メモ", "近隣通知", "散布前チェック", "ドローン連携", "実施後報告", "作業履歴"],
  neighbor: ["プロフィール登録", "トップ", "圃場マップ", "圃場ステータス"],
  admin: ["プロフィール登録", "トップ", "散布予定・実績"],
};

for (const [role, expected] of Object.entries(expectedNavigation)) {
  const result = await inspectPage(`/app.html?demo=1&role=${role}#dashboard`, `() => ({
    registered: profileIsRegistered(),
    role: document.querySelector('.role-option.active span')?.textContent.trim(),
    navigation: [...document.querySelectorAll('.nav-item')]
      .filter((item) => getComputedStyle(item).display !== 'none')
      .map((item) => item.querySelector('span:last-child')?.textContent.trim()),
    workflowTargets: [...document.querySelectorAll('#roleActionPanel [data-view-target]')]
      .map((item) => item.dataset.viewTarget),
    timelineTitles: [...document.querySelectorAll('#timeline li strong')]
      .map((item) => item.textContent.trim()),
    kpiCount: document.querySelectorAll('#kpiGrid .kpi-card').length,
    activePlan: document.querySelector('#activePlanSelect')?.value,
    caseTitle: document.querySelector('#caseBar strong')?.textContent.trim(),
    deadNeighborNotifyLink: Boolean(document.querySelector('#goNoGoCard [data-view-target="notify"]')),
    overflow: document.documentElement.scrollWidth - innerWidth,
  })`, { width: 1440, height: 960 }, 3500);
  const expectedRoleLabel = { sprayer: "散布者", neighbor: "周辺関係者", admin: "地域管理" }[role];
  const expectedKpiCount = { sprayer: 9, neighbor: 5, admin: 9 }[role];
  assert(result.value.role === expectedRoleLabel, `${role} demo opened as ${result.value.role}: ${result.errors.join(", ")}`);
  const expectedLabels = expected.map(label => label === "プロフィール登録" && result.value.registered ? "設定" : label);
  assert(JSON.stringify(result.value.navigation) === JSON.stringify(expectedLabels), `${role} navigation mismatch: ${result.value.navigation.join(" / ")}`);
  assert(result.value.kpiCount === expectedKpiCount, `${role} KPI count: ${result.value.kpiCount}`);
  assert(result.value.activePlan === "plan-kasama-demo", `${role} did not keep the Kasama demo case active`);
  assert(result.value.caseTitle?.includes("実証ケースK"), `${role} case bar is missing the shared case title`);
  if (role === "sprayer") {
    assert(result.value.workflowTargets.includes("history"), "Sprayer workflow must end in work history");
    assert(result.value.timelineTitles.includes("作業履歴"), "Sprayer timeline must include work history");
  }
  if (role === "neighbor") {
    assert(result.value.workflowTargets.includes("fields"), "Neighbor workflow must expose field privacy settings");
    assert(result.value.timelineTitles.includes("公開範囲"), "Neighbor timeline must include privacy scope");
    assert(!result.value.deadNeighborNotifyLink, "Neighbor reply action must not link to the forbidden notify view");
  }
  if (role === "admin") {
    assert(!result.value.workflowTargets.includes("plans"), "Admin workflow must not expose spray-plan editing");
    assert(result.value.timelineTitles.includes("位置づけ"), "Admin timeline must preserve the non-approval statement");
  }
  assert(result.value.overflow <= 0, `${role} app overflows by ${result.value.overflow}px`);
  assert(result.errors.length === 0, `${role} runtime errors: ${result.errors.join(", ")}`);
}

const sprayerHistory = await inspectPage("/app.html?demo=1&role=sprayer#history", `() => ({
  activeView: document.querySelector('.view.active')?.dataset.view,
  activeNavigation: document.querySelector('.nav-item.active span:last-child')?.textContent.trim(),
  recordCount: document.querySelectorAll('#historyTableBody tr').length,
  overflow: document.documentElement.scrollWidth - innerWidth,
})`, { width: 1440, height: 960 }, 3500);
assert(sprayerHistory.value.activeView === "history", `Sprayer history opened ${sprayerHistory.value.activeView}`);
assert(sprayerHistory.value.activeNavigation === "作業履歴", `Sprayer history navigation is ${sprayerHistory.value.activeNavigation}`);
assert(sprayerHistory.value.recordCount > 0, "Sprayer history contains no records");
assert(sprayerHistory.value.overflow <= 0, `Sprayer history overflows by ${sprayerHistory.value.overflow}px`);
assert(sprayerHistory.errors.length === 0, `Sprayer history runtime errors: ${sprayerHistory.errors.join(", ")}`);

for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  const conflictPanel = await inspectPage("/app.html?demo=1&role=sprayer#profile", `() => {
    const account = document.querySelector('#supabaseAccountPanel');
    const sync = document.querySelector('#supabaseSyncPanel');
    const notice = document.querySelector('#supabaseConflictNotice');
    const details = document.querySelector('#supabaseConflictDetails');
    const list = document.querySelector('#supabaseConflictList');
    account.hidden = false;
    sync.hidden = false;
    notice.hidden = false;
    details.hidden = false;
    list.innerHTML = \`
      <div class="cloud-conflict-row">
        <div>
          <strong>北側圃場</strong>
          <span class="cloud-conflict-state">両方で変更</span>
          <div class="cloud-conflict-values">
            <span><b>予定日</b>：クラウド「2026-07-26」 / 端末「2026-07-25」</span>
            <span><b>使用資材</b>：クラウド「除草剤A」 / 端末「液肥B」</span>
          </div>
        </div>
        <label>採用する内容
          <select><option>クラウド版（推奨）</option><option>端末版</option></select>
        </label>
      </div>\`;
    return {
      text: notice.textContent.trim(),
      noticeWidth: notice.getBoundingClientRect().width,
      detailsWidth: details.getBoundingClientRect().width,
      selectorVisible: getComputedStyle(list.querySelector('select')).display !== 'none',
      viewportWidth: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  }`, viewport, 3500);
  assert(conflictPanel.value.text.includes("別の端末"), "Conflict notice does not explain the cause");
  assert(
    conflictPanel.value.noticeWidth <= conflictPanel.value.viewportWidth,
    `Conflict notice is wider than the ${viewport.width}px viewport`,
  );
  assert(
    conflictPanel.value.detailsWidth <= conflictPanel.value.viewportWidth,
    `Conflict comparison is wider than the ${viewport.width}px viewport`,
  );
  assert(conflictPanel.value.selectorVisible, "Conflict choice is not visible");
  assert(
    conflictPanel.value.overflow <= 0,
    `Conflict notice causes ${conflictPanel.value.overflow}px overflow at ${viewport.width}px`,
  );
  assert(conflictPanel.errors.length === 0, `Conflict UI runtime errors: ${conflictPanel.errors.join(", ")}`);
}

for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  const pendingPanel = await inspectPage("/app.html?demo=1&role=sprayer#profile", `() => {
    const account = document.querySelector('#supabaseAccountPanel');
    const sync = document.querySelector('#supabaseSyncPanel');
    const retry = document.querySelector('#retryCloudSyncButton');
    const note = document.querySelector('#supabasePendingSyncNote');
    account.hidden = false;
    sync.hidden = false;
    retry.hidden = false;
    note.hidden = false;
    note.textContent = '未送信の変更があります（7月25日 10:02、再試行 1回）。端末を閉じても保持されます。';
    return {
      retryText: retry.textContent.trim(),
      noteText: note.textContent.trim(),
      retryWidth: retry.getBoundingClientRect().width,
      noteWidth: note.getBoundingClientRect().width,
      viewportWidth: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  }`, viewport, 3500);
  assert(pendingPanel.value.retryText === "未送信を再試行", "Pending retry action is unclear");
  assert(pendingPanel.value.noteText.includes("端末を閉じても保持"), "Pending note does not explain persistence");
  assert(
    pendingPanel.value.retryWidth <= pendingPanel.value.viewportWidth,
    `Pending retry is wider than the ${viewport.width}px viewport`,
  );
  assert(
    pendingPanel.value.noteWidth <= pendingPanel.value.viewportWidth,
    `Pending note is wider than the ${viewport.width}px viewport`,
  );
  assert(
    pendingPanel.value.overflow <= 0,
    `Pending sync UI causes ${pendingPanel.value.overflow}px overflow at ${viewport.width}px`,
  );
  assert(pendingPanel.errors.length === 0, `Pending sync UI runtime errors: ${pendingPanel.errors.join(", ")}`);
}

for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  const accountOperations = await inspectPage("/app.html?demo=1&role=sprayer#profile", `() => {
    const account = document.querySelector('#supabaseAccountPanel');
    const operations = document.querySelector('#accountDataOperations');
    const confirmation = document.querySelector('#accountDeletionConfirmation');
    const cancel = document.querySelector('#cancelAccountDeletionButton');
    const open = document.querySelector('#openAccountDeletionButton');
    account.hidden = false;
    operations.hidden = false;
    confirmation.hidden = false;
    open.hidden = true;
    cancel.hidden = false;
    document.querySelector('#accountOperationStatus').textContent =
      '退会申請を受け付けています（7月25日 21:00）。共有記録を確認してから処理します。';
    return {
      title: document.querySelector('#accountDataOperationsTitle').textContent.trim(),
      exportText: document.querySelector('#exportAccountDataButton').textContent.trim(),
      confirmationText: confirmation.textContent.trim(),
      operationWidth: operations.getBoundingClientRect().width,
      confirmationWidth: confirmation.getBoundingClientRect().width,
      viewportWidth: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  }`, viewport, 3500);
  assert(accountOperations.value.title === "データの控えと退会", "Account operation title is unclear");
  assert(
    accountOperations.value.exportText === "本人用データを書き出す",
    "Account export action is unclear",
  );
  assert(
    accountOperations.value.confirmationText.includes("退会を申請"),
    "Account deletion confirmation phrase is missing",
  );
  assert(
    accountOperations.value.operationWidth <= accountOperations.value.viewportWidth,
    `Account operations are wider than the ${viewport.width}px viewport`,
  );
  assert(
    accountOperations.value.confirmationWidth <= accountOperations.value.viewportWidth,
    `Account confirmation is wider than the ${viewport.width}px viewport`,
  );
  assert(
    accountOperations.value.overflow <= 0,
    `Account operations cause ${accountOperations.value.overflow}px overflow at ${viewport.width}px`,
  );
  assert(
    accountOperations.errors.length === 0,
    `Account operations runtime errors: ${accountOperations.errors.join(", ")}`,
  );
}

const legacyRedirect = await inspectPage("/#dashboard", `() => location.pathname`);
assert(
  legacyRedirect.value.endsWith("/app.html") || legacyRedirect.value.endsWith("/app"),
  `Legacy dashboard URL did not redirect: ${legacyRedirect.value}`,
);

console.log("Landing and role navigation checks passed.");

// The default entry must offer a complete workflow without demo-only tasks.
for (const width of [1440, 390]) {
  const result = await inspectPage("/app.html?role=sprayer#drone", `() => {
    const visible = (node) => Boolean(node && node.getClientRects().length);
    const dashboardText = document.querySelector('[data-view="dashboard"]').innerText;
    const redirected = document.querySelector('.view.active')?.dataset.view;
    const workflow = [...document.querySelectorAll('#roleActionPanel [data-view-target]')].map(n => n.dataset.viewTarget);
    switchView('map');
    const layers = [...document.querySelectorAll('[data-map-layer]')].filter(visible).map(n => n.dataset.mapLayer);
    return {
      ready: document.documentElement.dataset.appReady,
      demoVisible: [...document.querySelectorAll('[data-demo-only]')].some(visible),
      redirected, workflow, layers,
      asksForLog: dashboardText.includes('ログ未取込') || dashboardText.includes('ログ取込'),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  }`, { width, height: 960 });
  assert(result.value.ready === "true", "Default entry did not initialize");
  assert(result.value.redirected === "dashboard", "Unavailable drone route must return to dashboard");
  assert(!result.value.demoVisible, "Default entry exposes demo tools");
  assert(!result.value.asksForLog, "Default dashboard asks for unavailable log import");
  assert(result.value.workflow.includes("report") && !result.value.workflow.includes("drone"), "Default workflow must lead to report without drone import");
  assert(JSON.stringify(result.value.layers) === '["risk"]', "Default map exposes advanced layers");
  assert(result.value.overflow <= 0, "Default map overflows viewport");
  assert(result.errors.length === 0, `Default runtime errors: ${result.errors.join(', ')}`);
}
console.log("Default workflow verified at desktop and mobile widths.");

for (const width of [1440, 390]) {
  const result = await inspectPage("/app.html#dashboard", `() => {
    state.profile.registered = true;
    state.profile.role = "sprayer";
    state.role = "sprayer";
    renderAll();
    const buttons = [...document.querySelectorAll('#roleSwitcher [data-role]')];
    const visible = buttons.filter(n => n.getClientRects().length).map(n => n.dataset.role);
    document.querySelector('#roleSwitcher [data-role="neighbor"]').click();
    const neighbor = activeRole === 'neighbor' && currentNavigationRole() === 'neighbor'
      && document.querySelector('.view.active').dataset.view === 'dashboard';
    const profileKept = state.profile.role === 'sprayer' && state.profile.registered;
    const restored = state.role;
    state = normalizeState(structuredClone(state));
    restoreSelectedRole();
    const selectionKept = activeRole === restored;
    document.querySelector('#roleSwitcher [data-role="admin"]').click();
    const admin = activeRole === 'admin' && roleAllowsView('admin') && !roleAllowsView('plans');
    document.querySelector('#roleSwitcher [data-role="sprayer"]').click();
    const sprayer = activeRole === 'sprayer' && roleAllowsView('plans');
    switchView('plans');
    const input = document.querySelector('#planForm input[name="fieldName"]');
    input.value = '未保存の畑';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const originalConfirm = window.confirm;
    window.confirm = () => false;
    setRole('neighbor');
    const switchedWithDraft = activeRole === 'neighbor';
    setRole('sprayer');
    window.confirm = originalConfirm;
    const unsavedKept = switchedWithDraft && activeRole === 'sprayer' && input.value === '未保存の畑' && activeView === 'plans';
    const priorSession = supabaseSession;
    const priorMemberships = supabaseMemberships;
    const priorRuntime = supabaseRuntime;
    const priorFeedback = workspaceCreationFeedback;
    const priorWorkspace = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    supabaseSession = { user: { id: 'role-test' } };
    const workspace = { id: 'role-test-region', name: '笠間市テスト地域', prefecture: '茨城県', municipality: '笠間市', district: '動作確認用' };
    supabaseMemberships = [
      { workspace_id: 'role-test-region', role: 'sprayer', status: 'active', workspaces: workspace },
      { workspace_id: 'role-test-region', role: 'neighbor', status: 'active', workspaces: workspace },
      { workspace_id: 'other-region', role: 'admin', status: 'active' },
    ];
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, 'role-test-region');
    supabaseRuntime = { enabled: true };
    workspaceCreationFeedback = { workspaceId: 'role-test-region', name: '笠間市テスト地域' };
    renderSupabaseAccount();
    const workspaceFeedback = !document.querySelector('#activeWorkspaceCard').hidden
      && document.querySelector('#activeWorkspaceCard').innerText.includes('作成完了・現在の地域')
      && document.querySelector('#activeWorkspaceCard').innerText.includes('笠間市テスト地域')
      && document.querySelector('#activeWorkspaceCard').innerText.includes('散布者・周辺関係者');
    renderRoleSwitcher();
    const adminHidden = document.querySelector('#roleSwitcher [data-role="admin"]').hidden;
    setRole('admin');
    const unauthorizedBlocked = activeRole === 'sprayer';
    supabaseSession = priorSession;
    supabaseMemberships = priorMemberships;
    supabaseRuntime = priorRuntime;
    workspaceCreationFeedback = priorFeedback;
    if (priorWorkspace) localStorage.setItem(ACTIVE_WORKSPACE_KEY, priorWorkspace);
    else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    return { visible, neighbor, admin, sprayer, profileKept, selectionKept, unsavedKept, workspaceFeedback, adminHidden, unauthorizedBlocked };
  }`, { width, height: 960 });
  assert(JSON.stringify(result.value.visible) === '["sprayer","neighbor","admin"]', "Role buttons must be visible in normal mode");
  for (const key of ['neighbor', 'admin', 'sprayer', 'profileKept', 'selectionKept', 'unsavedKept', 'workspaceFeedback', 'adminHidden', 'unauthorizedBlocked']) {
    assert(result.value[key], `Role switching failed: ${key} at ${width}px`);
  }
  assert(result.errors.length === 0, `Role switching runtime errors: ${result.errors.join(', ')}`);
}
console.log("Registered role switching and membership boundaries verified.");

}

for (const width of [1440, 390]) {
  const result = await inspectPage("/app.html?role=sprayer#dashboard", `() => {
    const original = structuredClone(state);
    const originalConfirm = window.confirm;
    const outcome = {};
    try {
      outcome.navigation = [...document.querySelectorAll('.nav-list .nav-item, .mobile-quickbar [data-view-target]')].filter(n => n.getClientRects().length).map(n => n.dataset.viewTarget).sort();
      const otherId = activePlan().id;
      const otherBefore = JSON.stringify(planRepository.get(otherId));
      document.querySelector('#caseList [data-action="new-plan"]').click();
      const id = activePlan().id;
      outcome.created = id !== otherId && activeView === 'plans';
      const form = document.querySelector('#planForm');
      const next = form.querySelector('[data-next-step="notify"]');
      form.elements.pesticide.value = '';
      form.requestSubmit(next);
      outcome.invalidBlocked = activeView === 'plans';
      const fieldOption = [...form.elements.selectedFieldId.options].find(n => n.value);
      form.elements.selectedFieldId.value = fieldOption.value;
      form.elements.selectedFieldId.dispatchEvent(new Event('change', { bubbles: true }));
      for (const [key, value] of Object.entries({ pesticide: '検証用資材', purpose: '検証', operator: '検証用散布者', contact: '検証用連絡先' })) form.elements[key].value = value;
      form.requestSubmit(next);
      outcome.planSaved = activeView === 'notify' && activePlan().id === id && activePlan().fieldId === fieldOption.value;
      outcome.steps = document.querySelectorAll('#caseWorkflow .case-steps button').length;
      // A change must lead back to this case's notice, with the change wording.
      activePlan().notificationTargets = { 'review-target': true };
      activePlan().notificationAcks = { 'review-target': '2026-09-07' };
      activePlan().notificationResponses = { 'review-target': '確認しました' };
      const cancellation = document.querySelector('#caseWorkflow .cancellation-form');
      cancellation.elements.state.value = 'postponed';
      cancellation.elements.newDate.value = '2026-09-20';
      window.confirm = () => true;
      cancellation.querySelector('[data-action="save-cancellation"]').click();
      outcome.revisionReset = !activePlan().notificationTargets['review-target'] && !activePlan().notificationAcks['review-target'] && activePlan().noticeHistory.at(-1).acknowledgements['review-target'] === '2026-09-07' && activePlan().date === '2026-09-20';
      outcome.postponed = activeView === 'notify' && activePlan().id === id && document.querySelector('#noticeText').value.includes('延期');
      document.querySelector('#caseWorkflow [data-action="clear-cancellation"]').click();
      outcome.resumed = activeView === 'notify' && !activePlan().cancellation;
      document.querySelector('[data-view="notify"] [data-view-target="weather"]').click();
      const weather = document.querySelector('#weatherForm');
      weather.elements.actualSpeed.value = '1.2';
      weather.elements.weatherConfirmed.checked = true;
      document.querySelector('[data-save-weather-next]').click();
      outcome.weather = activeView === 'checklist' && activePlan().id === id && activePlan().weather.actualSpeed === 1.2;
      document.querySelector('[data-view="checklist"] [data-view-target="report"]').click();
      document.querySelector('#autoFillReportButton').click();
      outcome.draftOnly = !workRecordForPlan(activePlan()).doneDate;
      const report = document.querySelector('#reportForm');
      report.elements.reportNotes.value = '画面更新でも残す入力';
      report.elements.reportNotes.dispatchEvent(new Event('input', { bubbles: true }));
      renderAll();
      outcome.draftRetained = report.elements.reportNotes.value === '画面更新でも残す入力';
      report.elements.doneDate.value = '2026-09-07';
      const normalRepository = stateRepository;
      stateRepository = { ...normalRepository, save() { throw new Error('test save failure'); } };
      report.requestSubmit(report.querySelector('[data-next-step="dashboard"]'));
      outcome.failedSaveStays = activeView === 'report' && report.elements.doneDate.value === '2026-09-07';
      stateRepository = normalRepository;
      report.requestSubmit(report.querySelector('[data-next-step="dashboard"]'));
      outcome.report = activeView === 'dashboard' && activePlan().id === id && workRecordForPlan(activePlan()).doneDate === '2026-09-07';
      document.querySelector('[data-open-case="' + id + '"]').click();
      outcome.reopened = activeView === 'report' && document.querySelector('#reportForm').elements.doneDate.value === '2026-09-07';
      outcome.otherUnchanged = JSON.stringify(planRepository.get(otherId)) === otherBefore;
      outcome.overflow = document.documentElement.scrollWidth - innerWidth;
      outcome.currentCase = document.querySelector('#caseBar').innerText.includes('検証用資材');
      const boundaryState = structuredClone(state);
      const importedField = boundaryState.fields.find(field => field.id === 'spray-field-a');
      const actualBoundary = {type:'Polygon',coordinates:[[[140.31,36.38],[140.311,36.38],[140.311,36.381],[140.31,36.38]]]};
      importedField.geometry = actualBoundary;
      importedField.provenance = {source:'parcel-backdrop'};
      const preserved = normalizeState(boundaryState).fields.find(field => field.id === 'spray-field-a');
      outcome.importedBoundaryPreserved = JSON.stringify(preserved.geometry) === JSON.stringify(actualBoundary);
      outcome.unverifiedWaterHidden = !fieldFeatureCollection().features.some(feature => feature.id === 'water-channel-d');
      const originalMap = maplibregl.Map;
      const container = document.createElement('div');
      try {
        maplibregl.Map = class { constructor() { throw new Error('WebGL unavailable'); } };
        outcome.mapFallback = createMapSafely({ container }) === null && container.textContent.includes('一覧から操作');
      } finally { maplibregl.Map = originalMap; }
      return outcome;
    } finally {
      window.confirm = originalConfirm;
      state = normalizeState(original);
      saveState();
      renderAll();
    }
  }`, { width, height: 960 });
  assert(JSON.stringify(result.value.navigation) === '["dashboard","map","profile"]', `Default sprayer must have three navigation entries at ${width}px: ${JSON.stringify(result.value)}`);
  assert(result.value.steps === 4, "Case must have four steps");
  for (const key of ['created', 'invalidBlocked', 'planSaved', 'postponed', 'revisionReset', 'resumed', 'draftRetained', 'mapFallback', 'weather', 'draftOnly', 'failedSaveStays', 'report', 'reopened', 'otherUnchanged', 'currentCase', 'importedBoundaryPreserved', 'unverifiedWaterHidden']) {
    assert(result.value[key], `Case workflow failed: ${key} at ${width}px: ${JSON.stringify(result.value)}`);
  }
  assert(result.value.overflow <= 0, "Case workflow overflows viewport");
  assert(result.errors.length === 0, `Case workflow errors: ${result.errors.join(', ')}`);
}
console.log("One-case registration, changes, weather, and report flow verified.");
