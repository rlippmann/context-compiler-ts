#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${FIXTURES_SOURCE:-}" ]]; then
  echo "[fixtures:sync] FIXTURES_SOURCE is required." >&2
  echo "[fixtures:sync] Example: FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/conformance npm run fixtures:sync" >&2
  exit 1
fi

SOURCE_DIR="$FIXTURES_SOURCE"
TARGET_DIR="tests/fixtures/conformance"

echo "[fixtures:sync] Using source fixture directory: $SOURCE_DIR"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[fixtures:sync] Source fixture directory not found: $SOURCE_DIR" >&2
  echo "[fixtures:sync] Set FIXTURES_SOURCE to a valid Python fixture source path." >&2
  exit 1
fi

mkdir -p tests/fixtures
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "[fixtures:sync] Synced fixtures from '$SOURCE_DIR' to '$TARGET_DIR'."
