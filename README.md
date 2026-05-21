# @rlippmann/context-compiler

Tell the AI your rules once and keep them consistent across turns.

Context Compiler helps applications keep explicit user instructions separate from the chat transcript. Rules and corrections are stored as compiler state, so hosts can apply them consistently to future model calls.

The model writes responses. The compiler stores premise and policy rules.

This package is the TypeScript implementation of the Context Compiler engine, aligned with the Python reference implementation.

## What it does

Context Compiler lets a host application:
- store explicit rules such as `use sqlite` or `prohibit docker`
- replace or remove earlier rules without relying on the model to infer the correction
- block ambiguous or conflicting rule updates before calling the model
- save and restore stored rules between requests

Each user input produces a decision for the host:
- `update` -> stored premise/policy rules changed
- `clarify` -> ask the user for clarification; do not call the model
- `passthrough` -> normal chat input

Directive examples:
- `set premise concise replies`
- `use sqlite`
- `prohibit docker`
- `remove policy docker`
- `clear premise`

## Versioning

- Python is the source of truth for semantics.
- TypeScript package versions track Python compatibility by minor version.
- TS `0.N.y` targets semantic compatibility with the Python `0.N.x` line.
- Patch versions evolve independently by language/repo.

## Included in 0.6.0

- Core engine behavior aligned with Python 0.6 behavior.
- Shared behavior test coverage for:
  - single-turn rule updates
  - transcript replay
  - saving and restoring state
  - checkpoint restore
  - experimental preprocessor behavior
  - public API behavior
- Core public API for engine usage and transcript compilation.
- Checkpoint APIs for saving and restoring rules plus pending clarification state.
- Experimental preprocessor module exposed through a package subpath import.

## Not Included Yet

- REPL port

## Installation

```bash
npm install @rlippmann/context-compiler
```

## Examples

- `examples/nextjs-basic/` — minimal Next.js App Router integration
  - compiler-mediated request flow where explicit instructions stay consistent across turns
  - `clarify` blocks LLM calls
  - saved compiler state per session via checkpoint export/import for continuation-safe resume
- `examples/node-basic/` — minimal Node HTTP server integration

## Quick Start

```ts
import { createEngine } from '@rlippmann/context-compiler';

const engine = createEngine();
const decision = engine.step('set premise concise replies');

if (decision.kind === 'update') {
  // Use the updated stored rules from the engine.
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
- `engine.state` -> current stored premise/policy rules snapshot.
- `engine.exportJson()` / `engine.importJson(payload)` -> state serialization utilities.
- `engine.exportCheckpoint()` / `engine.importCheckpoint(payload)` -> continuation-safe checkpoint persistence (`authoritative_state` + pending continuation state).
- `engine.exportCheckpointJson()` / `engine.importCheckpointJson(payload)` -> JSON checkpoint persistence helpers.
- `compile_transcript(messages)` -> replay user messages and return `state` or `confirm`.
- `engine.apply_transcript(messages)` -> replay user messages onto an existing engine instance.
- `getPremiseValue(state)` / `getPolicyItems(state, value?)` -> read helpers for state.

## Experimental Preprocessor

The optional preprocessor can recognize natural-language rule updates before they reach the engine.

For example:
- "keep replies concise"
- "don't suggest docker"
- "forget that previous policy"

Preprocessor output should always be parsed/validated before passing it to the engine.

Experimental preprocessor APIs are available via package subpath:

```ts
import {
  preprocess_heuristic,
  parse_preprocessor_output,
  validate_preprocessor_output
} from '@rlippmann/context-compiler/experimental/preprocessor';
```

This module is intentionally experimental and separate from the deterministic core engine API.
