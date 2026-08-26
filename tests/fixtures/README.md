# Fixture Suites

This directory contains multiple fixture suites with different contracts.

These fixtures are synchronized from `rlippmann/context-compiler` at the commit recorded in `tests/fixtures/.source-commit`.

## Fixture types

* [`conformance/`](conformance/) — core engine cross-language conformance contract.
  Includes a small public API presence contract under `conformance/api/`.
* [`engine-regression/structured/`](engine-regression/structured/) — deterministic per-turn engine regression fixtures.

`conformance/` and `engine-regression/structured/` both cover engine behavior at different layers.
Both synchronized fixture families must come from the same Python checkout revision recorded in `tests/fixtures/.source-commit`.

## API contract fixture

[`conformance/api/public-api-v2.json`](conformance/api/public-api-v2.json) defines the portable package-root API contract for the current Python 0.9 surface. The `context_compiler.grammar` namespace references [`public-grammar-v1.json`](conformance/api/public-grammar-v1.json) for the separate grammar API.

Ports may sync this artifact with conformance fixtures.

Ports should check equivalent public exports and methods using language-appropriate names where casing differs.

Behavioral semantics remain covered by conformance and structured fixtures.

## Step fixtures

For [`conformance/step/`](conformance/step/):

Each step fixture runs:

1. optional `prelude` (array of prior user inputs)
2. main `input`

Then asserts:

* returned `Decision`
* final `engine.state`

## State JSON fixtures

For [`conformance/state-json/`](conformance/state-json/):

Portable serialization contract coverage for `engine.export_json()` and
`engine.import_json(...)`, including canonical export payload shape and
deterministic validation/error boundaries.

## Controller fixtures

For [`conformance/controller/`](conformance/controller/):

Portable controller contract coverage for:

* `step(engine, user_input)` result envelope and state snapshot
* `preview(engine, user_input)` result envelope, `would_mutate`, and non-mutation of live engine state
* `state_diff(state_before, state_after)` deterministic structural diff output

These fixtures keep a minimal, language-neutral contract matrix for controller APIs.

## Source of truth

Fixtures reflect current Python behavior and tests.
Property/fuzz invariants remain Python-local tests and are not part of the
portable fixture contract.

Local sync and drift checks must use a `rlippmann/context-compiler` checkout at the commit recorded in `tests/fixtures/.source-commit`.
CI reads the same file before checking fixture drift.
Files under synchronized fixture directories must not be edited manually; update the Python source, update `tests/fixtures/.source-commit` if needed, then re-sync both fixture families together.

## Engine regression fixtures

[`engine-regression/structured/`](engine-regression/structured/)

These fixtures capture deterministic per-turn engine behavior and are exercised by the TypeScript structured regression test in [`structured-regression-fixtures.test.ts`](../structured-regression-fixtures.test.ts).

They validate:

* per-turn input handling
* `Decision.kind` outcomes
* decision outcomes and state snapshots

Directive-drafter conformance is maintained in the separate
`context-compiler-directive-drafter` repositories and is not part of the core
engine fixture contract here.

## Test runners

See the TypeScript fixture runners in this repository for execution details:

* [`step-fixtures.test.ts`](../step-fixtures.test.ts)
* [`state-json-fixtures.test.ts`](../state-json-fixtures.test.ts)
* [`controller-fixtures.test.ts`](../controller-fixtures.test.ts)
* [`structured-regression-fixtures.test.ts`](../structured-regression-fixtures.test.ts)
