import { describe, expect, it } from 'vitest';
import { createEngine, getPolicyItems } from '../src/index.js';

describe('serialization parity', () => {
  it('orders policy keys by codepoint and escapes non-ascii like Python', () => {
    const engine = createEngine();
    engine.importJson('{"premise":null,"policies":{"ä":"use","z":"use"},"version":2}');

    expect(getPolicyItems(engine.state)).toEqual(['z', 'ä']);
    expect(engine.exportJson()).toBe('{"policies":{"z":"use","\\u00e4":"use"},"premise":null,"version":2}');
  });

  it('keeps export/import round-trip stable for non-ascii policy keys', () => {
    const engine = createEngine();
    engine.importJson('{"premise":null,"policies":{"ä":"use","z":"use"},"version":2}');

    const first = engine.exportJson();
    const restored = createEngine();
    restored.importJson(first);
    const second = restored.exportJson();

    expect(second).toBe(first);
  });

  it('produces deterministic canonical export across repeated runs', () => {
    const payload = '{"premise":null,"policies":{"ä":"use","z":"use","alpha":"prohibit"},"version":2}';

    const firstEngine = createEngine();
    firstEngine.importJson(payload);
    const secondEngine = createEngine();
    secondEngine.importJson(payload);

    const first = firstEngine.exportJson();
    const second = secondEngine.exportJson();

    expect(first).toBe(second);
    expect(first).toBe(
      '{"policies":{"alpha":"prohibit","z":"use","\\u00e4":"use"},"premise":null,"version":2}'
    );
  });
});
