import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';
import { loadPreprocessorApiContractFixture } from './harness/fixtures.js';

const fixture = await loadPreprocessorApiContractFixture();

describe('preprocessor public API parity contract (fixture)', () => {
  it('is an api-contract fixture', () => {
    expect(fixture.kind).toBe('api-contract');
  });

  it('exposes required exports from the preprocessor contract', () => {
    for (const required of fixture.required_exports) {
      expect(Object.prototype.hasOwnProperty.call(cc, required), `Missing TS export '${required}'`).toBe(true);
    }
  });

  it('contains unique required export names', () => {
    expect(new Set(fixture.required_exports).size).toBe(fixture.required_exports.length);
  });
});
