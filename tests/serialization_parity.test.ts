import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';

describe('serialization parity', () => {
  it('orders policy keys by codepoint and escapes non-ascii like Python', () => {
    const engine = new Engine();
    engine.import_json('{"premise":null,"policies":{"ä":"use","z":"use"},"version":2}');

    expect(Object.keys(JSON.parse(engine.export_json()).policies).sort()).toEqual(['z', 'ä']);
    expect(engine.export_json()).toBe('{"policies":{"z":"use","\\u00e4":"use"},"premise":null,"version":2}');
  });

  it('keeps export/import round-trip stable for non-ascii policy keys', () => {
    const engine = new Engine();
    engine.import_json('{"premise":null,"policies":{"ä":"use","z":"use"},"version":2}');

    const first = engine.export_json();
    const restored = new Engine();
    restored.import_json(first);
    const second = restored.export_json();

    expect(second).toBe(first);
  });

  it('produces deterministic canonical export across repeated runs', () => {
    const payload = '{"premise":null,"policies":{"ä":"use","z":"use","alpha":"prohibit"},"version":2}';

    const firstEngine = new Engine();
    firstEngine.import_json(payload);
    const secondEngine = new Engine();
    secondEngine.import_json(payload);

    const first = firstEngine.export_json();
    const second = secondEngine.export_json();

    expect(first).toBe(second);
    expect(first).toBe(
      '{"policies":{"alpha":"prohibit","z":"use","\\u00e4":"use"},"premise":null,"version":2}'
    );
  });

  it('rejects empty and colliding normalized policy keys during import', () => {
    const cases = [
      '{"premise":null,"policies":{"   ":"use"},"version":2}',
      '{"premise":null,"policies":{"A":"use","a":"use"},"version":2}',
    ];

    for (const payload of cases) {
      const engine = new Engine();
      expect(() => engine.import_json(payload)).toThrowError('Invalid state payload.');
    }
  });

  it('continues to accept valid non-empty normalized policy keys', () => {
    const engine = new Engine();
    engine.import_json('{"premise":null,"policies":{"Docker":"use"},"version":2}');
    expect(engine.export_json()).toBe('{"policies":{"docker":"use"},"premise":null,"version":2}');
  });
});
