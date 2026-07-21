# xarvio / WAGRI Integration Boundary

## Purpose

Provider data is normalized at the import boundary. UI state and saved field
records consume one canonical GeoJSON Polygon/MultiPolygon model and do not
depend on provider response shapes.

## WAGRI

Supported public response contracts:

- FieldPolygonID v2/v3 records containing `polygon_uuid`, land metadata, and
  `Polygons[].Coordinates[]`
- FieldPolygonID GeoJSON `FeatureCollection`
- AgriculturalMap3 `{ targetFeatures }` responses whose geometry type is
  `LinearPolygon`

Canonical mapping:

| WAGRI | Canonical field |
| --- | --- |
| `polygon_uuid`, `ID`, `LastPolygonUuid` | `externalRefs[].externalId` |
| `edit_year` / `EditYear` | `externalRefs[].revision` |
| polygon coordinates | GeoJSON EPSG:4326 geometry |
| `land_type` / `FieldType` | `properties.sourceLandType` only |

`land_type` and `FieldType` identify paddy/upland categories. They do not show
whether chemicals are used. WAGRI parcels therefore import as neutral,
unregistered (`public`) fields until a user or an authoritative workflow
assigns the app-specific safety status.

## xarvio FIELD MANAGER

The public boundary API exports KML, SHP, SVG, or DJI KML. The browser may
parse a single exported boundary to GeoJSON, then call the xarvio adapter with
the field UUID used in the API request.

The adapter intentionally rejects:

- a boundary without an explicit xarvio field UUID
- multiple polygons bound to one UUID
- automatic matching of shapes to UUIDs from undocumented archive attributes

## Authentication and Secrets

The current product is a static frontend. Production provider credentials,
OAuth refresh tokens, WAGRI tokens, and account identifiers must not be stored
in JavaScript, localStorage, or deployed static files.

A production integration requires a backend or BFF that:

1. performs provider authentication and token refresh;
2. calls provider APIs under the correct tenant/account;
3. validates and converts payloads to the documented adapter contract;
4. records consent, provenance, revision, and sync audit events;
5. returns only the minimum field data needed by the browser.

## Read-only BFF PoC

Cloudflare Pages Functions provide disabled-by-default proof-of-concept routes:

- `GET /api/integrations/status`
- `GET /api/integrations/wagri/field-polygons?lat=...&lng=...&cmp=1`
- `GET /api/integrations/xarvio/boundary?fieldUuid=...`

Every route requires `INTEGRATIONS_ENABLED=true`, the encrypted
`BFF_ACCESS_TOKEN` secret, and an `X-Tonari-BFF-Token` request header. This
shared token is for operator testing only. It must not be embedded in the
static browser app. Before exposing provider sync to end users, replace this
guard with real application authentication or Cloudflare Access authorization.
Use at least 32 random characters for `BFF_ACCESS_TOKEN`; shorter values are
rejected as a configuration error.

Provider secrets:

- WAGRI: `WAGRI_CLIENT_ID`, `WAGRI_CLIENT_SECRET`
- xarvio: `XARVIO_ACCESS_TOKEN` (a previously issued OAuth2 access token)

Store all four values as encrypted Cloudflare secrets. For local development,
put them in an untracked `.dev.vars` file. Never put them in `wrangler.toml`.

Run locally with Pages Functions enabled:

```powershell
npx.cmd --yes wrangler@latest pages dev .
```

The ordinary `python -m http.server` launch still serves the frontend, but it
does not execute the BFF routes.

## Next Step

Obtain licensed, redacted fixtures from each intended account and run them as
contract tests. Then add a BFF proof of concept with read-only boundary sync
before implementing bidirectional plan or operation exchange.

## Official References

- xarvio FIELD MANAGER Public API: https://developer.xarvio.com/api.html
- WAGRI FieldPolygonID v3: https://wagri.naro.go.jp/wagri_api/fieldpolygonid3-get/
- WAGRI FieldPolygonID v2 specification: https://wagri.naro.go.jp/wp-content/uploads/2022/08/FieldPolygonID2.pdf
- WAGRI AgriculturalMap3 city-code API: https://wagri.naro.go.jp/wagri_api/agriculturalmap3-getfieldpolygon-citycode/
- WAGRI AgriculturalMap3 WFS API: https://wagri.naro.go.jp/wagri_api/agriculturalmap3-wfsgetfieldpolygon/
- WAGRI access token API: https://wagri.naro.go.jp/wagri_api/token/
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Cloudflare Pages secrets: https://developers.cloudflare.com/pages/functions/bindings/
