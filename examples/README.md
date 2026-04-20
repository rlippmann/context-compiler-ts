# Examples

TypeScript examples showing host-side usage of the Context Compiler core API.

These examples target Python 0.5 semantic compatibility and only use core APIs.
In 0.5.x, `exportJson()` / `importJson()` persist authoritative state only (`premise`, `policies`) and do not persist pending clarify/confirm interaction state.
For stateless HTTP hosts, pending clarification context must be persisted separately if you need request-to-request clarify/confirm continuity.

## 01_persistent_guardrails.ts

Demonstrates how a prohibition persists as authoritative state across later turns.

## 02_configuration_and_correction.ts

Demonstrates explicit premise lifecycle in 0.5:
`set premise ...` followed by `change premise to ...`.

## 03_ambiguity_with_clarification.ts

Demonstrates contradiction clarify behavior before state mutation.
Shows host-side clarify handling and LLM-call blocking behavior.

## 04_tool_governance_denylist.ts

Demonstrates policy-based tool governance using prohibition directives.

## 05_llm_integration_pattern.ts

Demonstrates end-to-end host control flow around `Decision.kind` outcomes.
Includes single-item correction with `remove policy <item>`.

## 06_transcript_replay.ts

Demonstrates transcript replay behavior with `compile_transcript(messages)` and replay on current engine state via `engine.step(...)`.

## 07_single_policy_correction.ts

Demonstrates explicit single-policy correction without `reset policies`:
`prohibit peanuts` -> `remove policy peanuts` -> `use peanuts`.
