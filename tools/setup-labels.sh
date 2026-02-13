#!/usr/bin/env bash
# setup-labels.sh — 必須ラベルを GitHub Repo に一括登録する
#
# 使い方:
#   gh auth login  # 初回のみ
#   bash tools/setup-labels.sh [OWNER/REPO]
#
# OWNER/REPO を省略すると、カレントディレクトリの git remote origin から自動検出します。

set -euo pipefail

LABELS_FILE=".github/labels.yml"

# --- ターゲット Repo の解決 ---
if [[ $# -ge 1 ]]; then
  REPO="$1"
else
  REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
  if [[ -z "$REMOTE" ]]; then
    echo "ERROR: git remote origin が設定されていません。引数で OWNER/REPO を指定してください。" >&2
    exit 1
  fi
  # https://github.com/OWNER/REPO.git または git@github.com:OWNER/REPO.git
  REPO=$(echo "$REMOTE" | sed -E 's|.*github\.com[:/]||; s|\.git$||')
fi

echo "[setup-labels] ターゲット: $REPO"
echo "[setup-labels] ラベルファイル: $LABELS_FILE"

if [[ ! -f "$LABELS_FILE" ]]; then
  echo "ERROR: $LABELS_FILE が見つかりません。リポジトリルートで実行してください。" >&2
  exit 1
fi

# gh label create は YAML を直接読めないので、各エントリを解析して実行する
# シンプルなパーサー: name / color / description を3行1セットとして読む
NAME=""
COLOR=""
DESC=""

create_label() {
  local name="$1" color="$2" desc="$3"
  if gh label list --repo "$REPO" --limit 100 | grep -q "^${name}"; then
    echo "  [skip] '${name}' は既に存在します"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc"
    echo "  [ok]   '${name}' を作成しました"
  fi
}

echo "[setup-labels] ラベルを登録します..."

while IFS= read -r line; do
  # コメントと空行をスキップ
  [[ "$line" =~ ^# ]] && continue
  [[ -z "${line// }" ]] && continue

  if [[ "$line" =~ ^-\ name:\ \"?(.+)\"?$ ]]; then
    # 前のエントリを確定
    if [[ -n "$NAME" && -n "$COLOR" && -n "$DESC" ]]; then
      create_label "$NAME" "$COLOR" "$DESC"
    fi
    NAME="${BASH_REMATCH[1]}"
    COLOR=""
    DESC=""
  elif [[ "$line" =~ ^\ \ color:\ \"?(.+)\"?$ ]]; then
    COLOR="${BASH_REMATCH[1]}"
  elif [[ "$line" =~ ^\ \ description:\ \"(.+)\"$ ]]; then
    DESC="${BASH_REMATCH[1]}"
  fi
done < "$LABELS_FILE"

# 最後のエントリ
if [[ -n "$NAME" && -n "$COLOR" && -n "$DESC" ]]; then
  create_label "$NAME" "$COLOR" "$DESC"
fi

echo "[setup-labels] 完了"
