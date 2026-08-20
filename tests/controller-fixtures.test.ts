import { describe, expect, it } from 'vitest';
import { create_engine } from '../src/engine.js';
import { CanonicalDirective, decompose_directive } from '../src/grammar.js';
import { loadControllerFixtures } from './harness/fixtures.js';

const fixtures = await loadControllerFixtures();

describe('controller fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('controller');

      const engine = create_engine({ state: fixture.payload.initial_state });
      const observations: Record<string, unknown> = {};
      const payloads: Record<string, string> = {};

      for (const operation of fixture.payload.operations) {
        let result: unknown;
        switch (operation.fn) {
          case 'step':
            result = engine.step(operation.input as string);
            break;
          case 'apply_directive': {
            const applyDirective = (engine as unknown as Record<string, unknown>).apply_directive;
            expect(typeof applyDirective, `${fixture.name}: Engine.apply_directive is required by this fixture`).toBe(
              'function'
            );
            const directive = decompose_directive(operation.text as string);
            expect(directive, `${fixture.name}: apply_directive input must be canonical`).toBeInstanceOf(CanonicalDirective);
            result = (applyDirective as (value: CanonicalDirective) => unknown).call(engine, directive);
            break;
          }
          case 'export_json':
            result = engine.export_json();
            break;
          case 'import_json': {
            const payload = operation.payload_ref == null ? operation.payload : payloads[operation.payload_ref];
            expect(typeof payload, `${fixture.name}: import_json payload is missing`).toBe('string');
            engine.import_json(payload as string);
            result = undefined;
            break;
          }
        }

        if (operation.label != null) {
          observations[operation.label] = result;
          if (operation.fn === 'export_json') {
            payloads[operation.label] = result as string;
          }
        }
      }

      for (const [left, right] of fixture.payload.expected.equal) {
        expect(observations[left], `${fixture.name}: missing observation '${left}'`).toEqual(observations[right]);
      }
      expect(observations).toMatchObject(fixture.payload.expected.observations);
      expect(JSON.parse(engine.export_json())).toEqual(fixture.payload.expected.state);
    });
  }
});
