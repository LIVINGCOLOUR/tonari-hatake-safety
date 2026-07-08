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
- `js/main.js`: 全ロジック。状態管理、地図、気象、境界取込、VRA、CSV/PDFを含む
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
- Current storage key: `tonariHatakeSafetyMvp.v3.coverage`.
- The app should be opened over HTTP. Do not rely on direct `file://` open because boundary catalog fetches fail in that mode.

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
