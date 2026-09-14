import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';

describe('Engine private working memory', () => {
  it('does not expose its working memory as a runtime property', () => {
    const engine = new Engine();
    expect('_state' in engine).toBe(false);
    expect('workingMemory' in engine).toBe(false);
    expect(Object.getOwnPropertyNames(engine)).toEqual([]);
    expect(Reflect.ownKeys(engine)).toEqual([]);
  });
});
