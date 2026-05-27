# Node Basic Integration

Minimal framework-free Node HTTP server integration for Context Compiler.
Shows a request flow with compiler state where explicit instructions stay consistent across turns, clarify blocks ambiguous directives, and normal chat continues to the model.

## Run

From the repository root:

```bash
npm install
```

```bash
npx tsx examples/node-basic/server.ts
```

This example uses `exportCheckpointJson()` / `importCheckpointJson()` for per-session persistence.
That preserves both saved compiler state and pending clarify/confirm state.

It also demonstrates a minimal experimental preprocessor pass before `engine.step(...)`
using `preprocess_heuristic(...)` plus `parse_preprocessor_output(...)` from
`@rlippmann/context-compiler/experimental/preprocessor`.
