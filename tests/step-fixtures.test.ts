import { describe, expect, it } from 'vitest';
import { create_engine } from '../src/engine.js';
import { loadStepFixtures } from './harness/fixtures.js';

const fixtures = await loadStepFixtures();

describe('step fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('step');

      const engine = create_engine({ state: fixture.payload.initial_state });

      const prelude = fixture.payload.prelude ?? [];
      for (const priorInput of prelude) {
        engine.step(priorInput);
      }

      const decision = engine.step(fixture.payload.input) as Record<string, unknown>;
      const expected = fixture.payload.expected;
      const expectedDecision = expected.decision;

      expect(decision.kind).toBe(expectedDecision.kind);

      expect(decision).toEqual(expectedDecision);

      expect(engine._state_snapshot()).toEqual(expected.state);
    });
  }
});
