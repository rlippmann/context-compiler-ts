import { describe, expect, it } from 'vitest';
import { create_engine, get_policy_items } from '../src/engine.js';

describe('normalization parity', () => {
  it('normalizes policy items with NFKC, lowercase, whitespace collapse, and article stripping', () => {
    const engine = create_engine();
    engine.step('use   The    Ｄｏｃｋｅｒ   CLI  ');

    expect(get_policy_items(engine._state_snapshot())).toEqual(['docker cli']);
    expect(engine._state_snapshot().policies).toEqual({ 'docker cli': 'use' });
  });

  it("normalizes apostrophes and maps dont to don't in policy items", () => {
    const engine = create_engine();
    engine.step('use Don’t panic');
    engine.step('use dont panic');
    engine.step('use `dont` panic');

    expect(get_policy_items(engine._state_snapshot())).toEqual(["'don't' panic", "don't panic"]);
    expect(engine._state_snapshot().policies["don't panic"]).toBe('use');
  });

  it('clarifies when policy item becomes empty after normalization', () => {
    const engine = create_engine();

    const decision = engine.step('use   the   ');
    expect(decision.kind).toBe('clarify');
    expect(decision.prompt_to_user).toBe("Policy item cannot be empty.\nUse 'use <item>' with a non-empty value.");
    expect(engine._state_snapshot()).toEqual({ premise: null, policies: {}, version: 2 });
  });

  it('sanitizes premise with NFKC, apostrophe normalization, and whitespace collapse', () => {
    const engine = create_engine();

    const decision = engine.step('set premise   Ｋｅｅｐ   `focus`   and   Don’t   drift   ');
    expect(decision.kind).toBe('update');
    expect(engine._state_snapshot().premise).toBe("Keep 'focus' and Don't drift");
  });

  it('applies normalization during import and preserves canonical export', () => {
    const engine = create_engine();
    engine.import_json(
      '{"premise":"  Ｋｅｅｐ   `focus`  ","policies":{"The   Ｄｏｃｋｅｒ":"use","dont panic":"prohibit","Don’t Panic":"use"},"version":2}'
    );

    expect(engine._state_snapshot()).toEqual({
      premise: "Keep 'focus'",
      policies: {
        docker: 'use',
        "don't panic": 'use'
      },
      version: 2
    });
    expect(engine.export_json()).toBe('{"policies":{"docker":"use","don\'t panic":"use"},"premise":"Keep \'focus\'","version":2}');
  });
});
