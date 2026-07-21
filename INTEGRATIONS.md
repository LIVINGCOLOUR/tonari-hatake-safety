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

Optional safety settings:

- `XARVIO_MAX_BOUNDARY_BYTES`: maximum proxied ZIP size; defaults to 10 MiB
  and is hard-capped at 25 MiB. Declared oversized responses are rejected
  before streaming; chunked responses are terminated if they cross the cap.
  When `Content-Length` is present, a stream that ends before the declared
  length is treated as truncated instead of a successful ZIP download.
- `WAGRI_TIMEOUT_MS`: absolute deadline for each WAGRI authentication or JSON
  request; defaults to 12 seconds and is clamped to 1-30 seconds.
- `XARVIO_TIMEOUT_MS`: deadline for xarvio response headers; defaults to 12
  seconds and is clamped to 1-30 seconds.
- `XARVIO_STREAM_TIMEOUT_MS`: absolute deadline for the streamed xarvio ZIP
  body; defaults to 30 seconds and is clamped to 1-120 seconds. A timeout after
  streaming starts terminates the response body because its HTTP 200 status
  can no longer be replaced with a 504 response.

Provider timeouts return a sanitized `504 provider-timeout` response before a
response body starts and include `Retry-After: 5`. Client cancellation remains
distinct from an upstream timeout. Invalid timeout settings use the documented
defaults rather than disabling the limit.

Provider error bodies and diagnostic headers are never forwarded. WAGRI
authentication and field responses must contain valid JSON, and malformed or
empty successful responses are converted to a sanitized gateway failure.

Store all four values as encrypted Cloudflare secrets. For local development,
put them in an untracked `.dev.vars` file. Never put them in `wrangler.toml`.

Run locally with Pages Functions enabled:

```powershell
npx.cmd --yes wrangler@latest pages dev .
```

The ordinary `python -m http.server` launch still serves the frontend, but it
does not execute the BFF routes.

## Standalone integrations gateway

Rate-limited provider traffic is moving from Pages Functions to the standalone
`tonari-hatake-integrations` Worker. Its entry point is
`worker/integrations-gateway.js`, and `wrangler.integrations.toml` defines a
native Cloudflare Rate Limiting binding with a provider-route limit of 30
requests per 60 seconds.

Disabled-by-default deployment:
`https://tonari-hatake-integrations.makoto-monda.workers.dev`

The gateway authorizes the operator before counting a request. It fails closed
with `503 rate-limit-unavailable` when the binding is missing or fails, and
returns `429 rate-limit-exceeded` with `Retry-After: 60` before calling a
provider when the limit is reached. The binding is a protection mechanism, not
an accounting system; Cloudflare documents it as permissive and eventually
consistent within each location.

Each Worker isolate also applies a fail-fast provider concurrency guard:

- `WAGRI_MAX_CONCURRENCY`: defaults to 4 active JSON operations.
- `XARVIO_MAX_CONCURRENCY`: defaults to 2 active ZIP streams.

Both values are clamped to 1-10. Saturated providers return
`503 provider-busy` with `Retry-After: 2` before another provider request is
started. A xarvio slot remains active until the ZIP body closes, errors, is
cancelled by the client, or reaches its safety deadline. This per-isolate guard
limits local bursts but is not a global concurrency guarantee; use a Durable
Object-backed implementation if strict tenant-wide limits become necessary.

The existing Pages Functions remain disabled during the staged cutover. After
the standalone Worker is deployed and verified, move its secrets to the Worker,
route the intended API hostname/path to it, and remove the duplicate Pages
Functions routes. Do not enable both provider paths at the same time.

Validate the Worker configuration without deploying:

```powershell
npx.cmd --yes wrangler@latest deploy --config wrangler.integrations.toml --dry-run
```

Before replacing the operator-only shared token with Cloudflare Access, add
server-side verification of `Cf-Access-Jwt-Assertion`. The signature, issuer,
and application audience must all be verified against the team JWKS; trusting
the presence of the header alone is not authentication. Use Cloudflare's
documented `jose` implementation rather than a custom JWT verifier.

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
- Cloudflare Workers Streams: https://developers.cloudflare.com/workers/runtime-apis/streams/
- Cloudflare Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
