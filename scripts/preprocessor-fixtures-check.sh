#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PREPROCESSOR_FIXTURES_SOURCE:-}" ]]; then
  echo "[fixtures:preprocessor:check] PREPROCESSOR_FIXTURES_SOURCE is required." >&2
  echo "[fixtures:preprocessor:check] Example: PREPROCESSOR_FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/preprocessor npm run fixtures:preprocessor:check" >&2
  exit 1
fi

SOURCE_DIR="$PREPROCESSOR_FIXTURES_SOURCE"
TARGET_DIR="tests/fixtures/preprocessor"

echo "[fixtures:preprocessor:check] Using source fixture directory: $SOURCE_DIR"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[fixtures:preprocessor:check] Source fixture directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "[fixtures:preprocessor:check] Target fixture directory not found: $TARGET_DIR" >&2
  echo "[fixtures:preprocessor:check] Run 'npm run fixtures:preprocessor:sync' first." >&2
  exit 1
fi

if diff -ru "$SOURCE_DIR" "$TARGET_DIR" >/dev/null; then
  echo "[fixtures:preprocessor:check] Fixtures are up to date."
  exit 0
fi

echo "[fixtures:preprocessor:check] Fixture drift detected between '$SOURCE_DIR' and '$TARGET_DIR'." >&2
echo "[fixtures:preprocessor:check] Run 'npm run fixtures:preprocessor:sync' to refresh local fixtures." >&2

diff -ru "$SOURCE_DIR" "$TARGET_DIR" || true
exit 1
