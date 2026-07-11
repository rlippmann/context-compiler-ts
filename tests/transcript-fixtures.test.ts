import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile_transcript } from '../src/engine.js';
import { loadTranscriptFixtures } from './harness/fixtures.js';

const transcriptFixtureDir = resolve(process.cwd(), 'tests', 'fixtures', 'conformance', 'transcript');
const transcriptFixturesPresent = await access(transcriptFixtureDir)
  .then(() => true)
  .catch(() => false);
const fixtures = transcriptFixturesPresent ? await loadTranscriptFixtures() : [];

describe.skipIf(!transcriptFixturesPresent)('transcript fixtures (conformance)', () => {
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
