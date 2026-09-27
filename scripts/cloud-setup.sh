#!/usr/bin/env bash
# Setup for Claude Code on the web (cloud sessions) — paste this whole file into the cloud environment's
# "Setup script" (claude.ai/code → environment settings), or run `bash scripts/cloud-setup.sh` inside a session.
# Self-contained on purpose: it does not assume the repo is already cloned. Safe to re-run.
#
# 1) Playwright + Chromium outside the repo (same pinned version as .github/workflows/qa.yml), so the
#    *-qa.cjs / *-check.cjs scripts run with NODE_PATH=$HOME/.pw/node_modules — no package.json changes.
#    The default "Trusted" network level does NOT allow Playwright's browser CDN: set the environment's network
#    access to Custom and add cdn.playwright.dev + playwright.download.prss.microsoft.com (+ playwright.azureedge.net).
# 2) The team's Claude memory (private repo mlpditto/INTERN-PORT-claude-memory) into ~/intern-port-memory,
#    read-only context for cloud sessions (see "Working in a cloud session" in CLAUDE.md). Needs the Claude
#    GitHub App installed on that repo AND the repo attached to the session (the GitHub proxy only reaches
#    attached repos); if not, this step is skipped and the session still works.
set -u

PW_DIR="$HOME/.pw"
PW_VERSION="1.56.1"
if [ ! -x "$PW_DIR/node_modules/.bin/playwright" ]; then
  echo "[cloud-setup] installing playwright@$PW_VERSION into $PW_DIR"
  npm install --no-save --no-audit --no-fund --prefix "$PW_DIR" "playwright@$PW_VERSION" \
    || echo "[cloud-setup] WARN: npm install playwright failed"
fi
if [ -x "$PW_DIR/node_modules/.bin/playwright" ]; then
  "$PW_DIR/node_modules/.bin/playwright" install --with-deps chromium \
    || "$PW_DIR/node_modules/.bin/playwright" install chromium \
    || echo "[cloud-setup] WARN: chromium download failed (network level may block the Playwright CDN)"
fi

MEM_DIR="$HOME/intern-port-memory"
if [ -d "$MEM_DIR/.git" ]; then
  git -C "$MEM_DIR" pull --ff-only -q || echo "[cloud-setup] WARN: memory pull failed"
else
  git clone -q --depth 1 https://github.com/mlpditto/INTERN-PORT-claude-memory.git "$MEM_DIR" \
    && echo "[cloud-setup] memory cloned to $MEM_DIR" \
    || echo "[cloud-setup] WARN: memory repo not reachable — grant the Claude GitHub App access to mlpditto/INTERN-PORT-claude-memory"
fi

echo "[cloud-setup] done. Run QA with: NODE_PATH=$PW_DIR/node_modules bash scripts/run-qa.sh"
exit 0
