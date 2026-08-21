import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';

type StructuredScenario = {
  id: string;
  initial_state?: unknown;
  inputs: string[];
};

type StructuredExpectedTurn = {
  input: string;
  decision: Record<string, unknown>;
  state: unknown;
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

      const engine = new Engine();
      if (scenario.initial_state !== undefined && scenario.initial_state !== null) {
        engine.import_json(JSON.stringify(scenario.initial_state));
      }

      expect(expected.turns.length).toBe(scenario.inputs.length);

      for (let i = 0; i < scenario.inputs.length; i += 1) {
        const userInput = scenario.inputs[i];
        const turnExpected = expected.turns[i];
        const decision = engine.step(userInput);

        expect(turnExpected.input).toBe(userInput);
        expect(decision).toEqual(turnExpected.decision);
        expect(JSON.parse(engine.export_json())).toEqual(turnExpected.state);
      }
    });
  }
});
