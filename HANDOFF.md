# HANDOFF

## Current Status

- Project: `となり畑セーフティ MVP`
- Repository: `https://github.com/LIVINGCOLOUR/tonari-hatake-safety`
- Repository visibility: private
- Public demo: `https://tonari-hatake-safety.pages.dev/`
- Cloudflare Pages project: `tonari-hatake-safety`
- Baseline audited commit before this handoff/refactor: `d4d01cd 地域管理を自治体向けに刷新: 散布一覧＋クリック詳細`
- Local branch state at audit: `main...origin/main`, clean
- Production deployment at audit: Cloudflare Pages production was on `d4d01cd`

## What This App Is

農薬・液体肥料などの散布を、被害記録ではなく「散布前の事故予防」として支援するフロントエンドMVPです。

主な利用者は3つです。

- 散布者: 計画、気象、周辺確認、通知、飛行ログ、報告
- 周辺農家: 農薬不使用・有機・収穫前などの圃場ステータス登録と通知返信
- 地域管理: 自治体・JA向けに予定・実績・実施可否を一覧確認

## Important Files

- `index.html`: SPAの全画面マークアップ
- `css/styles.css`: 画面全体のスタイル
- `js/main.js`: UI状態、地図、気象、境界取込のIO、VRA、CSV/PDFを含む
- `js/domain/`: 保存・幾何・圃場取込の純粋なドメイン処理
- `data/boundaries/index.json`: 市町村境界カタログ
- `data/boundaries/*.geojson`: 軽量デモ境界
- `data/boundaries/*-fude.zip`: 筆ポリゴンShapefile zip
- `vendor/maplibre-gl/`: MapLibre
- `vendor/turf/`: Turf.js
- `vendor/shpjs/`: Shapefile読込

## Runtime Notes

- No build step.
- No backend.
- No package manager dependency is required for the app itself.
- Browser state is stored in `localStorage`.
- Current storage key: `tonariHatakeSafetyMvp.v3.coverage`. Since the Phase 1
  domain migration the value is a versioned envelope
  `{ schemaVersion: 4, revision, savedAt, data }`; bare pre-envelope blobs are
  migrated in place on load (`js/domain/state.mjs`).
- `js/main.js` is a classic script that dynamically imports the modules under
  `js/domain/` inside `init()`. Module
  scripts require a JavaScript MIME type, so the app must be served over HTTP
  (`python -m http.server` serves `.mjs` as `text/javascript`; do not rename
  the modules to `.js` — on this Windows machine the registry maps `.js` to
  `text/plain`, which browsers reject for modules).
- The app should be opened over HTTP. Direct `file://` open now fails fully
  (dynamic module import is blocked in that mode) and shows a fatal-error
  screen pointing at the HTTP requirement.

## Phase 1 Domain Migration (2026-07-21)

- `js/domain/state.mjs`: storage envelope (schema v4) + strict plan→field
  resolution. Plans reference fields by stable `fieldId`; `fieldName` stays as
  a display snapshot. Unresolved or ambiguous references stay `fieldId: null`
  and surface as 「散布ほ場参照切れ」 (go/no-go verdict `stop`, red admin
  reason, risk item placeholder) instead of silently falling back to another
  field. Sample plan `plan-drone-2` (`笠間デモほ場F`) is intentionally
  unresolved — the field does not exist in the demo field set.
- `js/domain/geometry.mjs`: canonical WGS84 Polygon/MultiPolygon
  normalization (holes preserved), boundary-to-boundary distance in metres,
  WGS84 range validation for imports, and content-hash based stable IDs
  (`imported-<type>-<hash>`); re-importing the same parcel yields the same ID.
- Fields carry `geometry` (canonical GeoJSON), `geometryRevision`
  (content hash), `externalRefs` (provider/externalId, filled from parcel
  properties like `筆ID`), and `provenance` (source, importedAt, originalCrs,
  stableKey). The legacy `geo` outer ring is still written for
  backward-compatible readers.
- Surrounding-field distances are now measured boundary distances, so the
  dashboard/notification numbers changed from the old hand-entered values
  (e.g. ほ場B is 2m, not 60m). This is intended.
- Known demo fields (ids in `SAMPLE_FIELD_GEOMETRY`) keep being refreshed from
  the curated sample coordinates on load; imported fields keep their own
  geometry.
- Shapefile import now requires a ZIP containing `.prj` (single `.shp` is
  rejected because its CRS cannot be verified).
- Tests: `node --test tools/domain.test.mjs` (14 tests, node:test, no deps).
- Browser smoke: serve the repo, start Chrome with
  `--headless=new --remote-debugging-port=9238`, then run
  `node tools/verify-pages.mjs http://127.0.0.1:4177 9238` and
  `node tools/verify-app-state.mjs http://127.0.0.1:4177 9238` (the latter
  covers envelope migration, plan resolution, the unresolved-plan UI, and a
  per-role view sweep).

## Phase 2 Import Boundary (2026-07-21)

- `js/domain/import.mjs` owns pure GeoJSON parsing, polygon filtering, field
  record construction, stable keys, provenance, external references,
  duplicate removal, and spray-relative distance/direction assignment.
- `main.js` keeps browser IO and orchestration: FileReader/fetch/shpjs, map
  layers, local state mutation, parcel selection, and user-facing toasts.
- The adapter contract accepts provider payloads only after they are converted
  to GeoJSON Polygon/MultiPolygon features with explicit source context.
  Generic file and municipality-parcel adapters are implemented.
- Provider IDs `xarvio` and `wagri` remain stable across provider adapters.
- Existing `imported-*`, curated demo, and `parcel-*` ID formats remain stable.
  Duplicate stable keys in one import batch keep the first record and emit a
  typed warning.
- Tests are dependency-free `node:test` suites under `tools/*.test.mjs`.

## Phase 3 Provider Contracts (2026-07-21)

- `adaptWagriFieldPolygonPayload` supports the officially documented
  FieldPolygonID v2/v3 record form, GeoJSON FeatureCollection form, and
  AgriculturalMap3 `targetFeatures` / `LinearPolygon` form.
- WAGRI `land_type` / `FieldType` is retained as source metadata and always
  enters the app as a neutral `public` field. It must never be inferred as a
  spray, organic, or no-chemical safety status.
- `adaptXarvioBoundaryPayload` binds one parsed KML/SHP-derived GeoJSON
  boundary to the field UUID supplied with the API request. It rejects a
  missing UUID or multiple polygons because public docs do not guarantee a
  feature-to-UUID attribute mapping in multi-field exports.
- Live API OAuth/token handling is deliberately outside the static frontend.
  Add a backend/BFF before connecting production xarvio or WAGRI accounts.
- Mapping, security boundary, and next integration steps are documented in
  `INTEGRATIONS.md`.

## Phase 4 Read-only BFF PoC (2026-07-21)

- Cloudflare Pages Functions under `functions/api/integrations/` proxy only
  read operations for WAGRI field polygons and one xarvio field boundary.
- All routes fail closed unless `INTEGRATIONS_ENABLED=true`, an encrypted
  `BFF_ACCESS_TOKEN` exists, and the request supplies the matching
  `X-Tonari-BFF-Token` header. The static frontend does not contain this token.
- WAGRI client credentials are exchanged server-side using the official token
  API and the short-lived access token is cached in the Worker isolate.
- xarvio currently accepts a pre-issued OAuth2 access token and returns the
  official single-field SHP export as a ZIP. Token lifecycle automation is a
  later backend task after partner onboarding confirms the authorization flow.
- Provider response bodies are not reflected on upstream errors. All BFF
  responses use `no-store`; UUID and coordinate inputs are validated before a
  provider call.
- xarvio ZIP responses stream through the Worker instead of being buffered in
  memory. `XARVIO_MAX_BOUNDARY_BYTES` defaults to 10 MiB; `Content-Length` is
  checked before streaming and chunked bodies are terminated at the same cap.
- `wrangler.toml` fixes the Pages output directory and Workers compatibility
  date without containing secrets.
- Tests: `node --test tools/bff.test.mjs tools/domain.test.mjs tools/import.test.mjs`.

Recommended local launch:

```powershell
python -m http.server 8080
```

Open:

```text
http://localhost:8080/
```

## Current Feature Map

- Dashboard:
  - pre-spray confirmation status card
  - readiness workflow
  - KPI cards
  - aerial-photo map preview

- Spray plan:
  - material type
  - aircraft/operator/default equipment template
  - total amount calculation from rate and area

- Field map:
  - MapLibre + GSI aerial photo tiles
  - surrounding/downwind view
  - flight log view
  - spray coverage playback
  - VRA prescription map
  - GeoJSON / Shapefile boundary import
  - municipality boundary catalog
  - parcel backdrop for large datasets
  - tap parcel to adopt as spray/neighbor field

- Weather:
  - Open-Meteo forecast fetch
  - actual wind memo remains manual

- Drone:
  - sample drone log
  - spray ON/OFF
  - altitude warning
  - outside planned range flag

- History:
  - field/material/status filters
  - pesticide/fertilizer work history
  - CSV/PDF output

- Admin:
  - Role navigation is intentionally reduced to `トップ` and `散布予定・実績`
  - municipality-oriented list
  - planned/done filter
  - district filter
  - click row to show aerial map, detail, and confirmation status

## Known Risks

- `js/main.js` is large and monolithic. Additions should prefer existing helpers and avoid duplicating state/render logic.
- `localStorage` schema changes can leave old browser data inconsistent. If display looks strange, use the app's sample reload or clear localStorage.
- `file://` local opening no longer fully works because boundary catalog and zip data are fetched.
- Boundary zip files are large. More municipalities may increase Git size and initial network load.
- Shapefile projection depends on `.prj` data and `shpjs`; test imported files carefully.
- Public demo URL is public even though GitHub repo is private.
- Admin page is role-gated. `#admin` direct navigation can redirect unless the active role is `admin`.

## Verification Commands

```powershell
git status --branch --short
node --check js\main.js
npx.cmd --yes wrangler@latest pages deployment list --project-name tonari-hatake-safety
Invoke-WebRequest -UseBasicParsing -Uri "https://tonari-hatake-safety.pages.dev/" | Select-Object -ExpandProperty StatusCode
```

Browser smoke targets:

- `/`
- `/#map`
- `/#history`
- `/#admin` after switching role to `地域管理`

## Handoff Rules For Another AI

- Read `README.md` and this file before editing.
- Run `git status` before touching files.
- Do not overwrite uncommitted user changes.
- Keep UI edits consistent with the existing dense operational tool style.
- Do not add a landing page.
- Use MapLibre/Turf/shpjs already present in `vendor/`.
- Keep the app static unless the user explicitly asks for backend/auth.
- When adding data-heavy features, consider Git size and Cloudflare Pages upload size.
- After changes, run `node --check js\main.js`, commit, push, and deploy if the public demo should change.

## Suggested Next Work

- Add a small local dev script or documented fallback for environments without Python.
- Split `js/main.js` into modules if development continues for more than a few rounds.
- Add a visible "clear demo data / reset localStorage" control.
- Add import validation messages for unsupported Shapefile/GeoJSON geometries.
- Add lightweight browser smoke test automation for dashboard/map/admin/history.
- Decide whether large public parcel datasets should stay in Git or move to external object storage.
