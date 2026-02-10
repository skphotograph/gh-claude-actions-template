# Claude Code × GitHub Actions 運用方針（個人開発・統合版：Subagent反映済）

## 1. 目的と到達ライン

### 1.1 到達ライン（現時点）

- **自動化完了の定義：自動マージまで**
  - Issue起票 → AI実装 → PR作成 → CI → 人間レビュー承認 → GitHub Auto-merge によるマージ

### 1.2 失敗時の停止条件（即停止）

- 以下いずれかで **即停止**（自動的に継続しない）
  - CI 失敗
  - lint 失敗
  - テスト不足（受け入れ条件に対するテストが用意できない、または代替担保が提示できない）
  - policy gate 失敗（禁止変更・diff上限・許可パス逸脱 等）

### 1.3 人間の介入ポイント（固定）

1. 要件定義・ゴール設定（人間主体、AIは壁打ち）
2. 設計・アーキテクチャ判断（選択肢提示はAI、決定は人間）
3. タスク分解・チケット化（共同作業）
4. 実装（AI主導）
5. テスト生成（AI主導）
6. レビュー・マージ判断（**人間100%**）

---

## 2. Issue 運用設計（AIが読める入力フォーマット）

### 2.1 基本思想

- **人間が読んで分かる**
- **AIが構造として読める**
- **見出し固定・順序固定・箇条書き基本**

### 2.2 Issueテンプレ（固定）

- 見出しは固定、順序も固定とする

```md
## 🎯 目的（Why）

- このIssueで解決したい問題
- 背景・業務的理由

## 📌 仕様（What）

- 実装する機能の振る舞い
- API / 画面 / バッチ 等の対象
- 入力と出力

## ✅ 受け入れ条件（Acceptance Criteria）

- [ ] 条件1
- [ ] 条件2
- [ ] 条件3

## 🧪 テスト観点

- 正常系：
- 異常系：
- 境界値：

## ⚙ 非機能要件

- 性能：
- セキュリティ：
- ログ：
- 例外処理：

## 🔄 影響範囲

- 変更されるモジュール
- 影響を受ける機能
- 互換性への影響

## ⛓ 制約・前提

- 使用技術
- 変更不可な仕様
- 参考資料・既存実装

## ❓ 未確定・要確認事項

- 現時点で決まっていない点
```

### 2.3 ラベル設計

| ラベル            | 意味                                               |
| ----------------- | -------------------------------------------------- |
| `ai-ready`        | AIが着手可能（誤爆防止の許可スイッチ）             |
| `ai-question`     | 仕様不足・質問待ち（AIは停止）                     |
| `ai-blocked`      | 人間判断が必要（AIは停止）                         |
| `draft-pr`        | ドラフトPR作成済                                   |
| `safe-to-merge`   | 人間が最終OK（Auto-merge有効化の合図）             |
| `phase-bootstrap` | 初期構築・探索フェーズ（仕様変更を儀式化して許容） |
| `phase-stable`    | 安定運用フェーズ（デフォルト扱い）                 |
| `allow-deps`      | 依存ファイル変更を例外許可（Soft Gate解除）        |
| `allow-config`    | 設定ファイル変更を例外許可（Soft Gate解除）        |

### 2.4 受け入れ条件（AC）の書き方ルール

- 原則
  - 自然言語 + 構造（推奨：Given/When/Then）
  - **1項目 = 1判定**
  - **曖昧語禁止**
  - チェックリスト化
  - AIが Done / Not Done を判定できる（PR作成時に検証可能）
  - レビュー観点がズレない

### 2.5 仕様不足の扱い（推測しない）

- 原則：**推測しない。質問する。止まる。**
- パターンA：Issue作成時に不足
  - AIの挙動
    - `ai-ready` を外す（もしくは付与しない）
    - `ai-question` を付与
    - コメントで質問を返して停止
- パターンB：実装途中で曖昧さ発見
  - AIの挙動
    - ドラフトPRを作成
    - 未確定部分に `TODO(spec)` コメント
    - PRを draft のまま止める（マージ不可）

---

## 3. 自動化トリガーとイベント設計（個人開発向け）

### 3.1 トリガー方針（A：ラベル＋コメント）

- ラベルは「AIに触らせてよい」の許可スイッチ
  - `ai-ready` が付いていることを前提にする
- 起動は **コメントコマンドで明示的に実行（誤爆ゼロ寄せ）**
  - plan：`/run-claude plan` のみ
  - implement：`/run-claude implement` のみ
  - review：`/run-claude review` のみ

### 3.2 Issue作成時トリガー（補助：解析のみ）

- `issues.opened`
- やってよいこと
  - テンプレ検査
  - 仕様不足チェック
  - 質問コメント
  - ラベル自動付与（例：`ai-question`）
- やらないこと
  - **勝手にコーディング開始しない**

### 3.3 誤爆防止のガード

- ガード①：ラベル必須
  - `ai-ready` が必須
  - `ai-blocked` / `ai-question` が付いていたら即停止
- ガード②：対象範囲（dir/repo/branch）
  - PR差分が `allowed_dirs` に収まる場合のみ
- ガード③：二重実行防止（concurrency）
  - 同一Issue/PRで二重に走らない
  - cancel-in-progress を基本とする

### 3.4 コメントコマンド体系（slash-command-dispatch）

- コマンド例
  - `/run-claude plan`
  - `/run-claude implement`
  - `/run-claude review`
  - `/retry`
  - `/rebase`
  - `/stop`（中断：`ai-blocked` 付与）

---

## 4. Claude Code にやらせる作業分割（ステージ運用）

### 4.1 基本方針

- 1回で全部やらせない
- 1ステージ = 1成果物（出力が明確）
- 各ステージにゲート（停止条件）を置く

### 4.2 ステージ定義

- Stage 0: 解析（現状把握）
  - 出力：変更対象候補、既存仕様/テスト/制約要約、リスク
  - 停止条件：仕様不足 → `ai-question` で質問して終了
- Stage 1: 設計案（plan）
  - 出力：方針A/B、変更点リスト（ファイル単位）、テスト戦略、ロールバック
  - 制約：原則 read-only（コード変更禁止）
  - 停止条件：影響範囲上限超過見込み → 縮小して再提案
- Stage 2: 実装（implement）
  - 出力：コード変更、変更理由メモ（PR本文に転用）
  - 停止条件：禁止事項に触れそう → 変更せず停止（質問/相談）
- Stage 3: テスト追加（test）
  - 出力：テスト追加/更新、ACとのトレース
  - 停止条件：テストが書けない → ルールに従い停止（後述）
- Stage 4: リファクタ（refactor）
  - 原則：別PR推奨（事故率低下）
- Stage 5: ドキュメント（docs）
  - 出力：README/ADR/API doc 等の必要最小
- Stage 6: PR本文生成（pr）
  - 出力：固定テンプレ（目的/変更点/テスト/影響/リスク/rollback）

---

## 5. 変更範囲ルール（Policy gate）

### 5.1 allowed_dirs（初期）

- `src/**`
- `test/**`
- `docs/**`

### 5.2 変更範囲上限（初期値の例）

- `max_files_changed`：5〜10
- `max_diff_lines`：200〜300
- `max_new_files`：3
- `max_deleted_files`：0〜1

### 5.3 2層ゲート

#### Hard Gate（例外なし：触れたら即停止）

- `.github/workflows/**`
- `migrations/**` / `ddl/**`（存在するなら）

#### Soft Gate（例外ラベルで解除可能）

- 依存：`package.json` / `pom.xml` / `build.gradle*`（例外ラベル：`allow-deps`）
- 設定：`*.yml` / `*.yaml` / `*.properties`（例外ラベル：`allow-config`）

### 5.4 例外の出し方（ラベル運用）

- 例外が必要ならラベルで明示
  - `allow-deps`
  - `allow-config`
- 例外ラベルが無い限り、対象変更が発生した時点で **停止**（draftで留める）

### 5.5 依存/設定変更の運用（合意プロセス）

- 依存/設定に触れる変更は、例外ラベル付与に加えて以下を必須化
  1. `/run-claude plan` を先に実施（方針・影響・ロールバックを確認）
  2. 合意後に `/run-claude implement`

---

## 6. テスト方針（AC↔テストのトレーサビリティ）

### 6.1 PR本文に AC→Test 対応表を必須化

- PR本文に「各ACをどのテストで担保したか」を必ず記載
- 未カバーACがある場合は理由と次アクションを記載（原則 safe-to-merge 付与不可）

### 6.2 “テストが書けない” の定義と扱い（A/B/C）

#### 分類

- A. 環境・外部依存によりCI上で物理的に実行できない（E2E環境なし等）
- B. テスト負債により、テストを書くには先に最小リファクタ/基盤整備が必要
- C. 仕様/期待値が不明でassertを定義できない（情報不足）

#### AIの標準動作

- C：推測せず質問して停止（`ai-question`）。必要なら draft PR + `TODO(spec)` で留める
- B：planで「テスト可能化の最小案」を提示し、implementは原則停止（`ai-blocked`）または draft で留める
- A：実装は draft PR として作成可。ただしPR本文に以下を必須記載
  - “書けない”理由（A/B/C）
  - 代替担保策（代替テスト or 手動検証手順）
  - 残課題のIssue化（任意だが推奨）

---

## 7. Auto-fix（自動修正）の許容範囲

### 7.1 自動fix OK

- formatter適用（prettier/spotless等）
- lintの自明修正（未使用import、単純な規約違反）
- テストの単純なセットアップ修正（mock/fixture不足など）
  - 条件：仕様変更なし／期待値の仕様変更が疑われないこと

### 7.2 自動fix NG（停止して人間判断）

- 仕様変更が疑われる挙動変更
- タイムアウト/閾値/リトライ回数など非機能パラメータ変更
- 依存追加・設定変更（Soft Gate対象）
  - 例外ラベル（`allow-deps` / `allow-config`）＋ plan 合意が必要

---

## 8. GitHub Actions 構成（最小）

### 8.1 方針

- Claude Code は **GitHub Actions 上で実行**
- 実行環境：**GitHub-hosted runner**
- 起動方式：**Claude Code Action（公式）**
- コメントコマンド：**slash-command-dispatch**
- マージ：**GitHub Auto-merge + Branch protection**

### 8.2 ワークフロー分離（最小5本）

1. `ci.yml`
   - `pull_request`
   - CI入口コマンドを実行（required checksの本体）
2. `policy-gate.yml`
   - `pull_request`
   - policy.yml に基づく差分判定（required check）
3. `issue-guard.yml`
   - `issues.opened`
   - テンプレ検査／仕様不足なら `ai-question` 付与 + 質問コメント
   - コーディングはしない
4. `ai-plan.yml`
   - コメント起動：`/run-claude plan`
   - read-only（設計案・影響範囲・質問）
5. `ai-implement.yml`
   - コメント起動：`/run-claude implement`
   - 実装＋テスト＋draft PR作成（policy gate必須）
6. `ai-review.yml`
   - コメント起動：`/run-claude review`
   - PR差分/PR本文の点検（指摘・質問のみ）
7. `enable-automerge.yml`
   - `pull_request.labeled`
   - `safe-to-merge` を検知して Auto-merge を有効化

### 8.3 最小権限（permissions）方針

- デフォルトは read-only
- 必要ワークフローだけ個別に権限を上げる
  - plan：`contents: read`, `issues: write`
  - implement：`contents: write`, `pull-requests: write`, `issues: write`
  - review：`pull-requests: write`（コメント投稿が必要な場合）
  - enable-automerge：`pull-requests: write`

### 8.4 ログと証跡（Artifacts + コメント）

- すべての実行で以下を残す
  - mode（plan/implement/review/fix）
  - 対象（Issue/PR番号、base、branch）
  - 開始時点のHEAD SHA
  - **Issue更新日時（`updated_at`）**
  - Policy判定結果（変更ファイル一覧、diff統計）
  - Result（テスト結果要約）
  - Run ID（GitHub run id）

---

## 9. PR運用と自動マージ

### 9.1 ブランチ命名規則

- `ai/issue-<number>-<slug>`
  - 例：`ai/issue-123-fix-login-timeout`
- 再実行で衝突を避ける場合は末尾に実行ID等を付与可
  - 例：`ai/issue-123-fix-login-timeout-r20260207-1`

### 9.2 PR作成方針

- AIがPRを作成（原則 draft）
- PR本文は固定テンプレで生成（目的/変更点/AC→Test/影響/リスク/rollback）
- `draft-pr` ラベルを付与して状態を明示

### 9.3 Auto-mergeの扱い（safe-to-merge連動）

- `safe-to-merge` は **人間（あなた）のみが付与**
- `safe-to-merge` が付与されたら `enable-automerge.yml` が Auto-merge を有効化
- required checks が揃った時点で GitHub が自動でマージ

---

## 10. 初期構築（phase-bootstrap）運用

### 10.1 基本方針

- 初期構築は仕様が動く前提のため、仕様変更を禁止せず **儀式化して許容**
- `phase-bootstrap` が付いているIssue/PRでは以下を必須化
  - PR本文に「仕様決定ログ（決定事項・変更点）」を記載
  - 依存/設定に触れる場合は `allow-deps` / `allow-config` + plan必須

### 10.2 安定運用（phase-stable）

- デフォルトは `phase-stable` 扱い
- 仕様曖昧は推測せず質問→停止
- 例外ラベルの利用は必要時のみ（plan必須を徹底）

---

## 11. 失敗時運用（標準動作）

### 11.1 失敗分類

- 仕様不足（Spec Gap）
- コンフリクト（Conflict）
- テスト失敗（実装バグ / フレーク / テスト負債 / 期待値変更）
- 環境不備（Env/Tooling）

### 11.2 自動リカバリ（上限あり）

- `/rebase`：最大1回/実行
- `/retry`：最大2回（flake判定含む）
- 自動fix：最大2ラウンド（それ以上は `ai-blocked`）

### 11.3 フィードバック方針

- 失敗したゲート名、原因、次アクションを必ず提示
- AIが直せるもの（format/lintの安全なfix等）は自動修正可（許容範囲内）
- 仕様変更や危険領域に触れるものは停止して人間判断を要求

---

## 12. 複数アプリ開発時のテンプレ運用（Template repository）

### 12.1 方針

- 本運用一式を **GitHub Template repository** として管理し、新規アプリはテンプレから作成する

### 12.2 テンプレに含めるもの（共通化）

- `.github/workflows/`（CI / policy / guard / plan / implement / review / enable-automerge）
- Issue/PRテンプレ
- policy gate スクリプト本体
- 実行ログ出力フォーマット（コメント＋Artifacts）

### 12.3 アプリごとに差し替えるもの（パラメータ化）

- CI入口コマンド（例：`make ci` / `npm run ci` / `mvn test`）
- `allowed_dirs`（リポジトリ構造に合わせる）
- 依存/設定ファイルの種類（言語により変更）
- diff上限（規模により変更）

### 12.4 今の段階で入れておくとテンプレ再利用がラクになる工夫（必須）

1. policy gate の設定を `policy.yml` に切り出す
2. CI入口コマンドを「1コマンド」に統一し、テンプレ側はそれを呼ぶだけにする

---

## 13. Subagent 運用（品質と速度の両立）

### 13.1 方針

- Subagent は **両方**採用する
  - 調査・設計・テスト観点整理（前工程の品質安定）
  - PRレビュー（後工程の取りこぼし検知）
- 起動は原則 **手動コマンド**で行う

### 13.2 初期セット

- `explorer`：現状把握（影響範囲/既存仕様/既存テスト）
- `architect`：設計案（方針A/B、変更点、テスト戦略、ロールバック）
- `test-designer`：テスト設計（AC→Test、A/B/C判定、代替担保）
- `policy-sentinel`：policy適合（例外ラベル要否、上限超過見込み）

### 13.3 PRレビュー用 Subagent

- `reviewer` を追加する
- 起動コマンド：`/run-claude review`

### 13.4 委譲順

- `/run-claude plan`
  - `explorer` → `policy-sentinel` → `architect` → mainが統合してコメント
- `/run-claude implement`
  - `test-designer`（事前）→ mainが実装/テスト/PR作成
- `/run-claude review`
  - `reviewer` が点検し、指摘・質問のみ返す

### 13.5 共通ルール

- plan系Subagentは **read-only**
- `reviewer` は **最終判定しない**
- `safe-to-merge` は **あなたのみが操作**
- Soft Gate領域は **例外ラベル＋plan合意必須**
