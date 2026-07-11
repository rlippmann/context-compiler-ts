# @rlippmann/context-compiler

Keep explicit user commitments consistent across turns.

Context Compiler solves a common state-management problem: storing user rules is
easy, but deciding when those rules are allowed to change is not.

It gives your app deterministic rules for explicit state changes such as
setting a premise, replacing a policy, blocking a conflicting update, or
asking for clarification before anything changes.

A dict stores state. Context Compiler makes state changes verifiable.

This package is the TypeScript implementation of the Context Compiler engine, aligned with Python 0.8 behavior and contract.

It is useful for hosts that need explicit conversational state to stay stable
across turns: chat apps, tool-using assistants, schema-routing workflows, and
other systems that need saved premise or policy state.

The model writes responses. The compiler decides whether explicit state changes
are accepted.

## What problem it solves

Saved state can drive prompt rendering, schema selection, routing, tool
availability, or other host behavior, but your app still needs rules for when
that state is allowed to change:

- when a replacement is valid
- when a conflicting update should stop and ask for confirmation
- when a change should be rejected instead of silently overwriting state
- how to restore both saved state and an in-progress clarification flow

## How it solves it

Context Compiler lets a host application:

- prevent silent overwrites when a new update conflicts with what is already saved
- require clarification before conflicting or confirmation-only changes are accepted
- let the host preview a change before applying it and keep live state unchanged until it is accepted
- restore both saved state and an in-progress clarification flow safely between requests

Each user input produces a decision for the host:

- `update` -> stored premise/policy rules changed
- `passthrough` -> input does not affect saved state
- `clarify` -> do not mutate state; ask the user to confirm or clarify

Directive examples:

- `set premise current project uses uv`
- `use sqlite`
- `prohibit docker`
- `remove policy docker`
- `clear premise`

## Installation

```bash
npm install @rlippmann/context-compiler
```

## Examples

- `examples/` — small core API examples focused on authority-layer behavior
- [`context-compiler-example-integrations`](https://github.com/rlippmann/context-compiler-example-integrations) — runnable application-layer examples, enforcement-point examples, and host integration examples

The npm package publishes the core runtime only. Examples and demos live in
this repository and are not included in the published package.

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
const decision = engine.step('set premise current project uses uv');

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
  // Normal user input. Call the model without mutating saved state.
}
```

State snapshots are intentionally opaque. Prefer helpers such as
`getPremiseValue(state)` and `getPolicyItems(state)` for value reads.

If the user later asks "how should I run the tests?", the host can use the
saved state however it needs, such as rendering it into a prompt, selecting a
schema, or routing the request with the saved premise in mind.

## Why not just a dict?

A dict stores values. Context Compiler defines and verifies the rules for
changing them.

## Public API

- `createEngine(init?)` -> create an engine instance.
- `engine.step(input)` -> apply one user input and return a `Decision`.
- `engine.state` -> current saved premise/policy rules snapshot.
- `engine.hasPendingClarification()` -> check whether confirmation-only input is currently required.
- `engine.exportJson()` / `engine.importJson(payload)` -> state serialization utilities.
- `engine.exportCheckpoint()` / `engine.importCheckpoint(payload)` -> checkpoint persistence (`authoritative_state` + pending confirmation state) that safely resumes pending confirmations.
- `engine.exportCheckpointJson()` / `engine.importCheckpointJson(payload)` -> JSON checkpoint wrapper persistence helpers.
- `getPremiseValue(state)` / `getPolicyItems(state, value?)` -> read helpers for state.
- `step(engine, input)` -> controller step envelope (`output_version`, `mode`, `decision`, `state`).
- `preview(engine, input)` -> dry-run step envelope with `state_before`, `state_after`, `diff`, and `would_mutate` (live engine state is restored).
- `getStepDecision(stepResult)` / `getStepState(stepResult)` -> read helpers for controller step results.
- `getPreviewDecision(previewResult)` / `getPreviewStateAfter(previewResult)` / `previewWouldMutate(previewResult)` -> read helpers for controller preview results.
- `diffHasChanges(diff)` -> read helper for the structural diff `changed` flag.
- `stateDiff(before, after)` -> structural state diff used by preview.
- `DECISION_PASSTHROUGH` / `DECISION_UPDATE` / `DECISION_CLARIFY` -> decision kind constants.

Prefer the controller helper accessors over direct controller result property reads in TypeScript examples and app code.

For normal host code, prefer exported decision helpers such as `isUpdate`,
`isClarify`, `isPassthrough`, `getClarifyPrompt`, and `getDecisionState`
instead of branching on raw decision fields.

## Directive Drafting

Directive drafting now lives in
[`@rlippmann/context-compiler-directive-drafter`](https://github.com/rlippmann/context-compiler-directive-drafter).

Context Compiler remains the authority layer and applies validated directives.

## Versioning

- Python is the source of truth for semantics.
- TypeScript package versions track Python compatibility by minor version.
- TS `0.N.y` targets semantic compatibility with the Python `0.N.x` line.
- Patch versions evolve independently by language/repo.

## 0.8 Parity Scope

The TypeScript implementation targets semantic compatibility with the Python 0.8 release, including engine behavior, checkpoint persistence, controller APIs, and shared fixture-based verification.

## Not Included Yet

- REPL port
