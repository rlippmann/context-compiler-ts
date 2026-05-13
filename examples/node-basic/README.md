# Node Basic Integration

Minimal framework-free Node HTTP server integration for Context Compiler.
Demonstrates compiler-mediated request flow, clarify blocking, and model forwarding on continue.

## Run

From the repository root:

```bash
npm install
```

```bash
npx tsx examples/node-basic/server.ts
```

This example uses `exportCheckpointJson()` / `importCheckpointJson()` for per-session persistence.
That preserves both authoritative state and pending clarify/confirm continuation state.

It also demonstrates a minimal experimental preprocessor pass before `engine.step(...)`
using `preprocess_heuristic(...)` plus `parse_preprocessor_output(...)` from
`@rlippmann/context-compiler/experimental/preprocessor`.
