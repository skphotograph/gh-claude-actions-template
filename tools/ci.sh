#!/usr/bin/env bash
set -euo pipefail

echo "[ci] START"

# テンプレートのデフォルト：プロジェクト固有の CI はまだ定義されていません。
# 派生（このテンプレートを元にした）リポジトリでは、実際に実行するコマンドをここに実装してください。
# 当面は、ここを明示的にしておき、いまはとにかく CI が通る（グリーンになる）状態にしておきます。
if [[ -f package.json ]]; then
  echo "[ci] Detected Node project: implement npm ci/test here in derived repo."
fi

if [[ -f pom.xml ]]; then
  echo "[ci] Detected Maven project: implement mvn test here in derived repo."
fi

echo "[ci] PASS (template placeholder)"
