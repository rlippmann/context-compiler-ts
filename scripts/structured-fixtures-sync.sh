#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${STRUCTURED_FIXTURES_SOURCE:-}" ]]; then
  echo "[fixtures:structured:sync] STRUCTURED_FIXTURES_SOURCE is required." >&2
  echo "[fixtures:structured:sync] Example: STRUCTURED_FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/engine-regression/structured npm run fixtures:structured:sync" >&2
  exit 1
fi

SOURCE_DIR="$STRUCTURED_FIXTURES_SOURCE"
TARGET_DIR="tests/fixtures/engine-regression/structured"

echo "[fixtures:structured:sync] Using source fixture directory: $SOURCE_DIR"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[fixtures:structured:sync] Source fixture directory not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p tests/fixtures/engine-regression
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "[fixtures:structured:sync] Synced fixtures from '$SOURCE_DIR' to '$TARGET_DIR'."
