const STORAGE_KEY = "tonariHatakeSafetyMvp.v3.coverage";

const VIEW_META = {
  profile: ["初期設定・プロフィール", "利用区分、対象市町村、公開範囲"],
  dashboard: ["トップダッシュボード", "地域内の散布予定と確認状況"],
  plans: ["散布計画登録", "散布前に必要な情報を記録"],
  map: ["圃場マップ", "散布ほ場・周辺圃場・飛行ログ"],
  fields: ["圃場ステータス", "農薬使用状況と通知希望"],
  drone: ["ドローン連携", "飛行ログと散布実績の確認"],
  notify: ["近隣通知", "通知文と通知履歴"],
  checklist: ["散布前チェック", "確認進捗と未完了項目"],
  weather: ["気象メモ", "風向・風速の記録"],
  report: ["実施後報告", "実施内容と問い合わせ記録"],
  history: ["作業履歴", "圃場ごとの散布・施肥履歴"],
  admin: ["散布予定・実績", "地域内の散布予定・実績一覧"],
  sources: ["データソース", "根拠資料とMVP範囲"],
};

const ROLE_META = {
  sprayer: {
    label: "散布者",
    title: "今日の散布前に必要な確認",
    note: "未完了タスクと次に必要な対応を先に確認します。",
  },
  neighbor: {
    label: "周辺農家",
    title: "あなたに関係する散布通知",
    note: "自分の圃場、未返信通知、公開範囲を確認します。",
  },
  admin: {
    label: "地域管理",
    title: "散布予定・実績の確認",
    note: "地域内で誰が、いつ、どこに、何を散布する／したかを一覧から確認します。",
  },
};

const ROLE_ALLOWED_VIEWS = {
  sprayer: ["dashboard", "plans", "map", "drone", "notify", "checklist", "weather", "report", "history", "profile"],
  neighbor: ["dashboard", "map", "fields", "notify", "profile"],
  admin: ["dashboard", "admin", "profile"],
};

const DEMO_ALLOWED_VIEWS = Object.keys(VIEW_META);

const PROFILE_ROLE_LABELS = {
  sprayer: "散布者",
  neighbor: "周辺農家",
  admin: "地域管理",
};

const CONTACT_METHOD_LABELS = {
  phone: "電話",
  line: "LINE",
  email: "メール",
  paper: "紙",
};

const VISIBILITY_OPTIONS = [
  ["private", "非公開"],
  ["selfOnly", "自分のみ"],
  ["notificationTargetsOnly", "通知対象のみ"],
  ["relatedOnly", "関係者限定"],
  ["managerOnly", "地域管理者まで"],
  ["municipalityJa", "自治体・JA共有"],
];

const PREFERRED_BOUNDARY_NAMES = ["友部", "笠間市", "水戸市", "石岡市", "つくば市", "益子町", "真岡市", "香取市", "成田市"];
const DEFAULT_BOUNDARY_MUNICIPALITY = "082163b";

const EQUIPMENT_FIELDS = [
  "droneModel", "aircraftRegistration", "pilot", "assistant",
  "sprayDevice", "nozzle", "plannedAltitude", "plannedSpeed", "sprayWidthM",
];

const DEFAULT_EQUIPMENT = {
  droneModel: "SDK対応予定機種A",
  aircraftRegistration: "DEMO-DRONE-001",
  pilot: "匿名操縦者",
  assistant: "匿名補助者",
  sprayDevice: "液剤散布装置A",
  nozzle: "中粒径ノズル",
  plannedAltitude: "作物上2m目安",
  plannedSpeed: "3.5m/s",
  sprayWidthM: "",
};

function equipmentTemplate() {
  return { ...DEFAULT_EQUIPMENT, ...profileEquipmentTemplate(), ...(state?.equipmentTemplate || {}) };
}

const MATERIAL_TYPES = ["農薬", "液体肥料・葉面散布", "その他資材"];

const MATERIAL_TERMS = {
  農薬: "農薬散布",
  "液体肥料・葉面散布": "肥料散布",
  その他資材: "資材散布",
};

const NOTICE_RESPONSE_OPTIONS = [
  "未回答",
  "確認しました",
  "時間変更希望",
  "電話希望",
  "収穫日につき要相談",
];

const DEFAULT_WEATHER_LOCATION = {
  latitude: 36.345,
  longitude: 140.304,
  label: "笠間市周辺デモ",
};

const CHECK_ITEMS = [
  {
    id: "label",
    title: "農薬ラベルを確認した",
    detail: "対象作物、使用時期、使用回数、周辺作物への注意事項を確認。",
  },
  {
    id: "amount",
    title: "使用量・希釈倍率を確認した",
    detail: "10a当たり使用量、希釈倍率、散布量を記録。",
  },
  {
    id: "organic",
    title: "周辺の農薬不使用ほ場を確認した",
    detail: "農薬不使用、有機JAS、影響回避希望の圃場と風下方向を確認。",
  },
  {
    id: "preharvest",
    title: "収穫時期の近い作物を確認した",
    detail: "収穫直前、育苗中、ハウス換気予定を確認。",
  },
  {
    id: "sensitive",
    title: "住宅・水源・養蜂等を確認した",
    detail: "公共施設、水路、養蜂、住宅地への配慮を記録。",
  },
  {
    id: "notice",
    title: "近隣通知を行った",
    detail: "通知先、通知内容、通知日時を記録。",
  },
  {
    id: "wind",
    title: "現地実測の風向・風速を記録した",
    detail: "散布直前の実測値、測定場所、測定者を記録。",
  },
  {
    id: "weatherForecast",
    title: "API予報を取得した",
    detail: "Open-Meteo等の予報値、対象時刻、取得時刻を記録。",
  },
  {
    id: "weatherEnv",
    title: "散布者が気象条件を確認した",
    detail: "予報と現地実測を見た上で、散布者が確認済みにした記録。",
  },
  {
    id: "aircraft",
    title: "機体登録記号を確認した",
    detail: "機体、操縦者、補助者、散布装置を確認。",
  },
  {
    id: "dips",
    title: "DIPS飛行計画を確認した",
    detail: "V1では確認記録のみ。API連携は後続。",
  },
  {
    id: "flightLog",
    title: "ドローンログ取込設定を確認した",
    detail: "飛行ルート、高度、散布ON/OFFログの取得準備を確認。",
  },
  {
    id: "altitude",
    title: "飛行高度予定を確認した",
    detail: "GPS高度、地表基準高度、作物上推定高度の扱いを確認。",
  },
  {
    id: "postpone",
    title: "強風時は延期する判断基準を確認した",
    detail: "風速目安を超える場合の時間変更先を確認。",
  },
  {
    id: "equipment",
    title: "散布装置の点検を行った",
    detail: "ノズル、タンク、飛行経路、周辺立入を確認。",
  },
  {
    id: "report",
    title: "実施後報告を行う",
    detail: "実施日時、気象、異常有無、問い合わせを残す。",
  },
];

const SOURCES = [
  {
    title: "農林水産省：農薬の使用に伴う事故・被害",
    body: "農薬使用に伴う事故・被害の発生状況を確認するための参照資料。",
    url: "https://www.maff.go.jp/j/press/syouan/nouyaku/260130.html",
  },
  {
    title: "農林水産省：無人航空機による農薬等の空中散布",
    body: "無人航空機による空中散布に関する情報を確認するための参照資料。",
    url: "https://www.maff.go.jp/j/syouan/syokubo/gaicyu/g_kouku_zigyo/muzinkoukuuki.html",
  },
  {
    title: "茨城県：農業支援サービス事業",
    body: "補助金・実証相談時の事業整理に使う参照資料。",
    url: "https://www.pref.ibaraki.jp/nourinsuisan/sansin/shushi/nougyoushiennservice.html",
  },
  {
    title: "MVP表示方針",
    body: "法的な判定や原因断定ではなく、未確認・要確認・記録不足として表示。",
    url: "",
  },
];

const DEFAULT_SETTINGS = {
  regionName: "笠間市周辺を想定した実証デモ",
  managerName: "地域管理者",
  organicRadius: 300,
  notifyRadius: 360,
  sensitiveRadius: 300,
  windCaution: 2.5,
  windLimit: 3,
  noticeDeadlineDays: 1,
  reportDeadlineDays: 1,
  sharingScope: "関係者限定",
};

const ADMIN_REGION_OPTIONS = [
  { prefecture: "茨城県", municipalities: ["笠間市", "水戸市", "石岡市", "つくば市"] },
  { prefecture: "栃木県", municipalities: ["益子町", "真岡市"] },
  { prefecture: "千葉県", municipalities: ["香取市", "成田市"] },
];

function defaultProfile() {
  return {
    registered: false,
    role: null,
    name: "",
    organizationName: "",
    municipality: "",
    district: "",
    addressDetail: "",
    phone: "",
    email: "",
    preferredContactMethod: "phone",
    affiliation: "",
    targetMunicipalities: [],
    visibility: {
      name: "relatedOnly",
      phone: "notificationTargetsOnly",
      addressDetail: "private",
      fieldLocation: "relatedOnly",
      cropStatus: "relatedOnly",
      notificationReplies: "relatedOnly",
    },
    sprayer: {
      defaultMethod: "ドローン",
      drones: [],
      defaultDroneId: null,
      droneModel: "",
      aircraftRegistration: "",
      remoteId: "",
      defaultPilot: "",
      defaultAssistant: "",
      defaultSprayDevice: "",
      defaultNozzle: "",
      defaultAltitude: "",
      defaultSpeed: "",
      logImportMethod: "sample",
    },
    neighbor: {
      notificationPreference: "nearbyAndDownwind",
      contactTimeNote: "",
      defaultFieldId: null,
      defaultCultivation: "農薬使用なし",
    },
    admin: {
      organizationType: "",
      managedMunicipalities: [],
      managedDistricts: [],
      ruleSetName: "",
      sharingScope: "関係者限定",
    },
    boundaryLoadStatus: {},
  };
}

const FIELD_TYPE_META = {
  spray: ["散布ほ場", "spray"],
  organic: ["有機ほ場", "organic"],
  noChemical: ["農薬不使用", "organic"],
  house: ["ハウス", "house"],
  preharvest: ["収穫直前", "preharvest"],
  water: ["水源・水路", "water"],
  bee: ["養蜂", "bee"],
  public: ["公共施設", "public"],
};

const DIRECTION_OPPOSITE = {
  北: "南",
  北東: "南西",
  東: "西",
  南東: "北西",
  南: "北",
  南西: "北東",
  西: "東",
  北西: "南東",
};

const DIRECTION_ANGLE = {
  東: 0,
  南東: 45,
  南: 90,
  南西: 135,
  西: 180,
  北西: 225,
  北: 270,
  北東: 315,
};

const DIRECTION_BEARING = {
  北: 0,
  北東: 45,
  東: 90,
  南東: 135,
  南: 180,
  南西: 225,
  西: 270,
  北西: 315,
};

// デモの既定範囲（友部寄りの谷筋農地）。実境界を取り込むと自動でその範囲に切り替わる。
const DEMO_MAP_BOUNDS = {
  west: 140.3102,
  east: 140.3152,
  north: 36.3911,
  south: 36.3820,
};

const DEFAULT_MAP_VIEW = {
  center: [140.31275, 36.38655],
  zoom: 15.25,
  bearing: 0,
};

// 実際のほ場境界（geo付きフィールド）があればその外接範囲、無ければデモ既定範囲。
function currentMapBounds() {
  const geoFields = (state?.fields || []).filter((f) => Array.isArray(f.geo) && f.geo.length >= 3);
  if (!geoFields.length) return DEMO_MAP_BOUNDS;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  geoFields.forEach((f) =>
    f.geo.forEach(([lng, lat]) => {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }),
  );
  const padLng = (east - west) * 0.18 || 0.002;
  const padLat = (north - south) * 0.18 || 0.002;
  return { west: west - padLng, east: east + padLng, north: north + padLat, south: south - padLat };
}

const BEARING_DIRECTIONS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];

function bearingToDirection(bearingDeg) {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  return BEARING_DIRECTIONS[Math.round(normalized / 45) % 8];
}

const FIELD_LAYER_COLORS = {
  spray: "#c94b44",
  organic: "#2d8c49",
  noChemical: "#2d8c49",
  house: "#477bc0",
  preharvest: "#e3a329",
  water: "#3393bb",
  bee: "#8a6734",
  public: "#695faf",
};

const ADMIN_DASHBOARD_COLORS = {
  done: "#2d8c49",
  planned: "#e3a329",
  attention: "#c94b44",
  surrounding: "#7b8d8b",
};

// 添付の航空写真で見える谷筋の畑境界に合わせたデモ圃場。geo は実座標、geoShape は旧データ用の保険。
const SAMPLE_FIELD_GEOMETRY = {
  "spray-field-a": {
    x: 40, y: 38, w: 20, h: 12,
    geo: [[140.312185, 36.387676], [140.313201, 36.387447], [140.313059, 36.386499], [140.312043, 36.386695]],
    geoShape: [[38, 48], [48, 47], [47, 57], [38, 58]],
  },
  "no-chemical-field-b": {
    x: 39, y: 52, w: 21, h: 14,
    geo: [[140.312043, 36.386532], [140.313059, 36.386303], [140.312937, 36.385159], [140.311881, 36.385388]],
    geoShape: [[39, 59], [49, 58], [48, 68], [40, 70]],
  },
  "organic-field-a": {
    x: 25, y: 26, w: 23, h: 13,
    geo: [[140.311434, 36.388755], [140.312591, 36.388526], [140.312449, 36.387644], [140.311312, 36.387856]],
    geoShape: [[49, 48], [58, 47], [57, 59], [48, 58]],
  },
  "seedling-house-c": {
    x: 32, y: 84, w: 36, h: 6,
    geo: [[140.311779, 36.383393], [140.313587, 36.383524], [140.313668, 36.383033], [140.311881, 36.382903]],
    geoShape: [[27, 74], [39, 74], [39, 79], [28, 79]],
  },
  "preharvest-field-d": {
    x: 58, y: 20, w: 22, h: 19,
    geo: [[140.313059, 36.38905], [140.314155, 36.388804], [140.313952, 36.387415], [140.312855, 36.387693]],
    geoShape: [[50, 32], [59, 31], [57, 44], [49, 45]],
  },
  "water-channel-d": {
    x: 12, y: 4, w: 43, h: 93,
    geo: [[140.310764, 36.390717], [140.311109, 36.390717], [140.312998, 36.382249], [140.312612, 36.382183]],
    geoShape: [[60, 25], [63, 25], [49, 81], [47, 81]],
  },
  "facility-e": {
    x: 66, y: 70, w: 23, h: 10,
    geo: [[140.313708, 36.384652], [140.314846, 36.384472], [140.314683, 36.383671], [140.313546, 36.383818]],
    geoShape: [[61, 52], [67, 52], [66, 59], [60, 60]],
  },
};

let state = loadState();
let activeRole = profileRole(state) || state?.role || "sprayer";
let activeView = "dashboard";
let noticeChannel = "line";
let mapLayer = "risk";
let historyFilters = { field: "all", material: "all", status: "all" };
let adminDashboardFilters = { prefecture: "茨城県", municipality: "笠間市", date: "" };
let coveragePlayIndex = null;
let coveragePlaying = false;
let coverageTimer = null;
let toastTimer;
let mapLibreMap;
let dashboardMapLibreMap;
let mapLibreReady = false;
let dashboardMapLibreReady = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", init);

function activeProfile() {
  state.profile = normalizeProfile(state.profile);
  return state.profile;
}

function profileRole(source = state) {
  const profile = source?.profile;
  return profile?.registered && ROLE_META[profile.role] ? profile.role : null;
}

function profileIsRegistered() {
  return Boolean(activeProfile().registered && ROLE_META[activeProfile().role]);
}

function allowedViewsForCurrentMode() {
  if (!profileIsRegistered()) return DEMO_ALLOWED_VIEWS;
  return ROLE_ALLOWED_VIEWS[activeProfile().role] || ROLE_ALLOWED_VIEWS.sprayer;
}

function init() {
  if (!state || !Array.isArray(state.plans) || !state.plans.length) {
    state = createSampleState();
  }
  state = normalizeState(state);
  activeRole = profileRole(state) || state.role || "sprayer";
  state.role = activeRole;
  saveState();

  bindEvents();
  renderAll();
  const initialView = location.hash.replace("#", "");
  switchView(VIEW_META[initialView] ? initialView : "dashboard");
  initBoundaries();
}

function bindEvents() {
  document.body.addEventListener("click", (event) => {
    const roleTarget = event.target.closest("#roleSwitcher [data-role]");
    if (roleTarget) {
      setRole(roleTarget.dataset.role);
      return;
    }

    const profileRoleButton = event.target.closest("[data-profile-role]");
    if (profileRoleButton) {
      const form = $("#profileForm");
      if (form) {
        form.elements.role.value = profileRoleButton.dataset.profileRole;
        renderProfileRoleOptions(profileRoleButton.dataset.profileRole);
      }
      return;
    }

    const profileBoundaryLoad = event.target.closest("[data-profile-boundary-load]");
    if (profileBoundaryLoad) {
      loadProfileBoundary(profileBoundaryLoad.dataset.profileBoundaryLoad);
      return;
    }

    const fieldEdit = event.target.closest("[data-field-edit]");
    if (fieldEdit) {
      state.activeFieldId = fieldEdit.dataset.fieldEdit;
      saveState();
      renderAll();
      switchView("fields");
      return;
    }

    const notifyAction = event.target.closest("[data-notify-action]");
    if (notifyAction) {
      setNotificationResponse(notifyAction.dataset.notifyAction, notifyAction.dataset.response, notifyAction.dataset.notifyPlan);
      return;
    }

    const mapFocus = event.target.closest("[data-map-focus]");
    if (mapFocus) {
      focusVisibleMaps(mapFocus.dataset.mapFocus);
      return;
    }

    const parcelAdopt = event.target.closest("[data-parcel-adopt]");
    if (parcelAdopt) {
      adoptParcel(parcelAdopt.dataset.parcelAdopt);
      return;
    }

    const adminRow = event.target.closest("[data-admin-plan]");
    if (adminRow) {
      adminSelectedId = adminRow.dataset.adminPlan;
      state.activePlanId = adminSelectedId;
      saveState();
      renderAdmin();
      return;
    }

    const rxAction = event.target.closest("[data-rx-action]");
    if (rxAction) {
      if (rxAction.dataset.rxAction === "regenerate") regeneratePrescription();
      else if (rxAction.dataset.rxAction === "export") exportPrescriptionGeoJSON();
      return;
    }

    const planTrack = event.target.closest("[data-plan-track]");
    if (planTrack) {
      const plan = state.plans.find((item) => item.id === planTrack.dataset.planTrack);
      if (plan && plan.droneLog) {
        state.activePlanId = plan.id;
        state.droneLog = plan.droneLog;
        saveState();
        renderAll();
        switchView("drone");
        showToast("飛行ログの軌跡を表示しました。");
      }
      return;
    }

    const target = event.target.closest("[data-view-target]");
    if (target) {
      switchView(target.dataset.viewTarget);
    }
  });

  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewTarget));
  });

  $("#activePlanSelect").addEventListener("change", (event) => {
    state.activePlanId = event.target.value;
    resetCoveragePlayback();
    saveState();
    renderAll();
  });

  $("#loadSampleButton").addEventListener("click", () => {
    const shouldReset = confirm("サンプルデータを読み込みます。現在の入力内容は置き換わります。");
    if (!shouldReset) return;
    state = createSampleState();
    saveState();
    renderAll();
    showToast("サンプルデータを読み込みました。");
  });

  $("#newPlanButton").addEventListener("click", () => {
    const plan = createBlankPlan();
    state.plans.unshift(plan);
    state.activePlanId = plan.id;
    saveState();
    renderAll();
    switchView("plans");
    showToast("新しい散布計画を追加しました。");
  });

  $("#duplicatePlanButton").addEventListener("click", () => {
    const current = activePlan();
    const copy = {
      ...structuredClone(current),
      id: uniqueId("plan"),
      date: dateOffset(1),
      timeWindow: current.timeWindow || "06:00-07:30",
      notificationTargets: {},
      report: defaultReport(),
    };
    state.plans.unshift(copy);
    state.activePlanId = copy.id;
    saveState();
    renderAll();
    showToast("散布計画を複製しました。");
  });

  $("#planForm").addEventListener("submit", (event) => {
    event.preventDefault();
    updatePlanFromForm();
    saveState();
    renderAll();
    showToast("散布計画を保存しました。");
  });

  ["ratePer10a", "areaHa", "rateUnit", "sprayWidthM"].forEach((name) => {
    const input = $("#planForm").elements[name];
    if (input) input.addEventListener("input", () => updatePlanTotalPreview());
  });

  $("#saveEquipmentButton")?.addEventListener("click", saveEquipmentTemplate);
  $("#applyEquipmentButton")?.addEventListener("click", applyEquipmentTemplate);
  $("#applyProfileToPlanButton")?.addEventListener("click", applyProfileToActivePlan);

  $("#saveWeatherButton").addEventListener("click", () => {
    updateWeatherFromForm();
    saveState();
    renderAll();
    showToast("気象メモを保存しました。");
  });
  $("#fetchWeatherButton").addEventListener("click", async () => {
    updateWeatherFromForm();
    await fetchWeatherForecast();
  });

  $("#weatherForm").addEventListener("submit", (event) => {
    event.preventDefault();
    updateWeatherFromForm();
  });

  $("#profileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfileFromForm();
  });

  $("#resetProfileButton")?.addEventListener("click", resetProfileToDemoMode);

  $("#reportForm").addEventListener("submit", (event) => {
    event.preventDefault();
    updateReportFromForm();
  });

  $("#photoInput").addEventListener("change", handlePhotoInput);

  $("#clearReportPhotoButton").addEventListener("click", () => {
    const plan = activePlan();
    plan.report.photoData = "";
    plan.report.photoName = "";
    $("#photoInput").value = "";
    saveState();
    renderReport();
    showToast("写真メモを外しました。");
  });

  $("#copyNoticeButton").addEventListener("click", copyNotice);
  $("#markNotifiedButton").addEventListener("click", markSelectedTargetsNotified);
  $("#printNoticeButton").addEventListener("click", () => printDocument("notice"));
  $("#printPrecheckButton").addEventListener("click", () => printDocument("precheck"));
  $("#printReportButton").addEventListener("click", () => printDocument("report"));
  $("#printAdminButton").addEventListener("click", () => printDocument("admin"));
  $("#printHistoryButton").addEventListener("click", () => printDocument("history"));
  $("#exportCsvButton").addEventListener("click", exportCsv);
  $("#exportHistoryCsvButton").addEventListener("click", exportHistoryCsv);
  $("#historyFieldFilter").addEventListener("change", (event) => {
    historyFilters.field = event.target.value;
    renderHistory();
  });
  $("#historyMaterialFilter").addEventListener("change", (event) => {
    historyFilters.material = event.target.value;
    renderHistory();
  });
  $("#historyStatusFilter").addEventListener("change", (event) => {
    historyFilters.status = event.target.value;
    renderHistory();
  });
  $("#newFieldStatusButton").addEventListener("click", () => {
    const field = createBlankField();
    state.fields.push(field);
    state.activeFieldId = field.id;
    state.role = "neighbor";
    activeRole = "neighbor";
    saveState();
    renderAll();
    switchView("fields");
    showToast("自分の圃場を追加しました。");
  });
  $("#saveFieldStatusButton").addEventListener("click", () => {
    updateFieldStatusFromForm();
    saveState();
    renderAll();
    showToast("圃場ステータスを保存しました。");
  });
  $("#loadDroneLogButton").addEventListener("click", () => {
    const log = createSampleDroneLog(true);
    state.droneLog = log;
    const plan = activePlan();
    plan.droneLog = log;
    plan.checks.flightLog = true;
    plan.checks.altitude = true;
    saveState();
    renderAll();
    switchView("drone");
    showToast("サンプル飛行ログを取り込み、この計画に紐付けました。");
  });
  $("#autoFillReportButton").addEventListener("click", () => {
    autoFillReportFromPlan();
    saveState();
    renderAll();
    switchView("report");
    showToast("計画とログから報告を入力しました。");
  });
  $("#saveRulesButton").addEventListener("click", () => {
    updateSettingsFromForm();
    saveState();
    renderAll();
    showToast("実証ルール案を保存しました。");
  });
  $("#resetRulesButton").addEventListener("click", () => {
    state.settings = { ...DEFAULT_SETTINGS };
    saveState();
    renderAll();
    showToast("実証ルール案を標準値に戻しました。");
  });
  $("#adminStatusFilter")?.addEventListener("change", (event) => {
    adminFilters.status = event.target.value;
    renderAdmin();
  });
  $("#adminDistrictFilter")?.addEventListener("change", (event) => {
    adminFilters.district = event.target.value;
    renderAdmin();
  });

  $$(".segment[data-channel]").forEach((button) => {
    button.addEventListener("click", () => {
      noticeChannel = button.dataset.channel;
      $$(".segment[data-channel]").forEach((item) => item.classList.toggle("active", item === button));
      renderNotification();
    });
  });

  $$(".segment[data-map-layer]").forEach((button) => {
    button.addEventListener("click", () => {
      mapLayer = button.dataset.mapLayer;
      if (mapLayer !== "coverage") stopCoveragePlayback();
      $$(".segment[data-map-layer]").forEach((item) => item.classList.toggle("active", item === button));
      renderMapView();
    });
  });

  $("#coveragePlayButton")?.addEventListener("click", toggleCoveragePlayback);
  $("#coverageResetButton")?.addEventListener("click", resetCoveragePlayback);

  $("#prescriptionFileInput")?.addEventListener("change", (event) => {
    importPrescriptionFile(event.target.files[0]);
    event.target.value = "";
  });
  $("#loadSamplePrescriptionButton")?.addEventListener("click", loadSamplePrescription);
  $("#clearPrescriptionButton")?.addEventListener("click", clearPrescription);
  $("#fieldBoundaryInput")?.addEventListener("change", (event) => {
    importFieldBoundaries(event.target.files[0]);
    event.target.value = "";
  });
  $("#boundaryMunicipalitySelect")?.addEventListener("change", (event) => {
    if (event.target.value && event.target.value !== "__custom__") loadMunicipalityBoundary(event.target.value);
  });
  $("#resetBoundaryButton")?.addEventListener("click", resetToMunicipality);
  $("#createPrescriptionButton")?.addEventListener("click", createPrescription);
  document.body.addEventListener("input", (event) => {
    const rateInput = event.target.closest("[data-rx-rate]");
    if (rateInput) updatePrescriptionRate(Number(rateInput.dataset.rxRate), rateInput.value);
  });

  document.body.addEventListener("change", (event) => {
    const targetMunicipality = event.target.closest("input[name='targetMunicipality']");
    if (targetMunicipality) {
      const profile = activeProfile();
      profile.targetMunicipalities = $$("input[name='targetMunicipality']:checked", $("#profileForm")).map((input) => input.value);
      if (targetMunicipality.checked && !profile.boundaryLoadStatus[targetMunicipality.value]) {
        profile.boundaryLoadStatus[targetMunicipality.value] = "notLoaded";
      }
      targetMunicipality.closest(".municipality-chip")?.classList.toggle("selected", targetMunicipality.checked);
      renderBoundaryStatus(profile);
      return;
    }

    const adminDashboardFilter = event.target.closest("[data-admin-dashboard-filter]");
    if (adminDashboardFilter) {
      updateAdminDashboardFilter(adminDashboardFilter.name, adminDashboardFilter.value);
      return;
    }

    const response = event.target.closest("[data-notify-response]");
    if (response) {
      setNotificationResponse(response.dataset.notifyResponse, response.value, response.dataset.notifyPlan);
    }
  });
}

function renderAll() {
  document.body.dataset.role = activeRole;
  document.body.dataset.profileRegistered = profileIsRegistered() ? "true" : "false";
  renderRoleSwitcher();
  renderRoleNavigation();
  renderProfileModeBanner();
  renderPlanSelect();
  renderRuleBanner();
  renderRoleActionPanel();
  renderDashboard();
  renderPlanForm();
  renderMapView();
  renderFieldStatus();
  renderDroneView();
  renderNotification();
  renderChecklist();
  renderWeather();
  renderReport();
  renderHistory();
  renderAdmin();
  renderRulesForm();
  renderProfileForm();
  renderSources();
}

function switchView(viewName) {
  if (!roleAllowsView(viewName)) {
    viewName = roleAllowsView("dashboard") ? "dashboard" : "profile";
  }
  activeView = viewName;
  $$(".view").forEach((view) => view.classList.toggle("active", view.dataset.view === viewName));
  $$("[data-view-target]").forEach((item) => item.classList.toggle("active", item.dataset.viewTarget === viewName));
  const meta = VIEW_META[viewName] || VIEW_META.dashboard;
  $("#currentCrumb").textContent = meta[0];
  $("#currentTitle").textContent = meta[1];
  if (location.hash !== `#${viewName}`) {
    history.replaceState(null, "", `#${viewName}`);
  }
  requestAnimationFrame(() => {
    if (viewName === "dashboard" && dashboardMapLibreMap) {
      dashboardMapLibreMap.resize();
      updateGisMap(dashboardMapLibreMap, { dashboard: true, adminDashboard: activeRole === "admin" });
    }
    if (viewName === "map" && mapLibreMap) {
      mapLibreMap.resize();
      updateGisMap(mapLibreMap);
    }
    if (viewName === "admin") {
      initAdminMapLibre();
      if (adminMapLibreMap) adminMapLibreMap.resize();
      renderAdminDetail();
    }
  });
}

function setRole(role) {
  if (!ROLE_META[role]) return;
  if (profileIsRegistered()) {
    showToast("プロフィール登録後は利用区分が固定されています。変更する場合はプロフィール設定を更新してください。");
    return;
  }
  activeRole = role;
  state.role = role;
  saveState();
  renderAll();
  if (!roleAllowsView(activeView)) {
    switchView("dashboard");
  } else {
    switchView(activeView);
  }
  showToast(`${ROLE_META[role].label}モードに切り替えました。`);
}

function roleAllowsView(viewName) {
  return allowedViewsForCurrentMode().includes(viewName);
}

function renderRoleSwitcher() {
  const switcher = $("#roleSwitcher");
  if (switcher) switcher.classList.toggle("role-switcher-locked", profileIsRegistered());
  $$("#roleSwitcher [data-role]").forEach((button) => {
    button.classList.toggle("active", button.dataset.role === activeRole);
    button.disabled = profileIsRegistered();
  });
}

function renderRoleNavigation() {
  $$("[data-view-target]").forEach((item) => {
    const roles = item.dataset.roles?.split(/\s+/);
    const viewTarget = item.dataset.viewTarget;
    const visible = profileIsRegistered()
      ? roleAllowsView(viewTarget)
      : true;
    item.classList.toggle("role-hidden", !visible);
  });
}

function renderProfileModeBanner() {
  const banner = $("#profileModeBanner");
  if (!banner) return;
  const profile = activeProfile();
  if (!profile.registered) {
    banner.innerHTML = `
      <div>
        <span class="tag tag-attention">未登録デモモード</span>
        <strong>すべての画面を確認できます。</strong>
        <span>プロフィール登録後は、選択した利用区分の画面だけ表示されます。</span>
      </div>
      <button class="secondary-button" data-view-target="profile" type="button">プロフィール登録</button>
    `;
    return;
  }
  banner.innerHTML = `
    <div>
      <span class="tag tag-green">${escapeHtml(PROFILE_ROLE_LABELS[profile.role] || "登録済み")}</span>
      <strong>${escapeHtml(profile.name || profile.organizationName || "プロフィール登録済み")}</strong>
      <span>${escapeHtml(profile.municipality || "対象市町村未設定")} / ${escapeHtml(profile.district || "地区未設定")}。この表示は本番認証ではなく、localStorage上のUI制御です。</span>
    </div>
    <button class="ghost-button" data-view-target="profile" type="button">プロフィール設定</button>
  `;
}

function renderPlanSelect() {
  const select = $("#activePlanSelect");
  select.innerHTML = state.plans
    .map((plan) => `<option value="${escapeAttr(plan.id)}">${escapeHtml(plan.date)} ${escapeHtml(plan.fieldName)}</option>`)
    .join("");
  select.value = state.activePlanId;
}

function renderRuleBanner() {
  const rules = activeSettings();
  const plan = activePlan();
  const score = readinessScore(plan);
  const progress = checkProgress(plan);
  const targets = riskItemsForPlan(plan).filter((item) => item.notifyTarget);
  const notified = targets.filter((item) => plan.notificationTargets[item.id]).length;
  $("#ruleBanner").innerHTML = `
    <div>
      <span class="tag tag-green">確認進捗</span>
      <strong>${score.value} / 100</strong>
      <span>チェック ${progress.done}/${progress.total} / 通知 ${notified}/${targets.length} / 気象 ${weatherCheckSummary(plan)} / ログ ${plan.droneLog?.imported ? "取込済み" : "未取込"} / 報告 ${plan.report.doneDate ? "提出済み" : "未提出"}</span>
    </div>
    <div class="rule-compact-note">
      <span>実証ルール案</span>
      <strong>${escapeHtml(rules.regionName)}</strong>
      <span>重点確認 ${escapeHtml(rules.organicRadius)}m / 通知候補 ${escapeHtml(rules.notifyRadius)}m / 距離は実証用仮設定です。</span>
    </div>
  `;
}

function renderRoleActionPanel() {
  const panel = $("#roleActionPanel");
  if (!panel) return;
  const role = ROLE_META[activeRole] || ROLE_META.sprayer;
  const plan = activePlan();
  const contentByRole = {
    sprayer: renderSprayerWorkflow(plan),
    neighbor: renderNeighborHome(plan),
    admin: renderAdminHome(),
  };
  panel.innerHTML = `
    <article class="panel role-home ${escapeAttr(activeRole)}">
      <div class="panel-head">
        <div>
          <span class="tag tag-green">${escapeHtml(role.label)}モード</span>
          <h4>${escapeHtml(role.title)}</h4>
          <p class="small-note">${escapeHtml(role.note)}</p>
        </div>
      </div>
      ${contentByRole[activeRole] || contentByRole.sprayer}
    </article>
  `;
}

function renderSprayerWorkflow(plan) {
  const progress = checkProgress(plan);
  const actions = nextActionsForSprayer(plan);
  const remainingActions = actions.slice(1, 5);
  const preSteps = [
    { title: "計画登録", detail: `${plan.fieldName} / ${plan.timeWindow}`, done: Boolean(plan.fieldName && plan.pesticide), view: "plans" },
    { title: "周辺確認", detail: `${riskItemsForPlan(plan).length}件の確認項目`, done: Boolean(plan.checks.organic && plan.checks.sensitive), view: "map" },
    { title: "近隣通知", detail: notificationLabel(plan), done: notificationIsComplete(plan), view: "notify" },
    { title: "気象確認", detail: weatherCheckSummary(plan), done: Boolean(plan.checks.weatherEnv && plan.checks.wind), view: "weather" },
    { title: "散布前チェック", detail: `${progress.done}/${progress.total}項目`, done: progress.percent >= 85, view: "checklist" },
  ];
  const postSteps = [
    { title: "飛行ログ", detail: droneLogLabel(plan.droneLog || createSampleDroneLog(false)), done: Boolean(plan.droneLog?.imported), view: "drone" },
    { title: "実施後報告", detail: plan.report.doneDate ? "提出済み" : "未提出", done: Boolean(plan.report.doneDate), view: "report" },
    { title: "作業履歴反映", detail: plan.report.doneDate ? "履歴に反映済み" : "報告後に反映", done: Boolean(plan.report.doneDate), view: "history" },
  ];
  const renderSteps = (steps, offset = 0) =>
    steps
      .map(
        (step, index) => `
          <button class="workflow-step ${step.done ? "done" : "todo"}" data-view-target="${escapeAttr(step.view)}" type="button">
            <span>${index + 1 + offset}</span>
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.detail)}</small>
          </button>
        `,
      )
      .join("");
  return `
    <div class="next-action-panel">
      <div class="next-action-primary">
        <span class="tag tag-attention">次に必要な対応</span>
        <strong>${escapeHtml(actions[0]?.title || "未完了タスクはありません")}</strong>
        <span>${escapeHtml(actions[0]?.detail || "散布後は実施後報告とドローンログを残してください。")}</span>
        <button class="primary-button" data-view-target="${escapeAttr(actions[0]?.view || "report")}" type="button">${escapeHtml(actions[0]?.title ? "この対応を開く" : "報告画面を開く")}</button>
      </div>
      <div class="next-action-list">
        ${
          remainingActions.length
            ? remainingActions
                .map(
                  (action) => `
                    <button class="next-action-row" data-view-target="${escapeAttr(action.view)}" type="button">
                      <span>${escapeHtml(action.title)}</span>
                      <small>${escapeHtml(action.detail)}</small>
                    </button>
                  `,
                )
                .join("")
            : `<div class="next-action-row is-static"><span>次の記録に進めます</span><small>散布後はログ取込と実施後報告を残してください。</small></div>`
        }
      </div>
    </div>
    <div class="workflow-section">
      <div class="workflow-section-head"><strong>散布前タスク</strong><span>周辺確認、通知、気象、チェックを先に確認します。</span></div>
      <div class="workflow-grid">${renderSteps(preSteps)}</div>
    </div>
    <div class="workflow-section">
      <div class="workflow-section-head"><strong>散布後タスク</strong><span>ログと報告を記録として残します。</span></div>
      <div class="workflow-grid compact-workflow">${renderSteps(postSteps, preSteps.length)}</div>
    </div>
  `;
}

function renderNeighborHome(plan) {
  const notices = neighborRelevantNotices().slice(0, 4);
  const field = activeField();
  const profile = activeProfile();
  const pending = notices.filter((notice) => notice.response === "未回答").length;
  const consulting = notices.filter((notice) => notice.response !== "未回答" && notice.response !== "確認しました").length;
  return `
    <div class="neighbor-inbox-summary">
      <article>
        <span>未返信通知</span>
        <strong>${pending}件</strong>
      </article>
      <article>
        <span>近日散布予定</span>
        <strong>${notices.length}件</strong>
      </article>
      <article>
        <span>相談中</span>
        <strong>${consulting}件</strong>
      </article>
      <article>
        <span>公開範囲</span>
        <strong>${escapeHtml(field.publicScope || "概略のみ共有")}</strong>
      </article>
    </div>
    <div class="neighbor-home-grid">
      <div class="neighbor-card">
        <strong>自分の圃場</strong>
        <span>${escapeHtml(field.name)} / ${escapeHtml(profile.municipality || field.municipality || "市町村未設定")} ${escapeHtml(profile.district || field.district || "")}</span>
        <div class="field-mini-grid">
          <div><span>作物</span><strong>${escapeHtml(field.crop || "未登録")}</strong></div>
          <div><span>農薬使用ステータス</span><strong>${escapeHtml(field.cultivation || "未登録")}</strong></div>
          <div><span>有機JAS</span><strong>${escapeHtml(field.organicJas || "未回答")}</strong></div>
          <div><span>通知希望</span><strong>${escapeHtml(field.notifyPreference || "通知未確認")}</strong></div>
        </div>
        <span class="small-note">公開範囲：${escapeHtml(field.publicScope || "概略のみ共有")}</span>
        <span class="small-note">最終更新日：${escapeHtml(field.updatedAt || "デモデータ")}</span>
        <div class="form-actions compact-actions">
          <button class="secondary-button" data-view-target="fields" type="button">圃場・公開範囲を編集</button>
          <button class="ghost-button" data-view-target="map" type="button">地図で確認</button>
        </div>
      </div>
      <div class="neighbor-card">
        <strong>あなたに関係する散布予定</strong>
        <div class="notice-response-list">
          ${
            notices.length
              ? notices.map(renderNeighborNoticeCard).join("")
              : `<div class="empty-state">現在の通知候補はありません。</div>`
          }
        </div>
      </div>
    </div>
    ${privacyScopeCard(field)}
  `;
}

function renderNeighborNoticeCard(notice) {
  const wind = noticeWindSummary(notice);
  const reason = notificationReason(notice);
  const responseClass = notice.response === "未回答" ? "amber" : notice.response === "確認しました" ? "green" : "blue";
  const distanceClass = notice.level === "high" ? "red" : notice.level === "medium" ? "amber" : "green";
  return `
    <div class="notice-response-row notice-card">
      <div class="notice-card-head">
        <div>
          <strong>${escapeHtml(notice.plan.date)} ${escapeHtml(notice.plan.timeWindow)}</strong>
          <span>${escapeHtml(notice.plan.fieldName)} / ${escapeHtml(notice.plan.pesticide)}</span>
        </div>
        <span class="pill ${responseClass}">${escapeHtml(notice.response)}</span>
      </div>
      <div class="notice-card-metrics">
        <div>
          <span>距離</span>
          <strong>${escapeHtml(notice.distanceLabel)}</strong>
        </div>
        <div>
          <span>風下</span>
          <strong>${escapeHtml(wind.short)}</strong>
        </div>
        <div>
          <span>対象圃場</span>
          <strong>${escapeHtml(notice.name)}</strong>
        </div>
      </div>
      <div class="pill-line">
        <span class="pill ${distanceClass}">${escapeHtml(riskLevelLabel(notice.level))}</span>
        <span class="pill ${wind.className}">${escapeHtml(wind.label)}</span>
        <span class="pill blue">${escapeHtml(notice.plan.materialType || "農薬")}</span>
      </div>
      <span class="small-note">通知理由：${escapeHtml(reason)}</span>
      <span class="small-note">${escapeHtml(wind.detail)}</span>
      <div class="pill-line notice-actions">
        <button class="pill-button" data-notify-plan="${escapeAttr(notice.plan.id)}" data-notify-action="${escapeAttr(notice.id)}" data-response="確認しました" type="button">確認しました</button>
        <button class="pill-button amber" data-notify-plan="${escapeAttr(notice.plan.id)}" data-notify-action="${escapeAttr(notice.id)}" data-response="時間変更希望" type="button">時間を相談</button>
        <button class="pill-button amber" data-notify-plan="${escapeAttr(notice.plan.id)}" data-notify-action="${escapeAttr(notice.id)}" data-response="電話希望" type="button">電話で相談</button>
        <button class="pill-button amber" data-notify-plan="${escapeAttr(notice.plan.id)}" data-notify-action="${escapeAttr(notice.id)}" data-response="収穫日につき要相談" type="button">収穫・作業あり</button>
      </div>
    </div>
  `;
}

function notificationReason(notice) {
  const rules = activeSettings();
  if (["organic", "noChemical"].includes(notice.type) && notice.distance <= rules.organicRadius) {
    return `農薬不使用圃場として登録済み、重点確認距離${rules.organicRadius}m以内`;
  }
  const wind = noticeWindSummary(notice);
  if (wind.label.includes("要確認")) return "風下方向に位置";
  if (notice.type === "preharvest") return "収穫予定時期が近い圃場として登録済み";
  if (notice.type === "house") return "育苗・ハウス換気の調整対象";
  return `通知対象距離${rules.notifyRadius}m以内`;
}

function noticeWindSummary(notice) {
  const weather = notice.plan.weather || {};
  const direction = weather.actualDirection || weather.forecastDirection || "未入力";
  const downwind = direction && direction !== "未入力" ? downwindDirection(direction) : "未確認";
  const isDownwind = downwind !== "未確認" && notice.direction === downwind;
  return {
    short: downwind,
    label: isDownwind ? "風下方向：要確認" : `風下 ${downwind}`,
    className: isDownwind ? "amber" : "green",
    detail: `風向 ${direction} / 風下 ${downwind} / あなたの圃場は散布ほ場から${notice.direction}側です。`,
  };
}

function nextActionsForSprayer(plan) {
  const actions = [];
  riskItemsForPlan(plan)
    .filter((item) => item.notifyTarget && !item.notified)
    .slice(0, 2)
    .forEach((item) => actions.push({ title: `${item.name}へ通知`, detail: item.message, view: "notify" }));
  if (!plan.checks.weatherForecast) {
    actions.push({ title: "API予報を取得", detail: "Open-Meteoの予報値を散布予定時刻に合わせて取得します。", view: "weather" });
  }
  if (!plan.weather.actualSpeed || !plan.checks.wind) {
    actions.push({ title: "散布直前に風速を実測", detail: "現地の風向・風速、測定場所、測定者を記録します。", view: "weather" });
  }
  if (!plan.checks.weatherEnv) {
    actions.push({ title: "散布者確認を記録", detail: "予報と実測を見た上で、確認済みチェックを入れます。", view: "weather" });
  }
  if (!plan.checks.dips) {
    actions.push({ title: "DIPS飛行計画を確認", detail: "V1では確認記録としてチェックを残します。", view: "checklist" });
  }
  if (!plan.droneLog?.imported) {
    actions.push({ title: "散布後にドローンログ取込", detail: "飛行ルート、高度、散布ON/OFFログを記録に紐付けます。", view: "drone" });
  }
  if (!plan.report.doneDate && plan.date <= dateOffset(0)) {
    actions.push({ title: "実施後報告を作成", detail: "実施日時、気象、問い合わせ有無を散布者控えとして残します。", view: "report" });
  }
  return actions;
}

function weatherCheckSummary(plan) {
  const parts = [
    plan.checks.weatherForecast ? "予報取得済み" : "予報未取得",
    plan.checks.weatherEnv ? "散布者確認済み" : "散布者未確認",
    plan.checks.wind ? "実測済み" : "実測未入力",
  ];
  return parts.join(" / ");
}

function neighborRelevantNotices() {
  const since = dateOffset(-1);
  const fieldId = activeField().id;
  return state.plans
    .filter((plan) => plan.date >= since)
    .flatMap((plan) =>
      riskItemsForPlan(plan)
        .filter((item) => item.notifyTarget && item.id === fieldId)
        .map((item) => ({
          ...item,
          plan,
          response: notificationResponse(plan, item.id),
        })),
    )
    .sort((a, b) => {
      const responseRank = (response) => (response === "未回答" ? 0 : response === "確認しました" ? 2 : 1);
      const responseA = responseRank(a.response);
      const responseB = responseRank(b.response);
      return responseA - responseB || `${a.plan.date} ${a.plan.timeWindow}`.localeCompare(`${b.plan.date} ${b.plan.timeWindow}`);
    });
}

function privacyScopeCard(field) {
  const rows = [
    ["圃場位置", "概略", "自分のみ詳細", "必要時詳細"],
    ["栽培ステータス", "表示", "自分のみ編集", "表示"],
    ["連絡先", "通知対象のみ", "自分のみ", "管理用"],
    ["返信内容", "関係者のみ", "自分", "管理者"],
  ];
  const scope = field.publicScope || "概略のみ共有";
  const reassurance = scope === "自分のみ"
    ? "現在は自分だけが詳細を確認できます。通知対象への共有は行いません。"
    : scope === "通知対象に詳細共有"
      ? "通知対象の散布者にだけ、確認に必要な詳細を共有します。"
      : scope === "地域管理者まで詳細共有"
        ? "地域管理者まで詳細を共有し、散布者には通知に必要な範囲で表示します。"
        : "現在は圃場の概略と通知希望だけを共有します。連絡先の詳細は広く表示しません。";
  return `
    <div class="privacy-scope-card">
      <div>
        <span class="tag tag-blue">公開範囲</span>
        <strong>${escapeHtml(scope)}</strong>
        <span>${escapeHtml(reassurance)}</span>
        <button class="ghost-button" data-view-target="profile" type="button">公開範囲を変更する</button>
      </div>
      <details class="privacy-scope-detail">
        <summary>公開範囲を確認</summary>
        <div class="privacy-scope-grid">
          <div class="scope-header"><b>情報</b><span>散布者</span><span>自分</span><span>地域管理</span></div>
          ${rows
            .map(
              ([info, sprayer, neighbor, admin]) => `
                <div><b>${escapeHtml(info)}</b><span>${escapeHtml(sprayer)}</span><span>${escapeHtml(neighbor)}</span><span>${escapeHtml(admin)}</span></div>
              `,
            )
            .join("")}
        </div>
      </details>
    </div>
  `;
}

function ensureAdminDashboardFilters() {
  const firstRegion = ADMIN_REGION_OPTIONS[0];
  const prefectures = ADMIN_REGION_OPTIONS.map((region) => region.prefecture);
  if (!prefectures.includes(adminDashboardFilters.prefecture)) {
    adminDashboardFilters.prefecture = firstRegion.prefecture;
  }
  const municipalities = adminMunicipalitiesForPrefecture(adminDashboardFilters.prefecture);
  if (!municipalities.includes(adminDashboardFilters.municipality)) {
    adminDashboardFilters.municipality = municipalities[0] || "";
  }
  if (!adminDashboardFilters.date) {
    adminDashboardFilters.date = dateOffset(0);
  }
}

function adminMunicipalitiesForPrefecture(prefecture) {
  return ADMIN_REGION_OPTIONS.find((region) => region.prefecture === prefecture)?.municipalities || ADMIN_REGION_OPTIONS[0].municipalities;
}

function updateAdminDashboardFilter(name, value) {
  if (!["prefecture", "municipality", "date"].includes(name)) return;
  adminDashboardFilters[name] = value;
  if (name === "prefecture") {
    adminDashboardFilters.municipality = adminMunicipalitiesForPrefecture(value)[0] || "";
  }
  ensureAdminDashboardFilters();
  renderRoleActionPanel();
  renderDashboard();
}

function adminDashboardDate() {
  ensureAdminDashboardFilters();
  return adminDashboardFilters.date;
}

function planMatchesAdminRegion(plan) {
  ensureAdminDashboardFilters();
  const municipality = adminDashboardFilters.municipality;
  if (!municipality) return true;
  const haystack = [plan.district, plan.fieldName, activeSettings().regionName, DEFAULT_WEATHER_LOCATION.label].join(" ");
  return haystack.includes(municipality);
}

function adminRegionPlans() {
  return state.plans.filter(planMatchesAdminRegion);
}

function adminDashboardPlans() {
  const date = adminDashboardDate();
  return adminRegionPlans().filter((plan) => plan.date === date);
}

function adminDashboardSummary() {
  const date = adminDashboardDate();
  const plans = adminDashboardPlans();
  const regionPlans = adminRegionPlans();
  const planned = plans.filter((plan) => !plan.report.doneDate).length;
  const done = plans.filter((plan) => Boolean(plan.report.doneDate)).length;
  const attention = plans.filter((plan) => riskLevel(plan) === "high").length;
  const notifyIncomplete = plans.filter((plan) => !notificationIsComplete(plan)).length;
  const organicNear = plans.filter((plan) =>
    riskItemsForPlan(plan).some((risk) => ["organic", "noChemical"].includes(risk.type) && risk.level === "high"),
  ).length;
  const windNeed = plans.filter(windNeedsAttention).length;
  const droneMissing = plans.filter((plan) => !plan.droneLog?.imported).length;
  const altitudeNeed = plans.filter((plan) => !plan.checks.altitude || altitudeCheckCount(plan.droneLog || activeDroneLog()) > 0).length;
  const inquiry = regionPlans.filter((plan) => plan.report?.inquiry && plan.report.inquiry !== "なし").length;
  const unregisteredNear = plans.filter((plan) => riskItemsForPlan(plan).some((risk) => risk.unregistered || risk.type === "public")).length;
  const today = dateOffset(0);
  const reportMissing = regionPlans.filter((plan) => plan.date <= today && !plan.report.doneDate).length;
  const replyNeed = regionPlans.reduce((total, plan) => {
    const values = Object.values(plan.notificationResponses || {});
    return total + values.filter((value) => ["時間変更希望", "電話希望", "収穫日につき要相談"].includes(value)).length;
  }, 0);
  const readiness = plans.length
    ? Math.round(plans.reduce((sum, plan) => sum + readinessScore(plan).value, 0) / plans.length)
    : 100;
  return {
    date,
    planned,
    done,
    attention,
    notifyIncomplete,
    organicNear,
    windNeed,
    droneMissing,
    altitudeNeed,
    inquiry,
    unregisteredNear,
    reportMissing,
    replyNeed,
    readiness,
    total: plans.length,
  };
}

function renderAdminHome() {
  ensureAdminDashboardFilters();
  const summary = adminDashboardSummary();
  const municipalities = adminMunicipalitiesForPrefecture(adminDashboardFilters.prefecture);
  const prefectureOptions = ADMIN_REGION_OPTIONS.map(
    (region) =>
      `<option value="${escapeAttr(region.prefecture)}" ${region.prefecture === adminDashboardFilters.prefecture ? "selected" : ""}>${escapeHtml(region.prefecture)}</option>`,
  ).join("");
  const municipalityOptions = municipalities
    .map((name) => `<option value="${escapeAttr(name)}" ${name === adminDashboardFilters.municipality ? "selected" : ""}>${escapeHtml(name)}</option>`)
    .join("");
  return `
    <div class="admin-disclaimer">
      この画面は散布の許可・承認を行うものではありません。散布計画、近隣通知、気象確認、実施後報告の記録状況を一覧化するための実証用画面です。
    </div>
    <div class="admin-filter-grid">
      <label>都道府県
        <select name="prefecture" data-admin-dashboard-filter>
          ${prefectureOptions}
        </select>
      </label>
      <label>市町村
        <select name="municipality" data-admin-dashboard-filter>
          ${municipalityOptions}
        </select>
      </label>
      <label>対象日
        <input name="date" data-admin-dashboard-filter type="date" value="${escapeAttr(summary.date)}">
      </label>
      <button class="primary-button" data-view-target="admin" type="button">散布予定・実績を見る</button>
    </div>
    <div class="workflow-grid admin-flow">
      <button class="workflow-step ${summary.attention ? "todo" : "done"}" data-view-target="admin" type="button">
        <span>1</span><strong>要確認の散布</strong><small>${summary.attention}件</small>
      </button>
      <button class="workflow-step ${summary.planned ? "todo" : "done"}" data-view-target="admin" type="button">
        <span>2</span><strong>対象日の予定</strong><small>${summary.planned}件</small>
      </button>
      <button class="workflow-step ${summary.reportMissing ? "todo" : "done"}" data-view-target="admin" type="button">
        <span>3</span><strong>報告未提出</strong><small>${summary.reportMissing}件</small>
      </button>
      <button class="workflow-step ${summary.replyNeed ? "todo" : "done"}" data-view-target="admin" type="button">
        <span>4</span><strong>近隣返信要確認</strong><small>${summary.replyNeed}件</small>
      </button>
    </div>
    <div class="admin-queue-grid">
      ${adminQueueItems(summary)
        .map(
          (item) => `
            <button class="queue-chip ${item.count ? "todo" : "done"}" data-view-target="admin" type="button">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(String(item.count))}件</strong>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function adminQueueItems(summary) {
  return [
    { label: "通知未完了", count: summary.notifyIncomplete },
    { label: "風向風速要確認", count: summary.windNeed },
    { label: "報告未提出", count: summary.reportMissing },
    { label: "ドローンログ未取込", count: summary.droneMissing },
    { label: "高度要確認", count: summary.altitudeNeed },
    { label: "問い合わせあり", count: summary.inquiry },
    { label: "未登録圃場近接", count: summary.unregisteredNear },
  ];
}

function adminAttentionReasons(plan) {
  const reasons = [];
  const risks = riskItemsForPlan(plan);
  const unnotified = risks.filter((risk) => risk.notifyTarget && !plan.notificationTargets[risk.id]);
  const organicNear = risks.filter((risk) => ["organic", "noChemical"].includes(risk.type) && risk.level === "high");
  const consulting = Object.entries(plan.notificationResponses || {})
    .filter(([, response]) => response && response !== "未回答" && response !== "確認しました")
    .map(([fieldId, response]) => {
      const field = state.fields.find((item) => item.id === fieldId);
      return `${field?.name || fieldId}：${response}`;
    });
  if (organicNear.length) {
    reasons.push({
      level: "red",
      title: "農薬不使用ほ場近接",
      detail: organicNear.slice(0, 2).map((risk) => `${risk.name} ${risk.distanceLabel}`).join("、"),
    });
  }
  if (unnotified.length) {
    reasons.push({
      level: "amber",
      title: "通知未完了",
      detail: `${unnotified.slice(0, 2).map((risk) => risk.name).join("、")}${unnotified.length > 2 ? " ほか" : ""}`,
    });
  }
  if (windNeedsAttention(plan)) {
    reasons.push({ level: "amber", title: "風向風速要確認", detail: weatherLabel(plan) });
  }
  if (!plan.checks.weatherEnv) {
    reasons.push({ level: "amber", title: "散布者の気象確認未記録", detail: weatherCheckSummary(plan) });
  }
  if (!plan.droneLog?.imported) {
    reasons.push({ level: "amber", title: "ドローンログ未取込", detail: "散布ON/OFF・高度・軌跡が未連携です。" });
  }
  const altitudeIssues = plan.droneLog?.imported ? altitudeCheckCount(plan.droneLog) : 0;
  if (!plan.checks.altitude || altitudeIssues > 0) {
    reasons.push({
      level: altitudeIssues > 0 ? "red" : "amber",
      title: "高度要確認",
      detail: altitudeIssues > 0 ? `${altitudeIssues}区間で予定高度との差を確認` : "飛行高度予定の確認が未完了です。",
    });
  }
  if (plan.date <= dateOffset(0) && !plan.report.doneDate) {
    reasons.push({ level: "amber", title: "実施後報告未提出", detail: "対象日を過ぎた散布の報告が未提出です。" });
  }
  if (consulting.length) {
    reasons.push({ level: "blue", title: "近隣返信要確認", detail: consulting.slice(0, 2).join("、") });
  }
  if (plan.report?.inquiry && plan.report.inquiry !== "なし") {
    reasons.push({ level: "blue", title: "問い合わせあり", detail: plan.report.inquiry });
  }
  return reasons.length ? reasons : [{ level: "green", title: "追加確認なし", detail: "通知・気象・報告の記録に大きな未完了はありません。" }];
}

function renderAdminReasonChips(plan, limit = 3) {
  return adminAttentionReasons(plan)
    .slice(0, limit)
    .map((reason) => `<span class="pill ${escapeAttr(reason.level)}">${escapeHtml(reason.title)}</span>`)
    .join("");
}

function renderAdminReasonPanel(plan) {
  return `
    <div class="admin-reason-panel">
      <strong>要確認理由</strong>
      <div class="admin-reason-list">
        ${adminAttentionReasons(plan)
          .map(
            (reason) => `
              <div class="admin-reason-row">
                <span class="pill ${escapeAttr(reason.level)}">${escapeHtml(reason.title)}</span>
                <b>${escapeHtml(reason.detail)}</b>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function sprayGoNoGo(plan) {
  const weather = weatherDecision(plan);
  const w = plan.weather || {};
  const rain = rainNeedsAttention(w);
  const notifyComplete = notificationIsComplete(plan);
  const unnotifiedHigh = riskItemsForPlan(plan).filter((r) => r.notifyTarget && r.level === "high" && !r.notified);
  const factors = [
    { label: "気象条件", status: weather.level, detail: `${weather.label}（${weatherLabel(plan)}）` },
    { label: "降雨", status: rain ? "bad" : "good", detail: rainRiskLabel(w) },
    { label: "近隣通知", status: notifyComplete ? "good" : "warn", detail: notificationLabel(plan) },
    {
      label: "風下の要確認圃場",
      status: unnotifiedHigh.length ? "bad" : "good",
      detail: unnotifiedHigh.length ? `${unnotifiedHigh.length}件が未通知` : "対応済み／該当なし",
    },
  ];
  let verdict;
  if (weather.level === "bad" || rain || unnotifiedHigh.length) verdict = "stop";
  else if (weather.level === "warn" || !notifyComplete) verdict = "caution";
  else verdict = "go";
  const meta = {
    go: { label: "記録上の確認状況：条件内", icon: "記" },
    caution: { label: "追加確認が必要", icon: "確" },
    stop: { label: "散布前に追加確認が必要です", icon: "確" },
  }[verdict];
  const actions = [];
  if (weather.level !== "good") actions.push({ view: "weather", label: "気象を確認" });
  if (!notifyComplete) actions.push({ view: "notify", label: "近隣通知へ" });
  if (unnotifiedHigh.length) actions.push({ view: "map", label: "風下を確認" });
  return { verdict, ...meta, factors, actions };
}

function goNoGoInner(g, plan, includeActions) {
  return `
    <div class="gonogo-verdict">
      <span class="gonogo-icon">${g.icon}</span>
      <div>
        <strong>${escapeHtml(g.label)}</strong>
        <span>${escapeHtml(plan.date)} ${escapeHtml(plan.timeWindow)} ／ ${escapeHtml(plan.fieldName)}</span>
      </div>
    </div>
    <div class="gonogo-factors">
      ${g.factors
        .map((f) => `<div class="gonogo-factor ${escapeAttr(f.status)}"><span>${escapeHtml(f.label)}</span><b>${escapeHtml(f.detail)}</b></div>`)
        .join("")}
    </div>
    ${
      includeActions && g.actions.length
        ? `<div class="gonogo-actions">${g.actions
            .map((a) => `<button class="ghost-button" data-view-target="${escapeAttr(a.view)}" type="button">${escapeHtml(a.label)}</button>`)
            .join("")}</div>`
        : ""
    }
  `;
}

function renderGoNoGo() {
  const card = $("#goNoGoCard");
  if (!card) return;
  if (activeRole === "admin") {
    const summary = adminDashboardSummary();
    const hasAttention = summary.attention || summary.notifyIncomplete || summary.reportMissing;
    card.className = `gonogo-card gonogo-${hasAttention ? "caution" : "go"}`;
    card.innerHTML = `
      <div class="gonogo-verdict">
        <span class="gonogo-icon">▦</span>
        <div>
          <strong>本日確認が必要な案件 ${escapeHtml(String(summary.attention + summary.notifyIncomplete + summary.reportMissing + summary.droneMissing + summary.altitudeNeed))}件</strong>
          <span>${escapeHtml(adminDashboardFilters.prefecture)} ${escapeHtml(adminDashboardFilters.municipality)} / ${escapeHtml(summary.date)}。この画面は散布の許可・承認を行うものではありません。</span>
        </div>
      </div>
      <div class="gonogo-factors">
        <div class="gonogo-factor ${summary.inquiry ? "warn" : "good"}"><span>問い合わせあり</span><b>${summary.inquiry}件</b></div>
        <div class="gonogo-factor ${summary.reportMissing ? "warn" : "good"}"><span>報告未提出</span><b>${summary.reportMissing}件</b></div>
        <div class="gonogo-factor ${summary.droneMissing ? "warn" : "good"}"><span>ログ未取込</span><b>${summary.droneMissing}件</b></div>
        <div class="gonogo-factor ${summary.notifyIncomplete ? "warn" : "good"}"><span>通知未完了</span><b>${summary.notifyIncomplete}件</b></div>
        <div class="gonogo-factor ${summary.altitudeNeed ? "warn" : "good"}"><span>高度要確認</span><b>${summary.altitudeNeed}件</b></div>
      </div>
      <div class="gonogo-actions">
        <button class="ghost-button" data-view-target="admin" type="button">散布予定・実績で詳細確認</button>
      </div>
    `;
    return;
  }
  if (activeRole === "neighbor") {
    const notices = neighborRelevantNotices();
    const pending = notices.filter((notice) => notice.response === "未回答");
    const consulting = notices.filter((notice) => notice.response !== "未回答" && notice.response !== "確認しました");
    const headline = pending.length
      ? "未返信の散布通知があります"
      : consulting.length
        ? "未返信はありません。相談中の案件があります"
        : "現在の通知状況：未返信なし";
    card.className = `gonogo-card gonogo-${pending.length ? "caution" : "go"}`;
    card.innerHTML = `
      <div class="gonogo-verdict">
        <span class="gonogo-icon">通</span>
        <div>
          <strong>${escapeHtml(headline)}</strong>
          <span>あなたの圃場に関係する散布予定と返信状況を表示しています。</span>
        </div>
      </div>
      <div class="gonogo-factors">
        <div class="gonogo-factor ${pending.length ? "warn" : "good"}"><span>未返信通知</span><b>${pending.length}件</b></div>
        <div class="gonogo-factor ${notices.length ? "warn" : "good"}"><span>近日散布予定</span><b>${notices.length}件</b></div>
        <div class="gonogo-factor ${consulting.length ? "warn" : "good"}"><span>相談中</span><b>${consulting.length}件</b></div>
        <div class="gonogo-factor good"><span>公開範囲</span><b>${escapeHtml(activeField().publicScope || "概略のみ共有")}</b></div>
      </div>
      <div class="gonogo-actions">
        <button class="ghost-button" data-view-target="notify" type="button">通知に返信</button>
        <button class="ghost-button" data-view-target="fields" type="button">公開範囲を確認</button>
      </div>
    `;
    return;
  }
  const plan = activePlan();
  const g = sprayGoNoGo(plan);
  const display = activeRole === "admin" ? { ...g, actions: [{ view: "admin", label: "散布予定・実績で確認" }] } : g;
  card.className = `gonogo-card gonogo-${g.verdict}`;
  card.innerHTML = goNoGoInner(display, plan, true);
}

function renderDashboard() {
  renderGoNoGo();
  const metrics = getDashboardMetrics();
  $("#kpiGrid").innerHTML = metrics
    .map(
      (metric) => `
        <article class="kpi-card ${metric.alert ? "alert" : ""}">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(String(metric.value))}</strong>
          <span>${escapeHtml(metric.note)}</span>
        </article>
      `,
    )
    .join("");

  if (activeRole === "admin") {
    renderAdminDashboardContent();
    return;
  }
  if (activeRole === "neighbor") {
    renderNeighborDashboardContent();
    return;
  }

  const plan = activePlan();
  $("#focusPlanTitle").textContent = `${plan.date} ${plan.timeWindow} ${plan.fieldName}`;
  renderDashboardGisMap();

  const riskItems = riskItemsForPlan(plan).slice(0, 4);
  const focusChecklist = $("#focusChecklist");
  if (focusChecklist) {
    focusChecklist.innerHTML = [
      statusRow("散布方法", `${plan.method} / ${plan.pesticide}`, "blue"),
      statusRow("通知状況", notificationLabel(plan), notificationIsComplete(plan) ? "green" : "amber"),
      statusRow("風向・風速", weatherLabel(plan), windNeedsAttention(plan) ? "amber" : "green"),
      ...riskItems.map((item) => statusRow(item.name, item.message, item.level === "high" ? "amber" : "green")),
    ].join("");
  }

  const priorityPlans = state.plans
    .map((planItem) => ({ plan: planItem, score: priorityScore(planItem), level: riskLevel(planItem) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  $("#priorityList").innerHTML = priorityPlans.length
    ? priorityPlans
        .map(
          ({ plan: planItem, level }) => `
            <button class="priority-row" type="button" data-plan-jump="${escapeAttr(planItem.id)}">
              <span>
                <strong>${escapeHtml(planItem.fieldName)}</strong>
                <span>${escapeHtml(planItem.date)} ${escapeHtml(planItem.timeWindow)} / ${escapeHtml(planItem.method)}</span>
              </span>
              ${riskTag(level)}
            </button>
          `,
        )
        .join("")
    : `<div class="empty-state">要確認の予定はありません。</div>`;
  $$("[data-plan-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activePlanId = button.dataset.planJump;
      saveState();
      renderAll();
      switchView("plans");
    });
  });

  $("#timeline").innerHTML = buildTimeline(plan)
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></li>`)
    .join("");

  $("#planTableBody").innerHTML = state.plans
    .slice()
    .sort((a, b) => `${a.date} ${a.timeWindow}`.localeCompare(`${b.date} ${b.timeWindow}`))
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.date)}<br><span class="small-note">${escapeHtml(row.timeWindow)}</span></td>
          <td>${escapeHtml(row.fieldName)}<br><span class="small-note">${escapeHtml(row.district)}</span></td>
          <td>${escapeHtml(row.method)}</td>
          <td>${progressPill(row)}</td>
          <td>${notificationPill(row)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderNeighborDashboardContent() {
  const field = activeField();
  const notices = neighborRelevantNotices();
  $("#focusPlanTitle").textContent = `${field.name} に関係する散布予定`;
  renderDashboardGisMap();

  $("#priorityList").innerHTML = notices.length
    ? notices
        .slice(0, 5)
        .map((notice) => {
          const wind = noticeWindSummary(notice);
          const responseClass = notice.response === "未回答" ? "amber" : notice.response === "確認しました" ? "green" : "blue";
          return `
            <button class="priority-row" type="button" data-view-target="notify">
              <span>
                <strong>${escapeHtml(notice.plan.date)} ${escapeHtml(notice.plan.timeWindow)} ${escapeHtml(notice.plan.fieldName)}</strong>
                <span>${escapeHtml(notice.plan.pesticide)} / 距離 ${escapeHtml(notice.distanceLabel)} / ${escapeHtml(wind.label)}</span>
              </span>
              <span class="pill ${responseClass}">${escapeHtml(notice.response)}</span>
            </button>
          `;
        })
        .join("")
    : `<div class="empty-state">あなたに関係する近日の散布通知はありません。</div>`;

  $("#timeline").innerHTML = [
    { title: "自分の圃場", detail: `${field.name} / ${field.cultivation || "未登録"} / ${field.notifyPreference || "通知未確認"}` },
    { title: "公開範囲", detail: field.publicScope || "概略のみ共有" },
    { title: "未返信通知", detail: `${notices.filter((notice) => notice.response === "未回答").length}件` },
    { title: "次の操作", detail: "通知への返信、連絡方法、公開範囲を確認します。" },
  ]
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></li>`)
    .join("");

  $("#planTableBody").innerHTML = notices.length
    ? notices
        .map((notice) => {
          const wind = noticeWindSummary(notice);
          const responseClass = notice.response === "未回答" ? "amber" : notice.response === "確認しました" ? "green" : "blue";
          return `
            <tr>
              <td>${escapeHtml(notice.plan.date)}<br><span class="small-note">${escapeHtml(notice.plan.timeWindow)}</span></td>
              <td>${escapeHtml(notice.plan.fieldName)}<br><span class="small-note">距離 ${escapeHtml(notice.distanceLabel)}</span></td>
              <td>${escapeHtml(notice.plan.method)}<br><span class="small-note">${escapeHtml(notice.plan.pesticide)}</span></td>
              <td><span class="pill ${wind.className}">${escapeHtml(wind.label)}</span></td>
              <td><span class="pill ${responseClass}">${escapeHtml(notice.response)}</span></td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="5"><div class="empty-state">近日の通知はありません。</div></td></tr>`;
}

function renderAdminDashboardContent() {
  const summary = adminDashboardSummary();
  const plans = adminDashboardPlans().sort((a, b) => `${a.date} ${a.timeWindow}`.localeCompare(`${b.date} ${b.timeWindow}`));
  const attentionPlans = adminRegionPlans()
    .map((planItem) => ({ plan: planItem, score: priorityScore(planItem), level: riskLevel(planItem) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  $("#focusPlanTitle").textContent = `${adminDashboardFilters.municipality} ${summary.date} の散布状況`;
  renderDashboardGisMap();

  $("#priorityList").innerHTML = attentionPlans.length
    ? attentionPlans
        .map(
          ({ plan: planItem, level }) => `
            <button class="priority-row" type="button" data-plan-jump="${escapeAttr(planItem.id)}">
              <span>
                <strong>${escapeHtml(planItem.fieldName)}</strong>
                <span>${escapeHtml(planItem.date)} ${escapeHtml(planItem.timeWindow)} / ${escapeHtml(planItem.operator)}</span>
                <span class="pill-line">${renderAdminReasonChips(planItem, 2)}</span>
              </span>
              ${riskTag(level)}
            </button>
          `,
        )
        .join("")
    : `<div class="empty-state">この地域で追加確認が必要な散布はありません。</div>`;

  $$("[data-plan-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      adminSelectedId = button.dataset.planJump;
      state.activePlanId = adminSelectedId;
      saveState();
      renderAll();
      switchView("admin");
    });
  });

  $("#timeline").innerHTML = [
    { title: "地域条件", detail: `${adminDashboardFilters.prefecture} ${adminDashboardFilters.municipality}` },
    { title: "対象日", detail: `${summary.date} / 予定 ${summary.planned}件・実施済み ${summary.done}件` },
    { title: "確認キュー", detail: `通知未完了 ${summary.notifyIncomplete}件 / 報告未提出 ${summary.reportMissing}件 / ドローンログ未取込 ${summary.droneMissing}件` },
    { title: "航空写真表示", detail: "黄が散布予定、緑が実施済み、赤が追加確認対象です。" },
    { title: "位置づけ", detail: "散布の許可・承認ではなく、記録状況と追加確認対象の一覧です。" },
  ]
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></li>`)
    .join("");

  $("#planTableBody").innerHTML = plans.length
    ? plans
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.date)}<br><span class="small-note">${escapeHtml(row.timeWindow)}</span></td>
              <td>${escapeHtml(row.fieldName)}<br><span class="small-note">${escapeHtml(row.district)}</span></td>
              <td>${escapeHtml(row.method)}<br><span class="small-note">${escapeHtml(row.materialType || "農薬")}</span></td>
              <td>${row.report.doneDate ? '<span class="pill green">実施済み</span>' : '<span class="pill amber">予定</span>'}</td>
              <td>${notificationPill(row)}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="5"><div class="empty-state">選択した日付・市町村の散布予定や実績はありません。</div></td></tr>`;
}

function renderPlanForm() {
  const plan = activePlan();
  const form = $("#planForm");
  Object.entries({
    date: plan.date,
    timeWindow: plan.timeWindow,
    fieldName: plan.fieldName,
    district: plan.district,
    crop: plan.crop,
    materialType: plan.materialType,
    pesticide: plan.pesticide,
    purpose: plan.purpose,
    method: plan.method,
    operator: plan.operator,
    contact: plan.contact,
    droneModel: plan.droneModel,
    aircraftRegistration: plan.aircraftRegistration,
    pilot: plan.pilot,
    assistant: plan.assistant,
    sprayDevice: plan.sprayDevice,
    nozzle: plan.nozzle,
    plannedAltitude: plan.plannedAltitude,
    plannedSpeed: plan.plannedSpeed,
    pesticideRegistration: plan.pesticideRegistration,
    preHarvestDays: plan.preHarvestDays,
    amount: plan.amount,
    dilution: plan.dilution,
    ratePer10a: plan.ratePer10a,
    rateUnit: plan.rateUnit,
    areaHa: plan.areaHa,
    sprayWidthM: plan.sprayWidthM,
    labelCheckedAt: plan.labelCheckedAt,
    sprayArea: plan.sprayArea,
    notes: plan.notes,
  }).forEach(([name, value]) => {
    const input = form.elements[name];
    if (input) input.value = value === 0 || value ? value : "";
  });

  updatePlanTotalPreview(plan);

  const riskItems = riskItemsForPlan(plan);
  $("#planRiskSummary").innerHTML = riskItems.length
    ? riskItems
        .map(
          (item) => `
            <div class="risk-row">
              <div class="pill-line">
                ${riskTag(item.level)}
                <span class="pill">${escapeHtml(item.distanceLabel)}</span>
              </div>
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.message)}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">周辺確認項目はありません。</div>`;

  $("#planReadinessSummary").innerHTML = renderReadinessCards(plan);

  const progress = checkProgress(plan);
  $("#planProgressLabel").textContent = `${progress.done}/${progress.total}`;
  $("#planProgressMeter").style.width = `${progress.percent}%`;
}

function saveEquipmentTemplate() {
  const form = $("#planForm");
  if (!form) return;
  const tpl = {};
  EQUIPMENT_FIELDS.forEach((name) => {
    const el = form.elements[name];
    if (!el) return;
    tpl[name] = name === "sprayWidthM" ? toNumber(el.value) : el.value.trim();
  });
  state.equipmentTemplate = tpl;
  saveState();
  showToast("機体・操縦者を既定として保存しました。以後の新規計画に自動反映されます。");
}

function applyEquipmentTemplate() {
  const plan = activePlan();
  const tpl = equipmentTemplate();
  EQUIPMENT_FIELDS.forEach((name) => {
    plan[name] = tpl[name];
  });
  saveState();
  renderPlanForm();
  showToast("既定の機体・操縦者を反映しました。");
}

function updatePlanTotalPreview(plan = activePlan()) {
  const el = $("#planTotalAmount");
  if (!el) return;
  const form = $("#planForm");
  const source = form && form.elements.ratePer10a
    ? { ratePer10a: form.elements.ratePer10a.value, areaHa: form.elements.areaHa.value, rateUnit: form.elements.rateUnit.value }
    : plan;
  const total = plannedTotalAmount(source);
  const cov = estimateCoverage(plan);
  const covNote = cov.hasLog && cov.coveragePct != null ? ` ／ 飛行ログのカバー率 ${cov.coveragePct}%` : "";
  el.innerHTML = total
    ? `総散布量の目安：<strong>${escapeHtml(formatAmountValue(total.value, total.unit))}</strong>（${escapeHtml(trimNumber(toNumber(source.ratePer10a)))}${escapeHtml(source.rateUnit || "mL")}/10a × ${escapeHtml(trimNumber(toNumber(source.areaHa)))}ha）${escapeHtml(covNote)}`
    : "使用量（数値）と面積（ha）を入力すると、総散布量を自動計算します。";
}

function renderMapView() {
  initMapLibre();
  updateGisMap(mapLibreMap);

  const plan = activePlan();
  const metrics = mapWeatherMetrics(plan);
  $("#mapDashMetrics").innerHTML = metrics
    .map((item) => `<div class="dash-metric"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.value)}</b><small>${escapeHtml(item.note)}</small></div>`)
    .join("");
  $("#mapStatusLabel").textContent = weatherDecision(plan).label;
  renderGisLegend($("#mapLegend"));

  const risks = riskItemsForPlan(plan);
  $("#mapRiskList").innerHTML = risks
    .map(
      (item) => `
        <div class="risk-row">
          <div class="pill-line">
            ${riskTag(item.level)}
            <span class="pill ${item.notified ? "green" : "amber"}">${item.notified ? "通知済み" : "通知対象"}</span>
          </div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.message)}</span>
        </div>
      `,
    )
    .join("");

  $("#mapWindCard").innerHTML = weatherCard(plan);
  renderCoveragePanel();
  renderPrescriptionPanel();
  renderBoundarySelector();
}

function renderDashboardGisMap() {
  const container = $("#dashboardGisMap");
  if (!container) return;
  initDashboardMapLibre();
  renderDashboardMapReadouts();
  updateGisMap(dashboardMapLibreMap, { dashboard: true, adminDashboard: activeRole === "admin" });
}

function renderDashboardMapReadouts() {
  if (activeRole === "admin") {
    const summary = adminDashboardSummary();
    $("#dashboardMapCardTitle").textContent = "日付別散布状況";
    $("#dashboardMapDate").textContent = summary.date;
    const decisionEl = $("#dashboardMapDecision");
    decisionEl.textContent = summary.attention ? "要確認あり" : summary.total ? "確認対象あり" : "予定なし";
    decisionEl.className = summary.attention ? "status-red" : summary.total ? "status-amber" : "status-green";
    $("#dashboardMapWind").textContent = `${summary.planned}件 予定`;
    $("#dashboardMapRain").textContent = `実施済み ${summary.done}件 / 通知未完了 ${summary.notifyIncomplete}件`;
    $("#dashboardMapMetrics").innerHTML = [
      { label: "実施済み", value: `${summary.done}件`, note: "緑で表示", level: summary.done ? "good" : "warn" },
      { label: "散布予定", value: `${summary.planned}件`, note: "黄で表示", level: summary.planned ? "warn" : "good" },
      { label: "要確認", value: `${summary.attention}件`, note: "赤で表示", level: summary.attention ? "bad" : "good" },
      { label: "通知未完了", value: `${summary.notifyIncomplete}件`, note: "近隣通知", level: summary.notifyIncomplete ? "warn" : "good" },
    ]
      .map(
        (item) => `
          <div>
            <span>${escapeHtml(item.label)}</span>
            <strong class="${item.level === "bad" ? "bad" : item.level === "warn" ? "warn" : "good"}">${escapeHtml(item.value)}</strong>
            <small>${escapeHtml(item.note)}</small>
          </div>
        `,
      )
      .join("");
    $("#dashboardTrackSummary").textContent = "対象日の予定・実績を航空写真に重ねて表示";
    $("#dashboardFieldCount").textContent = `${summary.total}件`;
    renderGisLegend($("#dashboardMapLegend"), "admin-dashboard");
    return;
  }

  $("#dashboardMapCardTitle").textContent = "散布前確認支援";
  const plan = activePlan();
  const weather = plan.weather || {};
  const decision = weatherDecision(plan);
  const downwind = downwindDirection(weather.actualDirection || weather.forecastDirection);
  const speed = weather.actualSpeed || weather.forecastSpeed || "--";
  const direction = weather.actualDirection || weather.forecastDirection || "--";
  const date = new Date(`${plan.date}T00:00:00+09:00`);
  const day = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  $("#dashboardMapDate").textContent = `${date.getMonth() + 1}/${date.getDate()}(${day})`;
  const decisionEl = $("#dashboardMapDecision");
  decisionEl.textContent = decision.label;
  decisionEl.className = decision.className;
  $("#dashboardMapWind").textContent = `${direction} ${speed}m/s`;
  $("#dashboardMapRain").textContent = `風下 ${downwind} / 降雨 ${rainRiskLabel(weather)}`;
  const metrics = mapWeatherMetrics(plan);
  $("#dashboardMapMetrics").innerHTML = metrics
    .map(
      (item) => `
        <div>
          <span>${escapeHtml(item.label)}</span>
          <strong class="${item.level === "bad" ? "bad" : item.level === "warn" ? "warn" : "good"}">${escapeHtml(item.value)}</strong>
          <small>${escapeHtml(item.note)}</small>
        </div>
      `,
    )
    .join("");
  $("#dashboardTrackSummary").textContent = droneLogLabel();
  $("#dashboardFieldCount").textContent = `${state.fields.length}件`;
  renderGisLegend($("#dashboardMapLegend"));
}

function renderGisLegend(container, mode = "field") {
  if (!container) return;
  const items =
    mode === "admin-dashboard"
      ? [
          ["実施済み", ADMIN_DASHBOARD_COLORS.done],
          ["散布予定", ADMIN_DASHBOARD_COLORS.planned],
          ["要確認", ADMIN_DASHBOARD_COLORS.attention],
          ["周辺圃場", ADMIN_DASHBOARD_COLORS.surrounding],
        ]
      : [
          ["散布ほ場", FIELD_LAYER_COLORS.spray],
          ["有機・不使用", FIELD_LAYER_COLORS.organic],
          ["ハウス・育苗", FIELD_LAYER_COLORS.house],
          ["収穫直前", FIELD_LAYER_COLORS.preharvest],
          ["水源・水路", FIELD_LAYER_COLORS.water],
          ["施設・未確認", FIELD_LAYER_COLORS.public],
          ["飛行ログ", "#ffd84d"],
        ];
  container.innerHTML = items
    .map(([label, color]) => `<span><i style="background:${color}"></i>${escapeHtml(label)}</span>`)
    .join("");
}

function initDashboardMapLibre() {
  const container = $("#dashboardMapLibreCanvas");
  if (!container || dashboardMapLibreMap || !window.maplibregl) return;
  dashboardMapLibreMap = new maplibregl.Map({
    container,
    style: rasterMapStyle("photo"),
    center: DEFAULT_MAP_VIEW.center,
    zoom: DEFAULT_MAP_VIEW.zoom,
    bearing: DEFAULT_MAP_VIEW.bearing,
    pitch: 0,
    dragRotate: false,
    touchPitch: false,
    scrollZoom: false,
  });
  dashboardMapLibreMap.on("load", () => {
    dashboardMapLibreReady = true;
    setupGisMapLayers(dashboardMapLibreMap);
    updateGisMap(dashboardMapLibreMap, { dashboard: true, adminDashboard: activeRole === "admin" });
  });
}

function rasterMapStyle(kind = "std") {
  const tiles =
    kind === "photo"
      ? ["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"]
      : ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"];
  return {
    version: 8,
    sources: {
      gsi: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution: "地理院タイル",
      },
    },
    layers: [{ id: "gsi", type: "raster", source: "gsi" }],
  };
}

function emptyFeatureCollection() {
  return { type: "FeatureCollection", features: [] };
}

function setupGisMapLayers(map) {
  if (!map || map.__tonariGisReady || !map.getStyle()?.layers?.length) return;
  try {
    [
      "risk-buffer",
      "wind-zone",
      "parcels",
      "fields",
      "coverage-grid",
      "prescription-zones",
      "flight-lines",
      "flight-points",
      "drone-marker",
    ].forEach((id) => {
      if (!map.getSource(id)) {
        map.addSource(id, { type: "geojson", data: emptyFeatureCollection() });
      }
    });

    map.addLayer({
      id: "parcels-fill",
      type: "fill",
      source: "parcels",
      paint: { "fill-color": "#7fd4ff", "fill-opacity": 0.06 },
    });
    map.addLayer({
      id: "parcels-outline",
      type: "line",
      source: "parcels",
      paint: { "line-color": "#39b7ff", "line-width": 0.6, "line-opacity": 0.55 },
    });
    map.addLayer({
      id: "risk-buffer-fill",
      type: "fill",
      source: "risk-buffer",
      paint: {
        "fill-color": ["case", ["==", ["get", "kind"], "organic"], "#e3a329", "#f2b84b"],
        "fill-opacity": ["case", ["==", ["get", "kind"], "organic"], 0.13, 0.1],
      },
    });
    map.addLayer({
      id: "risk-buffer-line",
      type: "line",
      source: "risk-buffer",
      paint: {
        "line-color": ["case", ["==", ["get", "kind"], "organic"], "#e3a329", "#f2b84b"],
        "line-width": ["case", ["==", ["get", "kind"], "organic"], 2.2, 1.6],
        "line-dasharray": [2, 1.2],
      },
    });
    map.addLayer({
      id: "wind-zone-fill",
      type: "fill",
      source: "wind-zone",
      paint: {
        "fill-color": ["case", ["==", ["get", "level"], "bad"], "#c94b44", "#2d8c49"],
        "fill-opacity": 0.2,
      },
    });
    map.addLayer({
      id: "field-fill",
      type: "fill",
      source: "fields",
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": ["case", ["==", ["get", "level"], "high"], 0.76, ["==", ["get", "notify"], 1], 0.66, 0.54],
      },
    });
    map.addLayer({
      id: "field-outline",
      type: "line",
      source: "fields",
      paint: {
        "line-color": ["case", ["==", ["get", "type"], "spray"], "#561d1a", "#162a44"],
        "line-width": ["case", ["==", ["get", "type"], "spray"], 2.7, 2],
      },
    });
    map.addLayer({
      id: "coverage-fill",
      type: "fill",
      source: "coverage-grid",
      paint: {
        "fill-color": ["case", ["==", ["get", "sprayed"], 1], "#2fbf6b", "#7c8a83"],
        "fill-opacity": ["case", ["==", ["get", "sprayed"], 1], 0.62, 0.32],
      },
    });
    map.addLayer({
      id: "coverage-outline",
      type: "line",
      source: "coverage-grid",
      paint: {
        "line-color": ["case", ["==", ["get", "sprayed"], 1], "#1f8f4d", "#5c6a62"],
        "line-width": 0.35,
        "line-opacity": 0.5,
      },
    });
    map.addLayer({
      id: "prescription-fill",
      type: "fill",
      source: "prescription-zones",
      paint: {
        "fill-color": ["coalesce", ["get", "_color"], "#addd8e"],
        "fill-opacity": 0.72,
      },
    });
    map.addLayer({
      id: "prescription-outline",
      type: "line",
      source: "prescription-zones",
      paint: {
        "line-color": "#204a2b",
        "line-width": 0.8,
        "line-opacity": 0.55,
      },
    });
    map.addLayer({
      id: "flight-lines",
      type: "line",
      source: "flight-lines",
      filter: ["==", ["get", "sprayOn"], 0],
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.2,
        "line-opacity": 0.68,
        "line-dasharray": [1.8, 1.2],
      },
    });
    map.addLayer({
      id: "flight-lines-spray",
      type: "line",
      source: "flight-lines",
      filter: ["==", ["get", "sprayOn"], 1],
      paint: {
        "line-color": "#ffd84d",
        "line-width": 2.4,
        "line-opacity": 0.98,
      },
    });
    map.addLayer({
      id: "flight-points",
      type: "circle",
      source: "flight-points",
      paint: {
        "circle-radius": ["case", ["==", ["get", "outside"], 1], 6, 5],
        "circle-color": ["case", ["==", ["get", "outside"], 1], "#c94b44", "#e3a329"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    });
    map.addLayer({
      id: "drone-marker-halo",
      type: "circle",
      source: "drone-marker",
      paint: {
        "circle-radius": 14,
        "circle-color": "#1f6fe0",
        "circle-opacity": 0.22,
      },
    });
    map.addLayer({
      id: "drone-marker-dot",
      type: "circle",
      source: "drone-marker",
      paint: {
        "circle-radius": 7,
        "circle-color": "#1f6fe0",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });

    map.on("click", "parcels-fill", (event) => showParcelPopup(map, event));
    map.on("mouseenter", "parcels-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "parcels-fill", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", "field-fill", (event) => showGisFieldPopup(map, event));
    map.on("mouseenter", "field-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "field-fill", () => {
      map.getCanvas().style.cursor = "";
    });
    map.__tonariGisReady = true;
  } catch (error) {
    console.warn("GISレイヤーの初期化を待機します。", error);
  }
}

function updateGisMap(map, options = {}) {
  if (!map || !map.getStyle()?.layers?.length) return;
  setupGisMapLayers(map);
  if (!map.__tonariGisReady) return;
  setGeoJsonSource(map, "parcels", parcelData || emptyFeatureCollection());
  setGeoJsonSource(map, "fields", options.adminDashboard ? adminDashboardFieldFeatureCollection() : fieldFeatureCollection());
  setGeoJsonSource(map, "risk-buffer", riskBufferFeatureCollection());
  setGeoJsonSource(map, "wind-zone", windZoneFeatureCollection(activePlan()));
  setGeoJsonSource(map, "flight-lines", flightLineFeatureCollection());
  setGeoJsonSource(map, "flight-points", flightPointFeatureCollection());
  const coverage = !options.dashboard && mapLayer === "coverage" ? coverageMapData(activePlan(), coveragePlayIndex) : null;
  setGeoJsonSource(map, "coverage-grid", coverage ? coverage.cells : emptyFeatureCollection());
  setGeoJsonSource(map, "drone-marker", coverage ? coverage.marker : emptyFeatureCollection());
  const prescription = !options.dashboard && mapLayer === "prescription" ? prescriptionZonesFeatureCollection(activePlan()) : emptyFeatureCollection();
  setGeoJsonSource(map, "prescription-zones", prescription);
  applyGisLayerVisibility(map, options);
}

function focusVisibleMaps(mode) {
  [mapLibreMap, dashboardMapLibreMap].forEach((map) => focusGisMap(map, mode));
}

function focusGisMap(map, mode) {
  if (!map) return;
  map.resize();
  if (mode === "all") {
    const bounds = currentMapBounds();
    map.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: 70, duration: 500, bearing: DEFAULT_MAP_VIEW.bearing },
    );
    return;
  }
  const center = fieldCenterLngLat();
  if (mode === "wind") {
    const plan = activePlan();
    const downwind = downwindDirection(plan.weather.actualDirection || plan.weather.forecastDirection);
    const windCenter = offsetLngLat(center, 120, directionToBearing(downwind));
    map.flyTo({ center: windCenter, zoom: 15.05, bearing: DEFAULT_MAP_VIEW.bearing, duration: 500 });
    return;
  }
  map.flyTo({ center, zoom: 15.25, bearing: DEFAULT_MAP_VIEW.bearing, duration: 500 });
}

function setGeoJsonSource(map, id, data) {
  const source = map.getSource(id);
  if (source) source.setData(data);
}

function applyGisLayerVisibility(map, options = {}) {
  const adminDashboard = Boolean(options.adminDashboard);
  const always = Boolean(options.dashboard) && !adminDashboard;
  const coverage = !adminDashboard && !always && mapLayer === "coverage";
  const showRisk = adminDashboard ? false : always || mapLayer === "risk";
  const showWind = adminDashboard ? false : always || mapLayer === "risk";
  const showDrone = adminDashboard ? false : always || mapLayer === "drone" || coverage;
  const visibility = {
    "risk-buffer-fill": showRisk,
    "risk-buffer-line": showRisk,
    "wind-zone-fill": showWind,
    "flight-lines": showDrone,
    "flight-lines-spray": showDrone,
    "flight-points": showDrone && !coverage,
    "coverage-fill": coverage,
    "coverage-outline": coverage,
    "drone-marker-halo": coverage,
    "drone-marker-dot": coverage,
    "prescription-fill": !always && mapLayer === "prescription",
    "prescription-outline": !always && mapLayer === "prescription",
  };
  Object.entries(visibility).forEach(([layerId, visible]) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    }
  });
}

function fieldFeatureCollection() {
  const plan = activePlan();
  const risks = new Map(riskItemsForPlan(plan).map((item) => [item.id, item]));
  return {
    type: "FeatureCollection",
    features: state.fields.map((field, index) => {
      const risk = risks.get(field.id);
      return {
        type: "Feature",
        id: field.id,
        geometry: {
          type: "Polygon",
          coordinates: [fieldPolygonCoordinates(field, index)],
        },
        properties: {
          id: field.id,
          type: field.type,
          name: field.name,
          short: field.short,
          crop: field.crop || "",
          cultivation: field.cultivation || "",
          distance: field.distance || "",
          direction: field.direction || "",
          notify: risk?.notifyTarget ? 1 : 0,
          level: risk?.level || (field.type === "spray" ? "spray" : "low"),
          color: FIELD_LAYER_COLORS[field.type] || FIELD_LAYER_COLORS.public,
        },
      };
    }),
  };
}

function adminDashboardFieldFeatureCollection() {
  const plans = adminDashboardPlans();
  const byField = new Map();
  plans.forEach((plan) => {
    const keys = [plan.fieldName, activeSprayField()?.name].filter(Boolean);
    keys.forEach((key) => {
      if (!byField.has(key)) byField.set(key, []);
      byField.get(key).push(plan);
    });
  });
  return {
    type: "FeatureCollection",
    features: state.fields.map((field, index) => {
      const matches = byField.get(field.name) || (field.type === "spray" ? plans : []);
      const status = adminDashboardFieldStatus(matches);
      return {
        type: "Feature",
        id: field.id,
        geometry: {
          type: "Polygon",
          coordinates: [fieldPolygonCoordinates(field, index)],
        },
        properties: {
          id: field.id,
          type: field.type,
          name: field.name,
          short: field.short,
          crop: field.crop || "",
          cultivation: field.cultivation || "",
          distance: field.distance || "",
          direction: field.direction || "",
          notify: status.notify,
          level: status.level,
          color: status.color,
          adminStatus: status.label,
        },
      };
    }),
  };
}

function adminDashboardFieldStatus(plans) {
  if (!plans.length) {
    return { label: "周辺圃場", color: ADMIN_DASHBOARD_COLORS.surrounding, level: "low", notify: 0 };
  }
  if (plans.some((plan) => riskLevel(plan) === "high")) {
    return { label: "要確認", color: ADMIN_DASHBOARD_COLORS.attention, level: "high", notify: 1 };
  }
  if (plans.some((plan) => Boolean(plan.report.doneDate))) {
    return { label: "実施済み", color: ADMIN_DASHBOARD_COLORS.done, level: "high", notify: 1 };
  }
  return { label: "散布予定", color: ADMIN_DASHBOARD_COLORS.planned, level: "high", notify: 1 };
}

function fieldPolygonCoordinates(field, index = 0) {
  if (Array.isArray(field.geo) && field.geo.length >= 3) {
    const ring = field.geo.map(([lng, lat]) => [Number(lng), Number(lat)]);
    ring.push([...ring[0]]);
    return ring;
  }
  if (Array.isArray(field.geoShape) && field.geoShape.length >= 3) {
    const ring = field.geoShape.map(([x, y]) => lngLatFromPercent(x, y));
    ring.push([...ring[0]]);
    return ring;
  }
  const shapes = {
    "spray-field-a": [[0, 0.08], [0.88, 0], [1, 0.72], [0.58, 1], [0, 0.84]],
    "organic-field-a": [[0.1, 0], [1, 0], [1, 0.86], [0.24, 1], [0, 0.55]],
    "no-chemical-field-b": [[0, 0.14], [0.92, 0], [1, 1], [0, 0.9]],
    "seedling-house-c": [[0, 0], [1, 0.08], [0.84, 1], [0.12, 0.92]],
    "preharvest-field-d": [[0.18, 0], [1, 0], [0.86, 1], [0, 0.82]],
    "water-channel-d": [[0.24, 0], [1, 0.1], [0.78, 1], [0, 0.88]],
  };
  const fallback = index % 2
    ? [[0, 0], [1, 0.08], [0.88, 1], [0.08, 0.92]]
    : [[0.08, 0], [1, 0], [0.92, 0.84], [0, 1]];
  const x = Number(field.x || 45);
  const y = Number(field.y || 45);
  const w = Number(field.w || 8);
  const h = Number(field.h || 8);
  const ring = (shapes[field.id] || fallback).map(([px, py]) => lngLatFromPercent(x + w * px, y + h * py));
  ring.push([...ring[0]]);
  return ring;
}

function activeSprayField() {
  const plan = activePlan();
  return state.fields.find((field) => field.name === plan.fieldName) || state.fields.find((field) => field.type === "spray") || state.fields[0];
}

function fieldCenterLngLat(field = activeSprayField()) {
  if (Array.isArray(field?.geo) && field.geo.length) {
    const sum = field.geo.reduce((acc, [lng, lat]) => ({ x: acc.x + Number(lng), y: acc.y + Number(lat) }), { x: 0, y: 0 });
    return [sum.x / field.geo.length, sum.y / field.geo.length];
  }
  if (Array.isArray(field?.geoShape) && field.geoShape.length) {
    const sum = field.geoShape.reduce(
      (acc, [x, y]) => {
        acc.x += Number(x);
        acc.y += Number(y);
        return acc;
      },
      { x: 0, y: 0 },
    );
    return lngLatFromPercent(sum.x / field.geoShape.length, sum.y / field.geoShape.length);
  }
  return lngLatFromPercent(Number(field?.x || 50) + Number(field?.w || 8) / 2, Number(field?.y || 50) + Number(field?.h || 8) / 2);
}

function lngLatFromPercent(x, y) {
  const bounds = currentMapBounds();
  const lng = bounds.west + (bounds.east - bounds.west) * (Number(x) / 100);
  const lat = bounds.north - (bounds.north - bounds.south) * (Number(y) / 100);
  return [lng, lat];
}

function riskBufferFeatureCollection() {
  const rules = activeSettings();
  const center = fieldCenterLngLat();
  return {
    type: "FeatureCollection",
    features: [
      circlePolygon(center, rules.notifyRadius, { kind: "notify", label: "通知範囲" }),
      circlePolygon(center, rules.organicRadius, { kind: "organic", label: "有機重点確認" }),
    ],
  };
}

function windZoneFeatureCollection(plan) {
  const weather = plan.weather || {};
  const center = fieldCenterLngLat();
  const downwind = downwindDirection(weather.actualDirection || weather.forecastDirection);
  const bearing = directionToBearing(downwind);
  const rules = activeSettings();
  const speed = Number(weather.actualSpeed || weather.forecastSpeed || 0);
  const length = Math.max(rules.notifyRadius * 1.6, 220);
  const width = Math.max(42, Math.min(95, length * 0.22));
  const tip = offsetLngLat(center, length, bearing);
  const left = offsetLngLat(offsetLngLat(center, width * 0.5, bearing - 90), length * 0.82, bearing);
  const right = offsetLngLat(offsetLngLat(center, width * 0.5, bearing + 90), length * 0.82, bearing);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[center, left, tip, right, center]] },
        properties: { direction: downwind, level: speed >= rules.windLimit ? "bad" : "warn" },
      },
    ],
  };
}

function flightLineFeatureCollection() {
  const points = (activeDroneLog()).points || [];
  const features = [];
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const point = points[index];
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [lngLatFromPercent(prev.x, prev.y), lngLatFromPercent(point.x, point.y)] },
      properties: { sprayOn: point.sprayOn ? 1 : 0 },
    });
  }
  return { type: "FeatureCollection", features };
}

function flightPointFeatureCollection() {
  const points = (activeDroneLog()).points || [];
  return {
    type: "FeatureCollection",
    features: points
      .filter((point) => point.altitudeCheck || point.outside)
      .map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: lngLatFromPercent(point.x, point.y) },
        properties: { outside: point.outside ? 1 : 0, altitudeCheck: point.altitudeCheck ? 1 : 0 },
      })),
  };
}

function directionToBearing(direction) {
  return DIRECTION_BEARING[direction] ?? 135;
}

function offsetLngLat([lng, lat], meters, bearingDeg) {
  const radius = 6378137;
  const bearing = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const distance = meters / radius;
  const nextLat = Math.asin(Math.sin(latRad) * Math.cos(distance) + Math.cos(latRad) * Math.sin(distance) * Math.cos(bearing));
  const nextLng =
    lngRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(distance) * Math.cos(latRad),
      Math.cos(distance) - Math.sin(latRad) * Math.sin(nextLat),
    );
  return [(nextLng * 180) / Math.PI, (nextLat * 180) / Math.PI];
}

function circlePolygon(center, radiusMeters, properties = {}) {
  if (window.turf?.circle) {
    return window.turf.circle(center, radiusMeters / 1000, { steps: 72, units: "kilometers", properties });
  }
  const ring = [];
  for (let angle = 0; angle <= 360; angle += 5) {
    ring.push(offsetLngLat(center, radiusMeters, angle));
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties };
}

function showGisFieldPopup(map, event) {
  const feature = event.features?.[0];
  if (!feature || !window.maplibregl) return;
  const field = state.fields.find((item) => item.id === feature.properties.id);
  if (!field) return;
  new maplibregl.Popup({ closeButton: false, offset: 14, className: "gis-popup" })
    .setLngLat(event.lngLat)
    .setHTML(gisFieldPopupHtml(field, feature.properties.adminStatus))
    .addTo(map);
}

function gisFieldPopupHtml(field, adminStatus = "") {
  return `
    <div class="pill-line">
      ${adminStatus ? `<span class="pill amber">${escapeHtml(adminStatus)}</span>` : ""}
      <span class="pill ${field.chemicalUse === "なし" || field.organicJas === "あり" ? "green" : "blue"}">${escapeHtml(field.cultivation || FIELD_TYPE_META[field.type]?.[0] || "未確認")}</span>
      <span class="pill ${field.notifyPreference === "希望する" ? "amber" : "green"}">${escapeHtml(field.notifyPreference || "通知候補")}</span>
    </div>
    <strong>${escapeHtml(field.name)}</strong>
    <span>${escapeHtml(field.crop || "作物未登録")} / ${escapeHtml(field.distance || "-")}m / ${escapeHtml(field.direction || "-")}</span>
    <button class="ghost-button mini-button" data-field-edit="${escapeAttr(field.id)}" type="button">圃場を編集</button>
  `;
}

function dashboardFieldClipPath(field, index) {
  const shapes = {
    "spray-field-a": "polygon(0 8%, 88% 0, 100% 72%, 58% 100%, 0 84%)",
    "organic-field-a": "polygon(10% 0, 100% 0, 100% 86%, 24% 100%, 0 55%)",
    "no-chemical-field-b": "polygon(0 14%, 92% 0, 100% 100%, 0 90%)",
    "seedling-house-c": "polygon(0 0, 100% 8%, 84% 100%, 12% 92%)",
    "preharvest-field-d": "polygon(18% 0, 100% 0, 86% 100%, 0 82%)",
    "water-channel-d": "polygon(24% 0, 100% 10%, 78% 100%, 0 88%)",
  };
  return shapes[field.id] || (index % 2 ? "polygon(0 0, 100% 8%, 88% 100%, 8% 92%)" : "polygon(8% 0, 100% 0, 92% 84%, 0 100%)");
}

function renderDashboardFlightOverlay(container) {
  const log = activeDroneLog();
  if (!log.points?.length) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("dashboard-flight-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  for (let index = 1; index < log.points.length; index += 1) {
    const prev = log.points[index - 1];
    const point = log.points[index];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", prev.x);
    line.setAttribute("y1", prev.y);
    line.setAttribute("x2", point.x);
    line.setAttribute("y2", point.y);
    line.setAttribute("class", point.sprayOn ? "dashboard-flight-line spray-on" : "dashboard-flight-line");
    svg.appendChild(line);
  }
  container.appendChild(svg);
}

function showDashboardMapPopup(container, field) {
  $$(".dashboard-map-popup", container).forEach((node) => node.remove());
  const popup = document.createElement("div");
  popup.className = "dashboard-map-popup dashboard-glass-card";
  popup.style.left = `${Math.min(72, Number(field.x || 45) + Number(field.w || 8) + 1)}%`;
  popup.style.top = `${Math.max(8, Number(field.y || 35) - 4)}%`;
  popup.innerHTML = `
    <div class="pill-line">
      <span class="pill ${field.chemicalUse === "なし" || field.organicJas === "あり" ? "green" : "blue"}">${escapeHtml(field.cultivation || FIELD_TYPE_META[field.type]?.[0] || "未確認")}</span>
      <span class="pill ${field.notifyPreference === "希望する" ? "amber" : "green"}">${escapeHtml(field.notifyPreference || "通知候補")}</span>
    </div>
    <strong>${escapeHtml(field.name)}</strong>
    <span>${escapeHtml(field.crop || "作物未登録")} / ${escapeHtml(field.distance || "-")}m / ${escapeHtml(field.direction || "-")}</span>
    <button class="ghost-button mini-button" data-field-edit="${escapeAttr(field.id)}" type="button">圃場を編集</button>
  `;
  container.appendChild(popup);
}

function renderMap(container, options = {}) {
  const mini = Boolean(options.mini);
  $$(".plot, .risk-ring, .wind-arrow, .flight-svg, .map-field-popup", container).forEach((node) => node.remove());

  const ring = document.createElement("div");
  ring.className = "risk-ring";
  if (mini) {
    ring.style.width = "190px";
    ring.style.height = "190px";
  }
  container.appendChild(ring);

  state.fields.forEach((field) => {
    const meta = FIELD_TYPE_META[field.type] || FIELD_TYPE_META.public;
    const plot = document.createElement("div");
    plot.className = `plot ${meta[1]}`;
    plot.style.left = `${field.x}%`;
    plot.style.top = `${field.y}%`;
    plot.style.width = `${field.w}%`;
    plot.style.height = `${field.h}%`;
    plot.textContent = field.short;
    plot.tabIndex = 0;
    plot.setAttribute("role", "button");
    plot.addEventListener("click", () => showMapFieldPopup(container, field));
    plot.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showMapFieldPopup(container, field);
      }
    });
    const label = document.createElement("span");
    label.className = "plot-label";
    label.textContent = `${field.name} / ${meta[0]}`;
    plot.appendChild(label);
    container.appendChild(plot);
  });

  const plan = activePlan();
  const downwind = downwindDirection(plan.weather.actualDirection || plan.weather.forecastDirection);
  const arrow = document.createElement("div");
  arrow.className = "wind-arrow";
  arrow.style.transform = `rotate(${DIRECTION_ANGLE[downwind] || 45}deg)`;
  if (mini) {
    arrow.style.width = "110px";
    arrow.style.height = "30px";
  }
  arrow.innerHTML = `<span>${escapeHtml(downwind)}</span>`;
  container.appendChild(arrow);
  renderFlightOverlay(container, mini);

  const legend = $("#mapLegend");
  if (legend && !mini) {
    const legendItems = [
      ["散布ほ場", "var(--red)"],
      ["有機・不使用", "var(--green)"],
      ["ハウス", "var(--blue)"],
      ["収穫直前", "var(--amber)"],
      ["水源・養蜂", "var(--brown)"],
    ];
    legend.innerHTML = legendItems
      .map(
        ([label, color]) => `
          <span class="legend-item" style="color:${color}">
            <span class="legend-dot"></span>${escapeHtml(label)}
          </span>
        `,
      )
      .join("");
  }
}

function showMapFieldPopup(container, field) {
  $$(".map-field-popup", container).forEach((node) => node.remove());
  const popup = document.createElement("div");
  popup.className = "map-field-popup";
  popup.style.left = `${Math.min(70, Number(field.x || 45) + Number(field.w || 8) + 1)}%`;
  popup.style.top = `${Math.max(8, Number(field.y || 35) - 4)}%`;
  popup.innerHTML = `
    <div class="pill-line">
      <span class="pill ${field.chemicalUse === "なし" || field.organicJas === "あり" ? "green" : "blue"}">${escapeHtml(field.cultivation || FIELD_TYPE_META[field.type]?.[0] || "未確認")}</span>
      <span class="pill ${field.notifyPreference === "希望する" ? "amber" : "green"}">${escapeHtml(field.notifyPreference || "通知候補")}</span>
    </div>
    <strong>${escapeHtml(field.name)}</strong>
    <span>${escapeHtml(field.crop || "作物未登録")} / ${escapeHtml(field.distance || "-")}m / ${escapeHtml(field.direction || "-")}</span>
    <button class="ghost-button mini-button" data-field-edit="${escapeAttr(field.id)}" type="button">圃場を編集</button>
  `;
  container.appendChild(popup);
}

function initMapLibre() {
  const container = $("#mapLibreCanvas");
  if (!container || mapLibreMap || !window.maplibregl) return;
  mapLibreMap = new maplibregl.Map({
    container,
    style: rasterMapStyle("photo"),
    center: DEFAULT_MAP_VIEW.center,
    zoom: DEFAULT_MAP_VIEW.zoom,
    bearing: DEFAULT_MAP_VIEW.bearing,
    pitch: 0,
    dragRotate: false,
    touchPitch: false,
    cooperativeGestures: true,
  });
  mapLibreMap.on("load", () => {
    mapLibreReady = true;
    setupGisMapLayers(mapLibreMap);
    updateGisMap(mapLibreMap);
  });
}

function renderFlightOverlay(container, mini) {
  const log = activeDroneLog();
  if (!log.points?.length) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("flight-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");

  for (let index = 1; index < log.points.length; index += 1) {
    const prev = log.points[index - 1];
    const point = log.points[index];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", prev.x);
    line.setAttribute("y1", prev.y);
    line.setAttribute("x2", point.x);
    line.setAttribute("y2", point.y);
    line.setAttribute("class", point.sprayOn ? "flight-line spray-on" : "flight-line");
    svg.appendChild(line);
  }

  log.points
    .filter((point) => point.altitudeCheck || point.outside)
    .forEach((point) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", mini ? 1.2 : 1.7);
      circle.setAttribute("class", point.outside ? "flight-point outside" : "flight-point altitude");
      svg.appendChild(circle);
    });

  container.appendChild(svg);
}

function renderFieldStatus() {
  const form = $("#fieldStatusForm");
  if (form) {
    const candidate = activeField();
    Object.entries({
      name: candidate.name,
      municipality: candidate.municipality,
      district: candidate.district,
      crop: candidate.crop,
      cultivation: candidate.cultivation,
      chemicalUse: candidate.chemicalUse,
      organicJas: candidate.organicJas,
      notifyPreference: candidate.notifyPreference,
      publicScope: candidate.publicScope,
      contactMethod: candidate.contactMethod,
      harvestWindow: candidate.harvestWindow,
      avoidReason: candidate.avoidReason,
    }).forEach(([name, value]) => {
      if (form.elements[name]) form.elements[name].value = value || "";
    });
    ["seedling", "house", "waterNear", "unregistered"].forEach((name) => {
      if (form.elements[name]) form.elements[name].checked = Boolean(candidate[name]);
    });
  }

  const list = $("#fieldStatusList");
  if (!list) return;
  list.innerHTML = state.fields
    .filter((field) => field.type !== "spray")
    .map(
      (field) => `
        <div class="field-status-row ${field.id === state.activeFieldId ? "active" : ""}">
          <div class="pill-line">
            <span class="pill ${field.chemicalUse === "なし" || field.organicJas === "あり" ? "green" : field.unregistered ? "amber" : "blue"}">${escapeHtml(field.cultivation || FIELD_TYPE_META[field.type]?.[0] || "未確認")}</span>
            <span class="pill ${field.notifyPreference === "希望する" ? "amber" : "green"}">${escapeHtml(field.notifyPreference || "通知候補")}</span>
            <span class="pill blue">${escapeHtml(field.publicScope || "概略のみ共有")}</span>
          </div>
          <strong>${escapeHtml(field.name)}</strong>
          <span>${escapeHtml(field.crop || "作物未登録")} / ${escapeHtml(field.avoidReason || "理由未登録")}</span>
          <button class="ghost-button mini-button" data-field-edit="${escapeAttr(field.id)}" type="button">この圃場を編集</button>
        </div>
      `,
    )
    .join("");
}

function renderDroneView() {
  const log = activeDroneLog();
  const plan = activePlan();
  const summary = $("#droneSummary");
  if (summary) {
    summary.innerHTML = `
      ${statusRow("対応メーカー", log.vendor, "blue")}
      ${statusRow("対応機種", plan.droneModel || log.model, "blue")}
      ${statusRow("SDK/API連携状況", log.sdkStatus, "amber")}
      ${statusRow("機体登録記号", plan.aircraftRegistration || log.aircraftRegistration, "green")}
      ${statusRow("リモートID", log.remoteId, "green")}
      ${statusRow("操縦者", plan.pilot || log.pilot, "blue")}
      ${statusRow("散布装置", plan.sprayDevice || log.sprayDevice, "blue")}
      ${statusRow("ログ取込状態", log.imported ? "サンプルログ取込済み" : "サンプルログ未取込", log.imported ? "green" : "amber")}
      ${statusRow("最終同期", log.lastSync, log.imported ? "green" : "amber")}
    `;
  }

  const flight = $("#flightLogSummary");
  if (flight) {
    flight.innerHTML = `
      <div class="flight-summary-grid">
        ${metricCard("飛行時間", `${log.startedAt} - ${log.endedAt}`)}
        ${metricCard("散布ON区間", `${log.sprayOnSegments}区間`)}
        ${metricCard("最大高度", `${maxAltitude(log)}m`)}
        ${metricCard("高度要確認", `${altitudeCheckCount(log)}点`)}
        ${metricCard("予定範囲外", log.outsideFlight ? "要確認" : "なし")}
      </div>
    `;
  }

  renderAltitudeChart(log);
  const advice = $("#droneAdviceList");
  if (advice) {
    advice.innerHTML = buildAdvice(plan)
      .map((item) => `<div class="advice-card"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div>`)
      .join("");
  }
}

function updateFieldStatusFromForm() {
  const form = $("#fieldStatusForm");
  const target = activeField();
  if (!target || !form) return;
  ["name", "municipality", "district", "crop", "cultivation", "chemicalUse", "organicJas", "notifyPreference", "publicScope", "contactMethod", "harvestWindow", "avoidReason"].forEach((name) => {
    target[name] = form.elements[name].value.trim();
  });
  ["seedling", "house", "waterNear", "unregistered"].forEach((name) => {
    target[name] = form.elements[name].checked;
  });
  target.notifyTarget = target.notifyPreference !== "未確認";
  if (target.chemicalUse === "なし" || target.organicJas === "あり") {
    target.type = target.organicJas === "あり" ? "organic" : "noChemical";
    target.short = "不使";
  } else if (target.house || target.seedling) {
    target.type = "house";
    target.short = "育苗";
  } else if (target.waterNear) {
    target.type = "water";
    target.short = "水路";
  } else if (target.unregistered) {
    target.type = "public";
    target.short = "未確";
  }
  target.updatedAt = dateOffset(0);
}

function renderAltitudeChart(log) {
  const chart = $("#altitudeChart");
  if (!chart) return;
  const points = downsampleAltitudePoints(log.points || [], 14);
  const max = Math.max(1, ...points.map((point) => point.altitude));
  const showLabels = points.length <= 12;
  chart.innerHTML = points
    .map(
      (point) => `
        <div class="altitude-bar ${point.altitudeCheck ? "check" : ""}" style="height:${Math.max(12, (point.altitude / max) * 100)}%">
          ${showLabels ? `<span>${escapeHtml(point.altitude)}m</span>` : ""}
        </div>
      `,
    )
    .join("");
}

// Evenly sample down to at most `maxBars`, preserving any 高度要確認 (altitudeCheck) points.
function downsampleAltitudePoints(points, maxBars) {
  if (points.length <= maxBars) return points;
  const step = points.length / maxBars;
  const picked = new Map();
  for (let i = 0; i < maxBars; i += 1) {
    const idx = Math.min(points.length - 1, Math.round(i * step));
    picked.set(idx, points[idx]);
  }
  points.forEach((point, idx) => {
    if (point.altitudeCheck || point.outside) picked.set(idx, point);
  });
  return [...picked.keys()].sort((a, b) => a - b).map((idx) => picked.get(idx));
}

function metricCard(label, value) {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderNotification() {
  const plan = activePlan();
  $("#noticeText").value = buildNoticeText(plan, noticeChannel);
  const targets = riskItemsForPlan(plan).filter((item) => item.notifyTarget);
  $("#notifyTargetList").innerHTML = targets.length
    ? targets
        .map(
          (item) => {
            const response = notificationResponse(plan, item.id);
            return `
            <div class="target-row">
              <input type="checkbox" data-notify-target="${escapeAttr(item.id)}" ${item.notified ? "" : "checked"} aria-label="${escapeAttr(item.name)}を通知対象にする">
              <span>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.owner)} / ${escapeHtml(item.distanceLabel)} / ${escapeHtml(item.message)}</span>
              </span>
              <span class="pill ${item.notified ? "green" : "amber"}">${item.notified ? "通知済み" : "未通知"}</span>
              <label class="response-select">
                返信
                <select data-notify-plan="${escapeAttr(plan.id)}" data-notify-response="${escapeAttr(item.id)}">
                  ${NOTICE_RESPONSE_OPTIONS.map((option) => `<option ${response === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
                </select>
              </label>
            </div>
          `;
          },
        )
        .join("")
    : `<div class="empty-state">通知対象はありません。</div>`;
}

function renderChecklist() {
  const plan = activePlan();
  const progress = checkProgress(plan);
  $("#checkProgressHero").textContent = `${progress.done} / ${progress.total}`;
  $("#checkDonut").style.background = `conic-gradient(var(--green) ${progress.percent * 3.6}deg, #dce6e2 0deg)`;
  $("#checkDonut span").textContent = `${progress.percent}%`;
  $("#checklistItems").innerHTML = CHECK_ITEMS.map(
    (item) => `
      <label class="check-item">
        <input type="checkbox" data-check-id="${escapeAttr(item.id)}" ${plan.checks[item.id] ? "checked" : ""}>
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.detail)}</span>
        </span>
        <span class="pill ${plan.checks[item.id] ? "green" : "amber"}">${plan.checks[item.id] ? "確認済み" : "未確認"}</span>
      </label>
    `,
  ).join("");

  $$("[data-check-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      activePlan().checks[checkbox.dataset.checkId] = checkbox.checked;
      saveState();
      renderAll();
    });
  });

  const missing = CHECK_ITEMS.filter((item) => !plan.checks[item.id]);
  $("#missingChecklist").innerHTML = missing.length
    ? missing
        .map(
          (item) => `
            <div class="missing-row">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.detail)}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">未確認項目はありません。</div>`;
}

function renderWeather() {
  const plan = activePlan();
  const form = $("#weatherForm");
  Object.entries({
    latitude: plan.weather.latitude,
    longitude: plan.weather.longitude,
    forecastDirection: plan.weather.forecastDirection,
    forecastSpeed: plan.weather.forecastSpeed,
    maxGust: plan.weather.maxGust,
    temperature: plan.weather.temperature,
    humidity: plan.weather.humidity,
    rainForecast: plan.weather.rainForecast,
    actualDirection: plan.weather.actualDirection,
    actualSpeed: plan.weather.actualSpeed,
    measuredAt: plan.weather.measuredAt,
    measuredPlace: plan.weather.measuredPlace,
    measurementMethod: plan.weather.measurementMethod,
    measuredBy: plan.weather.measuredBy,
    weatherNotes: plan.weather.weatherNotes,
  }).forEach(([name, value]) => {
    const input = form.elements[name];
    if (input) input.value = value ?? "";
  });
  if (form.elements.weatherConfirmed) {
    form.elements.weatherConfirmed.checked = Boolean(plan.checks.weatherEnv);
  }

  const downwind = downwindDirection(plan.weather.actualDirection || plan.weather.forecastDirection);
  $("#windCompass b").textContent = downwind;
  $("#weatherAssessment").innerHTML = weatherCard(plan);
  renderWeatherApiStatus(plan);
}

function renderWeatherApiStatus(plan) {
  const status = $("#weatherApiStatus");
  if (!status) return;
  const weather = plan.weather || {};
  const source = weather.source || "Open-Meteo未取得";
  const fetchedAt = weather.fetchedAt || "未取得";
  const targetTime = weather.forecastTargetTime || "散布予定に近い時間";
  status.innerHTML = `
    <div>
      <span class="tag ${weather.source ? "tag-blue" : "tag-attention"}">${escapeHtml(source)}</span>
      <strong>${escapeHtml(weather.locationLabel || DEFAULT_WEATHER_LOCATION.label)}</strong>
      <span class="small-note">取得時刻：${escapeHtml(fetchedAt)} / 対象：${escapeHtml(targetTime)}</span>
    </div>
    <div class="weather-check-strip">
      <span class="pill ${plan.checks.weatherForecast ? "green" : "amber"}">予報${plan.checks.weatherForecast ? "取得済み" : "未取得"}</span>
      <span class="pill ${plan.checks.weatherEnv ? "green" : "amber"}">散布者${plan.checks.weatherEnv ? "確認済み" : "未確認"}</span>
      <span class="pill ${plan.checks.wind ? "green" : "amber"}">現地実測${plan.checks.wind ? "済み" : "未入力"}</span>
    </div>
    <p>API予報は散布判断の補助です。散布直前の現地実測は別途記録してください。</p>
  `;
}

function renderReport() {
  const plan = activePlan();
  const form = $("#reportForm");
  Object.entries({
    doneDate: plan.report.doneDate,
    doneTime: plan.report.doneTime,
    doneField: plan.report.doneField || plan.fieldName,
    donePesticide: plan.report.donePesticide || plan.pesticide,
    doneArea: plan.report.doneArea || plan.sprayArea,
    doneWeather: plan.report.doneWeather || weatherLabel(plan),
    incident: plan.report.incident,
    inquiry: plan.report.inquiry,
    reportType: plan.report.reportType,
    actualAmount: plan.report.actualAmount,
    altitudeNotes: plan.report.altitudeNotes,
    outsideFlight: plan.report.outsideFlight,
    reportNotes: plan.report.reportNotes,
  }).forEach(([name, value]) => {
    const input = form.elements[name];
    if (input) input.value = value || "";
  });

  const photo = plan.report.photoData
    ? `<img src="${escapeAttr(plan.report.photoData)}" alt="実施後報告の写真メモ">`
    : `<div class="empty-state">写真メモは未登録です。</div>`;
  $("#reportPreview").innerHTML = `
    <div class="risk-row">
      <strong>${escapeHtml(plan.report.doneDate || "実施日未入力")} ${escapeHtml(plan.report.doneTime || "")}</strong>
      <span>${escapeHtml(plan.fieldName)} / ${escapeHtml(plan.pesticide)}</span>
    </div>
    <div class="risk-row">
      <strong>異常の有無：${escapeHtml(plan.report.incident || "未入力")}</strong>
      <span>分類：${escapeHtml(plan.report.reportType || "通常報告")} / 問い合わせ：${escapeHtml(plan.report.inquiry || "未入力")}</span>
    </div>
    <div class="risk-row">
      <strong>ドローンログ概要</strong>
      <span>${escapeHtml(droneLogLabel())} / 高度要確認：${escapeHtml(plan.report.altitudeNotes || altitudeCheckLabel())}</span>
    </div>
    ${photo}
  `;
}

const UNIT_STEP_UP = { mL: ["L", 1000], g: ["kg", 1000] };

function trimNumber(n) {
  return Number(Number(n).toFixed(2)).toString();
}

function plannedTotalAmount(plan) {
  const rate = toNumber(plan.ratePer10a);
  const area = toNumber(plan.areaHa);
  if (!rate || !area) return null;
  return { value: rate * area * 10, unit: plan.rateUnit || "mL" };
}

function formatAmountValue(value, unit) {
  if (!Number.isFinite(value)) return "";
  const stepUp = UNIT_STEP_UP[unit];
  if (stepUp && value >= stepUp[1]) {
    return `${trimNumber(value / stepUp[1])}${stepUp[0]}`;
  }
  return `${trimNumber(value)}${unit}`;
}

function formatTotalAmount(plan) {
  const total = plannedTotalAmount(plan);
  return total ? formatAmountValue(total.value, total.unit) : "—";
}

function haversineMeters([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const COVERAGE_CELL_M = 5;
const coverageGridCache = new Map();

function projectMeters([lng, lat], [lng0, lat0]) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return [(lng - lng0) * mPerDegLng, (lat - lat0) * mPerDegLat];
}

function unprojectMeters([x, y], [lng0, lat0]) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return [lng0 + x / mPerDegLng, lat0 + y / mPerDegLat];
}

function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointSegmentDistM([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function coverageField(plan) {
  return (
    state.fields.find((field) => field.name === plan.fieldName) ||
    state.fields.find((field) => field.type === "spray") ||
    state.fields[0]
  );
}

// Rasterise the spray field into a metre grid; cache per field geometry.
function buildCoverageGrid(plan) {
  const field = coverageField(plan);
  if (!field) return null;
  const ringLngLat = fieldPolygonCoordinates(field);
  const origin = ringLngLat[0];
  const ring = ringLngLat.map((c) => projectMeters(c, origin));
  const key = `${field.id}:${ring.map((p) => p.map((n) => Math.round(n)).join(",")).join(";")}`;
  if (coverageGridCache.has(key)) return coverageGridCache.get(key);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cell = COVERAGE_CELL_M;
  const cells = [];
  for (let y = minY; y < maxY; y += cell) {
    for (let x = minX; x < maxX; x += cell) {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      if (pointInRing([cx, cy], ring)) cells.push({ x, y, cx, cy });
    }
  }
  const grid = { origin, ring, cells, cell };
  coverageGridCache.set(key, grid);
  return grid;
}

function coverageTrackProjected(grid, plan) {
  const log = plan.droneLog;
  const points = Array.isArray(log?.points) ? log.points : [];
  return points.map((point) => ({
    proj: projectMeters(lngLatFromPercent(point.x, point.y), grid.origin),
    sprayOn: Boolean(point.sprayOn),
  }));
}

// Flags array (0/1) marking cells sprayed by the log up to `uptoIndex` (inclusive).
function coverageSprayedFlags(grid, plan, uptoIndex) {
  const track = coverageTrackProjected(grid, plan);
  const flags = new Uint8Array(grid.cells.length);
  if (track.length < 2) return flags;
  const half = (toNumber(plan.sprayWidthM) || 4) / 2 + grid.cell * 0.4;
  const end = uptoIndex == null ? track.length - 1 : Math.min(uptoIndex, track.length - 1);
  for (let i = 1; i <= end; i += 1) {
    if (!track[i - 1].sprayOn && !track[i].sprayOn) continue;
    const a = track[i - 1].proj;
    const b = track[i].proj;
    for (let c = 0; c < grid.cells.length; c += 1) {
      if (flags[c]) continue;
      if (pointSegmentDistM([grid.cells[c].cx, grid.cells[c].cy], a, b) <= half) flags[c] = 1;
    }
  }
  return flags;
}

function gridCoverage(plan, uptoIndex) {
  const log = plan.droneLog;
  if (!log || !Array.isArray(log.points) || log.points.length < 2) return null;
  const grid = buildCoverageGrid(plan);
  if (!grid || !grid.cells.length) return null;
  const flags = coverageSprayedFlags(grid, plan, uptoIndex);
  let sprayed = 0;
  for (let i = 0; i < flags.length; i += 1) sprayed += flags[i];
  const cellHa = (grid.cell * grid.cell) / 10000;
  return {
    grid,
    flags,
    sprayedCells: sprayed,
    totalCells: grid.cells.length,
    coveredHa: sprayed * cellHa,
    fieldAreaHa: grid.cells.length * cellHa,
    coveragePct: grid.cells.length ? Math.round((sprayed / grid.cells.length) * 100) : null,
  };
}

function estimateCoverage(plan) {
  const log = plan.droneLog;
  if (!log || !log.imported) return { hasLog: false };
  const gc = gridCoverage(plan);
  if (gc) {
    return {
      hasLog: true,
      coveredHa: Number(gc.coveredHa.toFixed(2)),
      fieldAreaHa: Number(gc.fieldAreaHa.toFixed(2)),
      coveragePct: gc.coveragePct,
      unsprayedCells: gc.totalCells - gc.sprayedCells,
    };
  }
  return { hasLog: false };
}

function coverageLabel(plan) {
  const cov = estimateCoverage(plan);
  if (!cov.hasLog) return "軌跡なし";
  return cov.coveragePct != null ? `カバー率 ${cov.coveragePct}%（${trimNumber(cov.coveredHa)}ha）` : "軌跡あり";
}

// Build map GeoJSON for the sprayed/unsprayed grid + current drone position (up to uptoIndex).
function coverageMapData(plan, uptoIndex) {
  const gc = gridCoverage(plan, uptoIndex);
  if (!gc) return null;
  const { origin, cell } = gc.grid;
  const cellFeatures = gc.grid.cells.map((c, i) => ({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        unprojectMeters([c.x, c.y], origin),
        unprojectMeters([c.x + cell, c.y], origin),
        unprojectMeters([c.x + cell, c.y + cell], origin),
        unprojectMeters([c.x, c.y + cell], origin),
        unprojectMeters([c.x, c.y], origin),
      ]],
    },
    properties: { sprayed: gc.flags[i] },
  }));
  const points = plan.droneLog.points;
  const idx = uptoIndex == null ? points.length - 1 : Math.max(0, Math.min(uptoIndex, points.length - 1));
  const marker = points[idx];
  return {
    cells: { type: "FeatureCollection", features: cellFeatures },
    marker: {
      type: "FeatureCollection",
      features: marker ? [{ type: "Feature", geometry: { type: "Point", coordinates: lngLatFromPercent(marker.x, marker.y) }, properties: {} }] : [],
    },
    gc,
    idx,
  };
}

function coveragePlanHasLog(plan = activePlan()) {
  return Boolean(plan?.droneLog?.imported && Array.isArray(plan.droneLog.points) && plan.droneLog.points.length >= 2);
}

function renderCoveragePanel() {
  const panel = $("#coveragePanel");
  if (!panel) return;
  const active = mapLayer === "coverage";
  panel.classList.toggle("is-active", active);
  if (!active) {
    stopCoveragePlayback();
    return;
  }
  updateCoverageDisplay();
}

function updateCoverageDisplay() {
  if (mapLayer !== "coverage") return;
  const plan = activePlan();
  const data = coveragePlanHasLog(plan) ? coverageMapData(plan, coveragePlayIndex) : null;
  if (mapLibreMap && mapLibreMap.getSource("coverage-grid")) {
    mapLibreMap.getSource("coverage-grid").setData(data ? data.cells : emptyFeatureCollection());
    mapLibreMap.getSource("drone-marker").setData(data ? data.marker : emptyFeatureCollection());
  }
  renderCoverageReadout(data);
  updateCoverageButtons();
}

function renderCoverageReadout(data) {
  const readout = $("#coverageReadout");
  if (!readout) return;
  const plan = activePlan();
  if (!coveragePlanHasLog(plan)) {
    readout.innerHTML = `<div class="empty-state">この計画には飛行ログがありません。<br>「ドローン連携」でサンプル飛行ログを取り込むと、散布済／未散布を表示します。</div>`;
    $("#coverageProgress").style.width = "0%";
    return;
  }
  if (!data) return;
  const gc = data.gc;
  const cellHa = (gc.grid.cell * gc.grid.cell) / 10000;
  const unsprayed = gc.totalCells - gc.sprayedCells;
  const total = plan.droneLog.points.length;
  const pctThrough = Math.round(((data.idx + 1) / total) * 100);
  readout.innerHTML = `
    <div class="coverage-figures">
      <div><span>カバー率</span><strong>${gc.coveragePct}%</strong></div>
      <div><span>散布済み</span><strong>${trimNumber(gc.coveredHa)}ha</strong></div>
      <div><span>塗り残し</span><strong class="${unsprayed ? "warn" : "good"}">${unsprayed}区画（${trimNumber(unsprayed * cellHa)}ha）</strong></div>
      <div><span>圃場面積</span><strong>${trimNumber(gc.fieldAreaHa)}ha</strong></div>
    </div>
    <div class="coverage-legend">
      <span><i style="background:#2fbf6b"></i>散布済み</span>
      <span><i style="background:#7c8a83"></i>未散布</span>
      <span><i class="dot" style="background:#1f6fe0"></i>現在地</span>
    </div>
    <div class="coverage-track-note">${coveragePlaying ? "再生中" : coveragePlayIndex == null ? "全区間表示" : "一時停止"} ・ 進捗 ${pctThrough}%</div>
  `;
  $("#coverageProgress").style.width = `${gc.coveragePct}%`;
}

function updateCoverageButtons() {
  const playButton = $("#coveragePlayButton");
  if (playButton) playButton.textContent = coveragePlaying ? "⏸ 一時停止" : "▶ 散布を再生";
}

function startCoveragePlayback() {
  const plan = activePlan();
  if (!coveragePlanHasLog(plan)) {
    showToast("この計画には飛行ログがありません。");
    return;
  }
  stopCoveragePlayback();
  const total = plan.droneLog.points.length;
  coveragePlaying = true;
  coveragePlayIndex = 0;
  const stepMs = Math.max(140, Math.round(6000 / total));
  coverageTimer = setInterval(() => {
    coveragePlayIndex += 1;
    if (coveragePlayIndex >= total - 1) {
      coveragePlayIndex = total - 1;
      stopCoveragePlayback();
    }
    updateCoverageDisplay();
  }, stepMs);
  updateCoverageDisplay();
}

function stopCoveragePlayback() {
  coveragePlaying = false;
  if (coverageTimer) {
    clearInterval(coverageTimer);
    coverageTimer = null;
  }
  updateCoverageButtons();
}

function toggleCoveragePlayback() {
  if (coveragePlaying) {
    stopCoveragePlayback();
    updateCoverageDisplay();
  } else {
    startCoveragePlayback();
  }
}

function resetCoveragePlayback() {
  stopCoveragePlayback();
  coveragePlayIndex = null;
  updateCoverageDisplay();
}

// --- 可変施肥（VRA）処方マップの取込・表示 ---
const PRESCRIPTION_COLORS = ["#f7fcb9", "#addd8e", "#41ab5d", "#238443", "#00441b"];
const RATE_KEYS = [
  "rate", "rx", "rxrate", "dose", "dosage", "amount", "qty", "quantity",
  "target", "targetrate", "value", "n_rate", "nrate", "施用量", "施肥量", "散布量", "目標",
];

function detectRateField(props) {
  const keys = Object.keys(props || {});
  const isNum = (k) => props[k] !== "" && props[k] !== null && Number.isFinite(Number(props[k]));
  const lower = keys.map((k) => String(k).toLowerCase());
  for (const cand of RATE_KEYS) {
    const i = lower.indexOf(cand);
    if (i >= 0 && isNum(keys[i])) return keys[i];
  }
  for (const k of keys) {
    if (/(rate|rx|dose|dosage|amount|施用|施肥|散布|目標)/i.test(k) && isNum(k)) return k;
  }
  for (const k of keys) {
    if (isNum(k)) return k;
  }
  return null;
}

function ringAreaM2(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const origin = ring[0];
  const pts = ring.map((c) => projectMeters(c, origin));
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(area / 2);
}

function polygonAreaHa(geom) {
  if (!geom) return 0;
  const ringsArea = (rings) => (rings.length ? ringAreaM2(rings[0]) - rings.slice(1).reduce((s, r) => s + ringAreaM2(r), 0) : 0);
  let m2 = 0;
  if (geom.type === "Polygon") m2 = ringsArea(geom.coordinates);
  else if (geom.type === "MultiPolygon") m2 = geom.coordinates.reduce((s, poly) => s + ringsArea(poly), 0);
  return Math.max(0, m2) / 10000;
}

function buildPrescription(features, name, unit) {
  const polys = (features || []).filter(
    (f) => f?.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
  );
  if (!polys.length) throw new Error("ポリゴンのGeoJSONが見つかりません。");
  const rateField = detectRateField(polys[0].properties || {});
  if (!rateField) throw new Error("施用量（rate）の数値項目が見つかりません。");
  const rates = polys.map((f) => Number(f.properties[rateField])).filter((n) => Number.isFinite(n));
  const min = rates.length ? Math.min(...rates) : 0;
  const max = rates.length ? Math.max(...rates) : 0;
  const avg = rates.length ? rates.reduce((s, n) => s + n, 0) / rates.length : 0;
  let totalAmount = 0;
  let totalAreaHa = 0;
  polys.forEach((f) => {
    const ha = polygonAreaHa(f.geometry);
    const rate = Number(f.properties[rateField]);
    totalAreaHa += ha;
    if (Number.isFinite(rate)) totalAmount += ha * rate;
  });
  return {
    name: name || "処方マップ",
    rateField,
    unit: unit || "",
    features: polys,
    count: polys.length,
    min,
    max,
    avg: Number(avg.toFixed(1)),
    totalAmount: Number(totalAmount.toFixed(1)),
    totalAreaHa: Number(totalAreaHa.toFixed(2)),
    importedAt: formatDateTime(new Date()),
  };
}

function parsePrescriptionText(text, name) {
  const data = JSON.parse(text);
  let features = [];
  if (data.type === "FeatureCollection") features = data.features || [];
  else if (data.type === "Feature") features = [data];
  else if (data.type && data.coordinates) features = [{ type: "Feature", geometry: data, properties: {} }];
  const unit = (data.unit || data.properties?.unit || "").toString();
  return buildPrescription(features, name, unit);
}

function samplePrescription(plan) {
  const field = coverageField(plan);
  const ring = fieldPolygonCoordinates(field);
  const lngs = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  const w = Math.min(...lngs);
  const e = Math.max(...lngs);
  const s = Math.min(...lats);
  const n = Math.max(...lats);
  const rates = [70, 90, 110, 130, 150, 120];
  const features = rates.map((rate, i) => {
    const y0 = n - ((n - s) * i) / rates.length;
    const y1 = n - ((n - s) * (i + 1)) / rates.length;
    return {
      type: "Feature",
      properties: { rate },
      geometry: { type: "Polygon", coordinates: [[[w, y0], [e, y0], [e, y1], [w, y1], [w, y0]]] },
    };
  });
  return buildPrescription(features, "サンプル処方（可変施肥・化学肥料）", "kg/ha");
}

function prescriptionClassOf(rate, min, max) {
  if (!Number.isFinite(rate)) return 0;
  const range = max - min || 1;
  return Math.min(PRESCRIPTION_COLORS.length - 1, Math.max(0, Math.floor(((rate - min) / range) * PRESCRIPTION_COLORS.length)));
}

function prescriptionZonesFeatureCollection(plan) {
  const rx = plan?.prescription;
  if (!rx) return emptyFeatureCollection();
  return {
    type: "FeatureCollection",
    features: rx.features.map((f) => {
      const rate = Number(f.properties[rx.rateField]);
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          _color: PRESCRIPTION_COLORS[prescriptionClassOf(rate, rx.min, rx.max)],
          _rate: Number.isFinite(rate) ? rate : null,
        },
      };
    }),
  };
}

function renderPrescriptionPanel() {
  const panel = $("#prescriptionPanel");
  if (!panel) return;
  const active = mapLayer === "prescription";
  panel.classList.toggle("is-active", active);
  if (active) updatePrescriptionDisplay();
}

function updatePrescriptionDisplay() {
  if (mapLayer !== "prescription") return;
  refreshPrescriptionMap();
  renderPrescriptionEditor(activePlan().prescription);
}

function refreshPrescriptionMap() {
  const plan = activePlan();
  if (mapLibreMap && mapLibreMap.getSource("prescription-zones")) {
    mapLibreMap.getSource("prescription-zones").setData(prescriptionZonesFeatureCollection(plan));
  }
  renderPrescriptionReadout(plan.prescription);
}

function renderPrescriptionReadout(rx) {
  const readout = $("#prescriptionReadout");
  if (!readout) return;
  if (!rx) {
    readout.innerHTML = `<div class="empty-state">処方マップ（GeoJSON）を取り込むと、施用量ゾーンを色分け表示します。<br>xarvio等から書き出したファイル、または「サンプル処方」でお試しください。</div>`;
    return;
  }
  const range = rx.max - rx.min || 1;
  const legend = PRESCRIPTION_COLORS.map((color, k) => {
    const low = rx.min + (range * k) / PRESCRIPTION_COLORS.length;
    const high = rx.min + (range * (k + 1)) / PRESCRIPTION_COLORS.length;
    return `<span><i style="background:${color}"></i>${trimNumber(low)}–${trimNumber(high)}</span>`;
  }).join("");
  const totalUnit = rx.unit ? rx.unit.replace(/\/?ha$/i, "") : "";
  readout.innerHTML = `
    <div class="rx-name">${escapeHtml(rx.name)}<span>${escapeHtml(rx.importedAt)}</span></div>
    <div class="coverage-figures">
      <div><span>ゾーン数</span><strong>${rx.count}</strong></div>
      <div><span>施用量</span><strong>${trimNumber(rx.min)}–${trimNumber(rx.max)}${escapeHtml(rx.unit)}</strong></div>
      <div><span>平均</span><strong>${trimNumber(rx.avg)}${escapeHtml(rx.unit)}</strong></div>
      <div><span>合計目標量</span><strong>${trimNumber(rx.totalAmount)}${escapeHtml(totalUnit)}（${trimNumber(rx.totalAreaHa)}ha）</strong></div>
    </div>
    <div class="rx-legend"><span class="rx-legend-label">少 → 多</span>${legend}</div>
    <div class="coverage-track-note">施用量項目：${escapeHtml(rx.rateField)}</div>
  `;
}

function importPrescriptionFile(file) {
  if (!file) return;
  const name = file.name.replace(/\.[^.]+$/, "");
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".zip") || lower.endsWith(".shp")) {
    showToast("Shapefileは次段対応です。まずGeoJSONで取り込んでください。");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rx = parsePrescriptionText(String(reader.result), name);
      const plan = activePlan();
      plan.prescription = rx;
      saveState();
      updatePrescriptionDisplay();
      showToast(`処方マップ「${rx.name}」を取り込みました（${rx.count}ゾーン）。`);
    } catch (error) {
      showToast(`取り込めませんでした：${error.message}`);
    }
  };
  reader.readAsText(file);
}

function loadSamplePrescription() {
  const plan = activePlan();
  plan.prescription = samplePrescription(plan);
  saveState();
  updatePrescriptionDisplay();
  showToast("サンプル処方（可変施肥）を読み込みました。");
}

function clearPrescription() {
  const plan = activePlan();
  plan.prescription = null;
  saveState();
  updatePrescriptionDisplay();
  showToast("処方マップをクリアしました。");
}

// --- 可変施肥マップの作成・編集・書き出し ---
const RATE_UNITS = ["kg/ha", "L/ha", "g/10a", "mL/10a"];

function generatePrescriptionZones(plan, zones, baseRate, unit, material) {
  const field = coverageField(plan);
  const ring = fieldPolygonCoordinates(field);
  const lngs = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  const w = Math.min(...lngs);
  const e = Math.max(...lngs);
  const s = Math.min(...lats);
  const n = Math.max(...lats);
  const count = Math.max(2, Math.min(8, Math.round(zones) || 4));
  const rate = toPositiveNumber(baseRate, 100);
  const features = [];
  for (let i = 0; i < count; i += 1) {
    const y0 = n - ((n - s) * i) / count;
    const y1 = n - ((n - s) * (i + 1)) / count;
    features.push({
      type: "Feature",
      properties: { zone: i + 1, rate },
      geometry: { type: "Polygon", coordinates: [[[w, y0], [e, y0], [e, y1], [w, y1], [w, y0]]] },
    });
  }
  const rx = buildPrescription(features, `処方マップ（${material || "可変施肥"}）`, unit || "kg/ha");
  rx.editable = true;
  rx.material = material || "化学肥料";
  return rx;
}

function createPrescription() {
  const plan = activePlan();
  plan.prescription = generatePrescriptionZones(plan, 4, 100, "kg/ha", "化学肥料");
  saveState();
  updatePrescriptionDisplay();
  showToast("処方マップを作成しました。ゾーンごとに施用量を編集できます。");
}

function regeneratePrescription() {
  const plan = activePlan();
  const zones = Number($("#rxZonesInput")?.value) || 4;
  const baseRate = $("#rxBaseRateInput")?.value;
  const unit = $("#rxUnitInput")?.value || "kg/ha";
  const material = plan.prescription?.material || "化学肥料";
  plan.prescription = generatePrescriptionZones(plan, zones, baseRate, unit, material);
  saveState();
  updatePrescriptionDisplay();
  showToast("処方マップを再生成しました。");
}

function updatePrescriptionRate(index, value) {
  const rx = activePlan().prescription;
  if (!rx?.editable || !rx.features[index]) return;
  rx.features[index].properties.rate = toNumber(value) || 0;
  const stats = buildPrescription(rx.features, rx.name, rx.unit);
  rx.min = stats.min;
  rx.max = stats.max;
  rx.avg = stats.avg;
  rx.totalAmount = stats.totalAmount;
  rx.totalAreaHa = stats.totalAreaHa;
  saveState();
  refreshPrescriptionMap();
}

function renderPrescriptionEditor(rx) {
  const container = $("#prescriptionEditor");
  if (!container) return;
  if (!rx?.editable) {
    container.innerHTML = "";
    return;
  }
  const unitOptions = RATE_UNITS.map((u) => `<option ${rx.unit === u ? "selected" : ""}>${escapeHtml(u)}</option>`).join("");
  const zoneOptions = [2, 3, 4, 5, 6].map((z) => `<option ${rx.count === z ? "selected" : ""}>${z}</option>`).join("");
  const zoneRows = rx.features
    .map((f, i) => {
      const ha = polygonAreaHa(f.geometry);
      return `
        <div class="rx-zone-row">
          <span>ゾーン${i + 1}<small>${trimNumber(ha)}ha</small></span>
          <input type="number" min="0" step="1" data-rx-rate="${i}" value="${escapeAttr(f.properties.rate)}">
          <span class="rx-zone-unit">${escapeHtml(rx.unit)}</span>
        </div>
      `;
    })
    .join("");
  container.innerHTML = `
    <div class="rx-builder">
      <div class="rx-builder-row">
        <label>単位<select id="rxUnitInput">${unitOptions}</select></label>
        <label>基準量<input id="rxBaseRateInput" type="number" min="0" step="1" value="${escapeAttr(Math.round(rx.avg))}"></label>
        <label>ゾーン数<select id="rxZonesInput">${zoneOptions}</select></label>
        <button class="ghost-button tiny" data-rx-action="regenerate" type="button">再生成</button>
      </div>
      <div class="rx-zone-list">${zoneRows}</div>
      <button class="primary-button" data-rx-action="export" type="button">GeoJSONで書き出し</button>
    </div>
  `;
}

function exportPrescriptionGeoJSON() {
  const rx = activePlan().prescription;
  if (!rx) {
    showToast("書き出す処方マップがありません。");
    return;
  }
  const fc = {
    type: "FeatureCollection",
    name: rx.name,
    unit: rx.unit,
    features: rx.features.map((f, i) => ({
      type: "Feature",
      properties: {
        zone: i + 1,
        rate: Number(f.properties[rx.rateField]),
        unit: rx.unit,
        material: rx.material || "",
      },
      geometry: f.geometry,
    })),
  };
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tonari-hatake-rx-${dateOffset(0)}.geojson`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("処方マップをGeoJSONで書き出しました。");
}

function historyRecords() {
  return state.plans
    .map((plan) => {
      const report = plan.report || {};
      const done = Boolean(report.doneDate);
      const dilution = plan.dilution ? `／${plan.dilution}` : "";
      const cov = estimateCoverage(plan);
      return {
        id: plan.id,
        done,
        date: report.doneDate || plan.date,
        planDate: plan.date,
        time: report.doneTime || plan.timeWindow,
        field: report.doneField || plan.fieldName,
        crop: plan.crop,
        materialType: plan.materialType || "農薬",
        material: report.donePesticide || plan.pesticide,
        rate: `${report.actualAmount || plan.amount || "未記録"}${dilution}`,
        total: formatTotalAmount(plan),
        area: report.doneArea || plan.sprayArea || "未記録",
        hasLog: cov.hasLog,
        coverage: coverageLabel(plan),
        method: plan.method,
        operator: plan.operator,
        weather: report.doneWeather || weatherLabel(plan),
        reportType: report.reportType || "",
      };
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

function filteredHistoryRecords() {
  return historyRecords().filter((record) => {
    if (historyFilters.field !== "all" && record.field !== historyFilters.field) return false;
    if (historyFilters.material !== "all" && record.materialType !== historyFilters.material) return false;
    if (historyFilters.status === "done" && !record.done) return false;
    if (historyFilters.status === "planned" && record.done) return false;
    return true;
  });
}

function fillHistoryFilterSelect(selector, values, selected, allLabel) {
  const select = $(selector);
  if (!select) return;
  const options = [`<option value="all">${escapeHtml(allLabel)}</option>`].concat(
    values.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`),
  );
  select.innerHTML = options.join("");
  select.value = values.includes(selected) ? selected : "all";
}

function renderHistory() {
  if (!$("#historyTableBody")) return;
  const allRecords = historyRecords();
  const fieldNames = [...new Set(allRecords.map((record) => record.field).filter(Boolean))];
  const materialTypes = [...new Set(allRecords.map((record) => record.materialType))];
  fillHistoryFilterSelect("#historyFieldFilter", fieldNames, historyFilters.field, "すべての圃場");
  fillHistoryFilterSelect("#historyMaterialFilter", materialTypes, historyFilters.material, "すべての種別");
  const statusSelect = $("#historyStatusFilter");
  if (statusSelect) statusSelect.value = historyFilters.status;

  const records = filteredHistoryRecords();
  const doneCount = records.filter((record) => record.done).length;
  const agroCount = records.filter((record) => record.materialType === "農薬").length;
  const logCount = records.filter((record) => record.hasLog).length;
  const kpis = [
    ["記録件数", `${records.length}件`, "計画・報告から集計"],
    ["実施済み散布", `${doneCount}件`, "報告が提出された記録"],
    ["対象圃場", `${new Set(records.map((record) => record.field)).size}圃場`, "履歴に含まれる圃場数"],
    ["農薬／肥料等", `${agroCount}／${records.length - agroCount}`, "資材種別の内訳"],
    ["飛行ログ連携", `${logCount}件`, "散布位置・カバー率を確認可能"],
  ];
  $("#historyKpiGrid").innerHTML = kpis
    .map(
      ([label, value, note]) => `
        <article class="kpi-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  $("#historyTableBody").innerHTML = records.length
    ? records
        .map(
          (record) => `
            <tr>
              <td>${escapeHtml(record.date)}<br><span class="muted-cell">${escapeHtml(record.time || "")}</span></td>
              <td>${escapeHtml(record.field)}</td>
              <td>${escapeHtml(record.crop)}</td>
              <td>${materialTypeTag(record.materialType)}</td>
              <td>${escapeHtml(record.material)}</td>
              <td>${escapeHtml(record.rate)}</td>
              <td><strong>${escapeHtml(record.total)}</strong></td>
              <td>${escapeHtml(record.area)}<br><span class="muted-cell">${escapeHtml(record.coverage)}</span></td>
              <td>${
                record.hasLog
                  ? `<button class="ghost-button tiny" data-plan-track="${escapeAttr(record.id)}" type="button">軌跡を見る</button>`
                  : '<span class="muted-cell">—</span>'
              }</td>
              <td>${escapeHtml(record.method)}</td>
              <td>${escapeHtml(record.operator)}</td>
              <td>${record.done ? '<span class="pill green">提出済み</span>' : '<span class="pill amber">未提出</span>'}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="12"><div class="empty-state">該当する履歴はありません。</div></td></tr>`;

  renderBars("#historyFieldBars", "圃場別の散布回数", countBy(records, "field"));
  renderBars("#historyMaterialBars", "資材種別の内訳", countBy(records, "materialType"));
}

function materialTypeTag(type) {
  const color = type === "農薬" ? "amber" : type === "液体肥料・葉面散布" ? "green" : "blue";
  return `<span class="pill ${color}">${escapeHtml(type)}</span>`;
}

let adminSelectedId = null;
let adminFilters = { status: "all", district: "all" };
let adminMapLibreMap;

function adminFilteredPlans() {
  return state.plans
    .slice()
    .filter((plan) => {
      const done = Boolean(plan.report.doneDate);
      if (adminFilters.status === "planned" && done) return false;
      if (adminFilters.status === "done" && !done) return false;
      if (adminFilters.district !== "all" && plan.district !== adminFilters.district) return false;
      return true;
    })
    .sort((a, b) => `${b.date} ${b.timeWindow}`.localeCompare(`${a.date} ${a.timeWindow}`));
}

function renderAdmin() {
  const tbody = $("#adminTableBody");
  if (!tbody) return;
  const districts = [...new Set(state.plans.map((p) => p.district).filter(Boolean))];
  const districtSelect = $("#adminDistrictFilter");
  if (districtSelect) {
    districtSelect.innerHTML = [`<option value="all">すべての地区</option>`, ...districts.map((d) => `<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`)].join("");
    districtSelect.value = districts.includes(adminFilters.district) ? adminFilters.district : "all";
  }
  const statusSelect = $("#adminStatusFilter");
  if (statusSelect) statusSelect.value = adminFilters.status;

  const rows = adminFilteredPlans();
  if (rows.length && !rows.some((p) => p.id === adminSelectedId)) adminSelectedId = rows[0].id;

  tbody.innerHTML = rows.length
    ? rows
        .map((plan) => {
          const done = Boolean(plan.report.doneDate);
          return `
            <tr class="admin-row ${plan.id === adminSelectedId ? "selected" : ""}" data-admin-plan="${escapeAttr(plan.id)}">
              <td>${escapeHtml(plan.date)}<br><span class="muted-cell">${escapeHtml(plan.timeWindow)}</span></td>
              <td>${escapeHtml(plan.operator)}</td>
              <td>${escapeHtml(plan.district)}<br><span class="muted-cell">${escapeHtml(plan.fieldName)}</span></td>
              <td>${materialTypeTag(plan.materialType || "農薬")}<br><span class="muted-cell">${escapeHtml(plan.pesticide)}</span></td>
              <td>${done ? '<span class="pill green">実施済み</span>' : '<span class="pill amber">予定</span>'}</td>
              <td><div class="pill-line">${renderAdminReasonChips(plan, 2)}</div></td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="6"><div class="empty-state">該当する散布はありません。</div></td></tr>`;

  renderAdminDetail();
}

function renderAdminDetail() {
  const info = $("#adminDetailInfo");
  if (!info) return;
  const plan = state.plans.find((p) => p.id === adminSelectedId) || state.plans[0];
  if (!plan) {
    info.innerHTML = `<div class="empty-state">散布を選択してください。</div>`;
    return;
  }
  const g = sprayGoNoGo(plan);
  const cov = estimateCoverage(plan);
  const total = formatTotalAmount(plan);
  const done = Boolean(plan.report.doneDate);
  const rows = [
    ["資材", `${plan.materialType || "農薬"} / ${plan.pesticide}`],
    ["使用量・総量", `${plan.amount || (plan.ratePer10a ? plan.ratePer10a + plan.rateUnit + "/10a" : "未記録")}${total !== "—" ? `（総量 ${total}）` : ""}`],
    ["散布範囲・カバー", `${plan.sprayArea || "未記録"}${cov.hasLog ? ` / カバー率 ${cov.coveragePct}%` : ""}`],
    ["機体・操縦者", `${plan.droneModel || "-"}（${plan.aircraftRegistration || "登録記号-"}）/ ${plan.pilot || "-"}`],
    ["近隣通知", notificationLabel(plan)],
    ["散布前チェック", `${checkProgress(plan).done}/${checkProgress(plan).total} 項目`],
    ["実施後報告", done ? `${plan.report.doneDate} 提出済み` : "未提出"],
  ];
  info.innerHTML = `
    <div class="gonogo-card gonogo-${g.verdict} admin-gonogo">${goNoGoInner(g, plan, false)}</div>
    ${renderAdminReasonPanel(plan)}
    <div class="admin-detail-rows">
      ${rows.map(([k, v]) => `<div class="admin-detail-row"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join("")}
    </div>
  `;
  initAdminMapLibre();
  if (adminMapLibreMap) {
    adminMapLibreMap.resize();
    updateGisMap(adminMapLibreMap, { dashboard: true });
    const field = state.fields.find((f) => f.name === plan.fieldName) || activeSprayField();
    if (field) adminMapLibreMap.flyTo({ center: fieldCenterLngLat(field), zoom: 16.2, duration: 500 });
  }
}

function initAdminMapLibre() {
  const container = $("#adminDetailMap");
  if (!container || adminMapLibreMap || !window.maplibregl) return;
  adminMapLibreMap = new maplibregl.Map({
    container,
    style: rasterMapStyle("photo"),
    center: DEFAULT_MAP_VIEW.center,
    zoom: DEFAULT_MAP_VIEW.zoom,
    bearing: 0,
    pitch: 0,
    dragRotate: false,
    scrollZoom: false,
  });
  adminMapLibreMap.on("load", () => {
    setupGisMapLayers(adminMapLibreMap);
    updateGisMap(adminMapLibreMap, { dashboard: true });
    renderAdminDetail();
  });
}

function renderRulesForm() {
  const form = $("#rulesForm");
  if (!form) return;
  const rules = activeSettings();
  Object.entries(rules).forEach(([name, value]) => {
    const input = form.elements[name];
    if (input) input.value = value;
  });
}

function updateSettingsFromForm() {
  const form = $("#rulesForm");
  const next = { ...activeSettings() };
  next.regionName = form.elements.regionName.value.trim() || DEFAULT_SETTINGS.regionName;
  next.managerName = form.elements.managerName.value.trim() || DEFAULT_SETTINGS.managerName;
  next.organicRadius = toPositiveNumber(form.elements.organicRadius.value, DEFAULT_SETTINGS.organicRadius);
  next.notifyRadius = toPositiveNumber(form.elements.notifyRadius.value, DEFAULT_SETTINGS.notifyRadius);
  next.sensitiveRadius = toPositiveNumber(form.elements.sensitiveRadius.value, DEFAULT_SETTINGS.sensitiveRadius);
  next.windCaution = toPositiveNumber(form.elements.windCaution.value, DEFAULT_SETTINGS.windCaution);
  next.windLimit = toPositiveNumber(form.elements.windLimit.value, DEFAULT_SETTINGS.windLimit);
  next.noticeDeadlineDays = toPositiveNumber(form.elements.noticeDeadlineDays.value, DEFAULT_SETTINGS.noticeDeadlineDays);
  next.reportDeadlineDays = toPositiveNumber(form.elements.reportDeadlineDays.value, DEFAULT_SETTINGS.reportDeadlineDays);
  next.sharingScope = form.elements.sharingScope.value || DEFAULT_SETTINGS.sharingScope;
  if (next.windCaution > next.windLimit) {
    next.windCaution = next.windLimit;
  }
  state.settings = next;
}

function renderProfileForm() {
  const form = $("#profileForm");
  if (!form) return;
  const profile = activeProfile();
  form.elements.role.value = profile.role || "";
  renderProfileRoleOptions(profile.role);
  setFormValue(form, "name", profile.name);
  setFormValue(form, "organizationName", profile.organizationName);
  setFormValue(form, "municipality", profile.municipality);
  setFormValue(form, "district", profile.district);
  setFormValue(form, "addressDetail", profile.addressDetail);
  setFormValue(form, "phone", profile.phone);
  setFormValue(form, "email", profile.email);
  setFormValue(form, "preferredContactMethod", profile.preferredContactMethod);
  setFormValue(form, "affiliation", profile.affiliation || "個人");

  setFormValue(form, "sprayer_defaultMethod", profile.sprayer.defaultMethod);
  setFormValue(form, "sprayer_droneModel", profile.sprayer.droneModel);
  setFormValue(form, "sprayer_aircraftRegistration", profile.sprayer.aircraftRegistration);
  setFormValue(form, "sprayer_remoteId", profile.sprayer.remoteId);
  setFormValue(form, "sprayer_defaultPilot", profile.sprayer.defaultPilot);
  setFormValue(form, "sprayer_defaultAssistant", profile.sprayer.defaultAssistant);
  setFormValue(form, "sprayer_defaultSprayDevice", profile.sprayer.defaultSprayDevice);
  setFormValue(form, "sprayer_defaultNozzle", profile.sprayer.defaultNozzle);
  setFormValue(form, "sprayer_defaultAltitude", profile.sprayer.defaultAltitude);
  setFormValue(form, "sprayer_defaultSpeed", profile.sprayer.defaultSpeed);
  setFormValue(form, "sprayer_logImportMethod", profile.sprayer.logImportMethod);

  setFormValue(form, "neighbor_notificationPreference", profile.neighbor.notificationPreference);
  setFormValue(form, "neighbor_contactTimeNote", profile.neighbor.contactTimeNote);
  setFormValue(form, "neighbor_defaultCultivation", profile.neighbor.defaultCultivation);

  setFormValue(form, "admin_organizationType", profile.admin.organizationType || "自治体");
  setFormValue(form, "admin_managedDistricts", profile.admin.managedDistricts.join(", "));
  setFormValue(form, "admin_ruleSetName", profile.admin.ruleSetName || activeSettings().regionName);
  setFormValue(form, "admin_organicRadius", activeSettings().organicRadius);
  setFormValue(form, "admin_notifyRadius", activeSettings().notifyRadius);
  setFormValue(form, "admin_sensitiveRadius", activeSettings().sensitiveRadius);
  setFormValue(form, "admin_windCaution", activeSettings().windCaution);
  setFormValue(form, "admin_windLimit", activeSettings().windLimit);
  setFormValue(form, "admin_noticeDeadlineDays", activeSettings().noticeDeadlineDays);
  setFormValue(form, "admin_reportDeadlineDays", activeSettings().reportDeadlineDays);
  setFormValue(form, "admin_sharingScope", profile.admin.sharingScope || activeSettings().sharingScope);

  renderVisibilitySelects(form, profile);
  renderMunicipalityChips(profile);
  renderBoundaryStatus(profile);
}

function setFormValue(form, name, value) {
  const input = form.elements[name];
  if (input) input.value = value ?? "";
}

function renderProfileRoleOptions(selectedRole) {
  $$("[data-profile-role]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profileRole === selectedRole);
  });
  $$("[data-profile-settings]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.profileSettings === selectedRole);
  });
}

function renderVisibilitySelects(form, profile) {
  Object.keys(profile.visibility).forEach((key) => {
    const select = form.elements[`visibility_${key}`];
    if (!select) return;
    select.innerHTML = VISIBILITY_OPTIONS.map(
      ([value, label]) => `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`,
    ).join("");
    select.value = profile.visibility[key] || "relatedOnly";
  });
}

function profileBoundaryChoices() {
  const entries = boundaryCatalog.length ? boundaryCatalog : [];
  const preferred = entries.filter((entry) => PREFERRED_BOUNDARY_NAMES.some((name) => entry.name.includes(name)));
  return preferred.length ? preferred : entries;
}

function renderMunicipalityChips(profile) {
  const wrap = $("#profileMunicipalityChips");
  if (!wrap) return;
  const choices = profileBoundaryChoices();
  wrap.innerHTML = choices.length
    ? choices
        .map((entry) => {
          const checked = profile.targetMunicipalities.includes(entry.code);
          const isZip = entry.file.toLowerCase().endsWith(".zip");
          return `
            <label class="municipality-chip ${checked ? "selected" : ""}">
              <input type="checkbox" name="targetMunicipality" value="${escapeAttr(entry.code)}" ${checked ? "checked" : ""}>
              <span>${escapeHtml(entry.name)}</span>
              <small>${isZip ? "手動読込" : "軽量"}</small>
            </label>
          `;
        })
        .join("")
    : `<div class="empty-state">市町村カタログを読み込み中です。</div>`;
}

function renderBoundaryStatus(profile) {
  const wrap = $("#profileBoundaryStatus");
  if (!wrap) return;
  const entries = profileBoundaryChoices().filter((entry) => profile.targetMunicipalities.includes(entry.code));
  wrap.innerHTML = entries.length
    ? entries
        .map((entry) => {
          const status = profile.boundaryLoadStatus[entry.code] || "notLoaded";
          const isZip = entry.file.toLowerCase().endsWith(".zip");
          return `
            <div class="boundary-status-row">
              <div>
                <strong>${escapeHtml(entry.name)}</strong>
                <span>${escapeHtml(boundaryStatusLabel(status))} / ${escapeHtml(isZip ? "筆ポリゴンzip" : "軽量GeoJSON")}</span>
              </div>
              ${
                isZip
                  ? `<button class="ghost-button tiny" data-profile-boundary-load="${escapeAttr(entry.code)}" type="button">筆ポリゴンを読み込む</button>`
                  : `<span class="pill ${status === "loaded" ? "green" : status === "failed" ? "red" : "amber"}">${escapeHtml(boundaryStatusLabel(status))}</span>`
              }
            </div>
          `;
        })
        .join("")
    : `<div class="empty-state">対象市町村を選択すると境界データの読込状態を表示します。</div>`;
}

function boundaryStatusLabel(status) {
  return {
    notLoaded: "未読込",
    loading: "読込中",
    loaded: "読込済み",
    failed: "読込失敗",
  }[status] || "未読込";
}

function saveProfileFromForm() {
  const form = $("#profileForm");
  if (!form) return;
  const role = form.elements.role.value;
  if (!ROLE_META[role]) {
    showToast("利用区分を選択してください。");
    return;
  }
  const selectedMunicipalities = $$("input[name='targetMunicipality']:checked", form).map((input) => input.value);
  const current = activeProfile();
  const profile = {
    ...current,
    registered: true,
    role,
    name: form.elements.name.value.trim(),
    organizationName: form.elements.organizationName.value.trim(),
    municipality: form.elements.municipality.value.trim(),
    district: form.elements.district.value.trim(),
    addressDetail: form.elements.addressDetail.value.trim(),
    phone: form.elements.phone.value.trim(),
    email: form.elements.email.value.trim(),
    preferredContactMethod: form.elements.preferredContactMethod.value,
    affiliation: form.elements.affiliation.value,
    targetMunicipalities: selectedMunicipalities,
    visibility: {
      name: form.elements.visibility_name.value,
      phone: form.elements.visibility_phone.value,
      addressDetail: form.elements.visibility_addressDetail.value,
      fieldLocation: form.elements.visibility_fieldLocation.value,
      cropStatus: form.elements.visibility_cropStatus.value,
      notificationReplies: form.elements.visibility_notificationReplies.value,
    },
    sprayer: {
      ...current.sprayer,
      defaultMethod: form.elements.sprayer_defaultMethod.value,
      droneModel: form.elements.sprayer_droneModel.value.trim(),
      aircraftRegistration: form.elements.sprayer_aircraftRegistration.value.trim(),
      remoteId: form.elements.sprayer_remoteId.value.trim(),
      defaultPilot: form.elements.sprayer_defaultPilot.value.trim(),
      defaultAssistant: form.elements.sprayer_defaultAssistant.value.trim(),
      defaultSprayDevice: form.elements.sprayer_defaultSprayDevice.value.trim(),
      defaultNozzle: form.elements.sprayer_defaultNozzle.value.trim(),
      defaultAltitude: form.elements.sprayer_defaultAltitude.value.trim(),
      defaultSpeed: form.elements.sprayer_defaultSpeed.value.trim(),
      logImportMethod: form.elements.sprayer_logImportMethod.value,
    },
    neighbor: {
      ...current.neighbor,
      notificationPreference: form.elements.neighbor_notificationPreference.value,
      contactTimeNote: form.elements.neighbor_contactTimeNote.value.trim(),
      defaultCultivation: form.elements.neighbor_defaultCultivation.value,
    },
    admin: {
      ...current.admin,
      organizationType: form.elements.admin_organizationType.value,
      managedMunicipalities: selectedMunicipalities,
      managedDistricts: form.elements.admin_managedDistricts.value.split(",").map((item) => item.trim()).filter(Boolean),
      ruleSetName: form.elements.admin_ruleSetName.value.trim(),
      sharingScope: form.elements.admin_sharingScope.value,
    },
    boundaryLoadStatus: selectedMunicipalities.reduce((acc, code) => {
      acc[code] = current.boundaryLoadStatus[code] || "notLoaded";
      return acc;
    }, {}),
  };
  state.profile = normalizeProfile(profile);
  state.role = role;
  activeRole = role;
  if (role === "admin") {
    state.settings = {
      ...activeSettings(),
      regionName: profile.admin.ruleSetName || activeSettings().regionName,
      managerName: profile.name || profile.organizationName || activeSettings().managerName,
      organicRadius: toPositiveNumber(form.elements.admin_organicRadius.value, DEFAULT_SETTINGS.organicRadius),
      notifyRadius: toPositiveNumber(form.elements.admin_notifyRadius.value, DEFAULT_SETTINGS.notifyRadius),
      sensitiveRadius: toPositiveNumber(form.elements.admin_sensitiveRadius.value, DEFAULT_SETTINGS.sensitiveRadius),
      windCaution: toPositiveNumber(form.elements.admin_windCaution.value, DEFAULT_SETTINGS.windCaution),
      windLimit: toPositiveNumber(form.elements.admin_windLimit.value, DEFAULT_SETTINGS.windLimit),
      noticeDeadlineDays: toPositiveNumber(form.elements.admin_noticeDeadlineDays.value, DEFAULT_SETTINGS.noticeDeadlineDays),
      reportDeadlineDays: toPositiveNumber(form.elements.admin_reportDeadlineDays.value, DEFAULT_SETTINGS.reportDeadlineDays),
      sharingScope: profile.admin.sharingScope,
    };
  }
  if (role === "sprayer") {
    applyProfileToActivePlan({ silent: true });
  }
  if (role === "neighbor") {
    applyNeighborProfileToField();
  }
  saveState();
  renderAll();
  switchView("dashboard");
  loadProfileLightBoundaries();
  showToast("プロフィールを保存しました。");
}

function resetProfileToDemoMode() {
  if (!confirm("プロフィールだけをリセットして未登録デモモードに戻しますか？")) return;
  state.profile = defaultProfile();
  state.role = "sprayer";
  activeRole = "sprayer";
  saveState();
  renderAll();
  switchView("profile");
  showToast("未登録デモモードに戻しました。");
}

function registeredProfileFor(role) {
  if (!state?.profile) return null;
  const profile = normalizeProfile(state.profile);
  return profile.registered && profile.role === role ? profile : null;
}

function profileEquipmentTemplate() {
  const profile = registeredProfileFor("sprayer");
  if (!profile) return {};
  return {
    droneModel: profile.sprayer.droneModel,
    aircraftRegistration: profile.sprayer.aircraftRegistration,
    pilot: profile.sprayer.defaultPilot,
    assistant: profile.sprayer.defaultAssistant,
    sprayDevice: profile.sprayer.defaultSprayDevice,
    nozzle: profile.sprayer.defaultNozzle,
    plannedAltitude: profile.sprayer.defaultAltitude,
    plannedSpeed: profile.sprayer.defaultSpeed,
  };
}

function profilePlanDefaults() {
  const profile = registeredProfileFor("sprayer");
  if (!profile) return {};
  return {
    method: profile.sprayer.defaultMethod || "ドローン",
    operator: profile.name || profile.organizationName || "匿名散布者",
    contact: profile.phone || profile.email || "デモ連絡先",
    district: [profile.municipality, profile.district].filter(Boolean).join(" ") || "笠間市周辺デモ",
  };
}

function profileWeatherDefaults() {
  const profile = registeredProfileFor("sprayer") || registeredProfileFor("neighbor") || registeredProfileFor("admin");
  if (!profile) return {};
  const label = [profile.municipality, profile.district].filter(Boolean).join(" ");
  return label ? { locationLabel: label } : {};
}

function profileFieldDefaults() {
  const profile = registeredProfileFor("neighbor");
  if (!profile) return {};
  return {
    owner: profile.name || profile.organizationName || "自分",
    municipality: profile.municipality,
    district: profile.district,
    contactMethod: CONTACT_METHOD_LABELS[profile.preferredContactMethod] || "電話",
    cultivation: profile.neighbor.defaultCultivation || "農薬使用なし",
    notifyPreference: notificationPreferenceLabel(profile.neighbor.notificationPreference),
    publicScope: visibilityLabel(profile.visibility.fieldLocation),
  };
}

function applyProfileToActivePlan(options = {}) {
  const profile = activeProfile();
  if (!profile.registered || profile.role !== "sprayer") {
    if (!options.silent) showToast("散布者プロフィールを登録すると反映できます。");
    return;
  }
  const plan = activePlan();
  plan.method = profile.sprayer.defaultMethod || plan.method;
  plan.operator = profile.name || profile.organizationName || plan.operator;
  plan.contact = profile.phone || profile.email || plan.contact;
  plan.district = [profile.municipality, profile.district].filter(Boolean).join(" ") || plan.district;
  plan.weather = { ...defaultWeather(), ...(plan.weather || {}), ...profileWeatherDefaults() };
  Object.entries(profileEquipmentTemplate()).forEach(([key, value]) => {
    if (value) plan[key] = value;
  });
  state.equipmentTemplate = { ...state.equipmentTemplate, ...profileEquipmentTemplate() };
  saveState();
  renderPlanForm();
  if (!options.silent) showToast("プロフィールの散布者情報を計画に反映しました。");
}

function applyNeighborProfileToField() {
  const profile = activeProfile();
  if (!profile.registered || profile.role !== "neighbor") return;
  const field = activeField();
  field.owner = profile.name || profile.organizationName || "自分";
  field.contactMethod = CONTACT_METHOD_LABELS[profile.preferredContactMethod] || field.contactMethod;
  field.cultivation = profile.neighbor.defaultCultivation || field.cultivation;
  field.notifyPreference = notificationPreferenceLabel(profile.neighbor.notificationPreference);
  field.publicScope = visibilityLabel(profile.visibility.fieldLocation);
  if (profile.municipality && !field.municipality) field.municipality = profile.municipality;
  if (profile.district && !field.district) field.district = profile.district;
  field.updatedAt = dateOffset(0);
}

function notificationPreferenceLabel(value) {
  return {
    allNearby: "すべての近隣散布",
    nearbyOnly: "近接時のみ",
    downwindOnly: "風下方向のみ",
    agrochemicalOnly: "農薬散布のみ",
    asNeeded: "必要時のみ",
    nearbyAndDownwind: "近接・風下時",
  }[value] || "必要時のみ";
}

function visibilityLabel(value) {
  return Object.fromEntries(VISIBILITY_OPTIONS)[value] || "関係者限定";
}

async function loadProfileLightBoundaries() {
  const profile = activeProfile();
  if (!profile.targetMunicipalities.length || !boundaryCatalog.length) return;
  const entries = boundaryCatalog.filter(
    (entry) => profile.targetMunicipalities.includes(entry.code) && !entry.file.toLowerCase().endsWith(".zip"),
  );
  if (!entries.length) return;
  const features = [];
  for (const entry of entries) {
    profile.boundaryLoadStatus[entry.code] = "loading";
    try {
      const res = await fetch(`data/boundaries/${encodeURIComponent(entry.file)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      featuresFromGeoJsonText(await res.text()).forEach((feature) => features.push(feature));
      profile.boundaryLoadStatus[entry.code] = "loaded";
    } catch (error) {
      profile.boundaryLoadStatus[entry.code] = "failed";
    }
  }
  if (features.length) {
    applyBoundaryFeatures(features, { silent: true, name: "プロフィール対象市町村" });
  }
  saveState();
  renderAll();
  requestAnimationFrame(() => focusVisibleMaps("all"));
}

async function loadProfileBoundary(code) {
  const profile = activeProfile();
  profile.boundaryLoadStatus[code] = "loading";
  saveState();
  renderProfileForm();
  const ok = await loadMunicipalityBoundary(code);
  profile.boundaryLoadStatus[code] = ok ? "loaded" : "failed";
  saveState();
  renderProfileForm();
}

function renderBars(selector, title, counts) {
  const entries = Object.entries(counts);
  const max = Math.max(1, ...entries.map((entry) => entry[1]));
  $(selector).innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${entries
      .map(
        ([label, value]) => `
          <div class="bar-row">
            <div><span>${escapeHtml(label)}</span><span>${value}件</span></div>
            <div class="bar-track"><span style="width:${Math.round((value / max) * 100)}%"></span></div>
          </div>
        `,
      )
      .join("")}
  `;
}

function renderSources() {
  $("#sourceGrid").innerHTML = SOURCES.map(
    (source) => `
      <article class="source-card">
        <span class="tag ${source.url ? "tag-blue" : "tag-green"}">${source.url ? "参照リンク" : "設計方針"}</span>
        <h4>${escapeHtml(source.title)}</h4>
        <p>${escapeHtml(source.body)}</p>
        ${source.url ? `<a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">公式ページを開く</a>` : ""}
      </article>
    `,
  ).join("");
}

function updatePlanFromForm() {
  const plan = activePlan();
  const form = $("#planForm");
  [
    "date",
    "timeWindow",
    "fieldName",
    "district",
    "crop",
    "materialType",
    "pesticide",
    "purpose",
    "method",
    "operator",
    "contact",
    "droneModel",
    "aircraftRegistration",
    "pilot",
    "assistant",
    "sprayDevice",
    "nozzle",
    "plannedAltitude",
    "plannedSpeed",
    "pesticideRegistration",
    "preHarvestDays",
    "amount",
    "dilution",
    "labelCheckedAt",
    "sprayArea",
    "notes",
  ].forEach((name) => {
    plan[name] = form.elements[name].value.trim();
  });
  plan.rateUnit = form.elements.rateUnit.value || "mL";
  plan.ratePer10a = toNumber(form.elements.ratePer10a.value);
  plan.areaHa = toNumber(form.elements.areaHa.value);
  plan.sprayWidthM = toNumber(form.elements.sprayWidthM.value);
}

function updateWeatherFromForm() {
  const plan = activePlan();
  const form = $("#weatherForm");
  plan.weather = {
    ...plan.weather,
    latitude: toNumber(form.elements.latitude.value),
    longitude: toNumber(form.elements.longitude.value),
    forecastDirection: form.elements.forecastDirection.value,
    forecastSpeed: toNumber(form.elements.forecastSpeed.value),
    maxGust: toNumber(form.elements.maxGust.value),
    temperature: toNumber(form.elements.temperature.value),
    humidity: toNumber(form.elements.humidity.value),
    rainForecast: form.elements.rainForecast.value.trim(),
    actualDirection: form.elements.actualDirection.value,
    actualSpeed: toNumber(form.elements.actualSpeed.value),
    measuredAt: form.elements.measuredAt.value,
    measuredPlace: form.elements.measuredPlace.value.trim(),
    measurementMethod: form.elements.measurementMethod.value,
    measuredBy: form.elements.measuredBy.value.trim(),
    weatherNotes: form.elements.weatherNotes.value.trim(),
  };
  plan.checks.weatherForecast = Boolean(plan.weather.source || plan.weather.fetchedAt || plan.weather.forecastSpeed || plan.weather.maxGust || plan.weather.rainForecast);
  plan.checks.wind = Boolean(plan.weather.actualSpeed && plan.weather.measuredAt && plan.weather.measuredPlace);
  plan.checks.weatherEnv = Boolean(form.elements.weatherConfirmed?.checked);
}

async function fetchWeatherForecast() {
  const plan = activePlan();
  const weather = plan.weather || defaultWeather();
  const latitude = Number(weather.latitude || DEFAULT_WEATHER_LOCATION.latitude);
  const longitude = Number(weather.longitude || DEFAULT_WEATHER_LOCATION.longitude);
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "Asia/Tokyo",
    wind_speed_unit: "ms",
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    forecast_days: "7",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  setWeatherStatus("取得中", "Open-Meteoから予報を取得しています。");
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const forecast = pickForecastHour(data, plan);
    const current = data.current || {};
    const directionDegrees = forecast.wind_direction_10m ?? current.wind_direction_10m;
    const speed = forecast.wind_speed_10m ?? current.wind_speed_10m;
    const gust = forecast.wind_gusts_10m ?? current.wind_gusts_10m;
    const temperature = forecast.temperature_2m ?? current.temperature_2m;
    const humidity = forecast.relative_humidity_2m ?? current.relative_humidity_2m;
    const precipitation = forecast.precipitation ?? current.precipitation;
    const precipitationProbability = forecast.precipitation_probability;
    plan.weather = {
      ...plan.weather,
      latitude,
      longitude,
      locationLabel: weather.locationLabel || DEFAULT_WEATHER_LOCATION.label,
      forecastDirection: degreesToDirection(directionDegrees),
      forecastSpeed: roundOne(speed),
      maxGust: roundOne(gust),
      temperature: roundOne(temperature),
      humidity: Number.isFinite(Number(humidity)) ? Math.round(Number(humidity)) : "",
      rainForecast: buildRainForecast(precipitation, precipitationProbability),
      source: "Open-Meteo Forecast API",
      fetchedAt: formatDateTime(new Date()),
      forecastTargetTime: forecast.time || current.time || "",
      weatherNotes: plan.weather.weatherNotes || "Open-Meteoの予報値を自動取得。散布直前に現地実測を記録してください。",
    };
    plan.checks.weatherForecast = true;
    saveState();
    renderAll();
    showToast("気象情報を自動取得しました。");
  } catch (error) {
    setWeatherStatus("取得失敗", "通信できないため、手入力の値を使用してください。");
    showToast("気象情報を取得できませんでした。手入力で続行できます。");
  }
}

function setWeatherStatus(label, message) {
  const status = $("#weatherApiStatus");
  if (!status) return;
  status.innerHTML = `
    <div>
      <span class="tag tag-attention">${escapeHtml(label)}</span>
      <strong>${escapeHtml(message)}</strong>
    </div>
  `;
}

function pickForecastHour(data, plan) {
  const hourly = data.hourly || {};
  const times = hourly.time || [];
  if (!times.length) return {};
  const target = forecastTargetDate(plan);
  let bestIndex = 0;
  let bestDiff = Infinity;
  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - target.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });
  return Object.fromEntries(
    Object.entries(hourly).map(([key, values]) => [key, Array.isArray(values) ? values[bestIndex] : values]),
  );
}

function forecastTargetDate(plan) {
  const startTime = String(plan.timeWindow || "06:00").split("-")[0] || "06:00";
  const [hour = "6", minute = "0"] = startTime.split(":");
  const date = new Date(`${plan.date}T00:00:00+09:00`);
  date.setHours(Number(hour) || 6, Number(minute) || 0, 0, 0);
  return date;
}

function degreesToDirection(degrees) {
  const number = Number(degrees);
  if (!Number.isFinite(number)) return "北西";
  const labels = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
  return labels[Math.round(number / 45) % 8];
}

function buildRainForecast(precipitation, probability) {
  const rain = Number(precipitation || 0);
  const chance = Number(probability);
  if (Number.isFinite(chance) && chance >= 50) return `降水確率${Math.round(chance)}%`;
  if (rain > 0) return `${roundOne(rain)}mmの降水見込み`;
  if (Number.isFinite(chance)) return `降水確率${Math.round(chance)}%`;
  return "なし";
}

function roundOne(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : "";
}

function updateReportFromForm() {
  const plan = activePlan();
  const form = $("#reportForm");
  plan.report = {
    ...plan.report,
    doneDate: form.elements.doneDate.value,
    doneTime: form.elements.doneTime.value.trim(),
    doneField: form.elements.doneField.value.trim(),
    donePesticide: form.elements.donePesticide.value.trim(),
    doneArea: form.elements.doneArea.value.trim(),
    doneWeather: form.elements.doneWeather.value.trim(),
    incident: form.elements.incident.value,
    inquiry: form.elements.inquiry.value,
    reportType: form.elements.reportType.value,
    actualAmount: form.elements.actualAmount.value.trim(),
    altitudeNotes: form.elements.altitudeNotes.value.trim(),
    outsideFlight: form.elements.outsideFlight.value,
    reportNotes: form.elements.reportNotes.value.trim(),
  };
  plan.checks.report = Boolean(plan.report.doneDate);
  saveState();
  renderAll();
  showToast("実施後報告を保存しました。");
}

function autoFillReportFromPlan() {
  const plan = activePlan();
  const log = activeDroneLog();
  plan.report = {
    ...plan.report,
    doneDate: plan.report.doneDate || plan.date,
    doneTime: plan.report.doneTime || (log.imported ? `${log.startedAt}-${log.endedAt}` : plan.timeWindow),
    doneField: plan.report.doneField || plan.fieldName,
    donePesticide: plan.report.donePesticide || plan.pesticide,
    doneArea: plan.report.doneArea || plan.sprayArea,
    doneWeather: plan.report.doneWeather || weatherLabel(plan),
    incident: plan.report.incident || "なし",
    inquiry: plan.report.inquiry || "なし",
    reportType: log.outsideFlight || altitudeCheckCount(log) ? "追加確認あり" : "通常報告",
    actualAmount: plan.report.actualAmount || plan.amount,
    altitudeNotes: altitudeCheckCount(log) ? `${altitudeCheckCount(log)}点 要確認 / 最大 ${maxAltitude(log)}m` : "高度要確認区間なし",
    outsideFlight: log.outsideFlight ? "要確認" : "なし",
  };
  plan.checks.report = Boolean(plan.report.doneDate);
}

function handlePhotoInput(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const plan = activePlan();
    plan.report.photoData = reader.result;
    plan.report.photoName = file.name;
    saveState();
    renderReport();
    showToast("写真メモを読み込みました。");
  };
  reader.readAsDataURL(file);
}

async function copyNotice() {
  const text = $("#noticeText").value;
  try {
    await navigator.clipboard.writeText(text);
    showToast("通知文をコピーしました。");
  } catch (error) {
    $("#noticeText").select();
    showToast("通知文を選択しました。コピー操作を行ってください。");
  }
}

function markSelectedTargetsNotified() {
  const plan = activePlan();
  const selected = $$("[data-notify-target]:checked").map((input) => input.dataset.notifyTarget);
  if (!selected.length) {
    showToast("通知済みにする対象を選択してください。");
    return;
  }
  selected.forEach((id) => {
    plan.notificationTargets[id] = true;
  });
  plan.checks.notice = notificationIsComplete(plan);
  saveState();
  renderAll();
  showToast("通知履歴を更新しました。");
}

function setNotificationResponse(fieldId, response, planId = "") {
  const plan = state.plans.find((item) => item.id === planId) || activePlan();
  plan.notificationResponses = plan.notificationResponses || {};
  plan.notificationResponses[fieldId] = response || "未回答";
  if (response && response !== "未回答") {
    plan.notificationTargets[fieldId] = true;
  }
  plan.checks.notice = notificationIsComplete(plan);
  state.activePlanId = plan.id;
  saveState();
  renderAll();
  showToast(`返信を「${response || "未回答"}」に更新しました。`);
}

function notificationResponse(plan, fieldId) {
  return plan.notificationResponses?.[fieldId] || "未回答";
}

function countNotificationResponses(response) {
  return state.plans.reduce((total, plan) => {
    const values = Object.values(plan.notificationResponses || {});
    return total + values.filter((value) => value === response).length;
  }, 0);
}

function printDocument(type) {
  const plan = activePlan();
  const htmlByType = {
    notice: buildNoticePrint(plan),
    precheck: buildPrecheckPrint(plan),
    report: buildReportPrint(plan),
    admin: buildAdminPrint(),
    history: buildHistoryPrint(),
  };
  $("#printSheet").innerHTML = htmlByType[type] || "";
  document.body.classList.add("printing");
  window.print();
  setTimeout(() => document.body.classList.remove("printing"), 400);
}

function buildNoticePrint(plan) {
  return `
    <article class="print-doc">
      <h1>農薬散布予定のお知らせ</h1>
      <p>作成日：${escapeHtml(formatDateTime(new Date()))}</p>
      ${printTable([
        ["散布予定日時", `${plan.date} ${plan.timeWindow}`],
        ["散布場所", `${plan.district} ${plan.fieldName}`],
        ["作物・使用農薬", `${plan.crop} / ${plan.pesticide}`],
        ["使用目的", plan.purpose],
        ["散布方法", plan.method],
        ["散布者連絡先", `${plan.operator} / ${plan.contact}`],
        ["天候変更時", "風向・風速等により日時変更する場合があります。"],
      ])}
      <h2>通知文</h2>
      <p>${escapeHtml(buildNoticeText(plan, "paper")).replace(/\n/g, "<br>")}</p>
    </article>
  `;
}

function buildPrecheckPrint(plan) {
  const rules = activeSettings();
  const progress = checkProgress(plan);
  const rows = CHECK_ITEMS.map((item) => [item.title, plan.checks[item.id] ? "確認済み" : "未確認"]);
  return `
    <article class="print-doc">
      <h1>農薬散布前 確認記録</h1>
      <p>確認状況：${progress.done} / ${progress.total} 項目</p>
      <p>確認進捗：${readinessScore(plan).value}</p>
      <p>実証ルール案：${escapeHtml(rules.regionName)} / 有機ほ場 ${escapeHtml(rules.organicRadius)}m以内重点確認 / 通知 ${escapeHtml(rules.notifyRadius)}m以内 / 風速 ${escapeHtml(rules.windLimit)}m/s以上は延期検討</p>
      ${printTable([
        ["散布予定", `${plan.date} ${plan.timeWindow}`],
        ["散布場所", `${plan.district} ${plan.fieldName}`],
        ["使用農薬", plan.pesticide],
        ["散布方法", plan.method],
        ["風向・風速", weatherLabel(plan)],
        ["通知状況", notificationLabel(plan)],
      ])}
      <h2>チェック項目</h2>
      ${printTable(rows)}
      <h2>周辺確認</h2>
      ${printTable(riskItemsForPlan(plan).map((item) => [item.name, item.message]))}
    </article>
  `;
}

function buildReportPrint(plan) {
  const photo = plan.report.photoData ? `<h2>写真メモ</h2><img src="${escapeAttr(plan.report.photoData)}" alt="写真メモ" style="max-width:280px">` : "";
  return `
    <article class="print-doc">
      <h1>農薬散布 実施後報告</h1>
      ${printTable([
        ["実施日時", `${plan.report.doneDate || ""} ${plan.report.doneTime || ""}`],
        ["実施ほ場", plan.report.doneField || plan.fieldName],
        ["使用農薬", plan.report.donePesticide || plan.pesticide],
        ["実施範囲", plan.report.doneArea || plan.sprayArea],
        ["気象条件", plan.report.doneWeather || weatherLabel(plan)],
        ["異常の有無", plan.report.incident || "未入力"],
        ["問い合わせ", plan.report.inquiry || "未入力"],
        ["備考", plan.report.reportNotes || ""],
      ])}
      ${photo}
    </article>
  `;
}

function buildAdminPrint() {
  const rules = activeSettings();
  return `
    <article class="print-doc">
      <h1>地域内 農薬散布予定・確認状況一覧</h1>
      <p>出力日：${escapeHtml(formatDateTime(new Date()))}</p>
      <p>実証ルール案：${escapeHtml(rules.regionName)} / 有機ほ場 ${escapeHtml(rules.organicRadius)}m以内重点確認 / 通知 ${escapeHtml(rules.notifyRadius)}m以内 / 風速 ${escapeHtml(rules.windLimit)}m/s以上は延期検討</p>
      <table>
        <thead>
          <tr><th>日付</th><th>地区</th><th>ほ場</th><th>周辺確認</th><th>通知</th><th>チェック</th><th>確認進捗</th><th>報告</th></tr>
        </thead>
        <tbody>
          ${state.plans
            .map((plan) => {
              const progress = checkProgress(plan);
              return `<tr>
                <td>${escapeHtml(plan.date)}</td>
                <td>${escapeHtml(plan.district)}</td>
                <td>${escapeHtml(plan.fieldName)}</td>
                <td>${escapeHtml(riskLevelLabel(riskLevel(plan)))}</td>
                <td>${escapeHtml(notificationLabel(plan))}</td>
                <td>${progress.done}/${progress.total}</td>
                <td>${readinessScore(plan).value}</td>
                <td>${plan.report.doneDate ? "提出済み" : "未提出"}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </article>
  `;
}

function buildHistoryPrint() {
  const rules = activeSettings();
  const records = filteredHistoryRecords();
  return `
    <article class="print-doc">
      <h1>ドローン散布・施肥 作業履歴（防除履歴）</h1>
      <p>出力日：${escapeHtml(formatDateTime(new Date()))} / ${escapeHtml(rules.regionName)}</p>
      <p>計画と実施後報告から自動集計した散布・施肥の記録です。防除履歴の記帳・出荷確認用の控えとして利用できます。</p>
      <table>
        <thead>
          <tr><th>実施/予定日</th><th>圃場</th><th>作物</th><th>種別</th><th>資材名</th><th>使用量(10a)・希釈</th><th>総量</th><th>範囲・カバー</th><th>方法</th><th>散布者</th><th>報告</th></tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `<tr>
                <td>${escapeHtml(record.date)} ${escapeHtml(record.time || "")}</td>
                <td>${escapeHtml(record.field)}</td>
                <td>${escapeHtml(record.crop)}</td>
                <td>${escapeHtml(record.materialType)}</td>
                <td>${escapeHtml(record.material)}</td>
                <td>${escapeHtml(record.rate)}</td>
                <td>${escapeHtml(record.total)}</td>
                <td>${escapeHtml(record.area)} / ${escapeHtml(record.coverage)}</td>
                <td>${escapeHtml(record.method)}</td>
                <td>${escapeHtml(record.operator)}</td>
                <td>${record.done ? "提出済み" : "未提出"}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </article>
  `;
}

function printTable(rows) {
  return `
    <table>
      <tbody>
        ${rows.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value || "")}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

function exportCsv() {
  const rows = [
    ["日付", "時間", "地区", "ほ場", "作物", "農薬", "方法", "周辺確認", "通知", "チェック", "確認進捗", "報告"],
    ...state.plans.map((plan) => {
      const progress = checkProgress(plan);
      return [
        plan.date,
        plan.timeWindow,
        plan.district,
        plan.fieldName,
        plan.crop,
        plan.pesticide,
        plan.method,
        riskLevelLabel(riskLevel(plan)),
        notificationLabel(plan),
        `${progress.done}/${progress.total}`,
        readinessScore(plan).value,
        plan.report.doneDate ? "提出済み" : "未提出",
      ];
    }),
  ];
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tonari-hatake-safety-${dateOffset(0)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSVを出力しました。");
}

function exportHistoryCsv() {
  const records = filteredHistoryRecords();
  const rows = [
    ["実施/予定日", "時間", "圃場", "作物", "資材種別", "資材名", "使用量(10a)・希釈", "総量", "実施範囲", "カバー", "散布方法", "散布者", "気象", "報告"],
    ...records.map((record) => [
      record.date,
      record.time,
      record.field,
      record.crop,
      record.materialType,
      record.material,
      record.rate,
      record.total,
      record.area,
      record.coverage,
      record.method,
      record.operator,
      record.weather,
      record.done ? "提出済み" : "未提出",
    ]),
  ];
  const csv = `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tonari-hatake-history-${dateOffset(0)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("防除・作業履歴CSVを出力しました。");
}

function getDashboardMetrics() {
  if (activeRole === "admin") return getAdminDashboardMetrics();
  if (activeRole === "neighbor") return getNeighborDashboardMetrics();

  const rules = activeSettings();
  const today = dateOffset(0);
  const tomorrow = dateOffset(1);
  const todayPlans = state.plans.filter((plan) => plan.date === today).length;
  const tomorrowPlans = state.plans.filter((plan) => plan.date === tomorrow).length;
  const notifyIncomplete = state.plans.filter((plan) => !notificationIsComplete(plan)).length;
  const organicNear = state.plans.filter((plan) => riskItemsForPlan(plan).some((risk) => ["organic", "noChemical"].includes(risk.type) && risk.level === "high")).length;
  const windNeed = state.plans.filter(windNeedsAttention).length;
  const reportMissing = state.plans.filter((plan) => plan.date <= today && !plan.report.doneDate).length;
  const highRisk = state.plans.filter((plan) => riskLevel(plan) === "high").length;
  const activeReadiness = readinessScore(activePlan()).value;
  return [
    { label: "今日の散布予定", value: `${todayPlans}件`, note: today, alert: false },
    { label: "明日の散布予定", value: `${tomorrowPlans}件`, note: tomorrow, alert: false },
    { label: "通知未完了", value: `${notifyIncomplete}件`, note: "近隣通知", alert: notifyIncomplete > 0 },
    { label: `有機ほ場${rules.organicRadius}m以内`, value: `${organicNear}件`, note: "周辺確認", alert: organicNear > 0 },
    { label: "風向・風速要確認", value: `${windNeed}件`, note: "気象メモ", alert: windNeed > 0 },
    { label: "実施後報告未提出", value: `${reportMissing}件`, note: "散布者控え", alert: reportMissing > 0 },
    { label: "追加確認が必要な予定", value: `${highRisk}件`, note: "管理者確認", alert: highRisk > 0 },
    { label: "表示中の確認進捗", value: `${activeReadiness}`, note: "説明用指標", alert: activeReadiness < 70 },
  ];
}

function getNeighborDashboardMetrics() {
  const notices = neighborRelevantNotices();
  const field = activeField();
  const pending = notices.filter((notice) => notice.response === "未回答").length;
  const consulting = notices.filter((notice) => notice.response !== "未回答" && notice.response !== "確認しました").length;
  return [
    { label: "未返信通知", value: `${pending}件`, note: "通知インボックス", alert: pending > 0 },
    { label: "近日散布予定", value: `${notices.length}件`, note: "自分に関係", alert: notices.length > 0 },
    { label: "時間変更・電話相談", value: `${consulting}件`, note: "返信履歴", alert: consulting > 0 },
    { label: "公開範囲", value: field.publicScope || "概略のみ共有", note: "圃場情報", alert: false },
    { label: "通知希望", value: field.notifyPreference || "未確認", note: field.name, alert: field.notifyPreference === "未確認" },
  ];
}

function getAdminDashboardMetrics() {
  const rules = activeSettings();
  const summary = adminDashboardSummary();
  return [
    { label: "対象日の散布予定", value: `${summary.planned}件`, note: summary.date, alert: false },
    { label: "通知未完了", value: `${summary.notifyIncomplete}件`, note: "近隣通知", alert: summary.notifyIncomplete > 0 },
    { label: "風向・風速要確認", value: `${summary.windNeed}件`, note: "気象条件", alert: summary.windNeed > 0 },
    { label: "実施後報告未提出", value: `${summary.reportMissing}件`, note: "散布者控え", alert: summary.reportMissing > 0 },
    { label: `有機ほ場${rules.organicRadius}m以内`, value: `${summary.organicNear}件`, note: "周辺確認", alert: summary.organicNear > 0 },
    { label: "ドローンログ未取込", value: `${summary.droneMissing}件`, note: "飛行ログ", alert: summary.droneMissing > 0 },
    { label: "高度要確認", value: `${summary.altitudeNeed}件`, note: "作業軌跡", alert: summary.altitudeNeed > 0 },
    { label: "問い合わせあり", value: `${summary.inquiry}件`, note: "実施後報告", alert: summary.inquiry > 0 },
    { label: "追加確認が必要な予定", value: `${summary.attention}件`, note: "管理者確認", alert: summary.attention > 0 },
  ];
}

function riskItemsForPlan(plan) {
  const rules = activeSettings();
  return state.fields
    .filter((field) => field.type !== "spray")
    .map((field) => {
      let level = "low";
      let message = "周辺情報として確認。";
      const isOrganicLike = field.type === "organic" || field.type === "noChemical";
      const isSensitive = ["house", "preharvest", "water", "bee"].includes(field.type);
      let requiresNotice = Boolean(field.notifyTarget && field.distance <= rules.notifyRadius);
      if (isOrganicLike && field.distance <= rules.organicRadius) {
        level = "high";
        requiresNotice = true;
        message = `周辺確認が必要です。${field.direction}方向 ${field.distance}m に${field.name}があります。実証ルール案の重点確認距離 ${rules.organicRadius}m 以内です。`;
      } else if (isSensitive && field.distance <= rules.sensitiveRadius) {
        level = "medium";
        requiresNotice = true;
        message = `通知・作業調整の確認対象です。${rules.sensitiveRadius}m 圏内にあります。`;
      } else if (requiresNotice) {
        level = "medium";
        message = `実証ルール案上の通知候補です。通知対象距離 ${rules.notifyRadius}m 圏内にあります。`;
      }
      const notified = Boolean(plan.notificationTargets[field.id]);
      return {
        ...field,
        notifyTarget: requiresNotice,
        level,
        notified,
        distanceLabel: `${field.distance}m`,
        message,
      };
    })
    .filter((item) => item.notifyTarget || item.level !== "low");
}

function riskLevel(plan) {
  const risks = riskItemsForPlan(plan);
  if (risks.some((risk) => risk.level === "high" && !risk.notified)) return "high";
  if (windNeedsAttention(plan)) return "high";
  if (risks.some((risk) => risk.level === "high")) return "medium";
  if (!notificationIsComplete(plan) || risks.some((risk) => risk.level === "medium")) return "medium";
  return "low";
}

function priorityScore(plan) {
  let score = 0;
  riskItemsForPlan(plan).forEach((risk) => {
    score += risk.level === "high" ? 4 : 2;
    if (!risk.notified) score += 2;
  });
  if (windNeedsAttention(plan)) score += 3;
  if (!plan.report.doneDate && plan.date <= dateOffset(0)) score += 1;
  return score;
}

function notificationIsComplete(plan) {
  const targets = riskItemsForPlan(plan).filter((item) => item.notifyTarget);
  if (!targets.length) return true;
  return targets.every((target) => plan.notificationTargets[target.id]);
}

function notificationLabel(plan) {
  const targets = riskItemsForPlan(plan).filter((item) => item.notifyTarget);
  const done = targets.filter((target) => plan.notificationTargets[target.id]).length;
  return `${done}/${targets.length}件 通知済み`;
}

function checkProgress(plan) {
  const done = CHECK_ITEMS.filter((item) => plan.checks[item.id]).length;
  const total = CHECK_ITEMS.length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

function windNeedsAttention(plan) {
  const rules = activeSettings();
  const speed = Number(plan.weather.actualSpeed || plan.weather.forecastSpeed || 0);
  return !plan.weather.actualSpeed || speed >= rules.windCaution;
}

function weatherDecision(plan) {
  const rules = activeSettings();
  const weather = plan.weather || {};
  const speed = Number(weather.actualSpeed || weather.forecastSpeed || 0);
  const gust = Number(weather.maxGust || 0);
  const rain = rainNeedsAttention(weather);
  if (!weather.actualSpeed) {
    return { label: "実測待ち", className: "status-amber", level: "warn" };
  }
  if (speed >= rules.windLimit || gust >= rules.windLimit + 2 || rain) {
    return { label: "延期検討条件あり", className: "status-red", level: "bad" };
  }
  if (speed >= rules.windCaution || gust >= rules.windCaution + 1) {
    return { label: "再測定推奨", className: "status-amber", level: "warn" };
  }
  return { label: "記録上は条件内", className: "status-green", level: "good" };
}

function mapWeatherMetrics(plan) {
  const weather = plan.weather || {};
  const rules = activeSettings();
  const direction = weather.actualDirection || weather.forecastDirection || "未入力";
  const downwind = downwindDirection(direction);
  const speed = Number(weather.actualSpeed || weather.forecastSpeed || 0);
  const gust = Number(weather.maxGust || 0);
  const decision = weatherDecision(plan);
  return [
    { label: "風向/風下", value: direction, note: `風下 ${downwind}`, level: "warn" },
    {
      label: "風速",
      value: speed ? `${speed}m/s` : "未測定",
      note: `注意 ${rules.windCaution}m/s`,
      level: !weather.actualSpeed || speed >= rules.windLimit ? "bad" : speed >= rules.windCaution ? "warn" : "good",
    },
    {
      label: "突風",
      value: gust ? `${gust}m/s` : "未取得",
      note: "飛散・姿勢乱れ確認",
      level: gust >= rules.windLimit + 2 ? "bad" : gust >= rules.windCaution + 1 ? "warn" : "good",
    },
    { label: "確認状況", value: decision.label, note: rainRiskLabel(weather), level: decision.level },
  ];
}

function rainNeedsAttention(weather) {
  const text = String(weather.rainForecast || "");
  return Boolean(text && text !== "なし" && !text.includes("なし") && !text.includes("0"));
}

function rainRiskLabel(weather) {
  const text = String(weather.rainForecast || "").trim();
  if (!text) return "未取得";
  return rainNeedsAttention(weather) ? text : "なし";
}

function weatherLabel(plan) {
  const weather = plan.weather || {};
  const direction = weather.actualDirection || weather.forecastDirection || "未入力";
  const speed = weather.actualSpeed || weather.forecastSpeed || "未入力";
  return `${direction} ${speed}m/s`;
}

function weatherCard(plan) {
  const rules = activeSettings();
  const speed = Number(plan.weather.actualSpeed || plan.weather.forecastSpeed || 0);
  const gust = Number(plan.weather.maxGust || 0);
  const downwind = downwindDirection(plan.weather.actualDirection || plan.weather.forecastDirection);
  let tag = `<span class="pill green">記録済み</span>`;
  let message = "散布前の気象記録があります。";
  if (!plan.weather.actualSpeed) {
    tag = `<span class="pill amber">実測未入力</span>`;
    message = "実測風速と測定場所を記録してください。";
  } else if (speed >= rules.windLimit) {
    tag = `<span class="pill amber">時間変更を検討</span>`;
    message = `実証ルール案の延期検討風速 ${rules.windLimit}m/s 以上です。弱風時間帯の再確認を推奨します。`;
  } else if (speed >= rules.windCaution) {
    tag = `<span class="pill amber">再確認推奨</span>`;
    message = `実証ルール案の再確認推奨風速 ${rules.windCaution}m/s 以上です。散布直前の再測定を記録してください。`;
  }
  return `
    <div class="wind-readout">
      <div class="wind-symbol">↘</div>
      <div>
        <div class="pill-line">${tag}<span class="pill blue">風下 ${escapeHtml(downwind)}</span></div>
        <strong>${escapeHtml(weatherLabel(plan))}</strong>
        <span class="small-note">${escapeHtml(message)}</span>
      </div>
    </div>
    <div class="risk-row">
      <strong>測定場所</strong>
      <span>${escapeHtml(plan.weather.measuredPlace || "未入力")} / ${escapeHtml(plan.weather.measuredAt || "時刻未入力")}</span>
    </div>
    <div class="risk-row">
      <strong>突風・降雨</strong>
      <span>最大瞬間 ${escapeHtml(gust ? `${gust}m/s` : "未取得")} / 降雨 ${escapeHtml(rainRiskLabel(plan.weather || {}))}</span>
    </div>
  `;
}

function readinessScore(plan) {
  const progress = checkProgress(plan);
  const targets = riskItemsForPlan(plan).filter((item) => item.notifyTarget);
  const notified = targets.filter((target) => target.notified).length;
  const noticePercent = targets.length ? Math.round((notified / targets.length) * 100) : 100;
  const riskPercent = riskItemsForPlan(plan).some((risk) => risk.level === "high" && !risk.notified) ? 45 : 100;
  const weatherPercent = weatherReadinessPercent(plan);
  const value = Math.round(progress.percent * 0.4 + noticePercent * 0.25 + weatherPercent * 0.2 + riskPercent * 0.15);
  const level = value >= 80 ? "good" : value >= 60 ? "caution" : "attention";
  return { value, level, progress, noticePercent, weatherPercent, riskPercent };
}

function weatherReadinessPercent(plan) {
  const rules = activeSettings();
  const speed = Number(plan.weather.actualSpeed || plan.weather.forecastSpeed || 0);
  if (!plan.weather.actualSpeed) return 35;
  if (speed >= rules.windLimit) return 45;
  if (speed >= rules.windCaution) return 75;
  return 100;
}

function renderReadinessCards(plan) {
  const score = readinessScore(plan);
  const targets = riskItemsForPlan(plan).filter((item) => item.notifyTarget);
  const notified = targets.filter((target) => target.notified).length;
  const rows = [
    ["散布前チェック", `${score.progress.done}/${score.progress.total} 項目`, score.progress.percent],
    ["近隣通知", `${notified}/${targets.length} 件`, score.noticePercent],
    ["風向・風速", weatherLabel(plan), score.weatherPercent],
    ["周辺確認", riskLevelLabel(riskLevel(plan)), score.riskPercent],
  ];
  return `
    <div class="readiness-card">
      <div class="score-badge ${score.level}">
        <span>確認進捗</span>
        <strong>${score.value}</strong>
      </div>
      <div class="readiness-lines">
        ${rows
          .map(
            ([label, detail, percent]) => `
              <div class="readiness-line">
                <div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></div>
                <div class="tiny-meter"><span style="width:${escapeAttr(percent)}%"></span></div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildAdvice(plan) {
  const log = activeDroneLog();
  const advice = [];
  const rules = activeSettings();
  const speed = Number(plan.weather.actualSpeed || plan.weather.forecastSpeed || 0);
  if (!plan.weather.actualSpeed || speed >= rules.windCaution) {
    advice.push({
      title: "風向・風速の追加確認",
      detail: "風速が高め、または実測値が未入力です。散布直前に再測定してください。",
    });
  }
  if (Number(plan.weather.humidity || 100) <= 45) {
    advice.push({
      title: "低湿度の確認",
      detail: "湿度が低く、飛散・蒸発の可能性が高まる場合があります。薬剤ラベルと現地条件を確認してください。",
    });
  }
  if (String(plan.weather.rainForecast || "").includes("雨")) {
    advice.push({
      title: "降雨予報の確認",
      detail: "降雨予報があります。使用条件、散布後の降雨、日時変更の要否を確認してください。",
    });
  }
  if (riskItemsForPlan(plan).some((item) => item.level === "high" && !item.notified)) {
    advice.push({
      title: "風下方向・周辺圃場の確認",
      detail: "風下方向または重点確認範囲に通知候補があります。散布前に連絡方法と時間調整を確認してください。",
    });
  }
  if (altitudeCheckCount(log) > 0) {
    advice.push({
      title: "散布高度の確認",
      detail: "高度が高い可能性がある区間があります。作物上高度とログ高度の種類を確認してください。",
    });
  }
  if (log.outsideFlight) {
    advice.push({
      title: "予定範囲外飛行の確認",
      detail: "散布予定範囲外の飛行ログがあります。実施範囲と散布ON/OFF区間を確認してください。",
    });
  }
  if (!advice.length) {
    advice.push({
      title: "追加確認なし",
      detail: "現時点のサンプルデータでは大きな未確認項目はありません。最終判断は散布実施主体が行ってください。",
    });
  }
  return advice;
}

function maxAltitude(log = activeDroneLog()) {
  return Math.max(0, ...log.points.map((point) => point.altitude));
}

function altitudeCheckCount(log = activeDroneLog()) {
  return log.points.filter((point) => point.altitudeCheck).length;
}

function altitudeCheckLabel() {
  const count = altitudeCheckCount();
  return count ? `${count}点 要確認` : "なし";
}

function droneLogLabel(log = activeDroneLog()) {
  return log.imported ? `取込済み ${log.startedAt}-${log.endedAt}` : "仮ログ表示中（散布ON/OFF確認用）";
}

function materialTerm(plan) {
  return MATERIAL_TERMS[plan?.materialType] || "散布";
}

function buildNoticeText(plan, channel) {
  const rules = activeSettings();
  const term = materialTerm(plan);
  const materialLine = plan.materialType && plan.materialType !== "農薬" ? "使用資材" : "使用農薬";
  const channelLead = {
    line: "関係者のみなさまへ",
    mail: `件名：${term}予定のお知らせ`,
    paper: `${term}予定のお知らせ`,
  }[channel];
  const risks = riskItemsForPlan(plan)
    .filter((item) => item.notifyTarget)
    .map((item) => `・${item.name}（${item.distanceLabel}、${item.message}）`)
    .join("\n");
  return `${channelLead}

${plan.district}で以下の${term}を予定しています。

散布予定：${plan.date} ${plan.timeWindow}
散布ほ場：${plan.fieldName}
作物：${plan.crop}
資材種別：${plan.materialType || "農薬"}
${materialLine}：${plan.pesticide}
使用目的：${plan.purpose}
散布方法：${plan.method}
ドローン機体：${plan.droneModel || "未入力"}
予定飛行時間：${plan.timeWindow}
散布者：${plan.operator}
連絡先：${plan.contact}
日時調整希望の連絡先：${plan.contact}

周辺確認対象：
${risks || "・通知対象は登録されていません。"}

風向・風速メモ：${weatherLabel(plan)}
実証ルール案：有機ほ場 ${rules.organicRadius}m以内重点確認、通知対象 ${rules.notifyRadius}m以内、風速 ${rules.windLimit}m/s以上は延期検討
天候や風向・風速により、日時を変更する場合があります。

このお知らせは、地域内で散布前の確認と記録を共有するためのものです。`;
}

function buildTimeline(plan) {
  return [
    { title: "散布計画登録", detail: `${plan.date} ${plan.timeWindow} / ${plan.operator}` },
    { title: "周辺確認", detail: `${riskItemsForPlan(plan).length}件の周辺確認項目` },
    { title: "近隣通知", detail: notificationLabel(plan) },
    { title: "風向・風速確認", detail: weatherLabel(plan) },
    { title: "実施後報告", detail: plan.report.doneDate ? `${plan.report.doneDate} 提出済み` : "未提出" },
  ];
}

function statusRow(title, detail, color = "") {
  return `
    <div class="status-row">
      <div class="pill-line">${color ? `<span class="pill ${color}">${escapeHtml(title)}</span>` : ""}</div>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function riskTag(level) {
  const label = riskLevelLabel(level);
  const color = level === "high" ? "red" : level === "medium" ? "amber" : "green";
  return `<span class="pill ${color}">${escapeHtml(label)}</span>`;
}

function riskLevelLabel(level) {
  return {
    high: "要確認",
    medium: "確認中",
    low: "記録済み",
  }[level] || "確認中";
}

function progressPill(plan) {
  const progress = checkProgress(plan);
  const color = progress.percent >= 80 ? "green" : progress.percent >= 50 ? "amber" : "red";
  return `<span class="pill ${color}">${progress.done}/${progress.total}</span>`;
}

function readinessPill(plan) {
  const score = readinessScore(plan);
  const color = score.value >= 80 ? "green" : score.value >= 60 ? "amber" : "red";
  return `<span class="pill ${color}">${score.value}</span>`;
}

function notificationPill(plan) {
  return `<span class="pill ${notificationIsComplete(plan) ? "green" : "amber"}">${escapeHtml(notificationLabel(plan))}</span>`;
}

function activePlan() {
  return state.plans.find((plan) => plan.id === state.activePlanId) || state.plans[0];
}

// Flight log tied to the active plan; falls back to a not-imported placeholder.
function activeDroneLog() {
  const plan = activePlan();
  if (plan && plan.droneLog) return plan.droneLog;
  return createSampleDroneLog(false);
}

function activeField() {
  const editableFields = state.fields.filter((field) => field.type !== "spray");
  const selected = editableFields.find((field) => field.id === state.activeFieldId);
  const fallback = editableFields[0] || createBlankField();
  if (!state.activeFieldId && fallback.id) {
    state.activeFieldId = fallback.id;
  }
  return selected || fallback;
}

// --- 実際のほ場境界（GeoJSON）の取込・表示 ---
function bearingBetween([lng1, lat1], [lng2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lng2 - lng1);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function outerRingLngLat(geometry) {
  const ring = geometry.type === "MultiPolygon" ? geometry.coordinates[0]?.[0] : geometry.coordinates[0];
  const coords = (ring || []).map((c) => [Number(c[0]), Number(c[1])]).filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (coords.length > 2) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) coords.pop();
  }
  return coords;
}

function buildFieldsFromGeoJson(text) {
  const data = JSON.parse(text);
  let features = [];
  if (data.type === "FeatureCollection") features = data.features || [];
  else if (data.type === "Feature") features = [data];
  else if (data.type && data.coordinates) features = [{ type: "Feature", geometry: data, properties: {} }];
  return buildFieldsFromFeatures(features);
}

function buildFieldsFromFeatures(rawFeatures) {
  const features = Array.isArray(rawFeatures) ? rawFeatures : [];
  const polys = features.filter((f) => f?.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"));
  if (!polys.length) throw new Error("ポリゴン境界が見つかりません。");
  const fields = polys.map((f, i) => {
    const geo = outerRingLngLat(f.geometry);
    const props = f.properties || {};
    const name = props.name || props["圃場名"] || props.field || props.NAME || props.label || `取込ほ場${i + 1}`;
    const featureType = importedFieldType(props.type || props["種別"], i);
    const isSpray = featureType === "spray";
    const defaults = importedFieldDefaults(featureType);
    return {
      id: importedFieldId(name, featureType, i),
      type: featureType,
      name: String(name),
      short: defaults.short,
      crop: String(props.crop || props["作物"] || "未登録"),
      cultivation: defaults.cultivation,
      chemicalUse: defaults.chemicalUse,
      organicJas: defaults.organicJas,
      notifyPreference: defaults.notifyPreference,
      contactMethod: defaults.contactMethod,
      publicScope: "概略のみ共有",
      harvestWindow: defaults.harvestWindow,
      avoidReason: defaults.avoidReason,
      seedling: featureType === "house",
      house: featureType === "house",
      waterNear: featureType === "water",
      unregistered: featureType === "public",
      geo,
      distance: 0,
      direction: isSpray ? "中心" : "-",
      notifyTarget: !isSpray && featureType !== "public",
      owner: isSpray ? "自分" : "周辺農家",
    };
  });
  const sprayCenter = fieldCenterLngLat(fields[0]);
  fields.forEach((field, i) => {
    if (i === 0) return;
    const c = fieldCenterLngLat(field);
    field.distance = Math.round(haversineMeters(sprayCenter, c));
    field.direction = bearingToDirection(bearingBetween(sprayCenter, c));
  });
  return fields;
}

function importedFieldType(rawType, index) {
  const value = String(rawType || "").trim();
  const aliases = {
    spray: "spray",
    organic: "organic",
    noChemical: "noChemical",
    house: "house",
    preharvest: "preharvest",
    water: "water",
    bee: "bee",
    public: "public",
    散布: "spray",
    有機: "organic",
    農薬不使用: "noChemical",
    ハウス: "house",
    収穫前: "preharvest",
    水路: "water",
    公共: "public",
  };
  return aliases[value] || (index === 0 ? "spray" : "noChemical");
}

function importedFieldId(name, type, index) {
  return knownDemoFieldMeta(name)?.id || `imported-${type}-${index}-${Date.now().toString(36)}`;
}

function knownDemoFieldMeta(name) {
  return {
    笠間デモほ場A: { id: "spray-field-a", type: "spray" },
    農薬不使用ほ場B: { id: "organic-field-a", type: "organic" },
    農薬不使用ほ場C: { id: "no-chemical-field-b", type: "noChemical" },
    育苗ハウスD: { id: "seedling-house-c", type: "house" },
    収穫前ほ場E: { id: "preharvest-field-d", type: "preharvest" },
    共有水路F: { id: "water-channel-d", type: "water" },
    地域施設G: { id: "facility-e", type: "public" },
  }[String(name)];
}

function importedFieldDefaults(type) {
  const defaults = {
    spray: {
      short: "散布",
      cultivation: "農薬使用あり",
      chemicalUse: "あり",
      organicJas: "なし",
      notifyPreference: "必要時のみ",
      contactMethod: "アプリ内通知",
      harvestWindow: "9月中旬",
      avoidReason: "散布計画の対象ほ場",
    },
    organic: {
      short: "不使",
      cultivation: "有機JAS",
      chemicalUse: "なし",
      organicJas: "あり",
      notifyPreference: "希望する",
      contactMethod: "LINE",
      harvestWindow: "収穫前",
      avoidReason: "出荷前の農薬影響回避を希望",
    },
    noChemical: {
      short: "不使",
      cultivation: "有機JASではないが農薬不使用",
      chemicalUse: "なし",
      organicJas: "なし",
      notifyPreference: "希望する",
      contactMethod: "メール",
      harvestWindow: "7月上旬",
      avoidReason: "直売向けの農薬不使用表示を守りたい",
    },
    house: {
      short: "育苗",
      cultivation: "農薬使用あり",
      chemicalUse: "あり",
      organicJas: "なし",
      notifyPreference: "必要時のみ",
      contactMethod: "アプリ内通知",
      harvestWindow: "育苗中",
      avoidReason: "換気時間帯の調整が必要",
    },
    preharvest: {
      short: "収穫",
      cultivation: "農薬使用あり",
      chemicalUse: "あり",
      organicJas: "なし",
      notifyPreference: "希望する",
      contactMethod: "紙",
      harvestWindow: "3日以内",
      avoidReason: "収穫直前のため事前連絡を希望",
    },
    water: {
      short: "水路",
      cultivation: "未登録・未回答",
      chemicalUse: "未回答",
      organicJas: "未回答",
      notifyPreference: "必要時のみ",
      contactMethod: "アプリ内通知",
      harvestWindow: "なし",
      avoidReason: "水路近接のため飛散・流入を避けたい",
    },
    public: {
      short: "施設",
      cultivation: "未登録・未回答",
      chemicalUse: "未回答",
      organicJas: "未回答",
      notifyPreference: "未確認",
      contactMethod: "未確認",
      harvestWindow: "なし",
      avoidReason: "人の出入りがある時間帯を確認したい",
    },
  };
  return defaults[type] || defaults.noChemical;
}

function applyImportedFields(fields, message, options = {}) {
  state.fields = fields;
  const plan = activePlan();
  if (plan && fields[0]) plan.fieldName = fields[0].name;
  state.activeFieldId = fields.find((f) => f.type !== "spray")?.id;
  if (options.pin) {
    state.boundaryPinned = true;
    state.boundaryMunicipality = "__custom__";
  }
  saveState();
  renderAll();
  renderBoundarySelector();
  requestAnimationFrame(() => focusVisibleMaps("all"));
  if (message) showToast(message);
}

function importFieldBoundaries(file) {
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".zip") || lower.endsWith(".shp")) {
    importShapefileBoundaries(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const features = featuresFromGeoJsonText(String(reader.result));
      applyBoundaryFeatures(features, { pin: true, message: "実際のほ場境界を取り込みました。" });
    } catch (error) {
      showToast(`取り込めませんでした：${error.message}`);
    }
  };
  reader.readAsText(file);
}

// Shapefile (.zip: shp/dbf/prj, or a single .shp) via shpjs; reprojects to WGS84.
async function importShapefileBoundaries(file) {
  if (typeof shp === "undefined") {
    showToast("Shapefile読み込みライブラリが未ロードです。少し待って再試行してください。");
    return;
  }
  showToast("Shapefileを解析中…");
  try {
    const buffer = await file.arrayBuffer();
    let features = [];
    if (file.name.toLowerCase().endsWith(".shp")) {
      const geometries = await shp.parseShp(buffer);
      features = (geometries || []).map((geometry) => ({ type: "Feature", geometry, properties: {} }));
    } else {
      const parsed = await shp.parseZip(buffer);
      const collections = Array.isArray(parsed) ? parsed : [parsed];
      collections.forEach((fc) => {
        (fc?.features || []).forEach((feature) => features.push(feature));
      });
    }
    applyBoundaryFeatures(features, { pin: true, message: "Shapefileから実境界を取り込みました。" });
  } catch (error) {
    showToast(`Shapefileを取り込めませんでした：${error.message || "形式を確認してください"}`);
  }
}

// --- 市町村カタログ（data/boundaries/index.json）からの自動読込 ---
let boundaryCatalog = [];
let parcelData = null; // 大量筆の背景レイヤー（表示専用・非永続）
let lastClickedParcel = null;
const PARCEL_DISPLAY_LIMIT = 400;

async function initBoundaries() {
  await loadBoundaryCatalog();
  if (profileIsRegistered() && activeProfile().targetMunicipalities.length) {
    await loadProfileLightBoundaries();
    renderBoundarySelector();
    return;
  }
  if (state.boundaryPinned) {
    renderBoundarySelector();
    return;
  }
  const code = boundaryCatalog.find((m) => m.code === state.boundaryMunicipality)?.code
    || boundaryCatalog.find((m) => m.code === DEFAULT_BOUNDARY_MUNICIPALITY)?.code
    || boundaryCatalog[0]?.code;
  if (code) await loadMunicipalityBoundary(code, { silent: true });
  else renderBoundarySelector();
}

async function loadBoundaryCatalog() {
  try {
    const res = await fetch("data/boundaries/index.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      boundaryCatalog = Array.isArray(data.municipalities) ? data.municipalities : [];
    }
  } catch (error) {
    boundaryCatalog = [];
  }
  renderBoundarySelector();
  renderProfileForm();
}

function renderBoundarySelector() {
  const select = $("#boundaryMunicipalitySelect");
  if (!select) return;
  const options = boundaryCatalog.map((m) => `<option value="${escapeAttr(m.code)}">${escapeHtml(m.name)}</option>`);
  if (state.boundaryPinned) options.unshift(`<option value="__custom__">（取込データ）</option>`);
  select.innerHTML = options.join("") || `<option value="">（カタログ未配置）</option>`;
  select.value = state.boundaryPinned
    ? "__custom__"
    : state.boundaryMunicipality || boundaryCatalog.find((m) => m.code === DEFAULT_BOUNDARY_MUNICIPALITY)?.code || boundaryCatalog[0]?.code || "";
}

async function loadMunicipalityBoundary(code, options = {}) {
  const entry = boundaryCatalog.find((m) => m.code === code);
  if (!entry) return false;
  try {
    if (!options.silent) showToast(`${entry.name}を読み込み中…`);
    const res = await fetch(`data/boundaries/${encodeURIComponent(entry.file)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let features;
    if (entry.file.toLowerCase().endsWith(".zip")) {
      if (typeof shp === "undefined") throw new Error("Shapefileライブラリ未ロード");
      features = await featuresFromZip(await res.arrayBuffer());
    } else {
      features = featuresFromGeoJsonText(await res.text());
    }
    applyBoundaryFeatures(features, { code, name: entry.name, silent: options.silent });
    return true;
  } catch (error) {
    if (!options.silent) showToast(`境界を読み込めませんでした：${error.message}`);
    return false;
  }
}

function featuresFromGeoJsonText(text) {
  const data = JSON.parse(text);
  if (data.type === "FeatureCollection") return data.features || [];
  if (data.type === "Feature") return [data];
  if (data.type && data.coordinates) return [{ type: "Feature", geometry: data, properties: {} }];
  return [];
}

async function featuresFromZip(buffer) {
  const parsed = await shp.parseZip(buffer);
  const collections = Array.isArray(parsed) ? parsed : [parsed];
  const features = [];
  collections.forEach((fc) => (fc?.features || []).forEach((f) => features.push(f)));
  return features;
}

// 少数なら管理ほ場、多数（市全域の筆ポリゴン等）なら背景の筆レイヤーに振り分け。
function applyBoundaryFeatures(features, opts = {}) {
  const polys = features.filter((f) => f?.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"));
  if (!polys.length) throw new Error("ポリゴン境界が見つかりません。");
  if (opts.code !== undefined) {
    state.boundaryMunicipality = opts.code;
    state.boundaryPinned = false;
  }
  if (polys.length > PARCEL_DISPLAY_LIMIT) {
    applyParcelBackdrop(polys, opts);
    return;
  }
  parcelData = null;
  const fields = buildFieldsFromFeatures(polys);
  applyImportedFields(fields, opts.silent ? "" : opts.message || `${opts.name || "境界"}を読み込みました（${fields.length}区画）。`, { pin: opts.pin });
  setParcelSource();
}

function applyParcelBackdrop(polys, opts = {}) {
  parcelData = { type: "FeatureCollection", features: polys.map((f) => ({ type: "Feature", geometry: f.geometry, properties: {} })) };
  const first = buildFieldsFromFeatures([polys[0]]);
  state.fields = first;
  state.activeFieldId = undefined;
  const plan = activePlan();
  if (plan && first[0]) plan.fieldName = first[0].name;
  if (opts.pin) {
    state.boundaryPinned = true;
    state.boundaryMunicipality = "__custom__";
  }
  saveState();
  renderAll();
  renderBoundarySelector();
  setParcelSource();
  requestAnimationFrame(() => fitToParcels());
  if (!opts.silent) {
    showToast(`${opts.name || "筆ポリゴン"}（${polys.length.toLocaleString()}筆）を背景表示しました。地図で自分のほ場をタップして登録できます。`);
  }
}

function setParcelSource() {
  [mapLibreMap, dashboardMapLibreMap].forEach((m) => {
    if (m && m.getSource && m.getSource("parcels")) m.getSource("parcels").setData(parcelData || emptyFeatureCollection());
  });
}

function eachPolygonRing(geometry, cb) {
  if (!geometry) return;
  if (geometry.type === "Polygon") geometry.coordinates.forEach(cb);
  else if (geometry.type === "MultiPolygon") geometry.coordinates.forEach((poly) => poly.forEach(cb));
}

function fitToParcels() {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  (parcelData?.features || []).forEach((f) =>
    eachPolygonRing(f.geometry, (ring) =>
      ring.forEach(([lng, lat]) => {
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }),
    ),
  );
  if (!Number.isFinite(west)) return;
  [mapLibreMap, dashboardMapLibreMap].forEach((m) => {
    if (!m) return;
    m.resize();
    m.fitBounds([[west, south], [east, north]], { padding: 40, duration: 400 });
  });
}

function showParcelPopup(map, event) {
  const feature = event.features?.[0];
  if (!feature || !window.maplibregl) return;
  lastClickedParcel = feature.geometry;
  new maplibregl.Popup({ closeButton: true, offset: 12, className: "gis-popup" })
    .setLngLat(event.lngLat)
    .setHTML(
      `<div class="parcel-popup"><strong>この筆を登録</strong><div class="pill-line">
        <button class="ghost-button mini-button" data-parcel-adopt="spray" type="button">散布ほ場にする</button>
        <button class="ghost-button mini-button" data-parcel-adopt="neighbor" type="button">周辺ほ場に追加</button>
      </div></div>`,
    )
    .addTo(map);
}

function adoptParcel(kind) {
  if (!lastClickedParcel) return;
  const geo = outerRingLngLat(lastClickedParcel);
  if (!geo || geo.length < 3) return;
  if (kind === "spray") {
    let spray = state.fields.find((f) => f.type === "spray");
    if (!spray) {
      spray = { ...createBlankField(), id: "parcel-spray", type: "spray", short: "散布", name: "散布ほ場", notifyTarget: false, owner: "自分" };
      state.fields.unshift(spray);
    }
    spray.geo = geo;
  } else {
    const neighbor = {
      ...createBlankField(),
      id: `parcel-${Date.now().toString(36)}`,
      type: "organic",
      short: "隣接",
      name: `隣接ほ場${state.fields.length}`,
      geo,
      notifyTarget: true,
      owner: "周辺農家",
    };
    state.fields.push(neighbor);
    state.activeFieldId = neighbor.id;
  }
  recomputeFieldDistances();
  saveState();
  renderAll();
  showToast(kind === "spray" ? "この筆を散布ほ場にしました。" : "周辺ほ場に追加しました。");
}

function recomputeFieldDistances() {
  const spray = state.fields.find((f) => f.type === "spray") || state.fields[0];
  if (!spray) return;
  const center = fieldCenterLngLat(spray);
  state.fields.forEach((f) => {
    if (f === spray) {
      f.distance = 0;
      f.direction = "中心";
      return;
    }
    const c = fieldCenterLngLat(f);
    f.distance = Math.round(haversineMeters(center, c));
    f.direction = bearingToDirection(bearingBetween(center, c));
  });
}

function resetToMunicipality() {
  state.boundaryPinned = false;
  saveState();
  const code = boundaryCatalog.find((m) => m.code === state.boundaryMunicipality)?.code || boundaryCatalog[0]?.code;
  if (code) {
    loadMunicipalityBoundary(code);
    return;
  }
  state.fields = createSampleState().fields;
  state.activeFieldId = state.fields.find((f) => f.type !== "spray")?.id;
  saveState();
  renderAll();
  requestAnimationFrame(() => focusVisibleMaps("all"));
  showToast("デモの圃場に戻しました。");
}

function createBlankField() {
  return {
    id: uniqueId("field"),
    type: "noChemical",
    name: "自分の圃場",
    short: "不使",
    crop: "",
    cultivation: "農薬使用なし",
    chemicalUse: "なし",
    organicJas: "なし",
    notifyPreference: "希望する",
    publicScope: "概略のみ共有",
    contactMethod: "LINE",
    harvestWindow: "",
    avoidReason: "農薬影響を避けたい",
    municipality: "",
    district: "",
    seedling: false,
    house: false,
    waterNear: false,
    unregistered: false,
    x: 40 + Math.round(Math.random() * 25),
    y: 34 + Math.round(Math.random() * 25),
    w: 10,
    h: 9,
    distance: 120,
    direction: "南東",
    notifyTarget: true,
    owner: "自分",
    updatedAt: dateOffset(0),
    ...profileFieldDefaults(),
  };
}

function createBlankPlan() {
  return {
    id: uniqueId("plan"),
    date: dateOffset(0),
    timeWindow: "06:00-07:30",
    fieldName: "笠間市 デモほ場A",
    district: "笠間市周辺デモ",
    crop: "水稲",
    materialType: "農薬",
    pesticide: "農薬名（サンプル）",
    purpose: "病害虫防除",
    method: "ドローン",
    operator: "匿名散布者",
    contact: "デモ連絡先",
    ...profilePlanDefaults(),
    ...equipmentTemplate(),
    pesticideRegistration: "登録番号サンプル",
    preHarvestDays: "使用条件確認中",
    amount: "",
    dilution: "",
    ratePer10a: "",
    rateUnit: "mL",
    areaHa: "",
    labelCheckedAt: dateOffset(0),
    sprayArea: "",
    notes: "",
    droneLog: null,
    prescription: null,
    weather: { ...defaultWeather(), ...profileWeatherDefaults() },
    checks: defaultChecks(false),
    notificationTargets: {},
    report: defaultReport(),
  };
}

// Serpentine (lawn-mower) sweep over the demo spray field, so grid coverage is meaningful.
function serpentineFlightPoints() {
  const x0 = 45.8;
  const x1 = 60.2;
  const y0 = 40;
  const y1 = 50;
  const rows = 14;
  const points = [];
  for (let r = 0; r < rows; r += 1) {
    const y = y0 + ((y1 - y0) * r) / (rows - 1);
    const leftToRight = r % 2 === 0;
    const ax = leftToRight ? x0 : x1;
    const bx = leftToRight ? x1 : x0;
    const altitude = Number((2 + (r % 3) * 0.4).toFixed(1));
    points.push({ x: ax, y: Number(y.toFixed(2)), altitude, sprayOn: r > 0, altitudeCheck: false, outside: false });
    points.push({ x: bx, y: Number(y.toFixed(2)), altitude, sprayOn: true, altitudeCheck: r === rows - 1, outside: r === rows - 1 });
  }
  return points;
}

function loopFlightPoints() {
  return [
    { x: 49.8, y: 44.2, altitude: 1.2, sprayOn: false, altitudeCheck: false, outside: false },
    { x: 51.6, y: 41.7, altitude: 2.1, sprayOn: true, altitudeCheck: false, outside: false },
    { x: 55.4, y: 40.9, altitude: 2.4, sprayOn: true, altitudeCheck: false, outside: false },
    { x: 59.6, y: 44.0, altitude: 3.5, sprayOn: true, altitudeCheck: true, outside: false },
    { x: 62.2, y: 47.9, altitude: 3.8, sprayOn: false, altitudeCheck: true, outside: true },
    { x: 56.2, y: 48.6, altitude: 2.6, sprayOn: true, altitudeCheck: false, outside: false },
    { x: 51.2, y: 47.4, altitude: 2.2, sprayOn: true, altitudeCheck: false, outside: false },
    { x: 49.8, y: 44.2, altitude: 1.4, sprayOn: false, altitudeCheck: false, outside: false },
  ];
}

function createSampleDroneLog(imported = false) {
  const points = imported ? serpentineFlightPoints() : loopFlightPoints();
  return {
    vendor: "デモSDKベンダー",
    model: "SDK対応予定機種A",
    sdkStatus: imported ? "サンプルログ取込済み" : "SDK/API連携はV1では未接続",
    aircraftRegistration: "DEMO-DRONE-001",
    remoteId: "RID-DEMO-001",
    pilot: "匿名操縦者",
    sprayDevice: "液剤散布装置A",
    imported: Boolean(imported),
    lastSync: imported ? formatDateTime(new Date()) : "未同期",
    startedAt: "06:04",
    endedAt: "07:02",
    sprayOnSegments: points.filter((point) => point.sprayOn).length,
    outsideFlight: points.some((point) => point.outside),
    points,
  };
}

function createSampleState() {
  const fields = [
    {
      id: "spray-field-a",
      type: "spray",
      name: "笠間デモほ場A",
      short: "散布",
      crop: "水稲",
      cultivation: "農薬使用あり",
      chemicalUse: "あり",
      organicJas: "なし",
      notifyPreference: "必要時のみ",
      contactMethod: "アプリ内通知",
      harvestWindow: "9月中旬",
      avoidReason: "散布計画の対象ほ場",
      x: 47,
      y: 40,
      w: 14,
      h: 11,
      distance: 0,
      direction: "中心",
      notifyTarget: false,
      owner: "匿名散布者",
    },
    {
      id: "organic-field-a",
      type: "organic",
      name: "農薬不使用ほ場B",
      short: "不使",
      crop: "葉物野菜",
      cultivation: "有機JAS",
      chemicalUse: "なし",
      organicJas: "あり",
      notifyPreference: "希望する",
      contactMethod: "LINE",
      harvestWindow: "収穫前",
      avoidReason: "出荷前の農薬影響回避を希望",
      x: 62,
      y: 55,
      w: 13,
      h: 10,
      distance: 82,
      direction: "南東",
      notifyTarget: true,
      owner: "匿名周辺農家B",
    },
    {
      id: "no-chemical-field-b",
      type: "noChemical",
      name: "農薬不使用ほ場C",
      short: "不使",
      crop: "とうもろこし",
      cultivation: "有機JASではないが農薬不使用",
      chemicalUse: "なし",
      organicJas: "なし",
      notifyPreference: "希望する",
      contactMethod: "メール",
      harvestWindow: "7月上旬",
      avoidReason: "直売向けの農薬不使用表示を守りたい",
      x: 30,
      y: 58,
      w: 13,
      h: 12,
      distance: 135,
      direction: "南西",
      notifyTarget: true,
      owner: "匿名周辺農家C",
    },
    {
      id: "seedling-house-c",
      type: "house",
      name: "育苗ハウスD",
      short: "育苗",
      crop: "苗",
      cultivation: "農薬使用あり",
      chemicalUse: "あり",
      organicJas: "なし",
      notifyPreference: "必要時のみ",
      contactMethod: "アプリ内通知",
      harvestWindow: "育苗中",
      avoidReason: "換気時間帯の調整が必要",
      seedling: true,
      house: true,
      x: 60,
      y: 30,
      w: 10,
      h: 8,
      distance: 120,
      direction: "東",
      notifyTarget: true,
      owner: "匿名周辺農家D",
    },
    {
      id: "preharvest-field-d",
      type: "preharvest",
      name: "収穫前ほ場E",
      short: "収穫",
      crop: "露地野菜",
      cultivation: "農薬使用あり",
      chemicalUse: "あり",
      organicJas: "なし",
      notifyPreference: "希望する",
      contactMethod: "紙",
      harvestWindow: "3日以内",
      avoidReason: "収穫直前のため事前連絡を希望",
      x: 36,
      y: 25,
      w: 9,
      h: 16,
      distance: 155,
      direction: "北西",
      notifyTarget: true,
      owner: "匿名周辺農家E",
    },
    {
      id: "water-channel-d",
      type: "water",
      name: "共有水路F",
      short: "水路",
      crop: "なし",
      cultivation: "未登録・未回答",
      chemicalUse: "未回答",
      organicJas: "未回答",
      notifyPreference: "必要時のみ",
      contactMethod: "アプリ内通知",
      harvestWindow: "なし",
      avoidReason: "水路近接のため飛散・流入を避けたい",
      waterNear: true,
      x: 69,
      y: 39,
      w: 7,
      h: 23,
      distance: 65,
      direction: "東",
      notifyTarget: true,
      owner: "地域共有",
    },
    {
      id: "facility-e",
      type: "public",
      name: "地域施設G",
      short: "施設",
      crop: "なし",
      cultivation: "未登録・未回答",
      chemicalUse: "未回答",
      organicJas: "未回答",
      notifyPreference: "未確認",
      contactMethod: "未確認",
      harvestWindow: "なし",
      avoidReason: "人の出入りがある時間帯を確認したい",
      unregistered: true,
      x: 74,
      y: 22,
      w: 9,
      h: 8,
      distance: 240,
      direction: "北東",
      notifyTarget: false,
      owner: "地域施設",
    },
  ];

  const plan1 = {
    id: "plan-drone-1",
    date: dateOffset(0),
    timeWindow: "06:00-07:30",
    fieldName: "笠間デモほ場A",
    district: "笠間市周辺デモ",
    crop: "水稲",
    materialType: "農薬",
    pesticide: "除草剤A（サンプル）",
    purpose: "初期除草",
    method: "ドローン",
    operator: "匿名散布事業者A",
    contact: "デモ連絡先A",
    droneModel: "SDK対応予定機種A",
    aircraftRegistration: "DEMO-DRONE-001",
    pilot: "匿名操縦者A",
    assistant: "匿名補助者A",
    sprayDevice: "液剤散布装置A",
    nozzle: "中粒径ノズル",
    plannedAltitude: "作物上2m目安",
    plannedSpeed: "3.5m/s",
    pesticideRegistration: "登録番号サンプルA",
    preHarvestDays: "使用条件確認済み",
    amount: "800mL/10a",
    dilution: "8倍",
    ratePer10a: 800,
    rateUnit: "mL",
    areaHa: 3.6,
    sprayWidthM: 9,
    labelCheckedAt: dateOffset(0),
    sprayArea: "3.6ha",
    notes: "農薬不使用ほ場が風下方向にあるため、通知と散布直前の風速確認を重点確認。",
    weather: {
      latitude: DEFAULT_WEATHER_LOCATION.latitude,
      longitude: DEFAULT_WEATHER_LOCATION.longitude,
      locationLabel: DEFAULT_WEATHER_LOCATION.label,
      forecastDirection: "北西",
      forecastSpeed: 2.6,
      maxGust: 4.1,
      temperature: 24,
      humidity: 48,
      rainForecast: "午後に小雨の可能性",
      actualDirection: "北西",
      actualSpeed: 2.8,
      measuredAt: "05:45",
      measuredPlace: "笠間デモほ場A 南側",
      measurementMethod: "携帯風速計で測定",
      measuredBy: "匿名補助者A",
      source: "Open-Meteo Forecast API（サンプル）",
      fetchedAt: formatDateTime(new Date()),
      forecastTargetTime: `${dateOffset(0)}T06:00`,
      weatherNotes: "弱風時間帯を再確認。散布直前に再測定予定。",
    },
    checks: {
      ...defaultChecks(false),
      label: true,
      amount: true,
      organic: true,
      preharvest: true,
      sensitive: true,
      notice: false,
      wind: true,
      weatherForecast: true,
      weatherEnv: true,
      aircraft: true,
      dips: true,
      flightLog: false,
      altitude: true,
      equipment: true,
    },
    notificationTargets: {
      "water-channel-d": true,
    },
    notificationResponses: {
      "water-channel-d": "確認しました",
    },
    report: defaultReport(),
  };

  const plan2 = {
    id: "plan-drone-2",
    date: dateOffset(1),
    timeWindow: "17:00-18:00",
    fieldName: "笠間デモほ場F",
    district: "笠間市周辺デモ",
    crop: "大豆",
    materialType: "農薬",
    pesticide: "殺菌剤B（サンプル）",
    purpose: "病害予防",
    method: "ドローン",
    operator: "匿名散布者B",
    contact: "デモ連絡先B",
    droneModel: "SDK対応予定機種B",
    aircraftRegistration: "DEMO-DRONE-002",
    pilot: "匿名操縦者B",
    assistant: "匿名補助者B",
    sprayDevice: "液剤散布装置B",
    nozzle: "飛散低減ノズル",
    plannedAltitude: "作物上1.8m目安",
    plannedSpeed: "3.0m/s",
    pesticideRegistration: "登録番号サンプルB",
    preHarvestDays: "使用条件確認中",
    amount: "120L/10a",
    dilution: "1000倍",
    ratePer10a: 120,
    rateUnit: "L",
    areaHa: 1.4,
    sprayWidthM: 4,
    labelCheckedAt: dateOffset(1),
    sprayArea: "1.4ha",
    notes: "通知対象は育苗ハウスと収穫前ほ場。気象の実測は当日入力予定。",
    weather: {
      latitude: DEFAULT_WEATHER_LOCATION.latitude,
      longitude: DEFAULT_WEATHER_LOCATION.longitude,
      locationLabel: DEFAULT_WEATHER_LOCATION.label,
      forecastDirection: "西",
      forecastSpeed: 1.8,
      maxGust: 2.7,
      temperature: 26,
      humidity: 56,
      rainForecast: "なし",
      actualDirection: "",
      actualSpeed: "",
      measuredAt: "",
      measuredPlace: "",
      measurementMethod: "風速計で測定予定",
      measuredBy: "",
      source: "Open-Meteo Forecast API（サンプル）",
      fetchedAt: formatDateTime(new Date()),
      forecastTargetTime: `${dateOffset(1)}T17:00`,
      weatherNotes: "",
    },
    checks: {
      ...defaultChecks(false),
      label: true,
      amount: true,
      organic: true,
      sensitive: true,
      weatherForecast: true,
      aircraft: true,
      altitude: false,
    },
    notificationTargets: {
      "organic-field-a": true,
      "water-channel-d": true,
    },
    notificationResponses: {
      "organic-field-a": "電話希望",
    },
    report: defaultReport(),
  };

  const plan3 = {
    id: "plan-drone-3",
    date: dateOffset(-1),
    timeWindow: "05:30-06:20",
    fieldName: "笠間デモほ場A",
    district: "笠間市周辺デモ",
    crop: "水稲",
    materialType: "農薬",
    pesticide: "殺虫剤C（サンプル）",
    purpose: "害虫防除",
    method: "ドローン",
    operator: "匿名散布事業者C",
    contact: "デモ連絡先C",
    droneModel: "SDK対応予定機種A",
    aircraftRegistration: "DEMO-DRONE-003",
    pilot: "匿名操縦者C",
    assistant: "匿名補助者C",
    sprayDevice: "液剤散布装置A",
    nozzle: "中粒径ノズル",
    plannedAltitude: "作物上2m目安",
    plannedSpeed: "3.2m/s",
    pesticideRegistration: "登録番号サンプルC",
    preHarvestDays: "使用条件確認済み",
    amount: "600mL/10a",
    dilution: "10倍",
    ratePer10a: 600,
    rateUnit: "mL",
    areaHa: 3.6,
    sprayWidthM: 9,
    labelCheckedAt: dateOffset(-1),
    sprayArea: "3.6ha",
    droneLog: createSampleDroneLog(true),
    notes: "通知済み、実施後報告作成済みのサンプル。飛行ログからカバレッジを可視化。",
    weather: {
      latitude: DEFAULT_WEATHER_LOCATION.latitude,
      longitude: DEFAULT_WEATHER_LOCATION.longitude,
      locationLabel: DEFAULT_WEATHER_LOCATION.label,
      forecastDirection: "北",
      forecastSpeed: 1.6,
      maxGust: 2.1,
      temperature: 22,
      humidity: 62,
      rainForecast: "なし",
      actualDirection: "北",
      actualSpeed: 1.4,
      measuredAt: "05:10",
      measuredPlace: "笠間デモほ場G 西側",
      measurementMethod: "携帯風速計で測定",
      measuredBy: "匿名補助者C",
      source: "Open-Meteo Forecast API（サンプル）",
      fetchedAt: formatDateTime(new Date()),
      forecastTargetTime: `${dateOffset(-1)}T05:30`,
      weatherNotes: "実測値を記録済み。",
    },
    checks: defaultChecks(true),
    notificationTargets: {
      "organic-field-a": true,
      "no-chemical-field-b": true,
      "seedling-house-c": true,
      "preharvest-field-d": true,
      "water-channel-d": true,
    },
    notificationResponses: {
      "organic-field-a": "確認しました",
      "no-chemical-field-b": "確認しました",
      "seedling-house-c": "確認しました",
      "preharvest-field-d": "確認しました",
      "water-channel-d": "確認しました",
    },
    report: {
      ...defaultReport(),
      doneDate: dateOffset(-1),
      doneTime: "05:32-06:18",
      doneField: "笠間デモほ場A",
      donePesticide: "殺虫剤C（サンプル）",
      doneArea: "3.6ha",
      doneWeather: "北 1.4m/s",
      incident: "なし",
      inquiry: "なし",
      reportType: "通常報告",
      actualAmount: "600mL/10a",
      altitudeNotes: "高度要確認区間なし",
      outsideFlight: "なし",
      reportNotes: "散布後の問い合わせなし。次回も同じ通知先を維持。",
    },
  };

  const plan4 = {
    ...createBlankPlan(),
    id: "plan-drone-4",
    date: dateOffset(-3),
    timeWindow: "06:30-07:10",
    fieldName: "笠間デモほ場A",
    district: "笠間市周辺デモ",
    crop: "水稲",
    materialType: "液体肥料・葉面散布",
    pesticide: "液体葉面散布肥料（サンプル）",
    purpose: "生育期の追肥",
    method: "ドローン",
    operator: "匿名散布者",
    contact: "デモ連絡先",
    droneModel: "SDK対応予定機種A",
    aircraftRegistration: "DEMO-DRONE-001",
    pilot: "匿名操縦者",
    sprayDevice: "液剤散布装置A",
    nozzle: "中粒径ノズル",
    plannedAltitude: "作物上2m目安",
    plannedSpeed: "3.5m/s",
    pesticideRegistration: "肥料のため農薬登録番号なし",
    preHarvestDays: "－",
    amount: "100L/10a",
    dilution: "500倍",
    ratePer10a: 100,
    rateUnit: "L",
    areaHa: 3.6,
    sprayWidthM: 9,
    droneLog: createSampleDroneLog(true),
    labelCheckedAt: dateOffset(-3),
    sprayArea: "3.6ha",
    notes: "農薬ではなく液体肥料の葉面散布。有機ほ場が風下にあるため、化学肥料の飛散にも配慮して通知・確認を実施。",
    weather: {
      ...defaultWeather(),
      forecastDirection: "北西",
      forecastSpeed: 1.4,
      maxGust: 2.2,
      temperature: 23,
      humidity: 58,
      rainForecast: "なし",
      actualDirection: "北西",
      actualSpeed: 1.3,
      measuredAt: "06:20",
      measuredPlace: "笠間デモほ場A 南側",
      measurementMethod: "携帯風速計で測定",
      measuredBy: "匿名補助者",
      source: "Open-Meteo Forecast API（サンプル）",
      fetchedAt: formatDateTime(new Date()),
      weatherNotes: "肥料散布時も同様に風向・風速を記録。",
    },
    checks: defaultChecks(true),
    notificationTargets: {
      "organic-field-a": true,
      "no-chemical-field-b": true,
    },
    notificationResponses: {
      "organic-field-a": "確認しました",
    },
    report: {
      ...defaultReport(),
      doneDate: dateOffset(-3),
      doneTime: "06:32-07:05",
      doneField: "笠間デモほ場A",
      donePesticide: "液体葉面散布肥料（サンプル）",
      doneArea: "3.6ha",
      doneWeather: "北西 1.3m/s",
      incident: "なし",
      inquiry: "なし",
      reportType: "通常報告",
      actualAmount: "100L/10a",
      altitudeNotes: "高度要確認区間なし",
      outsideFlight: "なし",
      reportNotes: "化学肥料の葉面散布。有機ほ場への飛散なしを確認。",
    },
  };

  return {
    profile: defaultProfile(),
    role: "sprayer",
    activePlanId: "plan-drone-1",
    activeFieldId: "organic-field-a",
    settings: { ...DEFAULT_SETTINGS },
    droneLog: createSampleDroneLog(false),
    fields,
    plans: [plan1, plan2, plan3, plan4],
  };
}

function defaultChecks(value) {
  return CHECK_ITEMS.reduce((acc, item) => {
    acc[item.id] = Boolean(value);
    return acc;
  }, {});
}

function defaultWeather() {
  return {
    latitude: DEFAULT_WEATHER_LOCATION.latitude,
    longitude: DEFAULT_WEATHER_LOCATION.longitude,
    locationLabel: DEFAULT_WEATHER_LOCATION.label,
    forecastDirection: "北西",
    forecastSpeed: 0,
    maxGust: "",
    temperature: "",
    humidity: "",
    rainForecast: "",
    actualDirection: "北西",
    actualSpeed: "",
    measuredAt: "",
    measuredPlace: "",
    measurementMethod: "風速計で測定",
    measuredBy: "",
    source: "",
    fetchedAt: "",
    forecastTargetTime: "",
    weatherNotes: "",
  };
}

function defaultReport() {
  return {
    doneDate: "",
    doneTime: "",
    doneField: "",
    donePesticide: "",
    doneArea: "",
    doneWeather: "",
    incident: "なし",
    inquiry: "なし",
    reportType: "通常報告",
    actualAmount: "",
    altitudeNotes: "",
    outsideFlight: "未確認",
    photoData: "",
    photoName: "",
    reportNotes: "",
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function normalizeState(input) {
  const next = input || createSampleState();
  next.profile = normalizeProfile(next.profile);
  if (next.profile.registered && ROLE_META[next.profile.role]) {
    next.role = next.profile.role;
  }
  if (!next.boundaryPinned && (!next.boundaryMunicipality || next.boundaryMunicipality === "082163")) {
    next.boundaryMunicipality = DEFAULT_BOUNDARY_MUNICIPALITY;
  }
  next.role = ROLE_META[next.role] ? next.role : "sprayer";
  next.settings = { ...DEFAULT_SETTINGS, ...(next.settings || {}) };
  next.droneLog = {
    ...createSampleDroneLog(false),
    ...(next.droneLog || {}),
    points: Array.isArray(next.droneLog?.points) ? next.droneLog.points : createSampleDroneLog(false).points,
  };
  if (!next.droneLog.imported) {
    next.droneLog.points = createSampleDroneLog(false).points;
  }
  if (next.settings.organicRadius === 100 && next.settings.notifyRadius === 160 && next.settings.sensitiveRadius === 160) {
    next.settings.organicRadius = DEFAULT_SETTINGS.organicRadius;
    next.settings.notifyRadius = DEFAULT_SETTINGS.notifyRadius;
    next.settings.sensitiveRadius = DEFAULT_SETTINGS.sensitiveRadius;
  }
  next.fields = Array.isArray(next.fields) && next.fields.length ? next.fields : createSampleState().fields;
  next.fields = next.fields.map((field) => {
    const known = knownDemoFieldMeta(field.name);
    const migratedField = known && String(field.id || "").startsWith("imported-") ? { ...field, id: known.id, type: known.type } : field;
    const sampleGeometry = SAMPLE_FIELD_GEOMETRY[migratedField.id] || {};
    return {
      crop: "未登録",
      cultivation: "未登録・未回答",
      chemicalUse: "未回答",
      organicJas: "未回答",
      notifyPreference: migratedField.notifyTarget ? "希望する" : "未確認",
      contactMethod: "未確認",
      harvestWindow: "未登録",
      avoidReason: "",
      seedling: false,
      house: false,
      waterNear: migratedField.type === "water",
      unregistered: false,
      ...migratedField,
      ...sampleGeometry,
    };
  });
  const editableFields = next.fields.filter((field) => field.type !== "spray");
  next.activeFieldId = editableFields.some((field) => field.id === next.activeFieldId)
    ? next.activeFieldId
    : editableFields[0]?.id;
  next.plans = Array.isArray(next.plans) ? next.plans : [];
  next.plans = next.plans.map((plan) => ({
    ...createBlankPlan(),
    ...plan,
    weather: { ...defaultWeather(), ...(plan.weather || {}) },
    checks: { ...defaultChecks(false), ...(plan.checks || {}) },
    notificationTargets: plan.notificationTargets || {},
    notificationResponses: plan.notificationResponses || {},
    report: { ...defaultReport(), ...(plan.report || {}) },
  }));
  next.activePlanId = next.plans.some((plan) => plan.id === next.activePlanId)
    ? next.activePlanId
    : next.plans[0]?.id;
  return next;
}

function normalizeProfile(input) {
  const base = defaultProfile();
  const profile = input || {};
  const next = {
    ...base,
    ...profile,
    visibility: { ...base.visibility, ...(profile.visibility || {}) },
    sprayer: { ...base.sprayer, ...(profile.sprayer || {}) },
    neighbor: { ...base.neighbor, ...(profile.neighbor || {}) },
    admin: { ...base.admin, ...(profile.admin || {}) },
    boundaryLoadStatus: { ...base.boundaryLoadStatus, ...(profile.boundaryLoadStatus || {}) },
  };
  next.registered = Boolean(next.registered && ROLE_META[next.role]);
  next.role = ROLE_META[next.role] ? next.role : null;
  next.targetMunicipalities = Array.isArray(next.targetMunicipalities) ? next.targetMunicipalities : [];
  next.admin.managedMunicipalities = Array.isArray(next.admin.managedMunicipalities) ? next.admin.managedMunicipalities : [];
  next.admin.managedDistricts = Array.isArray(next.admin.managedDistricts) ? next.admin.managedDistricts : [];
  next.sprayer.drones = Array.isArray(next.sprayer.drones) ? next.sprayer.drones : [];
  return next;
}

function activeSettings() {
  return { ...DEFAULT_SETTINGS, ...(state?.settings || {}) };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    showToast("保存容量の上限に達しました。取り込んだ処方マップはこの表示中のみ保持されます。");
  }
}

function countBy(items, keyOrFn) {
  return items.reduce((acc, item) => {
    const key = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function downwindDirection(direction) {
  return DIRECTION_OPPOSITE[direction] || "南東";
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function toPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function dateOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
