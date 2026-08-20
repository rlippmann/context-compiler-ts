import { describe, expect, it } from 'vitest';
import { create_engine } from '../src/engine.js';
import { loadApplyDirectiveFixtures } from './harness/fixtures.js';

const fixtures = await loadApplyDirectiveFixtures();

describe('apply-directive fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const engine = create_engine({ state: fixture.payload.initial_state });
      const applyDirective = (engine as unknown as Record<string, unknown>).apply_directive;
      expect(typeof applyDirective, `${fixture.name}: Engine.apply_directive is required by this fixture`).toBe(
        'function'
      );

      const decision = (applyDirective as (text: string) => unknown).call(engine, fixture.payload.action.text);
      expect(decision).toEqual(fixture.payload.expected.decision);
      expect(engine._state_snapshot()).toEqual(fixture.payload.expected.state);
    });
  }
});
