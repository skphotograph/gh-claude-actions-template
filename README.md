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

## Claudeコメントコマンド運用（最小）

### 前提

- 対象Issueに `ai-ready` ラベルが付いていること
- `ai-question` / `ai-blocked` が付いていないこと

### 使い方

1. **計画（read-only）**
   - Issueコメントで `/run-claude plan`
   - `ai-plan.yml` が起動し、最小版コメントを返します

2. **実装（最小版の器）**
   - Issueコメントで `/run-claude implement`
   - `ai-implement.yml` が起動し、最小版コメントを返します

3. **レビュー（最小版の器）**
   - PRコメントで `/run-claude review`
   - `ai-review.yml` が起動し、最小版コメントを返します

### マージ方針

- 本テンプレートは **手動マージ運用** です
- required checks（`ci` / `policy-gate`）が成功したPRを、人間が確認してマージします
