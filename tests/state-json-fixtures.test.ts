import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine.js';
import { loadStateJsonFixtures } from './harness/fixtures.js';

const fixtures = await loadStateJsonFixtures();

describe('state-json fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('state_json');

      const engine = createEngine({ state: fixture.payload.initial_state });
      for (const priorInput of fixture.payload.prelude ?? []) {
        engine.step(priorInput);
      }

      const expected = fixture.payload.expected;
      const action = fixture.payload.action;

      if (action.fn === 'export_json') {
        const payload = engine.exportJson();
        expect(payload).toBe(expected.payload);
        expect(engine.state).toEqual(expected.state);
        return;
      }

      if (expected.error != null) {
        expect(() => engine.importJson(String(action.payload))).toThrowError(expected.error.message_contains);
      } else {
        engine.importJson(String(action.payload));
      }
      expect(engine.state).toEqual(expected.state);
    });
  }
});
