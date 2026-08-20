import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';
import { loadStateJsonFixtures } from './harness/fixtures.js';

const fixtures = await loadStateJsonFixtures();

describe('state-json fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('state_json');

      const engine = new Engine({ state: fixture.payload.initial_state });
      for (const priorInput of fixture.payload.prelude ?? []) {
        engine.step(priorInput);
      }

      const expected = fixture.payload.expected;
      const action = fixture.payload.action;

      if (action.fn === 'export_json') {
        const payload = engine.export_json();
        expect(payload).toBe(expected.payload);
        expect(JSON.parse(engine.export_json())).toEqual(expected.state);
        return;
      }

      if (expected.error != null) {
        expect(() => engine.import_json(String(action.payload))).toThrowError(expected.error.message_contains);
      } else {
        engine.import_json(String(action.payload));
      }
      expect(JSON.parse(engine.export_json())).toEqual(expected.state);
    });
  }
});
