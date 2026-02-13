# Claude Code × GitHub Actions テンプレートリポジトリ

[運用方針](./docs/operation_policy.md)
[ロードマップ](./docs/roadmap.md)

## 必須ラベル一覧

### ラベルの一括登録（新規 Repo セットアップ時）

```bash
# gh CLI が必要: https://cli.github.com/
bash tools/setup-labels.sh          # カレントの git remote から自動検出
bash tools/setup-labels.sh OWNER/REPO  # 明示指定する場合
```

定義ファイル: [`.github/labels.yml`](.github/labels.yml)

### ラベル一覧

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

## Claudeコメントコマンド運用

### 前提

- 対象Issueに `ai-ready` ラベルが付いていること
- `ai-question` / `ai-blocked` が付いていないこと
- Repo に `ANTHROPIC_API_KEY` Secret が設定済みであること

### 使い方

1. **計画（read-only）**
   - Issueコメントで `/run-claude plan`
   - `ai-plan.yml` が起動し、explorer → policy-sentinel → architect の順で分析してコメントします

2. **実装**
   - Issueコメントで `/run-claude implement`
   - `ai-implement.yml` が起動し、テスト設計 → 実装 → CI → draft PR 作成を行います

3. **レビュー**
   - PRコメントで `/run-claude review`
   - `ai-review.yml` が起動し、reviewer subagent が PR 差分を点検してコメントします

4. **補助コマンド**（`slash-commands.yml`）
   - `/stop` — `ai-blocked` を付与して AI を停止
   - `/retry` — 直前のステージを再実行するよう案内
   - `/rebase` — Issue に紐づく draft PR ブランチを最新化

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
3. `ai-plan.yml` が起動し、Claude が explorer → policy-sentinel → architect の順で分析したコメントを返すことを確認
   - `ANTHROPIC_API_KEY` 未設定の場合はエラーになります

### 3) ai-implement（Issueコメント）

1. 対象Issueに `ai-ready` を付与（`ai-question` / `ai-blocked` は外す）
2. Issueに `/run-claude implement` とコメント
3. `ai-implement.yml` が起動し、Claude がテスト設計 → 実装 → CI → draft PR 作成を行うことを確認
   - `ANTHROPIC_API_KEY` 未設定の場合はエラーになります

### 4) ai-review（PRコメント）

1. 何らかのPRを1つ開く
2. PRコメントに `/run-claude review` と投稿
3. `ai-review.yml` が起動し、Claude が PR 差分を点検してコメントを返すことを確認
   - `ANTHROPIC_API_KEY` 未設定の場合はエラーになります

### 5) 失敗時の見る場所

- GitHubの **Actions** タブで該当Workflow Runを確認
- PRの **Checks** タブで `ci` / `policy-gate` の状態を確認

## Secrets 設計（各アプリ Repo での設定）

このテンプレートを使うアプリ Repo では、以下の Secrets を設定してください。

| Secret 名 | 設定場所 | 説明 |
|-----------|----------|------|
| `ANTHROPIC_API_KEY` | Repo Settings → Secrets → Actions | Anthropic API キー（Claude Code 実行に必要） |

### 設定手順

1. GitHub Repo の **Settings** → **Secrets and variables** → **Actions** を開く
2. **New repository secret** をクリック
3. Name: `ANTHROPIC_API_KEY`、Secret: Anthropic Console で発行した API キーを入力
4. **Add secret** で保存

> `GITHUB_TOKEN` は GitHub Actions が自動的に発行するため、別途設定不要です。

---

## Subagent 運用

### 初期セット（`.claude/agents/`）

| Subagent | 役割 | tools |
|----------|------|-------|
| `explorer` | 現状把握（変更対象候補・既存テスト・制約） | Read, Glob, Grep |
| `architect` | 設計案（方針A/B・変更点・テスト戦略・ロールバック） | Read, Glob, Grep, WebFetch |
| `test-designer` | テスト設計（AC→Test・A/B/C判定・代替担保） | Read, Glob, Grep |
| `policy-sentinel` | policy適合（例外ラベル要否・上限超過見込み） | Read, Glob, Grep |
| `reviewer` | PR差分点検（指摘・質問のみ、最終判定しない） | Read, Glob, Grep |

### 共通ルール

- plan 系 Subagent（explorer / architect / test-designer / policy-sentinel）は **read-only**
- `reviewer` は **最終判定しない**（マージ判断は人間）
- コードを変更するのは implement ステージの main Claude のみ

### 委譲順

**`/run-claude plan`**
```
explorer → policy-sentinel → architect → main が統合してコメント
```

**`/run-claude implement`**
```
test-designer（事前設計）→ main が実装・テスト・draft PR 作成
```

**`/run-claude review`**
```
reviewer が差分を点検 → 指摘・質問をコメントして返す
```

---

## 現在のテンプレ実装状況（2026-02時点）

- 実装済み
  - `issue-guard.yml` — Issue テンプレ検査・`ai-question` 自動付与
  - `ai-plan.yml` — `claude-code-action` 統合（explorer → policy-sentinel → architect）
  - `ai-implement.yml` — `claude-code-action` 統合（test-designer → 実装 → CI → draft PR）
  - `ai-review.yml` — `claude-code-action` 統合（reviewer subagent による差分点検）
  - `slash-commands.yml` — `/stop` `/retry` `/rebase` 補助コマンド
  - `ci.yml` — CI 入口（`tools/ci.sh`、派生 Repo で実装）
  - `policy-gate.yml` — policy.yml ベースの差分検査
  - `.claude/agents/` — 5体の Subagent 設定（explorer / architect / test-designer / policy-sentinel / reviewer）
- 運用方針
  - **手動マージ固定**（safe-to-merge / enable-automerge は不使用）
  - required checks（`ci` / `policy-gate`）成功後に人間がマージ
- 注意事項
  - `anthropics/claude-code-action@v1` の入力パラメータはリリース版で要確認
  - 派生 Repo では `ANTHROPIC_API_KEY` Secret の設定が必須
