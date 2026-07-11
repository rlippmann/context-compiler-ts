# Examples

TypeScript examples showing how host applications keep rules and corrections consistent across turns.

These examples are repository artifacts and are not installed from the published npm package.

These examples teach the Context Compiler authority layer and core APIs, including directive grammar, `Decision` handling, engine lifecycle, state access, checkpoints, controller APIs, and authority-layer usage patterns.
These examples follow the Python 0.8 behavior baseline and use only core APIs.
They focus on the core engine and intentionally avoid framework-specific integrations.
Request-based integrations can persist compiler state with checkpoint APIs so rules and corrections stay consistent across turns.
Directive drafting lives in the separate `@rlippmann/context-compiler-directive-drafter` package.
The TypeScript core package does not include a REPL.

## [Persistent guardrails](01_persistent_guardrails.ts)

Demonstrates how a prohibition persists as stored policy state across later turns.

## [Configuration and correction](02_configuration_and_correction.ts)

Demonstrates explicit premise lifecycle with the current premise directives:
`set premise ...` followed by `change premise to ...`.

## [Ambiguity with clarification](03_ambiguity_with_clarification.ts)

Shows contradiction clarify behavior before state mutation.
Shows host-side clarify handling and blocks the normal request path until the user confirms.

## [Tool governance denylist](04_tool_governance_denylist.ts)

Demonstrates policy-based tool governance using prohibition directives.

## [LLM integration pattern](05_llm_integration_pattern.ts)

Demonstrates end-to-end host control flow around `Decision.kind` outcomes.
Includes single-item correction with `remove policy <item>`.

## [Step sequence and checkpoint](06_step_sequence_and_checkpoint.ts)

Shows explicit directive sequencing through `engine.step(...)`, followed by checkpoint export and restore into a fresh engine.

## [Single policy correction](07_single_policy_correction.ts)

Demonstrates explicit single-policy correction without `reset policies`:
`prohibit peanuts` -> `remove policy peanuts` -> `use peanuts`.

## [Controller preview and diff](08_controller_preview_diff.ts)

Shows controller-layer auditability with `preview(engine, input)` and `stateDiff(before, after)`.
Shows that preview does not mutate live engine state, then applies the same input with `step(engine, input)`.
Uses the controller helper accessors such as `getPreviewDecision`, `getPreviewStateAfter`, `previewWouldMutate`, `getStepDecision`, and `getStepState`.

## Integration examples

Runnable application-layer examples, enforcement-point examples, and host integration examples now live in
[`context-compiler-example-integrations`](https://github.com/rlippmann/context-compiler-example-integrations).

This repository keeps only small core examples and authority-layer examples for the core engine.
