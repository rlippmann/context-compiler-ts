# Contributing

## Scope

This repository is a TypeScript port of the Context Compiler core.

The goal is strict behavioral parity with the upstream Python implementation.

## Source of Truth

Behavior is defined by the Python reference implementation:

[context-compiler (Python reference)](https://github.com/rlippmann/context-compiler)

The fixture corpus and directive grammar specification are authoritative.

## Requirements

All changes must:

- Preserve exact behavior defined by the fixture corpus
- Maintain deterministic state transitions
- Match transcript replay behavior exactly
- Respect fixture-defined prompt rules:
  - Exact match when a fixture specifies a string
  - Non-empty string when a fixture uses `null`

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

## What Not to Do

Do not:

- Add new features
- Extend or reinterpret the directive grammar
- Change state shape
- Introduce inference or “smart” behavior
- Modify fixtures to make tests pass

## Workflow

1. Run tests
2. Identify failing fixture(s)
3. Fix implementation
4. Re-run tests

All tests must pass before submitting changes.

## Fixture Sync

Python fixtures are the source of truth.

Conformance fixture policy:

- Do not hand-edit fixture JSON files under `tests/fixtures/conformance`.
- Update conformance fixtures only via `npm run fixtures:sync` with explicit `FIXTURES_SOURCE` pointing to the Python source of truth.
- If fixture updates introduce test failures, update TypeScript implementation to conform to fixtures.

Commands:

- `FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/conformance npm run fixtures:sync` to copy fixtures from Python into `tests/fixtures/conformance`
- `FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/conformance npm run fixtures:check` to detect drift between local fixtures and Python fixtures

`FIXTURES_SOURCE` is required for both commands.

## Pull Requests

- Keep changes minimal and focused
- Avoid refactoring unrelated code
- Explain which behavior or fixture is being addressed

## Notes

This is a conformance-driven port, not a redesign.

When in doubt, match the Python implementation and fixtures exactly.
