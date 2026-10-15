# デモ準備・公開手順

デモを見せる・公開を変更するときだけ読む。コマンドはリポジトリルート基準。

## デモ前チェック

1. 専用のサンプル用ブラウザで `/app.html?demo=1` を開く。実利用データのない状態で「サンプル読込」を1回実行し、今日基準の日付へ更新する。保存済みサンプルは開くだけでは日付が変わらない。
2. ログイン中の地域や未送信データを初期化しない。通常入口にはサンプル操作は表示されない。
3. 公開URLを見せる場合は対象コミットのデプロイを確認。pushだけでは公開画面は変わらない。
4. 紹介ページの「画面を試す」は `/app.html?preview=1`。通常画面をサンプルの状態で開き、ログイン画面とサンプル操作のボタンは出ない。全機能のデモを見せるときは `/app.html?demo=1`。

通常画面の操作確認は「予定作成→延期して再連絡→立場切替」。
実証デモの説明は、散布者トップ→近隣通知→同梱ログ取込→作業履歴→周辺農家/地域管理の順。
デモ境界は航空写真からの概略で、名称・栽培種別は架空。実機ログ・本番連絡の動作保証にしない。

## Cloudflare Pagesへのデプロイ手順

Pagesプロジェクト名は `tonari-hatake-safety`。手動アップロード構成。
テスト済みコミットをpushしてから、コミット済みの公開資産を一時ディレクトリへ書き出す。
以下はmacOS/zsh用。Windowsも同じ公開対象を新しい作業ディレクトリへ展開し、`npx.cmd` で実行する。

```sh
git status --branch --short
npm test
git rev-parse HEAD
```

未コミット差分は書き出しに含まれない。公開したい変更がコミット・pushされ、テスト対象と一致することを先に確認する。

```sh
site_stage=$(mktemp -d /tmp/tonari-site.XXXXXX)
video_stage=$(mktemp -d /tmp/tonari-video.XXXXXX)
git archive HEAD index.html app.html 概要.html css js vendor data assets | tar -x -C "$site_stage"
if [ -d "$site_stage/assets/video" ]; then
  mv "$site_stage/assets/video" "$video_stage/"
fi
```

展開が成功したことと、配信内容を確認する。リポジトリ全体をアップロードしない。

- 公開対象: `index.html`、`app.html`、`概要.html`、`css/`、`js/`、`vendor/`、`data/`、動画以外の `assets/`。
- `docs/`、ルートのMarkdown、認証情報、開発ツールは配信しない。
- `assets/video/` は限定公開方針の制作素材で、退避先をアップロードしない。
- 公開ページを増やすときはルートへ置き、上の一覧とarchive引数へ明示的に追加する。
- `概要.html` は `docs/概要説明A4.html` のスマートフォン向け版。内容を変えるときは両方を更新する。公開パスは `/概要`。

```sh
npx --yes wrangler@latest pages deploy "$site_stage" --project-name tonari-hatake-safety --branch main --commit-dirty=true
```

Workerの外部連携は別デプロイで、`INTEGRATIONS_RUNBOOK.md` に従う。
一時ディレクトリは確認後に実際のパスを指定して片付ける。

## 公開後の確認

```sh
npx --yes wrangler@latest pages deployment list --project-name tonari-hatake-safety
curl -I https://tonari-hatake-safety.pages.dev/
curl -I https://tonari-hatake-safety.pages.dev/BUSINESS_MODEL.md
```

対象デプロイと紹介・通常画面・デモを確認する。内部文書のURLではMarkdown本文が返らないことを確認する。
SPAのHTMLフォールバックでは200が返ることがあるため、HTTPステータスだけで判定しない。
