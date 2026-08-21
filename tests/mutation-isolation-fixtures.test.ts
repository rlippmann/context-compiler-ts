import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';
import { CanonicalDirective, DirectiveMetadata } from '../src/grammar.js';
import { loadMutationIsolationFixtures } from './harness/fixtures.js';

const fixtures = await loadMutationIsolationFixtures();

function setPath(target: unknown, path: (string | number)[], value: unknown): void {
  expect(path.length).toBeGreaterThan(0);
  let cursor = target as Record<string | number, unknown>;
  for (const segment of path.slice(0, -1)) {
    expect(cursor).toBeDefined();
    cursor = cursor[segment] as Record<string | number, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

function getPath(target: unknown, path: (string | number)[]): unknown {
  let cursor: unknown = target;
  for (const segment of path) {
    cursor = (cursor as Record<string | number, unknown>)[segment];
  }
  return cursor;
}

describe('mutation-isolation fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const engine = new Engine();
      engine.import_json(JSON.stringify(fixture.payload.initial_state));
      const operation = fixture.payload.operation;
      let result: unknown;

      for (const priorInput of fixture.payload.prelude ?? []) {
        engine.step(priorInput);
      }

      if (operation.fn === 'engine.step') {
        result = engine.step(operation.input as string);
      } else if (operation.fn === 'engine.policies') {
        expect('policies' in (engine as object), `${fixture.name}: Engine.policies is required by this fixture`).toBe(
          true
        );
        result = engine.policies;
      } else if (operation.fn === 'engine.premise') {
        expect('premise' in (engine as object), `${fixture.name}: Engine.premise is required by this fixture`).toBe(true);
        result = { value: engine.premise };
      } else if (operation.fn === 'canonical_directive.operands') {
        const directive = new CanonicalDirective(operation.kind as string, operation.operands as Record<string, unknown>);
        result = directive.operands;
      } else if (operation.fn === 'directive_metadata') {
        result = new DirectiveMetadata(
          operation.kind as 'use_item',
          operation.canonical_start as string,
          operation.operand_names as string[]
        );
      } else {
        throw new Error(`${fixture.name}: unsupported mutation-isolation operation '${operation.fn}'`);
      }

      const handle = fixture.payload.handles[operation.result_handle];
      expect(handle, `${fixture.name}: missing result handle '${operation.result_handle}'`).toBeDefined();
      const immutableResult =
        operation.fn === 'engine.step' ||
        operation.fn === 'canonical_directive.operands' ||
        operation.fn === 'directive_metadata';
      for (const mutation of fixture.payload.mutations) {
        expect(mutation.target_handle).toBe(operation.result_handle);
        expect(mutation.op).toBe('set');
        const mutate = () => setPath(result, mutation.path, mutation.value);
        if (immutableResult) {
          expect(mutate, `${fixture.name}: mutation should be rejected`).toThrow();
        } else {
          mutate();
        }
      }

      expect(JSON.parse(engine.export_json())).toEqual(fixture.payload.expected.authoritative_state);

      for (const [label, observation] of Object.entries(fixture.payload.expected.caller_owned_observations ?? {})) {
        expect(observation, `${fixture.name}: invalid caller observation '${label}'`).toBeDefined();
        expect(fixture.payload.handles[observation.target_handle], `${fixture.name}: missing observation target`).toBeDefined();
        expect(getPath(result, observation.path), `${fixture.name}: caller observation '${label}'`).toEqual(observation.value);
      }
    });
  }
});
