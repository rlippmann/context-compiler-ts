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

  it('ignores externally assigned legacy-looking properties', () => {
    const engine = new Engine();
    const external = engine as unknown as Record<string, unknown>;
    external._state = { premise: 'injected', policies: { docker: 'prohibit' }, version: 2 };
    external._workingMemory = { premise: 'injected', policies: { docker: 'prohibit' }, version: 2 };

    expect(engine.export_json()).toBe('{"policies":{},"premise":null,"version":2}');
    expect(engine.step('use sqlite')).toMatchObject({ kind: 'update', changed: true });
    expect(JSON.parse(engine.export_json())).toEqual({
      policies: { sqlite: 'use' },
      premise: null,
      version: 2
    });
  });
});
