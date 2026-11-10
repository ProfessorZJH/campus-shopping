#!/usr/bin/env bash
# Ubuntu 镜像源可能卡住；回退前仍须实际启动 Playwright Chromium。
set -euo pipefail

python -m playwright install chromium

deps_installed=false
for attempt in 1 2; do
  if timeout --kill-after=15s 180s python -m playwright install-deps chromium; then
    deps_installed=true
    break
  fi
  echo "::warning::Playwright system dependency installation failed or timed out (attempt ${attempt}/2)."
done

if [[ "$deps_installed" != true ]]; then
  echo '::warning::Checking whether the runner already has the required browser dependencies.'
fi

python - <<'PY'
from playwright.sync_api import sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    try:
        page = browser.new_page()
        page.set_content('<title>campus-ci</title>')
        if page.title() != 'campus-ci':
            raise RuntimeError('Chromium readiness check failed')
    finally:
        browser.close()
PY
