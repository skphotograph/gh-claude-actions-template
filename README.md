# Claude Code × GitHub Actions テンプレートリポジトリ

GitHub Issues からAIエージェント（Claude）が計画・実装・レビューを行うテンプレートです。
policy gate による差分制御と、人間による手動マージ運用を前提としています。

[運用方針](./docs/operation_policy.md) | [ロードマップ](./docs/roadmap.md)

---

## セットアップ（派生リポジトリ作成後）

テンプレートから新規リポジトリを作成した後、以下を順に実施してください:

- [ ] `ANTHROPIC_API_KEY` Secret を設定（Settings → Secrets → Actions）
- [ ] `bash tools/setup-labels.sh` で必須ラベルを一括登録
- [ ] Branch protection で `ci` / `policy-gate` を required check に設定
- [ ] `tools/ci.sh` にプロジェクト固有の CI コマンドを実装
- [ ] `policy.yml` の `allowed_dirs` をプロジェクト構造に合わせて調整
- [ ] 初期構築完了後、`bootstrap.allow_workflows` を `false` に変更
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

### マージ方針

**手動マージ運用**です。required checks（`ci` / `policy-gate`）が成功した PR を、人間が確認してマージします。

---

## policy.yml 運用ガイド

### Bootstrap モード

`bootstrap` セクションは、初期構築フェーズで AI エージェントにワークフロー変更や大量ファイル変更を許可する仕組みです。

| 項目 | Bootstrap ON (`true`) | Bootstrap OFF (`false`) |
|------|----------------------|------------------------|
| `.github/workflows/**` の変更 | 許可（hard_gate から除外） | 禁止（hard_gate で即 FAIL） |
| `allowed_dirs` の拡張 | `allowed_dirs_extra` が追加される | 通常の `allowed_dirs` のみ |
| ファイル変更上限 | `bootstrap.limits` で上書き | `limits` の値を適用 |

以下の条件を全て満たしたら `allow_workflows: false` に変更してください:

1. ワークフロー（`.github/workflows/`）の初期構築が完了した
2. CI / policy-gate が required check として動作している
3. AI エージェントにワークフロー変更を許可する必要がなくなった

> **重要**: `policy.yml` は hard_gate で保護されており、AI エージェントは変更できません。この変更は**人間が手動で**行ってください。

### セルフプロテクション

以下のファイルは AI エージェントによる変更が二重に禁止されています:

| 保護対象 | 防御レイヤー 1 | 防御レイヤー 2 |
|---------|---------------|---------------|
| `policy.yml` | `hard_gate` に記載 | `policy-gate.js` にハードコード |
| `tools/policy-gate.js` | `hard_gate` に記載 | `policy-gate.js` にハードコード |

- **レイヤー 1**: `policy.yml` の `hard_gate` ルールで検出 → FAIL
- **レイヤー 2**: `policy-gate.js` 内のハードコードチェックが `policy.yml` の読み込み**前**に実行 → ポリシー改ざんによるバイパスを防止

これらのファイルを変更する PR は policy-gate が必ず FAIL するため、**admin merge** が必要です。

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

| コマンド | フロー |
|---------|--------|
| `/run-claude plan` | explorer → policy-sentinel → architect → main が統合してコメント |
| `/run-claude implement` | test-designer（事前設計）→ main が実装・テスト・draft PR 作成 |
| `/run-claude review` | reviewer が差分を点検 → 指摘・質問をコメントして返す |

---

## ラベル一覧

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
