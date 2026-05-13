#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PREPROCESSOR_FIXTURES_SOURCE:-}" ]]; then
  echo "[fixtures:preprocessor:sync] PREPROCESSOR_FIXTURES_SOURCE is required." >&2
  echo "[fixtures:preprocessor:sync] Example: PREPROCESSOR_FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/preprocessor npm run fixtures:preprocessor:sync" >&2
  exit 1
fi

SOURCE_DIR="$PREPROCESSOR_FIXTURES_SOURCE"
TARGET_DIR="tests/fixtures/preprocessor"

echo "[fixtures:preprocessor:sync] Using source fixture directory: $SOURCE_DIR"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[fixtures:preprocessor:sync] Source fixture directory not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p tests/fixtures
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "[fixtures:preprocessor:sync] Synced fixtures from '$SOURCE_DIR' to '$TARGET_DIR'."
