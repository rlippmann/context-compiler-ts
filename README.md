# @rlippmann/context-compiler

TypeScript port of the Context Compiler core.
Deterministic control layer for LLM applications.
Compiles explicit user directives into authoritative context state before model calls.
Helps hosts enforce premise and policy guardrails consistently across turns.

Reference implementation (Python):
https://github.com/rlippmann/context-compiler

Behavioral conformance is validated against the upstream Python fixture/contracts corpus and directive specification.

## Versioning

- Python is the source of truth for semantics.
- TypeScript package versions track Python compatibility by minor version.
- TS `0.N.y` targets semantic compatibility with the Python `0.N.x` line.
- Patch versions evolve independently by language/repo.

## Included in 0.6.0

- Deterministic core engine semantics aligned to the Python 0.6.19 fixture/contracts baseline.
- Fixture-driven conformance coverage for:
  - step behavior
  - transcript replay behavior
  - checkpoint/state serialization behavior
  - structured regression behavior
  - experimental preprocessor behavior
  - public API contract fixtures (core + experimental preprocessor surface)
- Core public API for engine usage and transcript compilation.
- Checkpoint export/import APIs for full continuation-safe persistence.
- Experimental preprocessor module exposed via package subpath import.

## Not Included Yet

- REPL port

## Installation

```bash
npm install @rlippmann/context-compiler
```

## Examples

- `examples/nextjs-basic/` — minimal Next.js App Router integration
  - compiler-mediated request flow
  - `clarify` blocks LLM calls
  - per-session state via checkpoint export/import for continuation-safe resume
- `examples/node-basic/` — minimal Node HTTP server integration

## Quick Start

```ts
import { createEngine } from '@rlippmann/context-compiler';

const engine = createEngine();
const decision = engine.step('set premise concise replies');

if (decision.kind === 'update') {
  // Use authoritative state snapshot from the engine.
  console.log(engine.state);
} else if (decision.kind === 'clarify') {
  console.log(decision.prompt_to_user);
} else {
  // passthrough
}
```

## Public API

- `createEngine(init?)` -> create an engine instance.
- `engine.step(input)` -> apply one user input and return a `Decision`.
- `engine.state` -> authoritative current state snapshot.
- `engine.exportJson()` / `engine.importJson(payload)` -> state serialization utilities.
- `engine.exportCheckpoint()` / `engine.importCheckpoint(payload)` -> continuation-safe checkpoint persistence (`authoritative_state` + pending continuation state).
- `engine.exportCheckpointJson()` / `engine.importCheckpointJson(payload)` -> JSON checkpoint persistence helpers.
- `compile_transcript(messages)` -> replay user messages and return `state` or `confirm`.
- `engine.apply_transcript(messages)` -> replay user messages onto an existing engine instance.
- `getPremiseValue(state)` / `getPolicyItems(state, value?)` -> read helpers for state.

## Experimental Preprocessor

Experimental preprocessor APIs are available via package subpath:

```ts
import {
  preprocess_heuristic,
  parse_preprocessor_output,
  validate_preprocessor_output
} from '@rlippmann/context-compiler/experimental/preprocessor';
```

This module is intentionally experimental and separate from the deterministic core engine API.
