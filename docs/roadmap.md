# Claude Code × GitHub Actions ロードマップ（テンプレRepo先行・Subagent反映済）

## Phase 0：アカウント・課金・前提（PCまっさら）

1. GitHubアカウント作成・2FA ✅
2. Anthropic（Claude）API Key 発行（後で `ANTHROPIC_API_KEY` として使う） ⬜（未実施）

---

## Phase 1：テンプレ用リポジトリ作成（ここが本体）

1. Template repository 新規作成（Template ON） ✅
2. 骨格作成 ✅
   - `.github/` ✅
   - `.github/workflows/` ✅
   - `tools/` ✅
   - `policy.yml` ✅

---

## Phase 2：品質ゲートを完成（AI導入前）

1. `policy.yml` を確定（Hard/Soft/allowed_dirs/上限） ✅（暫定確定）
   - `allowed_dirs` に `tools/**` を追加済み
   - `allowed_files` に一部workflowを例外許可済み（`policy.yml` 自身は除外 → hard_gate + self-protection で保護）
   - `bootstrap.allow_workflows: true` と `bootstrap.allowed_dirs_extra` で初期構築時のworkflow改修を許容
   - soft gate（deps/config）は `ALLOW_DEPS` / `ALLOW_CONFIG` で解除する仕様まで実装済み
2. `policy-gate.yml`（PR差分判定）作成 → required check化 ✅
   - PR上でチェック名 **`policy-gate`** がRequiredになっていることを確認済み
3. `ci.yml`（PRでCI入口コマンド実行）作成 → required check化 ✅
   - PR上でチェック名 **`ci`** がRequiredになっていることを確認済み
4. PRテンプレ・Issueテンプレ導入 ✅
   - `.github/ISSUE_TEMPLATE/ai-issue.md`：作成済
   - `.github/PULL_REQUEST_TEMPLATE.md`：作成済

---

## Phase 3：ラベル運用・導入手順の整備

1. 必須ラベル一覧を README 化 ✅
2. ラベル投入方式を決める ✅
   - `.github/labels.yml` + `tools/setup-labels.sh`（GitHub CLI）で一括登録

---

## Phase 4：Subagent をテンプレに同梱（project-level）

1. 初期4体を作成 ✅
   - `explorer`, `architect`, `test-designer`, `policy-sentinel`
2. Subagent共通ルール（read-only等）を README に明記 ✅
3. `/run-claude plan` と `/run-claude implement` の委譲順を README に明記 ✅

---

## Phase 5：コメントコマンド基盤（slash-command-dispatch）

1. `/run-claude plan` / `/run-claude implement` / `/retry` / `/rebase` / `/stop` を実装 ✅
2. concurrency（Issue/PR単位）導入 ✅

---

## Phase 6：Claude Code Action 導入（plan → implement）

1. Secrets設計を README に記載（各アプリRepoで `ANTHROPIC_API_KEY` 設定） ✅
2. `ai-plan.yml`（コメント起動のみ、read-only） ✅（claude-code-action 統合）
3. `ai-implement.yml`（コメント起動のみ、draft PR作成） ✅（claude-code-action 統合）

---

## Phase 7：PRレビュー用 Subagent と reviewコマンド

1. `reviewer` Subagent 作成 ✅
2. `ai-review.yml`（`/run-claude review`）導入 ✅（claude-code-action 統合）

---

## Phase 8：テンプレ完成判定

- policy gate / CI / issue-guard / plan / implement / review が揃い ✅
- README に「各アプリRepoでやること（Secrets、Branch protection等）」が明記されている ✅

### 進捗メモ（2026-02）

- ✅ 完了（Phase 1-3）
  - Template repo化（Template ON）
  - `policy.yml` + `tools/policy-gate.js` の実装（globの正規表現バグ修正含む）
  - `policy-gate` workflow 作成・PRで動作
  - `ci` workflow 作成（required checkとして見える）
  - **Ruleset適用で main 直push禁止**
  - required checks `ci` / `policy-gate` が揃うまで **Mergeがブロックされる**ことを確認
- ✅ 解消済み
  - `tools/ci.sh` のプレースホルダー確定（"No such file" 解消済み、`bash tools/ci.sh` で pass）
- ❌ 採用しない方針に確定
  - `safe-to-merge` / `enable-automerge` によるAuto-merge（不安定・手間対効果が薄いため撤回）
  - マージ方針：**手動マージ固定（A運用）**
- ✅ 完了（Phase 4-8）
  - Phase 4: `.claude/agents/`（explorer / architect / test-designer / policy-sentinel）作成
  - Phase 5: concurrency 追加 + `slash-commands.yml`（`/retry` `/rebase` `/stop`）追加
  - Phase 6: `ai-plan.yml` / `ai-implement.yml` を `claude-code-action@v1` 統合版に更新、Secrets設計をREADMEに追記
  - Phase 7: `.claude/agents/reviewer.md` 作成 + `ai-review.yml` を `claude-code-action@v1` 統合版に更新
  - Phase 8: フレームワーク整備完了（policy gate / CI / issue-guard / plan / implement / review 揃い）
- ✅ セキュリティ強化
  - `policy.yml` を `allowed_files` から除外 → `hard_gate` に移動
  - `tools/policy-gate.js` も `hard_gate` に追加
  - `policy-gate.js` にハードコード self-protection を追加（ポリシー読み込み前チェック）
  - README に bootstrap 運用ガイド・派生リポジトリ向けセットアップチェックリストを追加
- スモーク結果は `docs/workflow_smoke_results.md` を参照
- マージ方針は手動マージ固定（safe-to-merge / enable-automerge 不使用）
- `anthropics/claude-code-action@v1` の実際の入力パラメータはリリース時に要確認

---

## Phase 9：第1アプリ作成（テンプレから派生）

1. テンプレから新規アプリRepo作成 ⬜
2. Secrets設定（`ANTHROPIC_API_KEY`） ⬜
3. Branch protection / Ruleset 設定 ⬜
4. アプリ側で CI入口コマンド（例：`make ci`）を整備し、CIを緑にする ⬜
5. `policy.yml` をリポ構造に合わせて調整 ⬜
6. 最短動作確認 ⬜
   - Issue → `ai-ready` → `/run-claude plan` → `/run-claude implement` → draft PR → `/run-claude review` → merge

---

## Phase 10：第2アプリ以降（横展開）

- Template repository から作成 ⬜
- アプリ側の差分は基本 `policy.yml` と CI入口コマンドのみ ⬜
