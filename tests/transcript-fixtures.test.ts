import { describe, expect, it } from 'vitest';
import { compile_transcript } from '../src/engine.js';
import { loadTranscriptFixtures } from './harness/fixtures.js';

const fixtures = await loadTranscriptFixtures();

describe('transcript fixtures (v2)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(fixture.payload.kind).toBe('transcript');

      const result = compile_transcript(fixture.payload.messages);

      let normalized: unknown;
      if (
        typeof result === 'object' &&
        result !== null &&
        Object.keys(result as Record<string, unknown>).length === 2 &&
        Object.prototype.hasOwnProperty.call(result, 'kind') &&
        Object.prototype.hasOwnProperty.call(result, 'prompt_to_user') &&
        typeof (result as Record<string, unknown>).prompt_to_user === 'string'
      ) {
        normalized = {
          clarify: {
            prompt_to_user: (result as Record<string, unknown>).prompt_to_user
          }
        };
      } else {
        normalized = { state: result };
      }

      expect(normalized).toEqual(fixture.payload.expected);
    });
  }
});
