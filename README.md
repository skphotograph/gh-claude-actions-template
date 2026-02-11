# Claude Code × GitHub Actions テンプレートリポジトリ

[運用方針](./docs/operation_policy.md)
[ロードマップ](./docs/roadmap.md)

## 必須ラベル一覧

| ラベル            | 用途                                         |
| ----------------- | -------------------------------------------- |
| `ai-ready`        | AI着手許可（誤爆防止のスイッチ）             |
| `ai-question`     | 仕様不足・質問待ち（AI停止）                 |
| `ai-blocked`      | 人間判断待ち（AI停止）                       |
| `draft-pr`        | AI作成のドラフトPR                           |
| `phase-bootstrap` | 初期構築フェーズ（仕様変更を儀式化して許容） |
| `phase-stable`    | 安定運用フェーズ（デフォルト）               |
| `allow-deps`      | 依存ファイル変更の例外許可（Soft Gate解除）  |
| `allow-config`    | 設定ファイル変更の例外許可（Soft Gate解除）  |
