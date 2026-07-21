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
