#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${FIXTURES_SOURCE:-../context-compiler/tests/fixtures/conformance}"
TARGET_DIR="tests/fixtures/conformance"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[fixtures:check] Source fixture directory not found: $SOURCE_DIR" >&2
  echo "[fixtures:check] Set FIXTURES_SOURCE to override the default source path." >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "[fixtures:check] Target fixture directory not found: $TARGET_DIR" >&2
  echo "[fixtures:check] Run 'npm run fixtures:sync' first." >&2
  exit 1
fi

if diff -ru "$SOURCE_DIR" "$TARGET_DIR" >/dev/null; then
  echo "[fixtures:check] Fixtures are up to date."
  exit 0
fi

echo "[fixtures:check] Fixture drift detected between '$SOURCE_DIR' and '$TARGET_DIR'." >&2
echo "[fixtures:check] Run 'npm run fixtures:sync' to refresh local fixtures." >&2

diff -ru "$SOURCE_DIR" "$TARGET_DIR" || true
exit 1
