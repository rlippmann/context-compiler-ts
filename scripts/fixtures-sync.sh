#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${FIXTURES_SOURCE:-../context-compiler/tests/fixtures/v2}"
TARGET_DIR="tests/fixtures/v2"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[fixtures:sync] Source fixture directory not found: $SOURCE_DIR" >&2
  echo "[fixtures:sync] Set FIXTURES_SOURCE to override the default source path." >&2
  exit 1
fi

mkdir -p tests/fixtures
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "[fixtures:sync] Synced fixtures from '$SOURCE_DIR' to '$TARGET_DIR'."
