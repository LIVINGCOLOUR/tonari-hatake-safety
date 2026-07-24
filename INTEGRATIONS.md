# xarvio・WAGRI 外部連携の境界設計

## 目的

外部プロバイダーのデータは、取込境界でアプリ共通形式へ正規化します。UIと保存済み圃場は、
共通のGeoJSON `Polygon`・`MultiPolygon` 形式だけを使用し、プロバイダー固有の
レスポンス形式には依存しません。

## WAGRI

公開仕様に基づいて対応するレスポンス形式は次のとおりです。

- `polygon_uuid`、土地情報、`Polygons[].Coordinates[]` を含むFieldPolygonID v2・v3形式
- FieldPolygonIDのGeoJSON `FeatureCollection` 形式
- `targetFeatures` と `LinearPolygon` を含むAgriculturalMap3形式

共通圃場形式への対応関係は次のとおりです。

| WAGRI | アプリ共通の圃場項目 |
| --- | --- |
| `polygon_uuid`、`ID`、`LastPolygonUuid` | `externalRefs[].externalId` |
| `edit_year`・`EditYear` | `externalRefs[].revision` |
| ポリゴン座標 | GeoJSON EPSG:4326 geometry |
| `land_type`・`FieldType` | `properties.sourceLandType` のみ |

`land_type` と `FieldType` は水田・畑などの土地分類を示すもので、農薬使用状況を
示すものではありません。そのため、WAGRIの筆ポリゴンは、利用者または権限のある運用で
このアプリ固有の安全ステータスを設定するまで、中立かつ未登録の `public` 圃場として
取り込みます。

## xarvio FIELD MANAGER

公開されている圃場境界APIは、KML、SHP、SVG、DJI KMLを出力できます。ブラウザ側では、
単一の出力境界をGeoJSONへ変換し、API呼出時に使ったxarvio圃場UUIDとともに
xarvioアダプターへ渡します。

アダプターは次の入力を意図的に拒否します。

- 明示的なxarvio圃場UUIDがない境界
- 1つのUUIDへ複数ポリゴンを割り当てる入力
- 公開仕様にないアーカイブ属性を使った、形状とUUIDの自動対応付け

## 認証と秘密情報

現在の製品は静的フロントエンドです。本番用のプロバイダー認証情報、OAuth更新トークン、
WAGRIトークン、アカウントIDをJavaScript、`localStorage`、公開静的ファイルへ
保存してはいけません。

本番連携には、次の責務を持つバックエンドまたはBFFが必要です。

1. プロバイダー認証とトークン更新を行う。
2. 正しい組織・アカウントの権限でプロバイダーAPIを呼び出す。
3. レスポンスを検証し、文書化されたアダプター契約へ変換する。
4. 同意、来歴、更新番号、同期監査イベントを記録する。
5. ブラウザに必要な最小限の圃場データだけを返す。

## 読み取り専用プロバイダーモジュール

`server/integrations/` にある、既定で無効なプロバイダー処理は次のAPIを定義しています。

- `GET /api/integrations/status`
- `GET /api/integrations/wagri/field-polygons?lat=...&lng=...&cmp=1`
- `GET /api/integrations/xarvio/boundary?fieldUuid=...`

すべてのAPIは、`INTEGRATIONS_ENABLED=true`、暗号化された
`BFF_ACCESS_TOKEN`、一致する `X-Tonari-BFF-Token` ヘッダーを必要とします。
この共通トークンは担当者試験専用であり、静的フロントエンドへ埋め込んではなりません。
一般利用者へプロバイダー同期を公開する前に、実際のアプリ認証またはCloudflare Access
認可へ置き換えます。`BFF_ACCESS_TOKEN` は32文字以上のランダムな値とし、
それより短い場合は設定エラーとして拒否します。

プロバイダーの秘密情報は次のとおりです。

- WAGRI: `WAGRI_CLIENT_ID`、`WAGRI_CLIENT_SECRET`
- xarvio: `XARVIO_ACCESS_TOKEN`（事前発行済みOAuth2アクセストークン）

任意の安全設定は次のとおりです。

- `XARVIO_MAX_BOUNDARY_BYTES`: 中継するZIPの最大サイズ。既定値は10 MiB、
  上限は25 MiBです。宣言されたサイズが上限を超える場合は通信開始前に拒否し、
  チャンク形式でも同じ上限を超えた時点で終了します。`Content-Length` がある場合に
  宣言サイズより短く終了したレスポンスは、正常なZIPではなく切断として扱います。
- `WAGRI_TIMEOUT_MS`: WAGRI認証・JSON通信の絶対期限。既定値は12秒で、
  1秒から30秒へ制限します。
- `XARVIO_TIMEOUT_MS`: xarvioのレスポンスヘッダー待機期限。既定値は12秒で、
  1秒から30秒へ制限します。
- `XARVIO_STREAM_TIMEOUT_MS`: xarvio ZIP本文全体の絶対期限。既定値は30秒で、
  1秒から120秒へ制限します。本文送信開始後はHTTP 200を504へ変更できないため、
  期限超過時はレスポンス本文を終了します。

プロバイダーの期限超過は、本文送信前であれば内容を限定した
`504 provider-timeout` と `Retry-After: 5` を返します。利用者側の通信中止は
プロバイダー期限超過と区別します。不正な期限設定は制限を無効化せず、文書化された
既定値を使用します。

外部プロバイダーのエラー本文と診断ヘッダーは転送しません。WAGRIの認証レスポンスと
圃場レスポンスには正しいJSONを要求し、空または不正な成功レスポンスは、内容を限定した
ゲートウェイエラーへ変換します。

4つの値はすべてCloudflareの暗号化シークレットとして保存します。ローカル開発では、
Git管理外の `.dev.vars` に置きます。`wrangler.toml` には記載しません。

単独ゲートウェイをローカルで起動する場合は、次を実行します。

```powershell
npx.cmd --yes wrangler@latest dev --config wrangler.integrations.toml
```

通常の `python -m http.server` はフロントエンドを配信しますが、
プロバイダーAPIは実行しません。

## 単独外部連携ゲートウェイ

レート制限付きのプロバイダー通信は、単独の
`tonari-hatake-integrations` Workerが担当します。入口は
`worker/integrations-gateway.js` で、`wrangler.integrations.toml` には
60秒あたり30リクエストのCloudflare Rate Limitingバインディングを定義しています。

既定で無効なデプロイ先:
`https://tonari-hatake-integrations.makoto-monda.workers.dev`

ゲートウェイは、レート制限を数える前に担当者認証を行います。バインディングがない、
または失敗した場合は安全側に停止して `503 rate-limit-unavailable` を返します。
上限到達時はプロバイダーを呼び出す前に、`Retry-After: 60` を付けた
`429 rate-limit-exceeded` を返します。このバインディングは防御機構であり、
厳密な集計機構ではありません。Cloudflareの仕様上、各拠点で最終的に整合する
許容型の制限です。

各Worker分離環境では、プロバイダーごとの同時実行制限も即時適用します。

- `WAGRI_MAX_CONCURRENCY`: JSON処理の同時実行数。既定値は4。
- `XARVIO_MAX_CONCURRENCY`: ZIPストリームの同時実行数。既定値は2。

どちらも1から10へ制限します。上限到達時は、新しいプロバイダー通信を始める前に
`Retry-After: 2` を付けた `503 provider-busy` を返します。xarvioの実行枠は、
ZIP本文の終了、エラー、中止、または安全期限到達まで保持します。この制限は各Worker
分離環境内の局所的な急増を抑えるもので、地域全体での厳密な同時実行保証ではありません。
地域単位で厳密に制限する場合は、Durable Objectsを使った実装が必要です。

重複していたPages FunctionsのAPIは削除済みです。静的Pagesサイトには
プロバイダー認証情報を含めず、外部連携処理も実行しません。Workerの秘密情報や
担当者試験フラグを変更する前に、`INTEGRATIONS_RUNBOOK.md` を確認します。

設定をデプロイせずに検証する場合は、次を実行します。

```powershell
npx.cmd --yes wrangler@latest deploy --config wrangler.integrations.toml --dry-run
```

担当者用共通トークンをCloudflare Accessへ置き換える前に、
`Cf-Access-Jwt-Assertion` をサーバー側で検証します。チームのJWKSを使って、
署名、発行者、アプリケーションの対象者をすべて検証する必要があります。
ヘッダーが存在するだけで認証済みとして扱ってはいけません。独自JWT実装ではなく、
Cloudflareが文書化している `jose` 実装を使用します。

## 次の段階

共通の担当者トークンを、アプリ認証または検証済みCloudflare Access認証へ
置き換えます。その後、対象アカウントから利用許諾を得て機密情報を除いたデータを取得し、
契約テストへ追加してから読み取り専用同期を有効化します。これらの条件を満たす前に、
散布計画や作業実績の双方向連携を実装してはいけません。

## 公式資料

- xarvio FIELD MANAGER Public API: https://developer.xarvio.com/api.html
- WAGRI FieldPolygonID v3: https://wagri.naro.go.jp/wagri_api/fieldpolygonid3-get/
- WAGRI FieldPolygonID v2仕様: https://wagri.naro.go.jp/wp-content/uploads/2022/08/FieldPolygonID2.pdf
- WAGRI AgriculturalMap3 市町村コードAPI: https://wagri.naro.go.jp/wagri_api/agriculturalmap3-getfieldpolygon-citycode/
- WAGRI AgriculturalMap3 WFS API: https://wagri.naro.go.jp/wagri_api/agriculturalmap3-wfsgetfieldpolygon/
- WAGRIアクセストークンAPI: https://wagri.naro.go.jp/wagri_api/token/
- Cloudflare Workers Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Workers Rate Limiting: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Cloudflare Access JWT検証: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
