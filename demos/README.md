# LLM Demos

These scripts are comparative LLM demos aligned to the Python reference demos.

Scored demos compare three paths:
- baseline
- compiler-mediated (full transcript + injected compiled state)
- compiler+compact (compacted transcript + injected compiled state)

Demo 06 is informational (context/prompt compaction metrics), not scored.

## Result variability note

LLM demo outcomes can vary across environments. In practice, PASS/FAIL patterns may differ based on:
- provider
- client layer
- model serving path

## Demo overview

| Demo | Behavior | Concept |
| :--: | --- | :--: |
| [01](./01_llm_contradiction_clarify.ts) | Contradiction blocking | clarification gate |
| [02](./02_llm_constraint_guardrail.ts) | Constraint drift | persistent policy enforcement |
| [03](./03_llm_premise_guardrail.ts) | Premise update drift | deterministic premise updates |
| [04](./04_llm_tool_denylist_guardrail.ts) | Tool governance | host-side denylist |
| [05](./05_llm_prompt_drift_vs_state.ts) | Prompt drift | long transcript edge case |
| [06](./06_llm_context_compaction.ts) | Context compaction | compiled state replacing transcript |
| [07](./07_llm_prompt_vs_state.ts) | Prompt engineering comparison | prompting vs compiled state |

## Requirements

Environment variables:
- `OPENAI_API_KEY` (required)
- `MODEL` (required)
- `OPENAI_BASE_URL` (optional; set for OpenAI-compatible local/hosted endpoints)

Examples:

```bash
export OPENAI_API_KEY=your_key_here
export MODEL=gpt-4.1-mini
```

OpenAI-compatible local endpoint:

```bash
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_API_KEY=ollama
export MODEL=ollama/llama3.1:8b
```

## Run

Build first:

```bash
npm run build
```

Run all demos:

```bash
node dist/demos/run_demo.js all
```

Run one demo:

```bash
node dist/demos/run_demo.js 1
```

Run with verbose output:

```bash
node dist/demos/run_demo.js all --verbose
```

Run demo 5 with stress turns:

```bash
node dist/demos/run_demo.js 5 -- --turns 120
```
