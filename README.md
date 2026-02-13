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

### コメント入力の注意

- slash command は **バッククォートなし** で入力してください
  - 例: `/run-claude implement`（OK）
  - 例: `` `/run-claude implement` ``（NG: 条件不一致で skipped になり得る）

### マージ方針

- 本テンプレートは **手動マージ運用** です
- required checks（`ci` / `policy-gate`）が成功したPRを、人間が確認してマージします

## ワークフロー動作確認手順（スモーク）

### 1) issue-guard（Issue作成時）

1. 見出しをいくつか省略したIssueを作成
2. `issue-guard` が起動し、`ai-question` ラベルと不足見出しコメントが付くことを確認
3. Issue本文を修正し、必要に応じて `ai-ready` を付与

### 2) ai-plan（Issueコメント）

1. 対象Issueに `ai-ready` を付与（`ai-question` / `ai-blocked` は外す）
2. Issueに `/run-claude plan` とコメント
3. `ai-plan.yml` が起動し、最小版応答コメントを返すことを確認

### 3) ai-implement（Issueコメント）

1. 対象Issueに `ai-ready` を付与（`ai-question` / `ai-blocked` は外す）
2. Issueに `/run-claude implement` とコメント
3. `ai-implement.yml` が起動し、最小版応答コメントを返すことを確認

### 4) ai-review（PRコメント）

1. 何らかのPRを1つ開く
2. PRコメントに `/run-claude review` と投稿
3. `ai-review.yml` が起動し、最小版応答コメントを返すことを確認

### 5) 失敗時の見る場所

- GitHubの **Actions** タブで該当Workflow Runを確認
- PRの **Checks** タブで `ci` / `policy-gate` の状態を確認

## 現在のテンプレ実装状況（2026-02時点）

- 実装済み
  - `issue-guard.yml`
  - `ai-plan.yml`（最小版）
  - `ai-implement.yml`（最小版）
  - `ai-review.yml`（最小版）
- 運用方針
  - **手動マージ固定**（safe-to-merge / enable-automerge は不使用）
  - required checks（`ci` / `policy-gate`）成功後に人間がマージ
