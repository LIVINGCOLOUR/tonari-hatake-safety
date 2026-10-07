# 開発・検証

実装時に該当節だけ参照。共通指示は [AGENTS.md](AGENTS.md)、機能の正本は [FEATURE_MAP.md](FEATURE_MAP.md)。
[Singularity Society開発指針](https://github.com/SingularitySociety/societys_statement/blob/main/development/README.md) を基本とし、アーキテクチャ変更時の相違は理由を記録する。

## コードの入口

| 対象 | ファイル・責務 |
| --- | --- |
| 紹介 | `index.html`、`css/landing.css`、`js/landing.js` |
| MVP画面 | `app.html`、`css/styles.css`、`js/main.js`（描画・地図・IOの組立） |
| ドメイン | `js/domain/`：state、geometry、import、spray、prescription、coverage、dashboard、disclosure、plan-lifecycle、sync |
| 外縁処理 | `js/services/`：気象、境界IO、出力、認証、Storage、同期、端末保存、フォーム下書き |
| 保存 | `js/repositories/`：ローカル・Supabaseアダプター。共通契約は `tools/repository-contract.mjs` |
| DB・権限 | `supabase/migrations/`、設計は `SUPABASE_ARCHITECTURE.md` |
| 外部連携 | `server/integrations/`、`worker/integrations-gateway.js`。契約は `INTEGRATIONS.md` |

## 実装原則

- ドメインは入出力が明確な小さなモジュールへ。DOM・地図・保存・SDKは外縁へ置く。実際の重複・変更要因に応じて分離し、早すぎる抽象化を避ける。
- 現在のVanilla JSを維持。Supabase Auth/DB/RLS/Storageは接続済み。別構成への移行は運用価値が移行コストを上回る場合に検討する。
- 外部データはプロバイダー別アダプターで共通契約へ正規化。認証情報・有料API通信はBFF内へ。本番BFFはアプリ認証・ロール認可・レート/容量/時間/同時実行制限・監査が前提。共通トークンは既定無効の試験用。
- 認証・設定・入力・外部応答が不完全なら安全側に停止。位置・栽培・連絡先・返信・履歴は所有者と公開範囲を管理する。
- UIは既存の業務ツールの密度に合わせる。紹介ページとアプリ本体の入口を維持する。

## 保存・境界データ

- `js/main.js` は通常スクリプトで、`init()` がES Modulesを動的読込。HTTPとJSのMIME typeが必要。
- デモ保存キーは `tonariHatakeSafetyMvp.v3.coverage`。schema v4は `{ schemaVersion: 4, revision, savedAt, data }`。移行は `js/domain/state.mjs`、利用者・地域別キーは `js/services/device-state-context.mjs`。
- 保存・同期変更時は `SYNC_BOUNDARY.md`、競合は `SYNC_CONFLICTS.md` を読む。初期化を利用者データの修復手段にしない。
- 境界追加は `data/boundaries/` にGeoJSONまたは `.prj` 付きShapefile ZIPを配置し、`index.json` に `code / name / file` を登録。大量筆は背景表示→クリック採用。Git容量・初回通信量を確認する。
- `plan-drone-2` の圃場参照切れは意図したデモ。外部取込のgeometryをデモ図形へ置換しない。

## 検証

```sh
node --check js/main.js
node --test tools/plan-lifecycle.test.mjs
npm test
```

2行目は対象テストの例。変更したJSの構文と関連テストを確認し、push・デプロイ前には全テストを実行する。
文書だけの変更はリンク・参照先・差分を確認する。過去の成功件数を現在の検証結果に流用しない。

画面・状態変更時はローカルHTTPサーバーと専用プロファイルのChrome/Edge（CDPポート例9239）で確認する。
検証ツールはサンプル保存を変更するため、実利用中のブラウザで実行しない。

```sh
node tools/verify-pages.mjs http://127.0.0.1:4177 9239
node tools/verify-app-state.mjs http://127.0.0.1:4177 9239
```

案件導線だけなら前者に `--case-only`。通常/デモ・3ロール・PC/スマートフォン幅を対象にする。
`.github/workflows/ci.yml` に構文・Nodeテスト・ブラウザ検証あり。実DBを使う検証は `SUPABASE_RUNBOOK.md`。
公開手順は [DEMO_AND_DEPLOY.md](docs/DEMO_AND_DEPLOY.md)。
