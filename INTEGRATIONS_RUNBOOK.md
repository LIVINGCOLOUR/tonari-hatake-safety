# 外部連携ゲートウェイ運用手順

この運用手順は、既定で無効化されている `tonari-hatake-integrations` Workerを
対象とします。本番の一般利用者によるアクセスを許可するものではありません。現在の
共通トークンによる保護は、管理された担当者試験にだけ使用します。

## 安全上のルール

- 認証情報をGit、`wrangler.toml`、ブラウザコード、コマンド引数、スクリーンショット、チャットメッセージへ記載しない。
- すべての事前確認が成功するまで、`INTEGRATIONS_ENABLED` を設定しないか、`false` にする。
- プロバイダー認証情報は `wrangler secret put` だけで保存する。
- プロバイダー認証情報をPagesプロジェクトに置かない。静的サイトは外部連携の実行環境ではない。
- 障害時は先に停止し、その後に調査する。最初の対応は外部連携の無効化とする。

## 事前確認

```powershell
git status --short --branch
node --test tools\bff.test.mjs tools\domain.test.mjs tools\gateway.test.mjs tools\import.test.mjs
npx.cmd --yes wrangler@latest deploy --config wrangler.integrations.toml --dry-run
```

デプロイ済みゲートウェイが引き続き無効であることを確認します。

```powershell
curl.exe -i https://tonari-hatake-integrations.makoto-monda.workers.dev/api/integrations/status
```

期待する結果は `503 integration-disabled` です。

## シークレットの準備

各コマンドは対話形式で実行します。Wranglerが値の入力を求めるため、認証情報は
コマンドラインに表示されません。

```powershell
npx.cmd --yes wrangler@latest secret put BFF_ACCESS_TOKEN --config wrangler.integrations.toml
npx.cmd --yes wrangler@latest secret put WAGRI_CLIENT_ID --config wrangler.integrations.toml
npx.cmd --yes wrangler@latest secret put WAGRI_CLIENT_SECRET --config wrangler.integrations.toml
npx.cmd --yes wrangler@latest secret put XARVIO_ACCESS_TOKEN --config wrangler.integrations.toml
```

承認された試験で使用するプロバイダーの認証情報だけを準備します。
`INTEGRATIONS_ENABLED` は無効のままにします。`BFF_ACCESS_TOKEN` は、
32文字以上のランダムな値にする必要があります。

## 管理された担当者試験

1. デプロイ結果またはダッシュボードから、現在のWorkerバージョンを記録する。
2. Cloudflare Rate Limitingのバインディングが存在することを確認する。
3. 試験対象者を限定し、担当者トークンは別経路で配布する。
4. 次のコマンドを対話形式で実行してフラグを有効化する。

```powershell
npx.cmd --yes wrangler@latest secret put INTEGRATIONS_ENABLED --config wrangler.integrations.toml
```

承認された試験時間中だけ `true` を入力します。`X-Tonari-BFF-Token` ヘッダーを付けて
状態確認APIを呼び出し、その後、プロバイダーを1つずつ検証します。このヘッダーの値を
フロントエンドへ埋め込んではなりません。

## 停止とロールバック

最初に、新しいプロバイダー通信を停止します。

```powershell
npx.cmd --yes wrangler@latest secret put INTEGRATIONS_ENABLED --config wrangler.integrations.toml
```

`false` を入力し、状態確認APIが `503 integration-disabled` を返すことを確認します。
コードのロールバックも必要な場合は、Cloudflareダッシュボードから最後に正常だった
Workerバージョンを選択します。デプロイ用コマンドは変更される可能性があるため、
CLIを使う前に `wrangler rollback --help` で現在の構文を確認します。

障害後は、Workerバージョン、発生時間帯、対象プロバイダー、レスポンス分類、
プロバイダーまでリクエストが到達したかを記録します。トークンや外部サービスの
生の診断情報を障害記録へ含めてはいけません。

## 本番利用の開始条件

以下がすべて揃うまで、このゲートウェイを一般利用者向けに有効化しません。

- アプリへのログイン、または検証済みCloudflare Access JWT
- 組織への所属確認とロール認可
- 利用者単位または地域単位のレート制限キー
- 同意、来歴、監査記録
- 利用許諾を得て機密情報を除いた契約テスト用データ
- プロバイダートークンの更新・失効処理
- 承認済みのデータ保持・削除方針
