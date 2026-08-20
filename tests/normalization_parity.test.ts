import { describe, expect, it } from 'vitest';
import { create_engine, get_policy_items } from '../src/engine.js';

describe('normalization parity', () => {
  it('normalizes policy items with NFKC, lowercase, and whitespace collapse', () => {
    const engine = create_engine();
    engine.step('use   The    Ｄｏｃｋｅｒ   CLI  ');

    expect(get_policy_items(JSON.parse(engine.export_json()))).toEqual(['the docker cli']);
    expect(JSON.parse(engine.export_json()).policies).toEqual({ 'the docker cli': 'use' });
  });

  it('normalizes apostrophes without rewriting distinct operands', () => {
    const engine = create_engine();
    engine.step('use Don’t panic');
    engine.step('use dont panic');
    engine.step('use `dont` panic');

    expect(get_policy_items(JSON.parse(engine.export_json()))).toEqual(["'dont' panic", "don't panic", 'dont panic']);
    expect(JSON.parse(engine.export_json()).policies["don't panic"]).toBe('use');
  });

  it('preserves a non-empty article as a policy item', () => {
    const engine = create_engine();

    const decision = engine.step('use   the   ');
    expect(decision.kind).toBe('update');
    expect(JSON.parse(engine.export_json())).toEqual({ premise: null, policies: { the: 'use' }, version: 2 });
  });

  it('sanitizes premise with NFKC, apostrophe normalization, and whitespace collapse', () => {
    const engine = create_engine();

    const decision = engine.step('set premise   Ｋｅｅｐ   `focus`   and   Don’t   drift   ');
    expect(decision.kind).toBe('update');
    expect(JSON.parse(engine.export_json()).premise).toBe("Keep 'focus' and Don't drift");
  });

  it('applies normalization during import and preserves canonical export', () => {
    const engine = create_engine();
    engine.import_json(
      '{"premise":"  Ｋｅｅｐ   `focus`  ","policies":{"The   Ｄｏｃｋｅｒ":"use","dont panic":"prohibit","Don’t Panic":"use"},"version":2}'
    );

    expect(JSON.parse(engine.export_json())).toEqual({
      premise: "Keep 'focus'",
      policies: {
        'the docker': 'use',
        'dont panic': 'prohibit',
        "don't panic": 'use'
      },
      version: 2
    });
    expect(engine.export_json()).toBe('{"policies":{"don\'t panic":"use","dont panic":"prohibit","the docker":"use"},"premise":"Keep \'focus\'","version":2}');
  });
});
