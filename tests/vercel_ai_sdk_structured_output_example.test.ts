import { describe, expect, it } from 'vitest';

import { createEngine } from '../src/index.js';
import {
  buildGenerateObjectRequest,
  selectStructuredSchemasFromState
} from '../examples/integrations/vercel_ai_sdk_structured_output/index.js';

async function findMissingOptionalDeps(packages: string[]): Promise<string[]> {
  const checks = await Promise.all(
    packages.map(async (pkg) => {
      try {
        await import(pkg);
        return null;
      } catch {
        return pkg;
      }
    })
  );
  return checks.filter((pkg): pkg is string => pkg !== null);
}

describe('vercel ai sdk structured output example', () => {
  it('selects python_script and excludes shell_command from compiler state', () => {
    const engine = createEngine();
    engine.step('use python_script');
    engine.step('prohibit shell_command');

    const schemas = selectStructuredSchemasFromState(engine.state);
    expect(schemas.map((schema) => schema.name)).toEqual(['python_script']);
  });

  it('builds generateObject request configuration from selected schema', () => {
    const engine = createEngine();
    engine.step('use python_script');
    engine.step('prohibit shell_command');

    const request = buildGenerateObjectRequest(engine.state, 'Write a hello-world program.');

    expect(request.schemaName).toBe('python_script');
    expect(request.schema.name).toBe('python_script');
    expect(request.schema.fields).toEqual(['code']);
    expect(request.prompt).toBe('Write a hello-world program.');
  });

  const RUN_SMOKE = process.env.CONTEXT_COMPILER_RUN_VERCEL_AI_SMOKE === '1';

  it.skipIf(!RUN_SMOKE)('optional smoke: can call Vercel AI SDK generateObject with selected schema', async () => {
    const missingDeps = await findMissingOptionalDeps(['ai', '@ai-sdk/openai', 'zod']);
    if (missingDeps.length > 0) {
      throw new Error(
        [
          'Optional smoke dependencies are missing:',
          `  ${missingDeps.join(', ')}`,
          'Install them from repository root with:',
          '  npm install --no-save ai @ai-sdk/openai zod'
        ].join('\n')
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OPENAI_API_KEY is required when CONTEXT_COMPILER_RUN_VERCEL_AI_SMOKE=1.');
    }

    const { generateObject } = (await import('ai')) as {
      generateObject: (request: {
        model: unknown;
        prompt: string;
        schema: unknown;
      }) => Promise<{ object: unknown }>;
    };
    const { createOpenAI } = (await import('@ai-sdk/openai')) as {
      createOpenAI: (config: { apiKey: string }) => (model: string) => unknown;
    };
    const { z } = (await import('zod')) as {
      z: {
        object: (shape: Record<string, unknown>) => unknown;
        string: () => unknown;
      };
    };

    const engine = createEngine();
    engine.step('use python_script');
    engine.step('prohibit shell_command');

    const request = buildGenerateObjectRequest(engine.state, 'Write a tiny Python hello-world script.');

    const openai = createOpenAI({ apiKey });
    const schema = z.object({ code: z.string() });
    const result = await generateObject({
      model: openai('gpt-4.1-mini'),
      prompt: request.prompt,
      schema
    });

    expect(request.schemaName).toBe('python_script');
    expect(result.object).toBeTruthy();
  }, 60_000);
});
