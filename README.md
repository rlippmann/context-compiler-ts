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

## Quick Start

```ts
import { Engine } from '@rlippmann/context-compiler';

const engine = new Engine();
const decision = engine.step('set premise current project uses uv');
console.log(decision);
```

## Why not just a dict?

A dict stores values. Context Compiler defines and verifies the rules for
changing them.

## Public API

The package root exposes the Python 0.9 decision model, policy constants, and
the `Engine` surface. Checkpoint persistence and the former controller/helper
aliases are not part of the 0.9 package API.

## Directive Drafting

Directive drafting now lives in
[`@rlippmann/context-compiler-directive-drafter`](https://github.com/rlippmann/context-compiler-directive-drafter).

Context Compiler remains the authority layer and applies validated directives.

## Versioning

- Python is the source of truth for semantics.
- TypeScript package versions track Python compatibility by minor version.
- TS `0.N.y` targets semantic compatibility with the Python `0.N.x` line.
- Patch versions evolve independently by language/repo.

## Not Included Yet

- REPL port
