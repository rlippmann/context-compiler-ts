# @rlippmann/context-compiler

TypeScript port of the Context Compiler core.
Deterministic control layer for LLM applications.
Compiles explicit user directives into authoritative context state before model calls.
Helps hosts enforce premise and policy guardrails consistently across turns.

Reference implementation (Python):
https://github.com/rlippmann/context-compiler

Behavioral conformance is defined by the upstream Python fixture corpus and directive specification.

## Versioning

- Python is the source of truth for semantics.
- TypeScript package versions track Python compatibility by minor version.
- TS `0.N.y` is intended to be semantically compatible with Python `0.N.x`.
- Patch versions evolve independently by language/repo.

## Included in 0.5.0

- Deterministic core engine semantics aligned with Python 0.5 behavior.
- Fixture-driven conformance for step and transcript behavior.
- Core public API for engine usage and transcript compilation.

## Not Included Yet

- REPL port
- Experimental preprocessor

## Installation

```bash
npm install @rlippmann/context-compiler
```

## Examples

- `examples/nextjs-basic/` — minimal Next.js App Router integration
  - compiler-mediated request flow
  - `clarify` blocks LLM calls
  - per-session state via `exportJson()` / `importJson()`
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
- Note: in 0.5.x, export/import serialize authoritative state only (`premise`, `policies`), not pending clarify/confirm interaction state.
- For stateless HTTP integrations, hosts must persist pending clarification context separately when needed; a checkpoint-style full-resume API is planned for 0.6.
- `compile_transcript(messages)` -> replay user messages and return `state` or `confirm`.
- `getPremiseValue(state)` / `getPolicyItems(state, value?)` -> read helpers for state.
