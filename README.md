# となりの畑セーフティ（仮称）

農薬・液体肥料のドローン散布について、散布者・周辺農家・自治体/JAが
事前確認、近隣周知、実施記録を共有するMVP。笠間市周辺想定の匿名サンプルです。
散布の許可、被害原因や法的責任の判定は行いません。

## 起動

```sh
node tools/static-server.mjs . 4177
```

- 紹介: `http://127.0.0.1:4177/`
- 通常画面: `http://127.0.0.1:4177/app.html`
- 実証デモ: `http://127.0.0.1:4177/app.html?demo=1`

`file://` は不可。通常画面も公開準備中で、デモ切替は表示のみです。
未登録時は端末保存。ログイン後、利用者が明示的に移行した地域をSupabaseと同期します。

## 開発資料

エージェントは [AGENTS.md](AGENTS.md) から開始し、必要な文書だけ参照します。

| 知りたいこと | 正本 |
| --- | --- |
| 機能・ロール・実装状況 | [FEATURE_MAP.md](FEATURE_MAP.md) |
| 通知方式・料金・閲覧権限 | [BUSINESS_MODEL.md](BUSINESS_MODEL.md) |
| コードの所在・開発・検証 | [DEVELOPMENT.md](DEVELOPMENT.md) |
| 未完了事項・作業再開 | [HANDOFF.md](HANDOFF.md) |
| 専門設計・運用・調査・配布資料 | [文書索引](docs/README.md) |

## 公開先

- [公開デモ](https://tonari-hatake-safety.pages.dev/)
- [GitHub](https://github.com/LIVINGCOLOUR/tonari-hatake-safety)（private）

Pagesは手動アップロードです。pushのみでは反映されません。
公開URLは誰でも閲覧可能。公開資産の選別・デモ準備は [運用手順](docs/DEMO_AND_DEPLOY.md) を参照。

## 課題の根拠

事前周知不足や変更時の再連絡、通知対象の把握を支援します。調査時点と原文の記録は
[RULES_AND_GUIDELINES.md](RULES_AND_GUIDELINES.md) §2・§11 にまとめています。
