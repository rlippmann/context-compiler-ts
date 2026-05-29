# Examples

TypeScript examples showing how host applications keep rules and corrections consistent across turns.

These examples follow the Python 0.7 behavior baseline and use only core APIs.
Request-based integrations can persist compiler state with checkpoint APIs so rules and corrections stay consistent across turns.

## 01_persistent_guardrails.ts

Demonstrates how a prohibition persists as stored policy state across later turns.

## 02_configuration_and_correction.ts

Demonstrates explicit premise lifecycle in 0.5:
`set premise ...` followed by `change premise to ...`.

## 03_ambiguity_with_clarification.ts

Shows contradiction clarify behavior before state mutation.
Shows host-side clarify handling and blocks LLM calls on clarify.

## 04_tool_governance_denylist.ts

Demonstrates policy-based tool governance using prohibition directives.

## 05_llm_integration_pattern.ts

Demonstrates end-to-end host control flow around `Decision.kind` outcomes.
Includes single-item correction with `remove policy <item>`.

## 06_transcript_replay.ts

Shows transcript replay with `compile_transcript(messages)` and replay onto current engine state with `engine.apply_transcript(...)`.

## 07_single_policy_correction.ts

Demonstrates explicit single-policy correction without `reset policies`:
`prohibit peanuts` -> `remove policy peanuts` -> `use peanuts`.

## 08_controller_preview_diff.ts

Shows controller-layer auditability with `preview(engine, input)` and `state_diff(before, after)`.
Shows that preview does not mutate live engine state, then applies the same input with `step(engine, input)`.

## Integrations

- [`examples/integrations/nextjs-basic/README.md`](/Users/rlippmann/Source/context-compiler-ts/examples/integrations/nextjs-basic/README.md)
- [`examples/integrations/node-basic/README.md`](/Users/rlippmann/Source/context-compiler-ts/examples/integrations/node-basic/README.md)
- [`examples/integrations/vercel_ai_sdk_structured_output/README.md`](/Users/rlippmann/Source/context-compiler-ts/examples/integrations/vercel_ai_sdk_structured_output/README.md)
