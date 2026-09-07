import { describe, expect, it } from 'vitest';
import * as grammar from '../src/grammar.js';
import { render_directive } from '../src/grammar-render.js';
import { loadGrammarFixtures } from './harness/fixtures.js';

const fixtures = await loadGrammarFixtures();

describe('grammar fixtures (conformance)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const publicGrammar = grammar as unknown as Record<string, unknown>;
      const fn = fixture.payload.action.fn === 'render_directive' ? render_directive : publicGrammar[fixture.payload.action.fn];
      if (fixture.payload.action.fn === 'construct_canonical_directive') {
        let result: unknown;
        try {
          result = new grammar.CanonicalDirective(
            fixture.payload.action.kind as string,
            fixture.payload.action.operands as Record<string, string>
          );
        } catch (error) {
          if (fixture.payload.expected.error == null) throw error;
          expect(String(error)).toContain(fixture.payload.expected.error.message_contains);
          return;
        }
        expect(fixture.payload.expected.error, `${fixture.name}: expected an error`).toBeUndefined();
        expect(result).toMatchObject({
          kind: fixture.payload.expected.directive_kind,
          text: fixture.payload.expected.text
        });
        return;
      }
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
        const expected = fixture.payload.expected.directive as Record<string, unknown>;
        if (result instanceof grammar.InvalidDirectiveSyntax) {
          expect({
            kind: 'invalid_directive_syntax',
            failure: result.failure,
            directive_kind: result.directive_kind,
            missing_operand: result.missing_operand
          }).toEqual(expected);
        } else {
          expect(result).toEqual(expected);
        }
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
      expect(result).toEqual({
        text: fixture.payload.expected.text,
        directive_kind: fixture.payload.expected.directive_kind
      });
    });
  }
});
