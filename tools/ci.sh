#!/usr/bin/env bash
set -euo pipefail

echo "[ci] START"

# Template default: project-specific CI is not defined yet.
# Derived repos should implement their real commands here.
# Keep it explicit and green for now.
if [[ -f package.json ]]; then
  echo "[ci] Detected Node project: implement npm ci/test here in derived repo."
fi

if [[ -f pom.xml ]]; then
  echo "[ci] Detected Maven project: implement mvn test here in derived repo."
fi

echo "[ci] PASS (template placeholder)"
