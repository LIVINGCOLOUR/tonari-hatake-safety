# 文書索引

必要な行の文書だけ読む。パスのコード表記はリポジトリルート基準。
共通指示は [AGENTS.md](../AGENTS.md)。この索引から全資料を順番に読む必要はない。

## 作業別の正本

| 作業 | 読む文書 |
| --- | --- |
| 継続作業・未完了 | [HANDOFF.md](../HANDOFF.md) |
| コード変更・検証・境界データ追加 | [DEVELOPMENT.md](../DEVELOPMENT.md) |
| 機能・ナビゲーション・ロール | [FEATURE_MAP.md](../FEATURE_MAP.md) |
| 事業・料金・通知方式・組織の権限 | [BUSINESS_MODEL.md](../BUSINESS_MODEL.md) |
| DB構成・RLS・Storage設計 | [SUPABASE_ARCHITECTURE.md](../SUPABASE_ARCHITECTURE.md) |
| Supabase設定・認証・マイグレーション・削除・Pro移行 | [SUPABASE_RUNBOOK.md](../SUPABASE_RUNBOOK.md) |
| 保存・利用者/地域/端末境界 | [SYNC_BOUNDARY.md](../SYNC_BOUNDARY.md) |
| 同時編集・競合・再送 | [SYNC_CONFLICTS.md](../SYNC_CONFLICTS.md) |
| xarvio/WAGRIの契約・アダプター | [INTEGRATIONS.md](../INTEGRATIONS.md) |
| 外部連携BFFの有効化・デプロイ | [INTEGRATIONS_RUNBOOK.md](../INTEGRATIONS_RUNBOOK.md) |
| 実機ログ・メーカーSDK/API | [DRONE_INTEGRATION.md](../DRONE_INTEGRATION.md) |
| デモ準備・Pages公開・公開対象追加 | [DEMO_AND_DEPLOY.md](DEMO_AND_DEPLOY.md) |

## 調査・ヒアリング・資料制作のときだけ

| 用途 | 資料 |
| --- | --- |
| 制度の原文・出典・未採用の運用仮説 | [RULES_AND_GUIDELINES.md](../RULES_AND_GUIDELINES.md) |
| 当事者への質問・紹介の進め方 | [ヒアリング設計](ヒアリング設計.md) |
| 現場で聞いた断片（判断・分析を混ぜない） | [現場メモ](現場メモ.md) |
| ３役・兼務の仮想操作で見つかった問題と再現手順 | [仮想操作レビュー（2026-09-09）](仮想操作レビュー_2026-09-09.md) |
| 水戸市の政策と出典 | [調査メモ](調査メモ_水戸市の農業政策.md) |
| 市議会質問設計 | [議会質問案](議会質問案_水戸市.md) |
| 自治体PDFの抽出・数値検算 | [PDF_EXTRACTION.md](PDF_EXTRACTION.md) |
| 県ヒアリング配布資料 | [概要説明A4](概要説明A4.html)、公開用 [概要.html](../概要.html) |
| 手持ち用・配布しない比較資料 | [類似サービス比較A4](類似サービス比較A4.html) |
| 製品を載せない無署名の問題提起 | [問題提起A4](問題提起A4.html)。動画第1部の原稿でもある |
| 基本仕様の説明資料 | [基本仕様書](basic-specification.html)（機能の最新状況はFEATURE_MAP） |
| 紹介動画の構成・文言・作り方（2部構成） | [video/README.md](video/README.md)。台本生成は `docs/video/build-promo-30s.py`、描画は `docs/video/render.sh` |
| 実画面の収録 | [画面録画手順](画面録画手順.md) |

調査の確認日・仮説/決定・未実装の区別は保持する。資料内の作成手順は、その資料を扱う場合に適用する。

## 履歴調査のときだけ

- [MVP批評と改善（2026-09-08）](MVP批評と改善_2026-09-08.md): 仮想ロールによるレビュー。実際の当事者ヒアリングではない。
- [引継ぎ原文](archive/HANDOFF_2026-09-08.md): 過去の実装段階・検証・判断。古い指示とTODOは現在の開発指示として扱わない。
- [事業方針原文](archive/BUSINESS_MODEL_2026-09-08.md): 詳細な訴求、決定理由、当時の出典・連絡先。現在の方針はルートのBUSINESS_MODEL。
- 動画の2026-08検討記録: [構成案](archive/紹介動画構成案_2026-08.md)、[キーフレーム指示](archive/動画キーフレーム指示_2026-08.md)（素材62枚の一覧あり）、[生成バッチ](archive/動画キーフレーム生成バッチ_2026-08.md)。75秒案とKling前提の制作環境は現行ではない。

## 文書の更新ルール

- 常時読む指示は `AGENTS.md`（目安3KB以内）に限定し、`CLAUDE.md` は参照先のみ。起動時に本書や全正本の読込を要求しない。
- 実装状況はFEATURE_MAP、事業判断はBUSINESS_MODEL、手順は各運用書へ。README・HANDOFFへ同じ説明を複写しない。
- HANDOFFは未完了・阻害要因・次の一手を置き換え、50行・4KBを目安に保つ。完了履歴・検証ログを追記し続けない。
- archiveは未コミット情報を含む整理前原文と、置き換えられた資料の保全用。通常の完了履歴はGitへ残し、毎回全文スナップショットを増やさない。
- 決定を既存文書の末尾へ「追記節」として継ぎ足さない。正本の該当箇所を書き換える。
- 文書変更後はローカルリンクと節参照、`git diff --check`、`wc -lc AGENTS.md CLAUDE.md HANDOFF.md` を確認する。
