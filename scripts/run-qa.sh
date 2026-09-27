#!/usr/bin/env bash
# Runs every QA script the way .github/workflows/qa.yml does (scripts/*-qa.cjs + scripts/*-check.cjs, 180 s each).
# Needs Playwright on NODE_PATH — in a cloud session: NODE_PATH=$HOME/.pw/node_modules (see scripts/cloud-setup.sh).
# Usage: bash scripts/run-qa.sh            (all)
#        bash scripts/run-qa.sh cover      (only scripts whose name contains "cover")
cd "$(dirname "$0")/.." || exit 1
export NODE_PATH="${NODE_PATH:-$HOME/.pw/node_modules}"
failed=(); total=0
for f in scripts/*-qa.cjs scripts/*-check.cjs; do
  case "$f" in *"${1:-}"*) ;; *) continue ;; esac
  total=$((total + 1))
  if timeout 180 node "$f" >/tmp/qa-out.txt 2>&1; then echo "ok   $f"; else echo "FAIL $f"; tail -5 /tmp/qa-out.txt; failed+=("$f"); fi
done
echo "QA: $((total - ${#failed[@]}))/$total passed"
[ ${#failed[@]} -eq 0 ]
