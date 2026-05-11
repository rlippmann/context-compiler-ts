#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${STRUCTURED_FIXTURES_SOURCE:-}" ]]; then
  echo "[fixtures:structured:check] STRUCTURED_FIXTURES_SOURCE is required." >&2
  echo "[fixtures:structured:check] Example: STRUCTURED_FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/engine-regression/structured npm run fixtures:structured:check" >&2
  exit 1
fi

SOURCE_DIR="$STRUCTURED_FIXTURES_SOURCE"
TARGET_DIR="tests/fixtures/engine-regression/structured"

echo "[fixtures:structured:check] Using source fixture directory: $SOURCE_DIR"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[fixtures:structured:check] Source fixture directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "[fixtures:structured:check] Target fixture directory not found: $TARGET_DIR" >&2
  echo "[fixtures:structured:check] Run 'npm run fixtures:structured:sync' first." >&2
  exit 1
fi

if diff -ru "$SOURCE_DIR" "$TARGET_DIR" >/dev/null; then
  echo "[fixtures:structured:check] Fixtures are up to date."
  exit 0
fi

echo "[fixtures:structured:check] Fixture drift detected between '$SOURCE_DIR' and '$TARGET_DIR'." >&2
diff -ru "$SOURCE_DIR" "$TARGET_DIR" || true
exit 1
