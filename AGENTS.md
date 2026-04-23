# AGENTS.md

## Purpose

This repository contains the TypeScript port of the Context Compiler core.

The goal is strict behavioral parity with the upstream Python implementation.

## Source of Truth

Behavior is defined by the upstream Python project:

[context-compiler (Python reference)](https://github.com/rlippmann/context-compiler)

The following are authoritative:
- Directive grammar specification
- Fixture corpus under `tests/fixtures/v2`
- Python engine behavior as exercised by those fixtures

If behavior differs, the TypeScript implementation is incorrect.

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
- Transcript replay behavior
- Fixture-defined prompt behavior:
  - Exact match when fixture specifies a string
  - Non-empty string when fixture uses `null`

The TypeScript implementation must pass the full fixture corpus.

## Constraints

- Do not introduce new features
- Do not extend the directive grammar
- Do not change state shape
- Do not add implicit behavior or inference
- Do not “improve” or reinterpret semantics

This is a deterministic port, not a redesign.

## Implementation Guidelines

- Prefer simple, explicit logic over abstractions
- Preserve evaluation order defined in the spec
- Avoid hidden state or non-determinism
- Use plain objects for state (JSON-compatible)
- Do not rely on object identity for equality

## Pending Clarification

Pending clarification behavior is strict:

- While pending exists, only confirmation tokens are processed
- All other input must return `clarify`
- The existing prompt must be reused exactly

## Testing

The fixture corpus is the conformance harness.

A change is correct only if all fixtures pass.

Do not modify fixtures to make tests pass.

## Test Coverage Expectations

Before opening a PR, consider:

- Does this change affect any user-facing behavior?
- If so, is that behavior covered by tests?

User-facing behavior includes:

- Engine decision outcomes (`kind`, `prompt_to_user`, and returned `state`)
- Checkpoint export/import and continuation behavior
- Clarify/confirmation flows (`yes` / `no`)
- Transcript replay behavior and compaction-related behavior
- Integration behavior (examples, demo runner, and integration scripts)
- Integration error-path normalization

If a user-facing behavior is changed or introduced, add or update tests to cover it.

Do not rely solely on coverage metrics.

## Workflow

Typical workflow:

1. Run tests
2. Identify failing fixture
3. Fix implementation
4. Re-run tests

Do not refactor broadly while tests are failing.

## Non-Goals

- No performance optimization
- No API redesign
- No packaging concerns
- No framework integration

Focus only on behavioral parity.

## Commit Messages

Use concise, prefixed commit messages:

- `chore:` setup, scaffolding, tooling
- `fix:` behavior changes to achieve fixture parity
- `test:` harness or fixture-related changes
- `docs:` documentation updates

Guidelines:

- Prefer small, focused commits
- Describe the behavior change, not the code change
- Reference the failing scenario when applicable

Examples:

- `fix: correct replacement clarify ordering`
- `fix: enforce pending clarification gating`
- `test: normalize transcript output shape`
- `chore: add TypeScript scaffold`
