# Next.js Basic Integration

This example uses `engine.exportCheckpointJson()` / `engine.importCheckpointJson()` for per-session persistence.
That preserves both saved compiler state and pending clarify/confirm state across stateless requests, so explicit instructions stay consistent across turns.
