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

This example uses `exportJson()` / `importJson()` for per-session state persistence.
In 0.5.x, pending clarify/confirm interaction state is not persisted across requests.
