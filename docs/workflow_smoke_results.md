# Workflow Smoke Results

実施日: 2026-02-13

## 対象

- issue-guard
- ai-plan
- ai-implement
- ai-review

## 実施結果

### 1) issue-guard

- 対象Issue: https://github.com/skphotograph/gh-claude-actions-template/issues/12
- 条件: 必須見出し不足のIssueを作成
- 結果:
  - `ai-question` ラベル付与を確認
  - 不足見出し一覧コメントを確認
  - Actions Run: failure（想定どおりガードで停止）

### 2) ai-plan

- 対象Issue: https://github.com/skphotograph/gh-claude-actions-template/issues/12
- 条件:
  - 1回目: `ai-ready` 未付与 + `ai-question` 付きで `/run-claude plan`
  - 2回目: `ai-ready` 付与 + `ai-question` 解除で `/run-claude plan`
- 結果:
  - 1回目: ガードで失敗コメント（想定どおり）
  - 2回目: 最小版の受理コメント（成功）

### 3) ai-implement

- 対象Issue: https://github.com/skphotograph/gh-claude-actions-template/issues/12
- 条件:
  - 1回目: `` `/run-claude implement` ``（バッククォート付き）
  - 2回目: `/run-claude implement`（プレーン）
- 結果:
  - 1回目: skipped（条件不一致）
  - 2回目: 最小版の受理コメント（success）

### 4) ai-review

- 対象PR: https://github.com/skphotograph/gh-claude-actions-template/pull/13
- 条件: PRコメントで `/run-claude review`
- 結果:
  - 最小版の受理コメントを確認
  - Actions Run: success

## 補足

- slash command は **バッククォートなし** のプレーンテキストで入力すること
- 本テンプレートは手動マージ運用（Auto-mergeは使用しない）
