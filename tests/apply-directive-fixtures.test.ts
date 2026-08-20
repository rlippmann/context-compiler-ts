import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';
import { CanonicalDirective, decompose_directive } from '../src/grammar.js';
import { loadApplyDirectiveFixtures } from './harness/fixtures.js';

const fixtures = await loadApplyDirectiveFixtures();

describe('apply-directive fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const engine = new Engine({ state: fixture.payload.initial_state });
      const applyDirective = (engine as unknown as Record<string, unknown>).apply_directive;
      expect(typeof applyDirective, `${fixture.name}: Engine.apply_directive is required by this fixture`).toBe(
        'function'
      );

      const directive = decompose_directive(fixture.payload.action.text);
      expect(directive).toBeInstanceOf(CanonicalDirective);
      const decision = (applyDirective as (value: CanonicalDirective) => unknown).call(engine, directive);
      expect(decision).toEqual(fixture.payload.expected.decision);
      expect(JSON.parse(engine.export_json())).toEqual(fixture.payload.expected.state);
    });
  }
});
