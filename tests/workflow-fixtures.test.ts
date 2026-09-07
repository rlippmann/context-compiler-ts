import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';
import { CanonicalDirective, decompose_directive } from '../src/grammar.js';
import { loadWorkflowFixtures } from './harness/fixtures.js';

const fixtures = await loadWorkflowFixtures();

describe('workflow fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const engine = new Engine();
      engine.import_json(JSON.stringify(fixture.payload.initial_state));
      const observations: Record<string, unknown> = {};
      const payloads: Record<string, string> = {};

      for (const operation of fixture.payload.operations) {
        let result: unknown;
        switch (operation.fn) {
          case 'step':
            result = engine.step(operation.input as string);
            break;
          case 'apply_directive': {
            const directive = decompose_directive(operation.text as string);
            expect(directive, `${fixture.name}: apply_directive input must be canonical`).toBeInstanceOf(CanonicalDirective);
            result = engine.apply_directive(directive as CanonicalDirective);
            break;
          }
          case 'apply_repair': {
            const decision = observations[operation.decision_ref as string] as { repairs: CanonicalDirective[] };
            const repair = decision?.repairs?.[operation.repair_index as number];
            expect(repair, `${fixture.name}: repair reference is missing`).toBeInstanceOf(CanonicalDirective);
            result = engine.apply_directive(repair);
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
          default:
            throw new Error(`${fixture.name}: unsupported workflow operation '${operation.fn}'`);
        }

        if (operation.label != null) {
          observations[operation.label] = result;
          if (operation.fn === 'export_json') payloads[operation.label] = result as string;
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
