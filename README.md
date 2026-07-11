# AGENTS.md

## Purpose

This repository contains the TypeScript port of the Context Compiler core.

The goal is strict behavioral parity with the upstream Python implementation.

## Source of Truth

Behavior is defined by the upstream Python project:

[context-compiler (Python reference)](https://github.com/rlippmann/context-compiler)

The following are authoritative:
- Directive grammar specification
- Fixture corpus under `tests/fixtures/conformance`
- Python engine behavior as exercised by those fixtures

If behavior differs, the TypeScript implementation is incorrect.

## Cross-Repo Parity Guidance

- Treat Python behavior and specification documents as authoritative when resolving ambiguity.
- Treat conformance fixtures as cross-repo behavioral contracts, not editable implementation hints.
- Do not reinterpret semantics for convenience; preserve directive meaning and evaluation order.
- Prefer minimal parity fixes over redesigns or broad rewrites.

## Versioning Policy
- Python is the source of truth for semantics.
- TypeScript package versions track Python compatibility by minor version.
- TS `0.N.y` is intended to be semantically compatible with Python `0.N.x`.
- Patch versions evolve independently by language/repo.
- Do not reset TS to `0.1.0` for initial releases; use the Python-compatible minor version instead.

Operational rule:

- If a change would break compatibility with the current Python minor version, stop and call it out before changing the version.

## Conformance Requirements

All changes must preserve:

- Exact `Decision.kind` behavior
- Exact state transitions
- Fixture-defined prompt behavior:
  - Exact match when fixture specifies a string
  - Non-empty string when fixture uses `null`

The TypeScript implementation must pass the full fixture corpus.

## Constraints

- Do not introduce new features
- Do not extend the directive grammar
- Do not change state shape
- Do not add implicit behavior or inference
- Do not “improve” or modify existing functionality without strict adherence to the Python reference behavior.

## Implementation Details

0.8 parity includes support for:
- Pending items: (list any remaining pending items for 0.8 parity)

