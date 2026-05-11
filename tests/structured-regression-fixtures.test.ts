import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/index.js';

type StructuredScenario = {
  id: string;
  initial_checkpoint?: unknown;
  inputs: string[];
};

type StructuredExpectedTurn = {
  input: string;
  decision: {
    kind: string;
    prompt_to_user: string | null;
  };
  checkpoint: unknown;
};

type StructuredExpected = {
  id: string;
  turns: StructuredExpectedTurn[];
};

const ROOT = resolve(process.cwd(), 'tests', 'fixtures', 'engine-regression', 'structured');
const SCENARIOS_DIR = join(ROOT, 'scenarios');
const EXPECTED_DIR = join(ROOT, 'expected');

async function listScenarioFiles(): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(SCENARIOS_DIR);
  return files.filter((f) => f.endsWith('.json')).sort();
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

const scenarioFiles = await listScenarioFiles();

describe('structured regression fixtures (engine-regression/structured)', () => {
  for (const filename of scenarioFiles) {
    const scenarioPath = join(SCENARIOS_DIR, filename);
    const expectedPath = join(EXPECTED_DIR, filename);

    it(basename(filename, '.json'), async () => {
      const scenario = await readJson<StructuredScenario>(scenarioPath);
      const expected = await readJson<StructuredExpected>(expectedPath);

      expect(expected.id).toBe(scenario.id);

      const engine = createEngine();
      if (scenario.initial_checkpoint != null) {
        engine.importCheckpoint(scenario.initial_checkpoint as never);
      }

      expect(expected.turns.length).toBe(scenario.inputs.length);

      for (let i = 0; i < scenario.inputs.length; i += 1) {
        const userInput = scenario.inputs[i];
        const turnExpected = expected.turns[i];
        const decision = engine.step(userInput);
        const checkpoint = engine.exportCheckpoint();

        expect(turnExpected.input).toBe(userInput);
        expect(decision.kind).toBe(turnExpected.decision.kind);
        expect(decision.prompt_to_user).toBe(turnExpected.decision.prompt_to_user);
        expect(checkpoint).toEqual(turnExpected.checkpoint);
      }
    });
  }
});
