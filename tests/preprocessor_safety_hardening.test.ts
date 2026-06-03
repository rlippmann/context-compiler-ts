import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/index.js';
import {
  parse_preprocessor_output,
  preprocess_heuristic,
  validate_preprocessor_output
} from '@rlippmann/context-compiler/experimental/preprocessor';

describe('preprocessor safety hardening', () => {
  it('keeps heuristic directive outputs validator-safe', () => {
    const messages = [
      'use docker',
      'Use Docker',
      'clear state.',
      '(reset policies)',
      '[prohibit peanuts]',
      'use "docker"'
    ];

    for (const message of messages) {
      const result = preprocess_heuristic(message);
      if (result.classification !== 'directive' || result.output == null) {
        continue;
      }
      expect(parse_preprocessor_output(result.output)).toBe(result.output);
      expect(validate_preprocessor_output(result.output)).toEqual({
        classification: 'directive',
        output: result.output
      });
    }
  });

  it('rejects unsafe wrapped or conversational source inputs from validated directive fallback', () => {
    const cases: Array<[string, string]> = [
      ['ok. prohibit peanuts', 'prohibit peanuts'],
      ['clear premise\nreset policies', 'clear premise'],
      ['```\nuse docker\n```', 'use docker'],
      ['the command is `use docker`', 'use docker'],
      ['the docs say "use docker"', 'use docker'],
      ['use docker and explain why', 'use docker'],
      ['can you use docker?', 'use docker'],
      ['example: clear state', 'clear state'],
      ['he said "reset policies"', 'reset policies']
    ];

    for (const [sourceInput, fallbackDirective] of cases) {
      expect(
        validate_preprocessor_output(fallbackDirective, {
          source_input: sourceInput
        })
      ).toEqual({
        classification: 'unknown',
        output: null
      });
      expect(
        parse_preprocessor_output(fallbackDirective, {
          source_input: sourceInput
        })
      ).toBeNull();
    }
  });

  it('prevents unsafe fallback rewrites from mutating engine state', () => {
    const cases: Array<[string, string]> = [
      ['ok. prohibit peanuts', 'prohibit peanuts'],
      ['```\nuse docker\n```', 'use docker'],
      ['the docs say "clear state"', 'clear state'],
      ['can you use docker?', 'use docker']
    ];

    for (const [sourceInput, fallbackDirective] of cases) {
      const parsed = parse_preprocessor_output(fallbackDirective, { source_input: sourceInput });
      const compileInput = parsed ?? sourceInput;

      const engine = createEngine();
      const before = engine.state;
      const decision = engine.step(compileInput);

      expect(decision.kind).not.toBe('update');
      expect(engine.state).toEqual(before);
    }
  });

  it('keeps parser and validator idempotent on representative outputs', () => {
    const outputs: unknown[] = [
      null,
      123,
      '<NO_DIRECTIVE>',
      'use docker',
      ' set premise concise replies ',
      'example: clear state',
      { classification: 'directive', output: 'clear state' },
      { classification: 'unknown', output: null }
    ];

    for (const rawOutput of outputs) {
      const firstParsed = parse_preprocessor_output(rawOutput);
      const secondParsed = parse_preprocessor_output(firstParsed);
      expect(secondParsed).toBe(firstParsed);

      const validated = validate_preprocessor_output(rawOutput);
      if (validated.classification === 'directive') {
        expect(typeof validated.output).toBe('string');
      } else {
        expect(validated.output).toBeNull();
      }
    }
  });

  it('replays representative fixture-like inputs deterministically', () => {
    const messages = [
      'ordinary conversation',
      'use docker',
      'use docker because the repo already has Docker',
      'the command is clear state',
      'clear state.',
      '"clear state"',
      'can you use docker?'
    ];

    for (const message of messages) {
      expect(preprocess_heuristic(message)).toEqual(preprocess_heuristic(message));
    }
  });
});
