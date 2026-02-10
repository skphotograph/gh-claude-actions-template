# Claude Code × GitHub Actions ロードマップ（テンプレRepo先行・Subagent反映済）

## Phase 0：アカウント・課金・前提（PCまっさら）

1. GitHubアカウント作成・2FA
2. Anthropic（Claude）契約・API Key 発行（後で `ANTHROPIC_API_KEY` として使う）

---

## Phase 1：テンプレ用リポジトリ作成（ここが本体）

1. Template repository 新規作成（Template ON）
2. 骨格作成
   - `.github/`
   - `.github/workflows/`
   - `tools/`
   - `policy.yml`

---

## Phase 2：品質ゲートを完成（AI導入前）

1. `policy.yml` を確定（Hard/Soft/allowed_dirs/上限）
2. `policy-gate.yml`（PR差分判定）作成 → required check化
3. `ci.yml`（PRでCI入口コマンド実行）作成 → required check化
4. PRテンプレ・Issueテンプレ導入

---

## Phase 3：ラベル運用・導入手順の整備

1. 必須ラベル一覧を README 化
2. ラベル投入方式を決める
   - 少数なら手動
   - 増えるなら `labels.yml` + GitHub CLI の投入手順（推奨）

---

## Phase 4：Subagent をテンプレに同梱（project-level）

1. 初期4体を作成
   - `explorer`, `architect`, `test-designer`, `policy-sentinel`
2. Subagent共通ルール（read-only等）を README に明記
3. `/run-claude plan` と `/run-claude implement` の委譲順を README に明記

---

## Phase 5：コメントコマンド基盤（slash-command-dispatch）

1. `/run-claude plan` / `/run-claude implement` / `/retry` / `/rebase` / `/stop` を実装
2. concurrency（Issue/PR単位）導入

---

## Phase 6：Claude Code Action 導入（plan → implement）

1. Secrets設計を README に記載（各アプリRepoで `ANTHROPIC_API_KEY` 設定）
2. `ai-plan.yml`（コメント起動のみ、read-only）
3. `ai-implement.yml`（コメント起動のみ、draft PR作成）

---

## Phase 7：PRレビュー用 Subagent と reviewコマンド

1. `reviewer` Subagent 作成
2. `ai-review.yml`（`/run-claude review`）導入

---

## Phase 8：safe-to-merge → Auto-merge ON

1. リポジトリで Auto-merge 許可
2. Branch protection 設定（required checks）
3. `enable-automerge.yml` 追加（`safe-to-merge` で Auto-merge 有効化）

---

## Phase 9：テンプレ完成判定

- policy gate / CI / issue-guard / plan / implement / review / enable-automerge が揃い
- README に「各アプリRepoでやること（Secrets、Branch protection等）」が明記されている

---

## Phase 10：第1アプリ作成（テンプレから派生）

1. テンプレから新規アプリRepo作成
2. Secrets設定（`ANTHROPIC_API_KEY`）
3. Branch protection / Auto-merge 設定
4. アプリ側で CI入口コマンド（例：`make ci`）を整備し、CIを緑にする
5. `policy.yml` をリポ構造に合わせて調整
6. 最短動作確認
   - Issue → `ai-ready` → `/run-claude plan` → `/run-claude implement` → draft PR → `/run-claude review` → `safe-to-merge` → Auto-merge

---

## Phase 11：第2アプリ以降（横展開）

- Template repository から作成
- アプリ側の差分は基本 `policy.yml` と CI入口コマンドのみ
