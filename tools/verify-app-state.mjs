// Phase 1 migration smoke test: drives the real app over CDP and checks the
// versioned storage envelope, plan->field resolution, and geometry-based
// distances against a live browser.
//
// Usage: start a local server and a Chrome with --remote-debugging-port, then
//   node tools/verify-app-state.mjs [baseUrl] [debugPort]
// Defaults match tools/verify-pages.mjs (http://127.0.0.1:4177, port 9238).

const baseUrl = process.argv[2] || "http://127.0.0.1:4177";
const port = process.argv[3] || "9238";

const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
if (!targetResponse.ok) throw new Error("Could not create browser target");
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const runtimeErrors = [];
let messageId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    const description = details.exception?.description || details.text;
    runtimeErrors.push(`${description}${details.url ? ` (${details.url}:${details.lineNumber + 1})` : ""}`);
  }
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

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function open(path, waitMs = 4200) {
  await command("Page.navigate", { url: `${baseUrl}${path}` });
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await command("Runtime.enable");
await command("Page.enable");

// --- scenario 1: fresh sample boot (includes startup municipality load) ---
await open("/app.html");
await evaluate("localStorage.clear()");
await open("/app.html?role=sprayer#dashboard");
const fresh = await evaluate(`(() => {
  const plans = Object.fromEntries(state.plans.map((p) => [p.id, { fieldId: p.fieldId, source: p.fieldIdSource }]));
  const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const fieldsOk = state.fields.every((f) =>
    f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
    && f.geometryRevision && f.provenance?.stableKey && Array.isArray(f.externalRefs));
  const risks = riskItemsForPlan(activePlan());
  const organic = risks.find((r) => r.id === "organic-field-a");
  const badLabel = risks.find((r) => /null|undefined|NaN/.test(String(r.distanceLabel)));
  const plan2 = state.plans.find((p) => p.id === "plan-drone-2");
  const g2 = sprayGoNoGo(plan2);
  const reasons2 = adminAttentionReasons(plan2);
  const importSmoke = domainImport.buildFieldsFromFeatures([{
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[140, 36], [140.001, 36], [140.001, 36.001], [140, 36.001], [140, 36]]] },
    properties: { name: "Browser import", type: "spray", id: "browser-import-1" },
  }], { sourceCode: "file:browser-smoke", provider: domainImport.PROVIDER_IDS.FILE }, { now: () => "2026-07-21T00:00:00.000Z" });
  return {
    fieldIds: state.fields.map((f) => f.id),
    plans,
    schemaVersion: envelope?.schemaVersion,
    revision: envelope?.revision,
    repositoryRevision: stateRepository.currentRevision(),
    fieldsOk,
    riskCount: risks.length,
    organicDistance: organic ? organic.distance : "absent",
    badLabel: badLabel ? badLabel.distanceLabel : null,
    noticeHasUndefined: buildNoticeText(activePlan(), "line").includes("undefined"),
    plan2Verdict: g2.verdict,
    plan2Factor: g2.factors.find((f) => f.label === "風下の要確認圃場")?.detail,
    plan2Reason: reasons2[0]?.title,
    importOk: importSmoke.ok,
    importProvider: importSmoke.fields?.[0]?.externalRefs?.[0]?.provider,
    reservedProviders: [domainImport.PROVIDER_IDS.XARVIO, domainImport.PROVIDER_IDS.WAGRI],
  };
})()`);

assert(fresh.fieldIds.includes("spray-field-a") && fresh.fieldIds.includes("organic-field-a"),
  `demo field ids not preserved through startup boundary load: ${fresh.fieldIds.join(", ")}`);
assert(fresh.plans["plan-drone-1"]?.fieldId === "spray-field-a", `plan1 fieldId: ${JSON.stringify(fresh.plans["plan-drone-1"])}`);
assert(fresh.plans["plan-drone-2"]?.fieldId === null, `plan2 must stay unresolved: ${JSON.stringify(fresh.plans["plan-drone-2"])}`);
assert(fresh.plans["plan-drone-3"]?.fieldId === "spray-field-a", `plan3 fieldId: ${JSON.stringify(fresh.plans["plan-drone-3"])}`);
assert(fresh.schemaVersion === 4 && fresh.revision >= 1, `envelope not saved: v${fresh.schemaVersion} r${fresh.revision}`);
assert(fresh.repositoryRevision === fresh.revision,
  `repository revision ${fresh.repositoryRevision} does not match envelope ${fresh.revision}`);
assert(fresh.fieldsOk, "some field is missing canonical geometry / provenance / externalRefs");
assert(fresh.riskCount >= 3, `expected surrounding risk items, got ${fresh.riskCount}`);
assert(Number.isFinite(fresh.organicDistance) && fresh.organicDistance > 0 && fresh.organicDistance < 1000,
  `organic field distance not geometry-based: ${fresh.organicDistance}`);
assert(fresh.badLabel === null, `broken distance label: ${fresh.badLabel}`);
assert(!fresh.noticeHasUndefined, "notice text contains 'undefined'");
assert(fresh.plan2Verdict === "stop", `unresolved plan verdict should be stop, got ${fresh.plan2Verdict}`);
assert(String(fresh.plan2Factor).includes("参照切れ"), `unresolved plan factor: ${fresh.plan2Factor}`);
assert(fresh.plan2Reason === "散布ほ場参照切れ", `unresolved plan admin reason: ${fresh.plan2Reason}`);
assert(fresh.importOk && fresh.importProvider === "file", `browser import module failed: ${JSON.stringify(fresh)}`);
assert(fresh.reservedProviders.join(",") === "xarvio,wagri", `provider ids: ${fresh.reservedProviders.join(",")}`);

// The real municipality Shapefile ZIP exercises shpjs, PRJ inspection, and
// service-level parsing without mutating the active map state.
const municipalityZip = await evaluate(`(async () => {
  const entry = boundaryCatalog.find((item) => item.code === "08216");
  if (!entry) return { missing: true };
  const loaded = await boundaryIOService.fetchBoundaryEntry(entry, shapefileTools());
  return {
    count: loaded.features.length,
    format: loaded.format,
    originalCrs: loaded.originalCrs,
  };
})()`);
assert(!municipalityZip.missing, "Kasama municipality ZIP is missing from the boundary catalog");
assert(municipalityZip.format === "shapefile" && municipalityZip.count > 400,
  `municipality ZIP was not parsed: ${JSON.stringify(municipalityZip)}`);
assert(String(municipalityZip.originalCrs).includes("EPSG:4326"),
  `municipality ZIP CRS was not confirmed: ${municipalityZip.originalCrs}`);

// --- scenario 1b: forecast retrieval never completes human/onsite checks --
const weather = await evaluate(`(async () => {
  const plan = activePlan();
  plan.checks.weatherForecast = false;
  plan.checks.weatherEnv = false;
  plan.checks.wind = false;
  plan.weather.actualSpeed = "";
  plan.weather.measuredAt = "";
  plan.weather.measuredPlace = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!String(url).startsWith("https://api.open-meteo.com/")) return originalFetch(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        current: {
          time: plan.date + "T05:45",
          temperature_2m: 20,
          relative_humidity_2m: 70,
          precipitation: 0,
          wind_speed_10m: 1,
          wind_direction_10m: 0,
          wind_gusts_10m: 2,
        },
        hourly: {
          time: [plan.date + "T05:00", plan.date + "T06:00", plan.date + "T07:00"],
          temperature_2m: [19, 21, 22],
          relative_humidity_2m: [75, 68, 65],
          precipitation_probability: [10, 55, 20],
          precipitation: [0, 0.2, 0],
          wind_speed_10m: [1, 2.3, 3],
          wind_direction_10m: [0, 90, 180],
          wind_gusts_10m: [2, 4.5, 5],
        },
      }),
    };
  };
  try {
    await fetchWeatherForecast();
  } finally {
    globalThis.fetch = originalFetch;
  }
  return {
    source: plan.weather.source,
    target: plan.weather.forecastTargetTime,
    speed: plan.weather.forecastSpeed,
    forecastChecked: plan.checks.weatherForecast,
    humanChecked: plan.checks.weatherEnv,
    onsiteChecked: plan.checks.wind,
    actualSpeed: plan.weather.actualSpeed,
  };
})()`);
assert(weather.source === "Open-Meteo Forecast API", `weather source: ${weather.source}`);
assert(String(weather.target).endsWith("T06:00"), `weather target: ${weather.target}`);
assert(weather.speed === 2.3 && weather.forecastChecked, `weather forecast was not stored: ${JSON.stringify(weather)}`);
assert(!weather.humanChecked && !weather.onsiteChecked && !weather.actualSpeed,
  `forecast retrieval completed a human/onsite check: ${JSON.stringify(weather)}`);

// --- scenario 1c: browser exports retain their real filenames and content --
const exports = await evaluate(`(async () => {
  const blobs = new Map();
  const downloads = [];
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  const originalPrint = window.print;
  let objectId = 0;
  let printCalls = 0;
  URL.createObjectURL = (blob) => {
    const url = "blob:export-smoke-" + (++objectId);
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {
    downloads.push({ filename: this.download, blob: blobs.get(this.href) });
  };
  window.print = () => { printCalls += 1; };
  try {
    exportCsv();
    exportHistoryCsv();
    if (!activePlan().prescription) createPrescription();
    exportPrescriptionGeoJSON();
    printDocument("precheck");
    const files = [];
    for (const item of downloads) {
      const bytes = item.blob ? Array.from(new Uint8Array(await item.blob.arrayBuffer()).slice(0, 3)) : [];
      files.push({
        filename: item.filename,
        type: item.blob?.type,
        text: item.blob ? await item.blob.text() : "",
        bytes,
      });
    }
    const printText = document.querySelector("#printSheet")?.textContent || "";
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      files,
      printCalls,
      printRestored: !document.body.classList.contains("printing"),
      printHidden: document.querySelector("#printSheet")?.getAttribute("aria-hidden"),
      printText,
    };
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalClick;
    window.print = originalPrint;
  }
})()`);
const planCsv = exports.files.find((file) => file.filename.startsWith("tonari-hatake-safety-"));
const historyCsv = exports.files.find((file) => file.filename.startsWith("tonari-hatake-history-"));
const prescriptionGeoJson = exports.files.find((file) => file.filename.startsWith("tonari-hatake-rx-"));
assert(planCsv?.filename.endsWith(".csv") && planCsv.type === "text/csv;charset=utf-8",
  `plan CSV metadata: ${JSON.stringify(planCsv)}`);
assert(planCsv.bytes.join(",") === "239,187,191" && planCsv.text.includes('"日付","時間","地区"'),
  "plan CSV lost its BOM or header");
assert(historyCsv?.text.includes('"資材種別","資材名"') && historyCsv.text.includes("農薬"),
  "history CSV lost its material columns or data");
assert(prescriptionGeoJson?.type === "application/geo+json;charset=utf-8",
  `prescription GeoJSON metadata: ${JSON.stringify(prescriptionGeoJson)}`);
assert(JSON.parse(prescriptionGeoJson.text).type === "FeatureCollection",
  "prescription export is not a GeoJSON FeatureCollection");
assert(exports.printCalls === 1 && exports.printRestored && exports.printHidden === "true",
  `print lifecycle failed: ${JSON.stringify(exports)}`);
assert(exports.printText.includes("農薬散布前 確認記録"), "precheck print content was not built");

// --- scenario 1d: plan and field UI writes use the entity repositories ----
const entityRepositories = await evaluate(`(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const initialPlans = planRepository.list().length;
  const initialFields = fieldRepository.list().length;

  document.querySelector("#newPlanButton").click();
  await wait(100);
  const createdPlanId = state.activePlanId;
  const planForm = document.querySelector("#planForm");
  planForm.elements.pesticide.value = "Repository確認用資材";
  planForm.requestSubmit();
  await wait(100);

  document.querySelector("#newFieldStatusButton").click();
  await wait(100);
  const createdFieldId = state.activeFieldId;
  const fieldForm = document.querySelector("#fieldStatusForm");
  fieldForm.elements.name.value = "Repository確認用圃場";
  document.querySelector("#saveFieldStatusButton").click();
  await wait(100);

  const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY));
  return {
    planCount: planRepository.list().length,
    fieldCount: fieldRepository.list().length,
    createdPlanId,
    createdFieldId,
    planMaterial: planRepository.get(createdPlanId)?.pesticide,
    fieldName: fieldRepository.get(createdFieldId)?.name,
    persistedPlan: envelope.data.plans.find((plan) => plan.id === createdPlanId)?.pesticide,
    persistedField: envelope.data.fields.find((field) => field.id === createdFieldId)?.name,
    repositoryRevision: stateRepository.currentRevision(),
    envelopeRevision: envelope.revision,
    initialPlans,
    initialFields,
  };
})()`);
assert(entityRepositories.planCount === entityRepositories.initialPlans + 1,
  `plan repository did not insert from UI: ${JSON.stringify(entityRepositories)}`);
assert(entityRepositories.fieldCount === entityRepositories.initialFields + 1,
  `field repository did not insert from UI: ${JSON.stringify(entityRepositories)}`);
assert(entityRepositories.planMaterial === "Repository確認用資材"
  && entityRepositories.persistedPlan === entityRepositories.planMaterial,
  `plan repository update was not persisted: ${JSON.stringify(entityRepositories)}`);
assert(entityRepositories.fieldName === "Repository確認用圃場"
  && entityRepositories.persistedField === entityRepositories.fieldName,
  `field repository update was not persisted: ${JSON.stringify(entityRepositories)}`);
assert(entityRepositories.repositoryRevision === entityRepositories.envelopeRevision,
  `entity repository save revision mismatch: ${JSON.stringify(entityRepositories)}`);

// --- scenario 1e: notification UI writes use the notification repository ---
const notificationRepositories = await evaluate(`(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const plan = planRepository.get("plan-drone-1");
  state.activePlanId = plan.id;
  plan.notificationTargets = {};
  plan.notificationResponses = {};
  planRepository.save(plan);
  saveState();
  renderAll();
  switchView("notify");
  await wait(100);

  const target = document.querySelector("[data-notify-target]");
  if (!target) return { missingTarget: true };
  const fieldId = target.dataset.notifyTarget;
  target.checked = true;
  document.querySelector("#markNotifiedButton").click();
  await wait(100);

  const response = [...document.querySelectorAll("[data-notify-response]")]
    .find((select) => select.dataset.notifyResponse === fieldId);
  if (!response) return { missingResponse: true, fieldId };
  response.value = "時間変更希望";
  response.dispatchEvent(new Event("change", { bubbles: true }));
  await wait(100);

  const record = notificationRepository.listByPlan(plan.id)
    .find((item) => item.fieldId === fieldId);
  const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const persistedPlan = envelope.data.plans.find((item) => item.id === plan.id);
  return {
    fieldId,
    record,
    persistedDelivered: persistedPlan.notificationTargets[fieldId],
    persistedResponse: persistedPlan.notificationResponses[fieldId],
    repositoryRevision: stateRepository.currentRevision(),
    envelopeRevision: envelope.revision,
  };
})()`);
assert(!notificationRepositories.missingTarget && !notificationRepositories.missingResponse,
  `notification UI target missing: ${JSON.stringify(notificationRepositories)}`);
assert(notificationRepositories.record?.delivered
  && notificationRepositories.record?.response === "時間変更希望",
  `notification repository was not updated from UI: ${JSON.stringify(notificationRepositories)}`);
assert(notificationRepositories.persistedDelivered === true
  && notificationRepositories.persistedResponse === "時間変更希望",
  `notification UI update was not persisted: ${JSON.stringify(notificationRepositories)}`);
assert(notificationRepositories.repositoryRevision === notificationRepositories.envelopeRevision,
  `notification repository revision mismatch: ${JSON.stringify(notificationRepositories)}`);

// --- scenario 1f: report UI writes feed work history and admin state ---
const workRecordRepositories = await evaluate(`(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const plan = planRepository.get("plan-drone-1");
  state.activePlanId = plan.id;
  workRecordRepository.save({
    ...workRecordRepository.get(plan.id),
    doneDate: "",
    doneTime: "",
    actualAmount: "",
    inquiry: "なし",
  });
  saveState();
  renderAll();
  switchView("report");
  await wait(100);

  const form = document.querySelector("#reportForm");
  if (!form) return { missingForm: true };
  form.elements.doneDate.value = "2026-07-23";
  form.elements.doneTime.value = "06:45";
  form.elements.doneField.value = "作業記録Repository確認ほ場";
  form.elements.donePesticide.value = "作業記録Repository確認資材";
  form.elements.doneArea.value = "1.25ha";
  form.elements.doneWeather.value = "北西 1.8m/s";
  form.elements.incident.value = "なし";
  form.elements.inquiry.value = "なし";
  form.elements.reportType.value = "通常報告";
  form.elements.actualAmount.value = "725mL/10a";
  form.elements.altitudeNotes.value = "高度差なし";
  form.elements.outsideFlight.value = "なし";
  form.elements.reportNotes.value = "Repository経由の保存確認";
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await wait(100);

  const record = workRecordRepository.get(plan.id);
  const history = historyRecords().find((item) => item.id === plan.id);
  const fact = dashboardPlanFact(plan);
  const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const persistedPlan = envelope.data.plans.find((item) => item.id === plan.id);
  return {
    record,
    history,
    reportDone: fact.reportDone,
    persistedReport: persistedPlan.report,
    persistedCheck: persistedPlan.checks.report,
    repositoryRevision: stateRepository.currentRevision(),
    envelopeRevision: envelope.revision,
  };
})()`);
assert(!workRecordRepositories.missingForm,
  `report form missing: ${JSON.stringify(workRecordRepositories)}`);
assert(workRecordRepositories.record?.doneDate === "2026-07-23"
  && workRecordRepositories.record?.actualAmount === "725mL/10a",
  `work-record repository was not updated from UI: ${JSON.stringify(workRecordRepositories)}`);
assert(workRecordRepositories.history?.done
  && workRecordRepositories.history?.field === "作業記録Repository確認ほ場"
  && workRecordRepositories.history?.rate.startsWith("725mL/10a"),
  `work history did not use the repository record: ${JSON.stringify(workRecordRepositories)}`);
assert(workRecordRepositories.reportDone && workRecordRepositories.persistedCheck,
  `admin/report completion state was not updated: ${JSON.stringify(workRecordRepositories)}`);
assert(workRecordRepositories.persistedReport?.reportNotes === "Repository経由の保存確認",
  `work record was not persisted: ${JSON.stringify(workRecordRepositories)}`);
assert(workRecordRepositories.repositoryRevision === workRecordRepositories.envelopeRevision,
  `work-record repository revision mismatch: ${JSON.stringify(workRecordRepositories)}`);

// --- scenario 2: legacy bare v3 blob migrates in place -------------------
await evaluate(`(() => {
  const legacy = {
    role: "sprayer",
    legacyMarker: { keep: true },
    activePlanId: "plan-legacy-1",
    fields: [
      { id: "spray-field-a", type: "spray", name: "笠間デモほ場A", short: "散布",
        geo: [[140.312185, 36.387676], [140.313201, 36.387447], [140.313059, 36.386499], [140.312043, 36.386695]],
        distance: 0, direction: "中心", notifyTarget: false, owner: "自分" },
      { id: "organic-field-a", type: "organic", name: "農薬不使用ほ場B", short: "農薬不使用",
        geo: [[140.311434, 36.388755], [140.312591, 36.388526], [140.312449, 36.387644], [140.311312, 36.387856]],
        distance: 120, direction: "北", notifyTarget: true, owner: "周辺農家" },
    ],
    plans: [
      { id: "plan-legacy-1", date: "2026-07-20", timeWindow: "06:00-07:30", fieldName: "笠間デモほ場A",
        district: "笠間市周辺デモ", crop: "水稲", pesticide: "サンプル", report: {} },
      { id: "plan-legacy-2", date: "2026-07-21", timeWindow: "08:00-09:00", fieldName: "存在しないほ場",
        district: "笠間市周辺デモ", crop: "大豆", pesticide: "サンプル", report: {} },
    ],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
})()`);
await open("/app.html#dashboard");
const legacy = await evaluate(`(() => {
  const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const p1 = state.plans.find((p) => p.id === "plan-legacy-1");
  const p2 = state.plans.find((p) => p.id === "plan-legacy-2");
  return {
    migratedFrom: state.migratedFrom,
    markerKept: state.legacyMarker?.keep === true,
    schemaVersion: envelope?.schemaVersion,
    revision: envelope?.revision,
    p1FieldId: p1?.fieldId,
    p1Source: p1?.fieldIdSource,
    p2FieldId: p2 ? p2.fieldId : "missing-plan",
    p2Resolved: p2 ? planFieldResolution(p2).resolved : "missing-plan",
  };
})()`);

assert(legacy.migratedFrom === "v3", `migratedFrom: ${legacy.migratedFrom}`);
assert(legacy.markerKept, "legacy custom key was dropped by migration");
assert(legacy.schemaVersion === 4 && legacy.revision >= 1, `legacy envelope: v${legacy.schemaVersion} r${legacy.revision}`);
// The name migration links plan1 first; the startup boundary load may then
// re-point the active plan to the same demo field with source boundary-import.
assert(legacy.p1FieldId === "spray-field-a" && ["name", "boundary-import"].includes(legacy.p1Source),
  `legacy plan1: ${legacy.p1FieldId} / ${legacy.p1Source}`);
assert(legacy.p2FieldId === null && legacy.p2Resolved === false, `legacy plan2 must stay unresolved: ${legacy.p2FieldId}`);

// --- scenario 3: admin sees the unresolved plan flagged ------------------
await evaluate("localStorage.clear()");
await open("/app.html?role=admin#admin");
const admin = await evaluate(`(() => ({
  rows: document.querySelectorAll("#adminTableBody tr.admin-row").length,
  flagged: document.querySelector("#adminDetailInfo")?.textContent.includes("散布ほ場参照切れ") || false,
  view: document.querySelector(".view.active")?.id || location.hash,
}))()`);
assert(admin.rows === 4, `admin table rows: ${admin.rows}`);
assert(admin.flagged, "admin detail does not flag the unresolved sample plan");

// --- scenario 4: every sprayer view renders, including with the unresolved
// plan active (reference-error path must not crash any renderer) ------------
await evaluate("localStorage.clear()");
await open("/app.html?role=sprayer#dashboard");
const sweep = await evaluate(`(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visited = [];
  for (const view of allowedViewsForCurrentMode()) {
    switchView(view);
    await wait(350);
    visited.push(document.querySelector(".view.active")?.dataset.view === view ? view : view + "!MISSING");
  }
  state.activePlanId = "plan-drone-3";
  const activeCoverage = coverageMapData(activePlan());
  state.activePlanId = "plan-drone-2";
  saveState();
  renderAll();
  const unresolvedVisited = [];
  for (const view of ["dashboard", "plans", "map", "notify", "drone", "report"]) {
    switchView(view);
    await wait(350);
    unresolvedVisited.push(view);
  }
  const coverage = estimateCoverage(activePlan());
  return {
    visited,
    unresolvedVisited,
    coverageHasLog: coverage.hasLog,
    activeCoverageCells: activeCoverage?.cells?.features?.length || 0,
    activeCoverageMarkers: activeCoverage?.marker?.features?.length || 0,
  };
})()`);
assert(!sweep.visited.some((v) => v.endsWith("!MISSING")), `view sweep failed: ${sweep.visited.join(", ")}`);
assert(sweep.activeCoverageCells > 0, "active spray plan did not produce coverage map cells");
assert(sweep.activeCoverageMarkers === 1, "active spray plan did not produce one coverage marker");
assert(sweep.coverageHasLog === false, "unresolved plan should report no coverage instead of a broken grid");

// --- scenario 5: neighbor views render -----------------------------------
await evaluate("localStorage.clear()");
await open("/app.html?role=neighbor#dashboard");
const neighborSweep = await evaluate(`(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visited = [];
  for (const view of allowedViewsForCurrentMode()) {
    switchView(view);
    await wait(350);
    visited.push(document.querySelector(".view.active")?.dataset.view === view ? view : view + "!MISSING");
  }
  return { visited };
})()`);
assert(!neighborSweep.visited.some((v) => v.endsWith("!MISSING")), `neighbor sweep failed: ${neighborSweep.visited.join(", ")}`);

await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`, { method: "PUT" });
socket.close();

const fatal = runtimeErrors.filter((text) => text && !text.includes("favicon"));
if (fatal.length) throw new Error(`Runtime errors: ${fatal.join(" | ")}`);
console.log("App state migration checks passed.");
