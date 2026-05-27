# LLM Demos

These scripts show side-by-side LLM outcomes with and without stored compiler rules, aligned with the [Python reference demos](https://github.com/rlippmann/context-compiler/blob/main/demos/README.md).

Scored demos compare three host flows:
- baseline
- compiler path (full transcript + injected stored rules/state)
- compiler+compact (compacted transcript + injected stored rules/state)

Demo 06 is informational (context/prompt compaction metrics), not scored.

## Result variability note

LLM demo outcomes can vary across environments. In practice, PASS/FAIL patterns may differ based on:
- provider
- client layer
- model serving path

## Demo overview

| Demo | Shows |
| :--: | --- |
| [01](./01_llm_contradiction_clarify.ts) | conflicting instructions trigger clarification instead of silently changing rules |
| [02](./02_llm_constraint_guardrail.ts) | rules stay consistent across long conversations |
| [03](./03_llm_premise_guardrail.ts) | corrected instructions replace earlier ones |
| [04](./04_llm_tool_denylist_guardrail.ts) | blocked tools stay blocked |
| [05](./05_llm_prompt_drift_vs_state.ts) | stored rules survive long transcripts |
| [06](./06_llm_context_compaction.ts) | stored rules can replace most transcript history |
| [07](./07_llm_prompt_vs_state.ts) | prompting alone compared with stored rules |

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
