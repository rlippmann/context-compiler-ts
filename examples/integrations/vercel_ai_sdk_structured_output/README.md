# Vercel AI SDK Structured Output Integration

This example shows a minimal host integration pattern:

compiler state
-> host selects Zod schema
-> Vercel AI SDK `generateObject` call
-> model generates structured object

## Scope and Guarantees

- Context Compiler does not select schemas.
- The host selects schemas using compiler state.
- This example uses compiler state from:
  - `use python_script`
  - `prohibit shell_command`
- Host behavior in this integration:
  - `python_script` schema is offered.
  - `shell_command` schema is not offered.

This is different from prompt reinjection. Schema availability and `generateObject` request configuration are explicit host decisions that are observable and testable before any model call.

## Important Boundaries

- Zod validates object shape and fields, not semantic policy compliance.
- Structured generation behavior may vary by provider and SDK behavior.
- `prohibit shell_command` means this host will not offer a shell-command schema.
- It does not mean the model can never discuss shell commands in freeform text.
- The generated object remains model-dependent.

## Minimal Integration

```ts
import { createEngine } from '@rlippmann/context-compiler';
import { selectStructuredSchemasFromState } from './index.js';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const engine = createEngine();
engine.step('use python_script');
engine.step('prohibit shell_command');

// Host-side selection using compiler state.
const availableSchemas = selectStructuredSchemasFromState(engine.state);

if (availableSchemas[0]?.name === 'python_script') {
  const result = await generateObject({
    model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })('gpt-4.1-mini'),
    prompt: 'Write a short Python script that prints hello.',
    schema: z.object({ code: z.string() })
  });

  console.log(result.object);
}
```

## Local Example Module

See [`index.ts`](./index.ts) for the deterministic host-side selection logic used by tests.

Exported testable functions:
- `selectStructuredSchemasFromState(state)`
- `buildGenerateObjectRequest(state, prompt)`
- `generateStructuredObject(state, prompt, generateObject)`

## Tests

Primary tests do not call a model.
They assert:
- state -> selected schema
- selected schema -> `generateObject` request configuration

Optional smoke test (real model call) is env-gated:

Required optional packages (from repository root):

```bash
npm install --no-save ai @ai-sdk/openai zod
```

Smoke command (from repository root):

```bash
CONTEXT_COMPILER_RUN_VERCEL_AI_SMOKE=1 OPENAI_API_KEY=... npm test -- --run tests/vercel_ai_sdk_structured_output_example.test.ts
```

`OPENAI_API_KEY` is required when `CONTEXT_COMPILER_RUN_VERCEL_AI_SMOKE=1`.

When the smoke flag is off, deterministic tests still validate host wiring.
