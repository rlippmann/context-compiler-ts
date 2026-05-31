# @rlippmann/context-compiler

Tell the AI your rules once and keep them consistent across turns.

Context Compiler helps applications keep explicit user instructions separate from the chat transcript. It stores rules and corrections as compiler state so hosts can apply them consistently on later model calls.

The model writes responses. The compiler stores premise and policy rules.

This package is the TypeScript implementation of the Context Compiler engine, aligned with Python 0.7 behavior.

## What it does

Context Compiler lets a host application:
- store explicit rules such as `use sqlite` or `prohibit docker`
- replace or remove earlier rules without asking the model to infer the correction
- block ambiguous or conflicting rule updates before calling the model
- save and restore rules between requests

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

## 0.7 Parity Scope

- Core engine behavior aligned with Python 0.7 behavior.
- Shared behavior test coverage for:
  - single-turn rule updates
  - transcript replay
  - saving and restoring state
  - checkpoint restore
  - experimental preprocessor behavior
  - public API behavior
- Core public API for engine usage and transcript replay.
- Checkpoint APIs for saving and restoring rules plus pending clarification state.
- Controller APIs for step envelopes, preview/dry-run, and structural state diffs.
- Decision constants for host-side checks.
- Experimental preprocessor module exposed through a package subpath import.
- Fixture parity synced from the Python source-of-truth fixture corpus.

## Not Included Yet

- REPL port

## Installation

```bash
npm install @rlippmann/context-compiler
```

## Examples

- `examples/integrations/nextjs-basic/` — minimal Next.js App Router integration
  - request flow with compiler state where explicit instructions stay consistent across turns
  - `clarify` blocks LLM calls
  - per-session compiler state via checkpoint export/import so sessions can resume safely
- `examples/integrations/node-basic/` — minimal Node HTTP server integration
- `examples/integrations/vercel_ai_sdk_structured_output/` — host-side schema selection for Vercel AI SDK structured output

## Quick Start

```ts
import {
  createEngine,
  getClarifyPrompt,
  getDecisionState,
  getPolicyItems,
  getPremiseValue,
  isClarify,
  isPassthrough,
  isUpdate
} from '@rlippmann/context-compiler';

const engine = createEngine();
const decision = engine.step('set premise concise replies');

if (isUpdate(decision)) {
  const state = getDecisionState(decision);
  if (state) {
    console.log({
      premise: getPremiseValue(state),
      policies: getPolicyItems(state)
    });
  }
} else if (isClarify(decision)) {
  console.log(getClarifyPrompt(decision));
} else if (isPassthrough(decision)) {
  // passthrough
}
```

State snapshots are intentionally opaque. Prefer helpers such as
`getPremiseValue(state)` and `getPolicyItems(state)` for value reads.

## Public API

- `createEngine(init?)` -> create an engine instance.
- `engine.step(input)` -> apply one user input and return a `Decision`.
- `engine.state` -> current stored premise/policy rules snapshot.
- `engine.hasPendingClarification()` -> check whether confirmation-only input is currently required.
- `engine.exportJson()` / `engine.importJson(payload)` -> state serialization utilities.
- `engine.exportCheckpoint()` / `engine.importCheckpoint(payload)` -> checkpoint persistence (`authoritative_state` + pending confirmation state) that safely resumes pending confirmations.
- `engine.exportCheckpointJson()` / `engine.importCheckpointJson(payload)` -> JSON checkpoint wrapper persistence helpers.
- `compileTranscript(messages)` -> replay user messages and return `state` or `confirm`.
- `engine.applyTranscript(messages)` -> replay user messages onto an existing engine instance.
- `getPremiseValue(state)` / `getPolicyItems(state, value?)` -> read helpers for state.
- `step(engine, input)` -> controller step envelope (`output_version`, `mode`, `decision`, `state`).
- `preview(engine, input)` -> dry-run step envelope with `state_before`, `state_after`, `diff`, and `would_mutate` (live engine state is restored).
- `stateDiff(before, after)` -> structural state diff used by preview.
- `DECISION_PASSTHROUGH` / `DECISION_UPDATE` / `DECISION_CLARIFY` -> decision kind constants.

## Experimental Preprocessor

The preprocessor is an optional host-side layer that can recognize some
natural-language rule updates before they reach the engine.

For example:
- "keep replies concise"
- "don't suggest docker"
- "forget that previous policy"

Safety guidance:
- Always validate preprocessor output before applying a directive to the engine.
- If `engine.hasPendingClarification()` is true, bypass preprocessing and pass raw input directly to `engine.step(...)`.
- Boundary behavior is conservative and false-negative-preferred: abstain rather than risk unsafe mutation.

Experimental preprocessor APIs are available via package subpath:

```ts
import { preprocessHeuristic, parsePreprocessorOutput, validatePreprocessorOutput } from '@rlippmann/context-compiler/experimental/preprocessor';
```

### Experimental Preprocessor Quick Start

```ts
function stepWithOptionalPreprocessor(engine: ReturnType<typeof createEngine>, userInput: string) {
  if (engine.hasPendingClarification()) {
    return engine.step(userInput);
  }

  const heuristic = preprocessHeuristic(userInput);
  let engineInput = userInput;

  if (heuristic.classification === 'directive' && heuristic.output !== null) {
    const parsed = parsePreprocessorOutput(heuristic.output, { sourceInput: userInput });
    if (parsed !== null) {
      engineInput = parsed;
    }
  }

  return engine.step(engineInput);
}
```

The preprocessor is a convenience layer. The engine remains the authoritative source of state changes.

This module is intentionally experimental and separate from the deterministic core engine API.
