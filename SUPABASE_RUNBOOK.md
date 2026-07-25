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

アプリは戻り先に一時的な `?auth=magic-link` を付けます。Supabaseが認証情報を
URLから回収した後、この印を使ってプロフィール画面を開き、アドレス欄から印を削除します。
送信後60秒は再送を止め、ページを再読込しても同じ待ち時間を引き継ぎます。

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

初回同期時にクラウドへ既存の圃場・計画がある場合は、端末データで上書きせず、
クラウドの内容を読み込む確認を表示します。別端末による先行更新が検出された場合は
競合表示になります。比較画面で変更内容を確認し、記録ごとに採用する版を選んでください。
端末版を選ぶ場合は確認画面が表示され、最新のクラウド版番号を再確認して保存します。

## 検証

```powershell
npm test
node tools\verify-app-state.mjs http://127.0.0.1:4177 9238
node tools\verify-pages.mjs http://127.0.0.1:4177 9238
```

実メール確認では、次を順に確認します。

1. 本番画面から自分のメールアドレスへ1通だけ送る。
2. 送信先と再送待ちが画面に残ることを確認する。
3. メール内のリンクが `app.html` に戻ることを確認する。
4. プロフィール画面が開き、ログイン中のメールアドレスが表示されることを確認する。
5. ログアウト後、ログイン済み地域データがデモ画面に残らないことを確認する。

`tools/verify-supabase-adapter.mjs`は実DBへ一時ユーザーと一時地域を作り、
圃場、計画、通知、報告、写真、飛行ログを往復確認してから削除します。
実行時だけ次の環境変数が必要です。

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY`をファイルへ保存しないでください。

### 退会申請の実DB確認

`tools/verify-account-operations.mjs`は、実DBへ2人の一時利用者を作成し、次を確認します。

- 確認文言が一致しない申請を拒否する
- 本人だけが申請状況を読める
- 退会申請を取り消せる
- 取消済み申請を重ねて取り消せない
- 取消後に再申請できる
- ブラウザから申請行を直接追加・完了・削除できない

確認後は一時利用者を削除します。実行時だけ次の環境変数を渡します。

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

ブラウザへ`service_role`を渡してはいけません。

## 退会とデータ削除

画面上の「退会を申請」は、認証ユーザーを即時削除する操作ではありません。
共有済みの散布計画、通知、実施後報告、監査記録を利用者の退会だけで失わないため、
まず取消可能な申請として記録します。

本削除前に運営者が確認する項目:

1. 本人用データを書き出したか
2. その利用者が地域の唯一の管理者ではないか
3. 共有業務記録の管理者移管または匿名化方針が決まっているか
4. 法令・自治体・JAとの取決めに基づく保存期間を満たしたか
5. Storageの報告写真・飛行ログをStorage APIで削除したか
6. 最後にSupabase Admin APIで認証ユーザーを削除したか

StorageのテーブルをSQLで直接削除しても、保存された実体は削除されません。
必ずStorage APIを先に使用します。自動本削除は、上記の運用と保持期間が確定するまで
有効化しません。

## FreeからProへ移る条件

次のいずれかの前にProへ移行します。

- 自治体、JA、散布者、周辺農家が実データを継続登録する。
- 停止を許容できない実証を始める。
- バックアップ、復旧目標、サポート条件を合意する。
- 個人情報と圃場情報の本番運用責任者を決める。

Pro移行時には、バックアップ復元訓練、監査ログ保持期間、退会・削除手順、
障害時連絡、個人情報取扱いを追加確認します。
