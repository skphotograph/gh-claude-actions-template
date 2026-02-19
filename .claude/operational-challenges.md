# テンプレートリポジトリ 課題一覧

派生リポジトリで開発を始めた際に問題になる事項を、
**テンプレートとして事前に解決しておくべきもの** に絞って重要度順に整理する。

> 派生リポジトリ固有の設定作業（`tools/ci.sh` の実装、`allowed_dirs` の調整、
> bootstrap OFF 切替など）は README セットアップチェックリストでカバー済みのため、
> ここには含めない。

---

## A. テンプレートの仕組み不備（機能しない設計がある）

### A-1. Soft Gate のラベル連動が未実装【重大】 ✅ 対応済み（2026-02-19 / `fix/a1-soft-gate-label-control`）

- **対象**: `.github/workflows/policy-gate.yml` L29-30
- **状況**: `ALLOW_DEPS: 'false'`、`ALLOW_CONFIG: 'true'` がハードコード。PR ラベル（`allow-deps` / `allow-config`）を動的に読み取るロジックが存在しない
- **影響**: Soft Gate の設計意図（ラベルで例外許可を制御）が全く機能していない。`ALLOW_CONFIG: 'true'` により設定ファイル変更が常時素通し
- **対応**: PR ラベルを取得して環境変数に反映するステップを追加

### A-2. `allowed_files` と `hard_gate` の評価順矛盾【重要】 ✅ 対応済み（2026-02-19 / `fix/a2-allowed-files-priority`）

- **対象**: `policy.yml` L10-11 vs L20, `tools/policy-gate.js` L267-283
- **状況**: `.github/workflows/ci.yml` 等が `allowed_files` に含まれるが、`hard_gate` の `.github/workflows/**` が先に評価されて即 FAIL。Bootstrap OFF 時に `allowed_files` が無意味
- **影響**: 「特定ワークフローだけ AI に変更許可」という意図が実現できない
- **対応**: `policy-gate.js` で `allowed_files` を hard_gate より優先評価するか、矛盾するエントリを整理する

### A-3. `phase-bootstrap` / `phase-stable` ラベルが未使用【中】 ✅ 対応済み（2026-02-19 / `fix/a3-phase-labels-bootstrap-control`）

- **対象**: `.github/labels.yml` L21-27
- **状況**: ラベル定義はあるが、どのワークフローでも参照されていない。bootstrap 判定は `policy.yml` の `allow_workflows` フラグのみで行われる
- **影響**: ラベルが飾りになっており、運用者に混乱を与える。ラベルを切り替えても何も起きない
- **対応**: ワークフローでラベルを参照するか、使わないなら定義を削除する

### A-4. Soft Gate の config パターンが広すぎる【中】 ✅ 対応済み（2026-02-19 / `fix/a4-narrow-soft-gate-config-patterns`）

- **対象**: `policy.yml` L35-37 (`**/*.yml`, `**/*.yaml`)
- **状況**: `allowed_dirs` 内のテスト fixture 等にもマッチする。A-1 と合わせて YAML 変更が実質無制御
- **影響**: 派生リポジトリでも同じパターンが引き継がれ、意図しないファイルが soft gate 対象になる
- **対応**: ルート直下や特定ディレクトリに限定する（例: `*.yml`, `config/**/*.yml`）

---

## B. テンプレートの機能不足（あると派生リポジトリの運用が楽になる）

### B-1. `/retry` が実際のリトライを行わない【中】

- **対象**: `.github/workflows/slash-commands.yml` L68-122
- **状況**: 再実行コマンドを案内するだけで、ワークフローをトリガーしない
- **影響**: ユーザーが手動で再コメントする必要がある。特に AI 停止→修正→再実行のサイクルで摩擦が大きい
- **対応**: `github-script` から直接コメントを作成してワークフローをトリガーする方式を検討

### B-2. issue-guard が Issue 編集時に再検証しない【中】

- **対象**: `.github/workflows/issue-guard.yml` L4-5
- **状況**: `issues: [opened]` のみ。Issue 編集で見出しを補完しても `ai-question` が自動で外れない
- **影響**: 毎回手動でラベルを付け外しする運用負担
- **対応**: `edited` イベントを追加し、全見出し揃ったら `ai-question` を自動除去

### B-3. CLAUDE.md のスケルトンがない【低〜中】

- **対象**: リポジトリルート
- **状況**: `CLAUDE.md` が存在しない。かつ `allowed_files` にも含まれていないため、AI が作成もできない
- **影響**: 派生リポジトリで AI にプロジェクト固有の規約を伝える手段がテンプレートに組み込まれていない
- **対応**: テンプレートにスケルトンを配置し、`allowed_files` に追加する

### B-4. .gitignore が存在しない【低】

- **対象**: リポジトリルート
- **状況**: テンプレートに `.gitignore` がない
- **影響**: 派生リポジトリで node_modules、.env 等が誤コミットされるリスク。AI が生成したファイルも全てトラッキング対象になる
- **対応**: 汎用的な `.gitignore`（Node / Python / IDE 等）のスケルトンを配置する

---

## C. 設計判断が必要（意図的かもしれないが確認が要る）

### C-1. Concurrency グループが plan / implement で共有【低〜中】

- **対象**: `ai-plan.yml` L13-14, `ai-implement.yml` L13-14
- **状況**: 同一 Issue 番号で同じ concurrency グループ。plan 中に implement をコメントすると plan がキャンセルされる
- **論点**: 二重実行防止として意図的か、plan → implement の順序保証を壊すリスクか
- **案**: グループ名にステージ名を含める（`run-claude-plan-{N}` / `run-claude-impl-{N}`）

### C-2. API コスト管理の仕組みがない【低〜中】

- **対象**: 全 AI ワークフロー
- **状況**: トークン上限・月次バジェット・実行回数制限がない
- **論点**: テンプレートで対応すべきか、派生リポジトリの運用に委ねるか
- **案**: `claude-code-action` の `max_tokens` パラメータ活用、または README に推奨設定を記載

### C-3. AI 停止時の外部通知がない【低】

- **対象**: 全 AI ワークフロー
- **状況**: `ai-blocked` / `ai-question` 付与時に Issue コメントのみ。Slack 等への通知なし
- **論点**: 通知先はプロジェクト固有のため、テンプレートに含めるべきか
- **案**: hook ポイント（reusable workflow / composite action）だけ用意し、通知先は派生側で設定

---

> 最終更新: 2026-02-19
