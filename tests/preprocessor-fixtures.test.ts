import { describe, expect, it } from 'vitest';
import * as cc from '../src/experimental/preprocessor/index.js';
import { loadPreprocessorFixtures } from './harness/fixtures.js';

type PreprocessorLike = {
  preprocess_heuristic?: (message: string) => unknown;
  validate_preprocessor_output?: (raw: unknown, opts?: { source_input?: string }) => unknown;
};

const fixtures = await loadPreprocessorFixtures();
const preprocessor = cc as unknown as PreprocessorLike;

function normalizeHeuristicResult(result: unknown): { classification: string; output: string | null } {
  if (typeof result !== 'object' || result === null) {
    throw new Error('preprocess_heuristic returned non-object result');
  }
  const rec = result as Record<string, unknown>;
  const classification = rec.classification;
  const output = rec.output;

  if (typeof classification === 'string') {
    return {
      classification,
      output: typeof output === 'string' ? output : null
    };
  }

  const outcome = rec.outcome;
  const directive = rec.directive;
  if (typeof outcome === 'string') {
    return {
      classification: outcome,
      output: typeof directive === 'string' ? directive : null
    };
  }

  throw new Error('preprocess_heuristic result missing expected classification/outcome');
}

function normalizeValidatorResult(result: unknown): { classification: string; output: string | null } {
  if (typeof result !== 'object' || result === null) {
    throw new Error('validate_preprocessor_output returned non-object result');
  }
  const rec = result as Record<string, unknown>;
  if (typeof rec.classification !== 'string') {
    throw new Error('validate_preprocessor_output result missing classification');
  }
  return {
    classification: rec.classification,
    output: typeof rec.output === 'string' ? rec.output : null
  };
}

describe('preprocessor fixtures (conformance)', () => {
  it('exposes preprocessor harness entry points', () => {
    expect(typeof preprocessor.preprocess_heuristic).toBe('function');
    expect(typeof preprocessor.validate_preprocessor_output).toBe('function');
  });

  for (const fixture of fixtures) {
    it(fixture.name, () => {
      if (fixture.payload.kind === 'validator') {
        if (typeof preprocessor.validate_preprocessor_output !== 'function') {
          throw new Error('Missing validate_preprocessor_output export');
        }
        const actual = normalizeValidatorResult(
          preprocessor.validate_preprocessor_output(fixture.payload.raw_output, {
            source_input: fixture.payload.source_input
          })
        );
        expect(actual).toEqual(fixture.payload.expected);
        return;
      }

      if (typeof preprocessor.preprocess_heuristic !== 'function') {
        throw new Error('Missing preprocess_heuristic export');
      }
      const actual = normalizeHeuristicResult(preprocessor.preprocess_heuristic(fixture.payload.input as string));
      expect(actual).toEqual(fixture.payload.expected);
    });
  }
});
