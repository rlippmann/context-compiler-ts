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
    decision: {
      kind: string;
      prompt_to_user: string | null;
      state: Record<string, JsonValue> | null;
    };
    state: Record<string, JsonValue>;
  };
}

export interface TranscriptFixtureCase {
  id: string;
  kind: 'transcript';
  messages: unknown[];
  expected:
    | {
        clarify: {
          prompt_to_user: string;
        };
      }
    | {
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

export interface CheckpointFixtureCase {
  id: string;
  kind: 'checkpoint';
  initial_state: Record<string, JsonValue>;
  prelude?: string[];
  action: {
    fn: 'import_checkpoint' | 'export_checkpoint_json' | 'import_checkpoint_json' | 'checkpoint_json_round_trip';
    payload?: unknown;
  };
  expected: {
    state: Record<string, JsonValue>;
    has_pending_clarification?: boolean;
    payload_json_parseable?: boolean;
    payload_object?: Record<string, JsonValue>;
    error?: {
      type: string;
      message_contains: string;
    };
    followup?: {
      input: string;
      decision: {
        kind: string;
        state: Record<string, JsonValue> | null;
        prompt_to_user: string | null;
      };
      state: Record<string, JsonValue>;
      has_pending_clarification?: boolean;
    };
  };
}

export interface PreprocessorFixtureCase {
  name: string;
  input?: string;
  kind?: 'validator' | 'parse';
  raw_output?: unknown;
  source_input?: string;
  expected?: {
    classification: string;
    output: string | null;
  };
  expected_parsed?: string | null;
}

export interface ControllerFixtureCase {
  id: string;
  kind: 'controller';
  initial_state: Record<string, JsonValue>;
  prelude?: string[];
  action:
    | { fn: 'step'; input: string }
    | { fn: 'preview'; input: string }
    | { fn: 'state_diff'; before: Record<string, JsonValue>; after: Record<string, JsonValue> };
  expected: {
    result?: Record<string, JsonValue>;
    diff?: Record<string, JsonValue>;
    state?: Record<string, JsonValue>;
    state_after_preview?: Record<string, JsonValue>;
    has_pending_clarification?: boolean;
  };
}

export interface PreprocessorApiContractFixture {
  id: string;
  kind: 'api-contract';
  module: string;
  required_exports: string[];
}

export interface NamedFixture<T> {
  name: string;
  path: string;
  payload: T;
}

const FIXTURE_ROOT = resolve(process.cwd(), 'tests', 'fixtures', 'conformance');
const PREPROCESSOR_FIXTURE_ROOT = resolve(process.cwd(), 'tests', 'fixtures', 'preprocessor');

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
  const files = await listJsonFilesRecursive(dir);
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

export async function loadTranscriptFixtures(): Promise<NamedFixture<TranscriptFixtureCase>[]> {
  return loadFixtureFiles<TranscriptFixtureCase>('transcript');
}

export async function loadStateJsonFixtures(): Promise<NamedFixture<StateJsonFixtureCase>[]> {
  return loadFixtureFiles<StateJsonFixtureCase>('state-json');
}

export async function loadCheckpointFixtures(): Promise<NamedFixture<CheckpointFixtureCase>[]> {
  return loadFixtureFiles<CheckpointFixtureCase>('checkpoint');
}

export async function loadControllerFixtures(): Promise<NamedFixture<ControllerFixtureCase>[]> {
  return loadFixtureFiles<ControllerFixtureCase>('controller');
}

export async function loadPreprocessorFixtures(): Promise<NamedFixture<PreprocessorFixtureCase>[]> {
  const files = await listJsonFilesRecursive(PREPROCESSOR_FIXTURE_ROOT);
  const filtered = files
    .filter((path) => !basename(path).startsWith('public-api-'))
    .sort((a, b) => a.localeCompare(b));
  const loaded = await Promise.all(
    filtered.map(async (path) => {
      const raw = await readFile(path, 'utf8');
      const payload = JSON.parse(raw) as PreprocessorFixtureCase;
      return {
        name: basename(path, '.json'),
        path,
        payload
      };
    })
  );
  return loaded;
}

export async function loadPreprocessorApiContractFixture(): Promise<PreprocessorApiContractFixture> {
  const path = join(PREPROCESSOR_FIXTURE_ROOT, 'public-api-v1.json');
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as PreprocessorApiContractFixture;
}

export { FIXTURE_ROOT };
