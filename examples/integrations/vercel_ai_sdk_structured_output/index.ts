import { POLICY_PROHIBIT, POLICY_USE, createEngine, type EngineState, getPolicyItems } from '../../../src/index.js';

declare const process: { argv: string[]; exitCode?: number };

export type StructuredSchemaName = 'python_script' | 'shell_command';

export type StructuredSchema = {
  name: StructuredSchemaName;
  description: string;
  fields: readonly string[];
};

export type GenerateObjectRequest = {
  prompt: string;
  schemaName: StructuredSchemaName;
  schema: StructuredSchema;
};

export type GenerateObjectLike<TObject> = (request: GenerateObjectRequest) => Promise<{ object: TObject }>;

const SCHEMA_REGISTRY: Record<StructuredSchemaName, StructuredSchema> = {
  python_script: {
    name: 'python_script',
    description: 'Generate a Python script request object.',
    fields: ['code']
  },
  shell_command: {
    name: 'shell_command',
    description: 'Generate a shell command request object.',
    fields: ['command']
  }
};

const KNOWN_SCHEMAS: readonly StructuredSchemaName[] = ['python_script', 'shell_command'];

export function selectStructuredSchemasFromState(state: EngineState): StructuredSchema[] {
  const prohibited = new Set(getPolicyItems(state, POLICY_PROHIBIT));
  const preferred = getPolicyItems(state, POLICY_USE).filter((item): item is StructuredSchemaName => {
    return KNOWN_SCHEMAS.includes(item as StructuredSchemaName);
  });

  if (preferred.length > 0) {
    return preferred
      .filter((name) => !prohibited.has(name))
      .map((name) => SCHEMA_REGISTRY[name]);
  }

  return KNOWN_SCHEMAS.filter((name) => !prohibited.has(name)).map((name) => SCHEMA_REGISTRY[name]);
}

export function buildGenerateObjectRequest(state: EngineState, prompt: string): GenerateObjectRequest {
  const available = selectStructuredSchemasFromState(state);
  if (available.length === 0) {
    throw new Error('No structured schemas are available for this compiler state.');
  }
  const selected = available[0];
  return {
    prompt,
    schemaName: selected.name,
    schema: selected
  };
}

export async function generateStructuredObject<TObject>(
  state: EngineState,
  prompt: string,
  generateObject: GenerateObjectLike<TObject>
): Promise<{ request: GenerateObjectRequest; object: TObject }> {
  const request = buildGenerateObjectRequest(state, prompt);
  const result = await generateObject(request);
  return {
    request,
    object: result.object
  };
}

export async function runIntegrationExample(): Promise<{
  availableSchemaNames: StructuredSchemaName[];
  request: GenerateObjectRequest;
  object: { code: string };
}> {
  const engine = createEngine();
  engine.step('use python_script');
  engine.step('prohibit shell_command');
  const state = engine.state;

  const available = selectStructuredSchemasFromState(state);
  const generated = await generateStructuredObject<{ code: string }>(
    state,
    'Write a short Python script that prints Fibonacci numbers up to 21.',
    async (request) => ({
      object: {
        code: `# schema=${request.schemaName}\nprint([0, 1, 1, 2, 3, 5, 8, 13, 21])`
      }
    })
  );

  return {
    availableSchemaNames: available.map((schema) => schema.name),
    request: generated.request,
    object: generated.object
  };
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  runIntegrationExample()
    .then((result) => {
      console.log('integration example: vercel ai sdk structured output (host-side schema selection)');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
