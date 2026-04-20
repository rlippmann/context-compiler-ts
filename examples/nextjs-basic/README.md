# Next.js Basic Integration

This example uses `engine.exportJson()` / `engine.importJson()` for per-session persistence.
In 0.5.x, that payload stores authoritative state only (`premise` and `policies`), not pending clarify/confirm interaction state.
In stateless HTTP flows, a clarify on request N can lose pending confirmation context on request N+1 after restore.
That means follow-ups like `maybe` may not re-trigger the same clarify prompt unless the host persists pending interaction state separately.
A checkpoint-style resume API is planned for 0.6 to support full conversation resume.

