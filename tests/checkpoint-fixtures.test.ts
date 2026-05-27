import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine.js';
import { loadCheckpointFixtures } from './harness/fixtures.js';

const fixtures = await loadCheckpointFixtures();

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

describe('checkpoint fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('checkpoint');

      let engine = createEngine({ state: fixture.payload.initial_state });
      for (const priorInput of fixture.payload.prelude ?? []) {
        engine.step(priorInput);
      }

      const expected = fixture.payload.expected;
      const { action } = fixture.payload;

      if (action.fn === 'import_checkpoint') {
        if (expected.error != null) {
          expect(() => engine.importCheckpoint(action.payload as never)).toThrowError(expected.error.message_contains);
        } else {
          engine.importCheckpoint(action.payload as never);
        }
      } else if (action.fn === 'export_checkpoint_json') {
        const payload = engine.exportCheckpointJson();
        if (expected.payload_json_parseable) {
          const parsed = JSON.parse(payload) as Record<string, unknown>;
          expect(parsed).toEqual(expected.payload_object);
        }
      } else if (action.fn === 'import_checkpoint_json') {
        if (expected.error != null) {
          expect(() => engine.importCheckpointJson(String(action.payload))).toThrowError(expected.error.message_contains);
        } else {
          engine.importCheckpointJson(String(action.payload));
        }
      } else {
        const payload = engine.exportCheckpointJson();
        const target = createEngine();
        target.importCheckpointJson(payload);
        engine = target;
      }

      expect(engine.state).toEqual(expected.state);
      assertOptionalPendingFlag(expected, engine, fixture.name);

      if (expected.followup != null) {
        const decision = engine.step(expected.followup.input);
        expect(decision).toEqual(expected.followup.decision);
        expect(engine.state).toEqual(expected.followup.state);
        assertOptionalPendingFlag(expected.followup, engine, fixture.name);
      }
    });
  }
});
