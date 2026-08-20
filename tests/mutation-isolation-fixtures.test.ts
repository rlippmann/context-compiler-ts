import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/index.js';
import { loadMutationIsolationFixtures } from './harness/fixtures.js';

const fixtures = await loadMutationIsolationFixtures();

function setPath(target: unknown, path: (string | number)[], value: unknown): void {
  expect(path.length).toBeGreaterThan(0);
  let cursor = target as Record<string | number, unknown>;
  for (const segment of path.slice(0, -1)) {
    expect(cursor).toBeDefined();
    cursor = cursor[segment] as Record<string | number, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

describe('mutation-isolation fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const engine = createEngine({ state: fixture.payload.initial_state });
      const operation = fixture.payload.operation;
      let result: unknown;

      if (operation.fn === 'engine.step') {
        result = engine.step(operation.input as string);
      } else if (operation.fn === 'engine.policies') {
        expect('policies' in (engine as object), `${fixture.name}: Engine.policies is required by this fixture`).toBe(
          true
        );
        result = engine.policies;
      } else {
        expect('premise' in (engine as object), `${fixture.name}: Engine.premise is required by this fixture`).toBe(true);
        result = { value: engine.premise };
      }

      const handle = fixture.payload.handles[operation.result_handle];
      expect(handle, `${fixture.name}: missing result handle '${operation.result_handle}'`).toBeDefined();
      const mutableResult = structuredClone(result);
      for (const mutation of fixture.payload.mutations) {
        expect(mutation.target_handle).toBe(operation.result_handle);
        expect(mutation.op).toBe('set');
        setPath(mutableResult, mutation.path, mutation.value);
      }

      expect(engine.state).toEqual(fixture.payload.expected.authoritative_state);
    });
  }
});
