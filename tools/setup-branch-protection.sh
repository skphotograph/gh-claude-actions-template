#!/usr/bin/env bash
# setup-branch-protection.sh — Branch protection を GitHub Repo に適用する
#
# 使い方:
#   gh auth login  # 初回のみ
#   bash tools/setup-branch-protection.sh [OWNER/REPO] [BRANCH]
#
# 引数省略時:
#   OWNER/REPO: git remote origin から自動検出
#   BRANCH: main

set -euo pipefail

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

BRANCH="${2:-main}"
ENC_BRANCH="${BRANCH//\//%2F}"

echo "[setup-branch-protection] ターゲット: $REPO"
echo "[setup-branch-protection] ブランチ: $BRANCH"
echo "[setup-branch-protection] ルール: required checks (ci, policy-gate)"

gh api \
  --method PUT \
  --header "Accept: application/vnd.github+json" \
  "/repos/$REPO/branches/$ENC_BRANCH/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "ci",
      "policy-gate"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON

echo "[setup-branch-protection] 完了"
