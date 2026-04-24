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

export { FIXTURE_ROOT };
