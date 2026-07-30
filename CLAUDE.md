# CLAUDE.md

農薬・液体肥料のドローン散布について、散布前確認・近隣周知・飛行ログ確認・実施後報告を
散布者・周辺農家・自治体/JAで共有するMVP。茨城県笠間市周辺想定の匿名サンプルデモ。

## 正本の所在（編集前に必ず該当文書を読む）

| 内容 | 正本 |
| --- | --- |
| 製品範囲・3ロール・実装状況・将来機能 | `FEATURE_MAP.md` |
| **事業方針（優先順位・通知方式・料金・閲覧権限）** | `BUSINESS_MODEL.md` |
| 実装履歴・引継ぎルール・検証コマンド | `HANDOFF.md` |
| 県ヒアリング用の将来仮説（未採用・未実装） | `RULES_AND_GUIDELINES.md` |
| ドローン連携の調査と表現ルール | `DRONE_INTEGRATION.md` |
| 外部連携（xarvio/WAGRI）・同期境界 | `INTEGRATIONS.md` / `SYNC_BOUNDARY.md` |
| Supabase運用 | `SUPABASE_RUNBOOK.md` |
| 県ヒアリング資料（配布用A4・手持ち比較表） | `docs/概要説明A4.html` / `docs/類似サービス比較A4.html` |

## 技術構成（1行）

Vanilla JS（ES Modules・ビルドなし）+ MapLibre/Turf/shpjs ／
Cloudflare Pages + Workers ＋ Supabase（PostgreSQL/PostGIS・RLS・非公開Storage）

## 起動と検証

```powershell
node tools/static-server.mjs . 4177   # file:// は不可（動的import・fetchが失敗する）
node --check js\main.js
node --test tools\*.test.mjs
```

## 絶対に守ること（製品の安全境界）

- 散布の可否を判定する表現・自治体/JAが許可したように見える表現を作らない
- 被害原因・法的責任を断定する表現を作らない
- **「監視」「取り締まり」「違反」という語を使わない。「把握」「共有」「要確認」を使う**
- 通知は一方向の告知。**日程調整・合意形成の機能を作らない**
- 周辺農家の非公開圃場は種別・方向・距離のみの最小共有。本体を開示しない
- 気象予報を現地実測の代わりに扱わない
- **散布者は無条件・無料の原則を崩さない**（詳細は `BUSINESS_MODEL.md` §5）
- `FEATURE_MAP.md` 末尾の「利用者への確認が必要な変更」と `BUSINESS_MODEL.md` §11 に
  該当する変更は、実装前に必ず門田さんへ確認する

## 開発ルール要点（詳細は HANDOFF.md）

- `js/main.js` は大きい。追加時は `js/domain/` `js/services/` の既存ヘルパーを優先し、
  状態更新・描画を重複させない
- ライブラリは `vendor/` 同梱の MapLibre/Turf/shpjs を優先。新規CDN依存を足さない
- 保存形式（schema v4）変更は `js/domain/state.mjs` の移行と互換を確認
- 編集前に `git status`。未コミットの利用者変更を上書きしない
- 変更後は関連テストを実行。公開デモはテスト済みコミットをpushしてからデプロイ
- 判断理由・未完了事項はコミットメッセージか `HANDOFF.md` に残す（AI会話は残らない）

## ユーザー（門田さん）との対話

- 常にメタ視点・高い視座を添える。選択肢を並べるだけでなく推奨を1つ明示する
- 音声入力のため誤変換が多い（例:「散布車」=散布者、「件」=県）。文脈で読み替える
