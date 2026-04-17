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

Default source path:

- `../context-compiler/tests/fixtures/v2`

Commands:

- `npm run fixtures:sync` to copy fixtures from Python into `tests/fixtures/v2`
- `npm run fixtures:check` to detect drift between local fixtures and Python fixtures

Optional override:

- Set `FIXTURES_SOURCE` to use a different source path, for example:
  - `FIXTURES_SOURCE=/path/to/context-compiler/tests/fixtures/v2 npm run fixtures:check`

## Pull Requests

- Keep changes minimal and focused
- Avoid refactoring unrelated code
- Explain which behavior or fixture is being addressed

## Notes

This is a conformance-driven port, not a redesign.

When in doubt, match the Python implementation and fixtures exactly.
