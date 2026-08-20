import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';
import { loadGrammarFixtures } from './harness/fixtures.js';

const fixtures = await loadGrammarFixtures();

describe('grammar fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const grammar = cc as unknown as Record<string, unknown>;
      const fn = grammar[fixture.payload.action.fn];
      expect(typeof fn, `${fixture.name}: missing grammar export '${fixture.payload.action.fn}'`).toBe('function');

      if (fixture.payload.action.fn === 'decompose_directive') {
        let result: unknown;
        try {
          result = (fn as (text: string) => unknown)(fixture.payload.action.text as string);
        } catch (error) {
          if (fixture.payload.expected.error == null) {
            throw error;
          }
          expect(String(error)).toContain(fixture.payload.expected.error.message_contains);
          return;
        }
        expect(fixture.payload.expected.error, `${fixture.name}: expected an error`).toBeUndefined();
        expect(result).toEqual(fixture.payload.expected.directive);
        return;
      }

      let result: unknown;
      try {
        result = (fn as (kind: string, operands: Record<string, unknown>) => unknown)(
          fixture.payload.action.kind as string,
          fixture.payload.action.operands ?? {}
        );
      } catch (error) {
        if (fixture.payload.expected.error == null) {
          throw error;
        }
        expect(String(error)).toContain(fixture.payload.expected.error.message_contains);
        return;
      }
      expect(fixture.payload.expected.error, `${fixture.name}: expected an error`).toBeUndefined();
      expect(result).toEqual(fixture.payload.expected.directive);
    });
  }
});
