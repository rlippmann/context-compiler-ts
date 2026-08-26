# @rlippmann/context-compiler

Keep explicit user commitments consistent across turns.

Context Compiler solves a common state-management problem: storing user rules is
easy, but deciding when those rules are allowed to change is not.

It gives your app deterministic rules for explicit state changes such as
setting a premise, replacing a policy, or blocking a conflicting update.

A dict stores state. Context Compiler makes state changes verifiable.

This package is the TypeScript implementation of the Context Compiler engine, aligned with Python 0.9 behavior and contract.

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
- when a change should be rejected instead of silently overwriting state
- how to save and restore authoritative state

## How it solves it

Context Compiler lets a host application:

- prevent silent overwrites when a new update conflicts with what is already saved
- preserve state until an explicit directive is accepted
- let the host inspect advisory repairs without applying them automatically
- save and restore state through the JSON persistence API

Each user input produces a decision for the host:

- `update` -> the directive was accepted; `changed` reports whether state changed
- `no_directive` -> input did not produce a canonical directive
- `error` -> the directive was rejected; the result identifies the semantic failure and advisory repairs

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
the `Engine` surface. The supported engine persistence methods are
`export_json()` and `import_json()`.

The public grammar API is available from the `@rlippmann/context-compiler/grammar`
namespace.

```ts
import {
  CanonicalDirective,
  DirectiveKind,
  decompose_directive
} from '@rlippmann/context-compiler/grammar';
```

The grammar namespace contains the public directive constructors, metadata,
syntax classifications, and parsing helpers. Internal parsing helpers are not
part of the supported API.

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
