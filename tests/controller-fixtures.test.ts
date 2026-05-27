import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';
import { createEngine } from '../src/index.js';
import { loadControllerFixtures } from './harness/fixtures.js';

const fixtures = await loadControllerFixtures();
const controller = cc as unknown as Record<string, unknown>;

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

describe('controller fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('controller');

      let engine = createEngine({ state: fixture.payload.initial_state });
      for (const priorInput of fixture.payload.prelude ?? []) {
        engine.step(priorInput);
      }

      const action = fixture.payload.action;
      const expected = fixture.payload.expected;

      if (action.fn === 'step') {
        expect(typeof controller.step).toBe('function');
        const result = (controller.step as (eng: unknown, input: string) => unknown)(engine, action.input);
        expect(result).toEqual(expected.result);
        expect(engine.state).toEqual(expected.state);
        assertOptionalPendingFlag(expected, engine, fixture.name);
        return;
      }

      if (action.fn === 'preview') {
        expect(typeof controller.preview).toBe('function');

        const before = engine.state;
        const maybeEngine = engine as unknown as Record<string, unknown>;
        const pendingBefore =
          typeof maybeEngine.has_pending_clarification === 'function'
            ? (maybeEngine.has_pending_clarification as () => unknown)()
            : undefined;

        const result = (controller.preview as (eng: unknown, input: string) => unknown)(engine, action.input);
        expect(result).toEqual(expected.result);
        expect(engine.state).toEqual(before);
        expect(engine.state).toEqual(expected.state_after_preview);

        if (pendingBefore !== undefined) {
          const pendingAfter = (maybeEngine.has_pending_clarification as () => unknown)();
          expect(pendingAfter).toBe(pendingBefore);
        }
        assertOptionalPendingFlag(expected, engine, fixture.name);
        return;
      }

      expect(typeof controller.state_diff).toBe('function');
      const diff = (controller.state_diff as (before: unknown, after: unknown) => unknown)(action.before, action.after);
      expect(diff).toEqual(expected.diff);
    });
  }
});
