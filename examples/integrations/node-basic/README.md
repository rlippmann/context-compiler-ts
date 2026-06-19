# Node Basic Integration

Minimal framework-free Node HTTP server integration for Context Compiler.
Shows a request flow with compiler state where explicit instructions stay consistent across turns, clarify blocks ambiguous directives, and normal requests continue through the host's usual application flow.

## Run

From the repository root:

```bash
npm install
```

```bash
npx tsx examples/integrations/node-basic/server.ts
```

This example uses `exportCheckpointJson()` / `importCheckpointJson()` for per-session persistence.
That preserves both saved compiler state and pending clarify/confirm state.

Directive-drafter and starter-app examples now live in
`context-compiler-example-integrations`.
