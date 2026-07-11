#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/fixtures-provenance.sh"

if [[ -z "${FIXTURES_SOURCE:-}" ]]; then
  echo "[fixtures:sync] FIXTURES_SOURCE is required." >&2
  echo "[fixtures:sync] Example: FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/conformance npm run fixtures:sync" >&2
  exit 1
fi

SOURCE_DIR="$FIXTURES_SOURCE"
TARGET_DIR="tests/fixtures/conformance"

echo "[fixtures:sync] Using source fixture directory: $SOURCE_DIR"

cc_verify_source_dir_matches_expected_commit "fixtures:sync" "$SOURCE_DIR"

mkdir -p tests/fixtures
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "[fixtures:sync] Synced fixtures from '$SOURCE_DIR' to '$TARGET_DIR'."
