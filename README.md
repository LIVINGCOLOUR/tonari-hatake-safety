# となり畑セーフティ MVP

農薬・液体肥料などのドローン散布について、散布者、周辺農家、自治体・JA担当者が同じ地図と確認状況を見ながら、散布前確認、近隣通知、飛行ログ確認、実施後報告を行うためのフロントエンドMVPです。

笠間市周辺を想定した匿名サンプルデモとして作成しています。実運用の判定システムではなく、飛散被害を未然に防ぐための確認・共有フローを検証する画面です。

## デプロイ先

Cloudflare Pages: https://tonari-hatake-safety.pages.dev/

GitHub: https://github.com/LIVINGCOLOUR/tonari-hatake-safety

GitHubリポジトリはprivateです。Cloudflare PagesのURLは公開URLなので、URLを知っている人は閲覧できます。

## ローカルでの開き方

このMVPは `fetch()` で `data/boundaries/index.json` や境界データを読むため、`index.html` を `file://` で直接開くと市町村カタログが読み込めません。

ローカル確認はHTTPサーバー経由で開いてください。

```powershell
python -m http.server 8080
```

その後、ブラウザで以下を開きます。

```text
http://localhost:8080/
```

入力内容はブラウザの `localStorage` に保存されます。保存キーは `tonariHatakeSafetyMvp.v3.coverage` です。

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

## データ構成

- `index.html`: 画面構造
- `css/styles.css`: UIスタイル
- `js/main.js`: 状態管理、描画、地図、気象取得、境界取込、VRA、CSV/PDF処理
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

## V1で未実装のもの

実認証、バックエンドDB、LINE実送信、DIPS連携、ドローンメーカーSDK実連携、圃場台帳との本番連携、権限管理、監査ログ、本番用の個人情報管理は未実装です。

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
