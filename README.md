# context-compiler-ts

TypeScript port of the Context Compiler core.

Reference implementation (Python):
https://github.com/rlippmann/context-compiler

Behavioral conformance is defined by the upstream Python fixture corpus and directive specification.

Status: in-progress (0.5 parity)

## Versioning

- Python is the source of truth for semantics.
- TypeScript package versions track Python compatibility by minor version.
- TS `0.N.y` is intended to be semantically compatible with Python `0.N.x`.
- Patch versions evolve independently by language/repo.
