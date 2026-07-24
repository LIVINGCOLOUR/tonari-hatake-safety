# Supabase運用手順

## 現在の環境

- 開発プロジェクト：`tonari-hatake-safety-dev`
- プロジェクト参照：`wigvqprxwzbpztmafuqi`
- リージョン：東京（`ap-northeast-1`）
- 利用プラン：Free
- アプリ動作：`hybrid`

未登録デモは従来どおり端末内で動きます。ログインして地域を選んでも、
利用者が「端末データをクラウドへ移行」を実行するまでは、端末データを送信しません。

## 秘密情報

- ブラウザとGitに置けるのは、プロジェクトURLとpublishable keyだけです。
- `service_role`、`sb_secret_`、DBパスワードはブラウザ、Git、Cloudflare Pagesへ置きません。
- 管理操作が必要なときは、Supabase Dashboardまたはログイン済みCLIを使います。
- `.env`と`.dev.vars`はGit対象外です。

## マイグレーション

ローカルとリモートの履歴を確認します。

```powershell
npx supabase migration list --linked
```

未反映分を適用します。

```powershell
npx supabase db push --linked --include-all
```

アプリが所有する`public`スキーマを検査します。

```powershell
npx supabase db lint --linked --schema public --level warning --fail-on error
```

PostGIS拡張の内部関数まで対象にすると、Supabase管理領域に静的解析の誤検知が出ます。
アプリの合否判定は`public`スキーマに限定します。

## 認証

Magic Linkの戻り先は次のURLです。

- `https://tonari-hatake-safety.pages.dev/app.html`
- `http://127.0.0.1:4177/app.html`
- `http://127.0.0.1:4178/app.html`
- `http://localhost:8080/app.html`

Supabase CLI 2.109.1ではFreeプロジェクトへの`config push`時に、
通常Storageとは無関係なベクターバケット更新で402になる場合があります。
Auth設定は先に反映されています。設定を変更するときは、Dashboardの
Authentication URL Configurationも確認し、有料化で回避しません。

## データ移行

1. アプリの「プロフィール設定」を開く。
2. Magic Linkでログインする。
3. 地域を作成するか、招待コードで参加する。
4. 対象地域を選ぶ。
5. 「端末データをクラウドへ移行」を押す。
6. 同期済み表示を確認する。
7. 別端末では同じアカウントでログインし、「クラウドから再読込」を使う。

通信失敗時も端末保存を維持します。クラウド保存に失敗した状態を成功表示にしません。

## 検証

```powershell
npm test
node tools\verify-app-state.mjs http://127.0.0.1:4177 9238
node tools\verify-pages.mjs http://127.0.0.1:4177 9238
```

`tools/verify-supabase-adapter.mjs`は実DBへ一時ユーザーと一時地域を作り、
圃場、計画、通知、報告、写真、飛行ログを往復確認してから削除します。
実行時だけ次の環境変数が必要です。

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY`をファイルへ保存しないでください。

## FreeからProへ移る条件

次のいずれかの前にProへ移行します。

- 自治体、JA、散布者、周辺農家が実データを継続登録する。
- 停止を許容できない実証を始める。
- バックアップ、復旧目標、サポート条件を合意する。
- 個人情報と圃場情報の本番運用責任者を決める。

Pro移行時には、バックアップ復元訓練、監査ログ保持期間、退会・削除手順、
障害時連絡、個人情報取扱いを追加確認します。
