#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/fixtures-provenance.sh"

if [[ -z "${FIXTURES_SOURCE:-}" ]]; then
  echo "[fixtures:check] FIXTURES_SOURCE is required." >&2
  echo "[fixtures:check] Example: FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/conformance npm run fixtures:check" >&2
  exit 1
fi

SOURCE_DIR="$FIXTURES_SOURCE"
TARGET_DIR="tests/fixtures/conformance"

echo "[fixtures:check] Using source fixture directory: $SOURCE_DIR"

cc_verify_source_dir_matches_expected_commit "fixtures:check" "$SOURCE_DIR"

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
