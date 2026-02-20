# Claude Code × GitHub Actions テンプレートリポジトリ

GitHub Issues から AI エージェント（Claude）が計画・実装・レビューを行うテンプレートです。
policy gate による差分制御と、人間による手動マージ運用を前提としています。

---

## セットアップ（派生リポジトリ作成後）

テンプレートから新規リポジトリを作成した後、以下を順に実施してください:

- [ ] `ANTHROPIC_API_KEY` Secret を設定（Settings → Secrets → Actions）
- [ ] `bash tools/setup-labels.sh` で必須ラベルを一括登録
- [ ] Branch protection で `ci` / `policy-gate` を required check に設定
- [ ] `tools/ci.sh` にプロジェクト固有の CI コマンドを実装
- [ ] `policy.yml` の `allowed_dirs` をプロジェクト構造に合わせて調整
- [ ] 初期構築完了後、`bootstrap.allow_workflows` を `false` に変更
- [ ] （任意）`AI_NOTIFY_WEBHOOK_URL` Secret を設定（`ai-question` / `ai-blocked` 通知）
- [ ] スモークテスト（後述）で一連のフローを確認

> `GITHUB_TOKEN` は GitHub Actions が自動的に発行するため、別途設定不要です。

---

## コメントコマンド

### 前提

- 対象 Issue に `ai-ready` ラベルが付いていること
- `ai-question` / `ai-blocked` が付いていないこと

### 使い方

| コマンド | 投稿場所 | 動作 |
|---------|---------|------|
| `/run-claude plan` | Issue コメント | explorer → policy-sentinel → architect の順で分析（read-only） |
| `/run-claude implement` | Issue コメント | テスト設計 → 実装 → CI → draft PR 作成 |
| `/run-claude review` | PR コメント | reviewer subagent が差分を点検してコメント |
| `/stop` | Issue/PR コメント | `ai-blocked` を付与して AI を停止 |
| `/retry` | Issue/PR コメント | 直前のステージを再実行するよう案内 |
| `/rebase` | Issue/PR コメント | Issue に紐づく draft PR ブランチを最新化 |

> slash command は **バッククォートなし** で入力してください。`` `/run-claude plan` `` のように囲むと条件不一致で skipped になります。

---

## AI の動作ルール

### 停止条件

以下のいずれかが発生すると AI は即停止します（自動で継続しません）:

- CI 失敗
- lint 失敗
- テスト不足（受け入れ条件に対するテストが用意できない）
- policy gate 失敗（禁止変更・diff 上限・許可パス逸脱）
- 仕様不足（推測せず `ai-question` を付与して質問）

### 外部通知 Hook（任意）

`AI_NOTIFY_WEBHOOK_URL` Secret を設定すると、以下のラベル付与時に JSON を POST します。

- `ai-question`（`issue-guard`）
- `ai-blocked`（`/stop`）

### 人間の介入ポイント

| フェーズ | 主体 |
|---------|------|
| 要件定義・ゴール設定 | 人間（AI は壁打ち） |
| 設計・アーキテクチャ判断 | 人間（AI は選択肢提示） |
| 実装・テスト生成 | AI |
| レビュー・マージ判断 | **人間 100%** |

### ブランチ命名規則

AI が作成する PR のブランチ名:

```
ai/issue-<number>-<slug>
```

例: `ai/issue-123-fix-login-timeout`

### テスト方針

PR 本文に **AC → Test 対応表**（各受け入れ条件をどのテストで担保したか）を必須記載します。

テストが書けない場合の分類:

| 分類 | 状況 | AI の動作 |
|------|------|----------|
| A | 環境・外部依存で CI 上で実行不可 | draft PR 作成 + 代替担保策を記載 |
| B | テスト負債で基盤整備が先に必要 | plan で最小案を提示し停止（`ai-blocked`） |
| C | 仕様・期待値が不明 | 質問して停止（`ai-question`） |

### 自動修正の許容範囲

| OK（自動修正可） | NG（停止して人間判断） |
|------------------|----------------------|
| formatter 適用 | 仕様変更が疑われる挙動変更 |
| lint の自明修正（未使用 import 等） | タイムアウト・閾値等の非機能パラメータ変更 |
| テストのセットアップ修正 | 依存追加・設定変更（Soft Gate 対象） |

### 失敗時のリトライ上限

- `/rebase`: 最大 1 回/実行
- `/retry`: 最大 2 回
- 自動 fix: 最大 2 ラウンド（それ以上は `ai-blocked`）

### API コスト管理（`max_tokens`）

- `ai-plan`: `max_tokens: 12000`
- `ai-implement`: `max_tokens: 24000`
- `ai-review`: `max_tokens: 8000`

トークン上限に達して応答が不足した場合は、Issue/PR を分割するか、必要に応じて上限値を調整してください。

---

## Issue の書き方

### テンプレート

Issue は `.github/ISSUE_TEMPLATE/ai-issue.md` のテンプレートに従って作成してください。
必須見出しが不足している場合、`issue-guard` が `ai-question` ラベルを付与して質問します。

### 受け入れ条件（AC）のルール

- **1 項目 = 1 判定**（複合条件にしない）
- **曖昧語禁止**（「適切に」「正しく」ではなく具体的な条件を書く）
- チェックリスト形式
- 推奨: Given / When / Then 形式

---

## policy.yml 運用ガイド

### 2 層ゲート

| ゲート | 対象例 | 動作 |
|--------|--------|------|
| **Hard Gate** | `.github/workflows/**`, `migrations/**`, `policy.yml` | 原則即 FAIL（`allowed_files` 明示分は許可） |
| **Soft Gate** | `package.json`（deps）, `*.yml` / `config/**/*.yml`（config） | 例外ラベル（`allow-deps` / `allow-config`）で解除可 |

Soft Gate 対象を変更する場合は、**例外ラベル付与 + `/run-claude plan` の事前合意**が必要です。

### Bootstrap モード

`bootstrap` セクションは、初期構築フェーズで AI にワークフロー変更や大量ファイル変更を許可する仕組みです。

| 項目 | Bootstrap ON (`true`) | Bootstrap OFF (`false`) |
|------|----------------------|------------------------|
| `.github/workflows/**` の変更 | 許可（hard_gate から除外） | 原則禁止（`allowed_files` 明示分のみ許可） |
| `allowed_dirs` の拡張 | `allowed_dirs_extra` が追加される | 通常の `allowed_dirs` のみ |
| ファイル変更上限 | `bootstrap.limits` で上書き | `limits` の値を適用 |

PR ラベルでフェーズを一時的に上書きできます:

- `phase-bootstrap`: `bootstrap.allow_workflows: true` 相当として扱う
- `phase-stable`: `bootstrap.allow_workflows: false` 相当として扱う
- `phase-bootstrap` と `phase-stable` を同時付与した場合は `policy-gate` を FAIL

以下の条件を全て満たしたら `allow_workflows: false` に変更してください:

1. ワークフロー（`.github/workflows/`）の初期構築が完了した
2. CI / policy-gate が required check として動作している
3. AI にワークフロー変更を許可する必要がなくなった

> **重要**: `policy.yml` は hard_gate で保護されており、AI は変更できません。この変更は**人間が手動で**行ってください。

### セルフプロテクション

`policy.yml` と `tools/policy-gate.js` は AI による変更が二重に禁止されています:

- **レイヤー 1**: `hard_gate` ルールで検出 → FAIL
- **レイヤー 2**: `policy-gate.js` のハードコードチェックが policy 読み込み**前**に実行 → 改ざんバイパスを防止

これらを変更する PR は policy-gate が必ず FAIL するため、**admin merge** が必要です。

---

## Subagent 運用

| Subagent | 役割 | tools |
|----------|------|-------|
| `explorer` | 現状把握（変更対象候補・既存テスト・制約） | Read, Glob, Grep |
| `architect` | 設計案（方針 A/B・変更点・テスト戦略・ロールバック） | Read, Glob, Grep, WebFetch |
| `test-designer` | テスト設計（AC→Test・A/B/C 判定・代替担保） | Read, Glob, Grep |
| `policy-sentinel` | policy 適合（例外ラベル要否・上限超過見込み） | Read, Glob, Grep |
| `reviewer` | PR 差分点検（指摘・質問のみ、最終判定しない） | Read, Glob, Grep |

- plan 系 Subagent は **read-only**、`reviewer` は **最終判定しない**
- コードを変更するのは implement ステージの main Claude のみ

| コマンド | フロー |
|---------|--------|
| `/run-claude plan` | explorer → policy-sentinel → architect → main が統合してコメント |
| `/run-claude implement` | test-designer（事前設計）→ main が実装・テスト・draft PR 作成 |
| `/run-claude review` | reviewer が差分を点検 → 指摘・質問をコメントして返す |

---

## ラベル一覧

| ラベル            | 用途                                         |
| ----------------- | -------------------------------------------- |
| `ai-ready`        | AI 着手許可（誤爆防止のスイッチ）            |
| `ai-question`     | 仕様不足・質問待ち（AI 停止）                |
| `ai-blocked`      | 人間判断待ち（AI 停止）                      |
| `draft-pr`        | AI 作成のドラフト PR                         |
| `phase-bootstrap` | 初期構築フェーズ（`bootstrap` 動作へ上書き） |
| `phase-stable`    | 安定運用フェーズ（`stable` 動作へ上書き）    |
| `allow-deps`      | 依存ファイル変更の例外許可（Soft Gate 解除） |
| `allow-config`    | 設定ファイル変更の例外許可（Soft Gate 解除） |

定義ファイル: [`.github/labels.yml`](.github/labels.yml)

```bash
# 一括登録（gh CLI が必要）
bash tools/setup-labels.sh
```

---

## スモークテスト

### 1) issue-guard

1. 見出しをいくつか省略した Issue を作成
2. `issue-guard` が起動し、`ai-question` ラベルと不足見出しコメントが付くことを確認

### 2) ai-plan

1. Issue に `ai-ready` を付与（`ai-question` / `ai-blocked` は外す）
2. `/run-claude plan` とコメント → Claude が分析コメントを返すことを確認

### 3) ai-implement

1. Issue に `ai-ready` を付与
2. `/run-claude implement` とコメント → draft PR が作成されることを確認

### 4) ai-review

1. PR コメントに `/run-claude review` と投稿 → 差分点検コメントが返ることを確認

### トラブルシュート

- **Actions** タブで該当 Workflow Run のログを確認
- **Checks** タブで `ci` / `policy-gate` の状態を確認
- `ANTHROPIC_API_KEY` 未設定の場合はエラーになります
