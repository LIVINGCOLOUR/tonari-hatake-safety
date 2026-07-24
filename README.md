# となり畑セーフティ MVP

農薬・液体肥料などのドローン散布について、散布者、周辺農家、自治体・JA担当者が同じ地図と確認状況を見ながら、散布前確認、近隣通知、飛行ログ確認、実施後報告を行うためのフロントエンドMVPです。

笠間市周辺を想定した匿名サンプルデモとして作成しています。実運用の判定システムではなく、飛散被害を未然に防ぐための確認・共有フローを検証する画面です。

## デプロイ先

Cloudflare Pages: https://tonari-hatake-safety.pages.dev/

紹介ページは `/`、MVP本体は `/app.html` です。紹介ページから未登録デモの3ロールへ直接移動できます。

GitHub: https://github.com/LIVINGCOLOUR/tonari-hatake-safety

GitHubリポジトリはprivateです。Cloudflare PagesのURLは公開URLなので、URLを知っている人は閲覧できます。

## ローカルでの開き方

このMVPは `fetch()` で `data/boundaries/index.json` や境界データを読むため、`app.html` を `file://` で直接開くと市町村カタログが読み込めません。`index.html` はサービス紹介ページです。

ローカル確認はHTTPサーバー経由で開いてください。

```powershell
python -m http.server 8080
```

その後、ブラウザで以下を開きます。

```text
http://localhost:8080/
```

未登録デモの入力はブラウザの `localStorage` に保存されます。保存キーは
`tonariHatakeSafetyMvp.v3.coverage` です。ログイン後に利用者が明示的に移行した地域は、
端末保存を維持しながらSupabaseへ同期します。

## 主な機能

- トップダッシュボード
- 散布前確認状況・追加確認項目の表示
- 散布計画登録
- 資材種別（農薬、液体肥料・葉面散布、その他資材）
- 使用量・面積からの総量計算
- 機体・操縦者・散布装置の既定値保存
- 圃場マップ・周辺確認
- MapLibre + 国土地理院航空写真タイル
- GeoJSON / Shapefile zip の圃場境界取込
- `data/boundaries/index.json` による市町村カタログ読込
- 筆ポリゴンの背景表示と、地図タップによる自ほ場採用
- 圃場ステータス登録
- 近隣通知文生成、通知済み管理
- Open-Meteo Forecast API による気象予報の自動取得
- 散布前チェックリスト
- ドローン連携モック
- サンプル飛行ログ取込
- 散布カバレッジ表示と再生
- 可変施肥（VRA）処方マップの取込・作成・編集・GeoJSON書き出し
- 実施後報告
- 作業履歴・防除履歴、CSV/PDF出力
- 自治体向け地域管理画面
- 散布予定・実績一覧、行クリック詳細、上空写真、作業詳細、気象確認状況
- 管理者ロールでは、操作タブを `トップ` と `散布予定・実績` に限定
- PDF印刷用ビュー
- Magic Linkログイン、地域ワークスペース、3ロール所属
- Supabaseへの圃場・計画・通知・報告の同期
- 非公開Storageへの報告写真・飛行ログ保存

## データ構成

- `index.html`: サービス紹介ページ
- `app.html`: MVP画面構造
- `css/landing.css`: 紹介ページのスタイル
- `js/landing.js`: 紹介ページのナビゲーション
- `css/styles.css`: UIスタイル
- `js/main.js`: UI状態、描画、地図、気象取得、境界取込IO、VRA、CSV/PDF処理
- `js/domain/state.mjs`: 保存形式と圃場参照の移行
- `js/domain/geometry.mjs`: WGS84形状、距離、方位、安定ハッシュ
- `js/domain/import.mjs`: 圃場取込の正規化、来歴、外部参照、重複排除
- `js/domain/sync.mjs`: アカウント・地域・端末の同期境界と遠隔同期ペイロード
- `js/repositories/app-state.mjs`: 計画、圃場、通知、作業記録の保存契約
- `js/repositories/supabase-app-state.mjs`: Supabase正規化テーブルとの同期アダプター
- `js/services/supabase-auth.mjs`: Magic Link、プロフィール、地域所属
- `js/services/supabase-storage.mjs`: 非公開写真・飛行ログ保存
- `supabase/migrations/`: Postgres / PostGIS、RLS、監査、Storage
- `SUPABASE_RUNBOOK.md`: Supabaseの反映、検証、FreeからProへの移行手順
- `SYNC_CONFLICTS.md`: 複数端末で同時編集した場合の上書き防止と利用者の操作
- `server/integrations/`: プロバイダーに依存しない読取専用BFFロジック
- `worker/`: レート・同時実行制限を持つ外部連携専用Worker
- `INTEGRATIONS.md`: xarvio/WAGRI連携の対応範囲、項目対応、認証境界
- `SYNC_BOUNDARY.md`: 遠隔保存の同期範囲、権限前提、大容量資産の扱い
- `vendor/maplibre-gl/`: MapLibre GL JS
- `vendor/turf/`: Turf.js
- `vendor/shpjs/`: Shapefile読込
- `data/boundaries/index.json`: 市町村境界カタログ
- `data/boundaries/*.geojson`: 軽量デモ境界
- `data/boundaries/*-fude.zip`: 筆ポリゴンShapefile zip

## 境界データの追加

`data/boundaries/` に GeoJSON または Shapefile zip を配置し、`data/boundaries/index.json` に登録すると、圃場マップの「対象市町村」から選べます。

```json
{
  "code": "08216",
  "name": "笠間市（筆ポリゴン2021）",
  "file": "kasama-fude.zip"
}
```

多数の筆ポリゴンは背景レイヤーとして表示し、地図上で筆をクリックして「散布ほ場にする」「周辺ほ場に追加」を選ぶ運用です。少数のポリゴンは管理対象ほ場として直接読み込まれます。

## 設計方針

法的な判定や原因断定ではなく、散布前後の確認状況を「未確認」「要確認」「記録済み」として扱います。目的は、散布者、周辺農家、JA、自治体が同じ情報を見て、農薬・資材の飛散リスクを事前に下げることです。

xarvio/WAGRIは、公開仕様で確認できる圃場境界だけをプロバイダー別アダプターで正規化します。API認証情報はフロントエンドへ保存せず、本接続時はバックエンドまたはBFFで扱います。詳細は `INTEGRATIONS.md` を参照してください。

## V1で未実装のもの

LINE実送信、DIPS連携、ドローンメーカーSDK実連携、圃場台帳との本番連携、
通信切断中の変更を保持する再送キュー、本番用の個人情報運用は未実装です。

認証、バックエンドDB、RLS、監査イベント、非公開StorageはFree開発環境へ実装済みです。
実利用者を受け入れる前にProへ移行し、バックアップ、復旧、監査保持、退会・削除手順を
運用として確定します。

気象情報はOpen-Meteoの予報値を取得しますが、散布直前の現地実測の代替ではありません。

## デプロイ

Cloudflare Pages のプロジェクト名は `tonari-hatake-safety` です。

```powershell
npx.cmd --yes wrangler@latest pages deployment list --project-name tonari-hatake-safety
```

最新の本番反映状況は以下で確認できます。

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://tonari-hatake-safety.pages.dev/" | Select-Object -ExpandProperty StatusCode
```

## 引継ぎ

別AI・別スレッドへ渡す場合は [HANDOFF.md](HANDOFF.md) を先に読ませてください。Claude Codeなど他AIとの会話そのものはこのリポジトリからは参照できないため、判断理由や未完了事項は必ずコミットメッセージか `HANDOFF.md` に残します。

## 参照リンク

- 農林水産省：農薬の使用に伴う事故・被害  
  https://www.maff.go.jp/j/press/syouan/nouyaku/260130.html
- 農林水産省：無人航空機による農薬等の空中散布  
  https://www.maff.go.jp/j/syouan/syokubo/gaicyu/g_kouku_zigyo/muzinkoukuuki.html
- 茨城県：農業支援サービス事業  
  https://www.pref.ibaraki.jp/nourinsuisan/sansin/shushi/nougyoushiennservice.html
- Open-Meteo Forecast API  
  https://open-meteo.com/en/docs
