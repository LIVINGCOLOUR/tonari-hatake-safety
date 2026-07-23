const baseUrl = process.argv[2] || "http://127.0.0.1:4177";
const port = process.argv[3] || "9238";

async function inspectPage(path, expression, viewport = { width: 1440, height: 960 }, waitMs = 1800) {
  const url = `${baseUrl}${path}`;
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Could not create target for ${url}`);
  const target = await targetResponse.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let messageId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
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

const landingDesktop = await inspectPage("/", `() => ({
  title: document.title,
  imageFailures: [...document.images].filter((image) => !image.complete || !image.naturalWidth).map((image) => image.src),
  overflow: document.documentElement.scrollWidth - innerWidth,
  roleLinks: [...document.querySelectorAll('.role-card a')].map((link) => link.getAttribute('href')),
  featureLinks: [...document.querySelectorAll('.feature-item a')].map((link) => link.getAttribute('href')),
})`);
assert(landingDesktop.value.title.includes("となり畑セーフティ"), "Landing page title is missing");
assert(landingDesktop.value.imageFailures.length === 0, `Broken landing images: ${landingDesktop.value.imageFailures.join(", ")}`);
assert(landingDesktop.value.overflow <= 0, `Desktop landing page overflows by ${landingDesktop.value.overflow}px`);
assert(landingDesktop.value.roleLinks.length === 3, "Landing page must expose all three role demos");
assert(landingDesktop.value.featureLinks.length === 4, "Landing page must expose all four planned capabilities");
assert(landingDesktop.value.featureLinks.every((href) => href?.startsWith("app.html?role=sprayer#")), "Capability links must open an available sprayer demo view");
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
  sprayer: ["プロフィール登録", "トップ", "散布計画", "圃場マップ", "気象メモ", "近隣通知", "散布前チェック", "ドローン連携", "実施後報告"],
  neighbor: ["プロフィール登録", "トップ", "圃場マップ", "圃場ステータス", "近隣通知"],
  admin: ["プロフィール登録", "トップ", "散布予定・実績"],
};

for (const [role, expected] of Object.entries(expectedNavigation)) {
  const result = await inspectPage(`/app.html?role=${role}#dashboard`, `() => ({
    role: document.querySelector('.role-option.active span')?.textContent.trim(),
    navigation: [...document.querySelectorAll('.nav-item')]
      .filter((item) => getComputedStyle(item).display !== 'none')
      .map((item) => item.querySelector('span:last-child')?.textContent.trim()),
    overflow: document.documentElement.scrollWidth - innerWidth,
  })`, { width: 1440, height: 960 }, 3500);
  const expectedRoleLabel = { sprayer: "散布者", neighbor: "周辺農家", admin: "地域管理" }[role];
  assert(result.value.role === expectedRoleLabel, `${role} demo opened as ${result.value.role}`);
  assert(JSON.stringify(result.value.navigation) === JSON.stringify(expected), `${role} navigation mismatch: ${result.value.navigation.join(" / ")}`);
  assert(result.value.overflow <= 0, `${role} app overflows by ${result.value.overflow}px`);
  assert(result.errors.length === 0, `${role} runtime errors: ${result.errors.join(", ")}`);
}

const legacyRedirect = await inspectPage("/#dashboard", `() => location.pathname`);
assert(
  legacyRedirect.value.endsWith("/app.html") || legacyRedirect.value.endsWith("/app"),
  `Legacy dashboard URL did not redirect: ${legacyRedirect.value}`,
);

console.log("Landing and role navigation checks passed.");
