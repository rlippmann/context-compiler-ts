import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine.js';
import { loadCheckpointFixtures } from './harness/fixtures.js';

const fixtures = await loadCheckpointFixtures();

describe('checkpoint fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('checkpoint');

      const engine = createEngine({ state: fixture.payload.initial_state });
      for (const priorInput of fixture.payload.prelude ?? []) {
        engine.step(priorInput);
      }

      const expected = fixture.payload.expected;
      if (expected.error != null) {
        expect(() => engine.importCheckpoint(fixture.payload.action.payload as never)).toThrowError(
          expected.error.message_contains
        );
      } else {
        engine.importCheckpoint(fixture.payload.action.payload as never);
      }

      expect(engine.state).toEqual(expected.state);

      if (expected.followup != null) {
        const decision = engine.step(expected.followup.input);
        expect(decision).toEqual(expected.followup.decision);
        expect(engine.state).toEqual(expected.followup.state);
      }
    });
  }
});
