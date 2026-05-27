import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine.js';
import { loadStepFixtures } from './harness/fixtures.js';

const fixtures = await loadStepFixtures();

function assertOptionalPendingFlag(expectedObj: unknown, engine: object, fixtureName: string): void {
  if (typeof expectedObj !== 'object' || expectedObj === null) {
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(expectedObj, 'has_pending_clarification')) {
    return;
  }

  const expectedPending = (expectedObj as Record<string, unknown>).has_pending_clarification;
  expect(typeof expectedPending, `${fixtureName}: has_pending_clarification must be boolean`).toBe('boolean');

  const maybeEngine = engine as Record<string, unknown>;
  expect(typeof maybeEngine.has_pending_clarification, `${fixtureName}: missing has_pending_clarification()`).toBe(
    'function'
  );
  const actualPending = (maybeEngine.has_pending_clarification as () => unknown)();
  expect(actualPending).toBe(expectedPending);
}

describe('step fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('step');

      const engine = createEngine({ state: fixture.payload.initial_state });

      const prelude = fixture.payload.prelude ?? [];
      for (const priorInput of prelude) {
        engine.step(priorInput);
      }

      const decision = engine.step(fixture.payload.input) as Record<string, unknown>;
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
      assertOptionalPendingFlag(expected, engine, fixture.name);
    });
  }
});
