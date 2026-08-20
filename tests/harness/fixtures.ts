import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface StepFixtureCase {
  id: string;
  kind: 'step';
  initial_state: Record<string, JsonValue>;
  prelude?: string[];
  input: string;
  expected: {
    decision: Record<string, JsonValue>;
    state: Record<string, JsonValue>;
  };
}

export interface StateJsonFixtureCase {
  id: string;
  kind: 'state_json';
  initial_state: Record<string, JsonValue>;
  prelude?: string[];
  action: {
    fn: 'export_json' | 'import_json';
    payload?: unknown;
  };
  expected: {
    payload?: string;
    state: Record<string, JsonValue>;
    error?: {
      type: string;
      message_contains: string;
    };
  };
}

export interface ControllerFixtureCase {
  id: string;
  kind: 'controller';
  initial_state: Record<string, JsonValue>;
  operations: Array<{
    fn: 'step' | 'apply_directive' | 'export_json' | 'import_json';
    input?: string;
    text?: string;
    payload?: string;
    payload_ref?: string;
    label?: string;
  }>;
  expected: {
    observations: Record<string, JsonValue>;
    equal: string[][];
    state: Record<string, JsonValue>;
  };
}

export interface GrammarFixtureCase {
  id: string;
  kind: 'grammar';
  action: {
    fn: 'decompose_directive' | 'render_directive';
    text?: string;
    kind?: string;
    operands?: Record<string, JsonValue>;
  };
  expected: {
    directive?: Record<string, JsonValue> | null;
    error?: { type: string; message_contains: string };
  };
}

export interface ApplyDirectiveFixtureCase {
  id: string;
  kind: 'apply_directive';
  initial_state: Record<string, JsonValue>;
  action: { fn: 'apply_directive'; text: string };
  expected: {
    decision: Record<string, JsonValue>;
    state: Record<string, JsonValue>;
  };
}

export interface MutationIsolationFixtureCase {
  id: string;
  kind: 'mutation_isolation';
  initial_state: Record<string, JsonValue>;
  prelude?: string[];
  operation: {
    fn: 'engine.step' | 'engine.policies' | 'engine.premise' | 'canonical_directive.operands' | 'directive_metadata';
    input?: string;
    kind?: string;
    operands?: Record<string, JsonValue>;
    canonical_start?: string;
    operand_names?: string[];
    result_handle: string;
  };
  handles: Record<string, { kind: string }>;
  mutations: Array<{
    target_handle: string;
    path: (string | number)[];
    op: 'set';
    value: JsonValue;
  }>;
  expected: {
    authoritative_state: Record<string, JsonValue>;
    caller_owned_observations?: Record<
      string,
      { target_handle: string; path: (string | number)[]; value: JsonValue }
    >;
  };
}

export interface NamedFixture<T> {
  name: string;
  path: string;
  payload: T;
}

const FIXTURE_ROOT = resolve(process.cwd(), 'tests', 'fixtures', 'conformance');

async function listJsonFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listJsonFilesRecursive(abs)));
      continue;
    }
    if (entry.isFile() && extname(entry.name) === '.json') {
      out.push(abs);
    }
  }
  return out;
}

async function loadFixtureFiles<T>(subdir: string): Promise<NamedFixture<T>[]> {
  const dir = join(FIXTURE_ROOT, subdir);
  let files: string[];
  try {
    files = await listJsonFilesRecursive(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  files.sort((a, b) => a.localeCompare(b));

  const loaded = await Promise.all(
    files.map(async (path) => {
      const raw = await readFile(path, 'utf8');
      const payload = JSON.parse(raw) as T;
      return {
        name: basename(path, '.json'),
        path,
        payload
      };
    })
  );

  return loaded;
}

export async function loadStepFixtures(): Promise<NamedFixture<StepFixtureCase>[]> {
  return loadFixtureFiles<StepFixtureCase>('step');
}

export async function loadStateJsonFixtures(): Promise<NamedFixture<StateJsonFixtureCase>[]> {
  return loadFixtureFiles<StateJsonFixtureCase>('state-json');
}

export async function loadControllerFixtures(): Promise<NamedFixture<ControllerFixtureCase>[]> {
  return loadFixtureFiles<ControllerFixtureCase>('controller');
}

export async function loadGrammarFixtures(): Promise<NamedFixture<GrammarFixtureCase>[]> {
  return loadFixtureFiles<GrammarFixtureCase>('grammar');
}

export async function loadApplyDirectiveFixtures(): Promise<NamedFixture<ApplyDirectiveFixtureCase>[]> {
  return loadFixtureFiles<ApplyDirectiveFixtureCase>('apply-directive');
}

export async function loadMutationIsolationFixtures(): Promise<NamedFixture<MutationIsolationFixtureCase>[]> {
  return loadFixtureFiles<MutationIsolationFixtureCase>('mutation-isolation');
}

export { FIXTURE_ROOT };
