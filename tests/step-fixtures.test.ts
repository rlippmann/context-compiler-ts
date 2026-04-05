import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine.js';
import { loadStepFixtures } from './harness/fixtures.js';

const fixtures = await loadStepFixtures();

describe('step fixtures (v2)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('step');

      const engine = createEngine({ state: fixture.payload.initial_state });

      const prelude = fixture.payload.prelude ?? [];
      for (const priorInput of prelude) {
        engine.step(priorInput);
      }

      const result = engine.step(fixture.payload.input);
      const decision = result.decision as Record<string, unknown>;
      const expected = fixture.payload.expected;
      const expectedDecision = expected.decision;

      expect(decision.kind).toBe(expectedDecision.kind);

      if (decision.kind === 'clarify') {
        expect(decision.state).toEqual(expectedDecision.state);
        const expectedPrompt = expectedDecision.prompt_to_user;
        const actualPrompt = decision.prompt_to_user;
        if (expectedPrompt === null) {
          expect(typeof actualPrompt).toBe('string');
          expect((actualPrompt as string).length > 0).toBe(true);
        } else {
          expect(actualPrompt).toBe(expectedPrompt);
        }
      } else {
        expect(decision).toEqual(expectedDecision);
      }

      if (decision.kind === 'update') {
        expect(decision.state).toEqual(engine.state);
      }

      expect(engine.state).toEqual(expected.state);
    });
  }
});
