import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/index.js';

describe('transcript parity', () => {
  it('exposes apply_transcript on engine for API parity', () => {
    const engine = createEngine();
    expect(typeof engine.apply_transcript).toBe('function');
  });

  it('replays transcript onto existing engine state via apply_transcript', () => {
    const engine = createEngine({ state: { premise: 'concise', policies: { docker: 'use' }, version: 2 } });

    const result = engine.apply_transcript([
      { role: 'user', content: 'use kubectl' },
      { role: 'user', content: 'remove policy docker' }
    ]);

    expect(result).toEqual({
      kind: 'state',
      state: { premise: 'concise', policies: { kubectl: 'use' }, version: 2 }
    });
    expect(engine.state).toEqual({ premise: 'concise', policies: { kubectl: 'use' }, version: 2 });
  });

  it('resolves pending clarify with yes during apply_transcript replay', () => {
    const engine = createEngine();
    engine.step('use kubectl instead of docker');

    const result = engine.apply_transcript([{ role: 'user', content: 'yes' }]);

    expect(result).toEqual({
      kind: 'state',
      state: { premise: null, policies: { kubectl: 'use' }, version: 2 }
    });
  });

  it('resolves pending clarify with no during apply_transcript replay', () => {
    const engine = createEngine();
    engine.step('use kubectl instead of docker');

    const result = engine.apply_transcript([{ role: 'user', content: 'no' }]);

    expect(result).toEqual({
      kind: 'state',
      state: { premise: null, policies: {}, version: 2 }
    });
  });

  it('unmatched pending input reuses prompt exactly during apply_transcript replay', () => {
    const engine = createEngine();
    const first = engine.step('use kubectl instead of docker');
    expect(first.kind).toBe('clarify');

    const result = engine.apply_transcript([{ role: 'user', content: 'what?' }]);

    expect(result).toEqual({
      kind: 'confirm',
      prompt_to_user: first.prompt_to_user
    });
  });

  it('returns unchanged state for passthrough-only transcript replay', () => {
    const engine = createEngine({ state: { premise: 'Keep short', policies: { docker: 'prohibit' }, version: 2 } });
    const before = engine.state;

    const result = engine.apply_transcript([
      { role: 'assistant', content: 'thanks' },
      { role: 'user', content: 'hello there' },
      { role: 'user', content: 'what do you think?' }
    ]);

    expect(result).toEqual({
      kind: 'state',
      state: before
    });
    expect(engine.state).toEqual(before);
  });

  it('stops before mutating later transcript messages after clarify', () => {
    const engine = createEngine();

    const result = engine.apply_transcript([
      { role: 'user', content: 'use docker' },
      { role: 'user', content: 'prohibit kubectl' },
      { role: 'user', content: 'use kubectl instead of docker' },
      { role: 'user', content: 'set premise should not apply' },
      { role: 'user', content: 'yes' }
    ]);

    expect(result).toEqual({
      kind: 'confirm',
      prompt_to_user: '"kubectl" is currently prohibited. Did you mean to remove "docker" and use "kubectl" instead?'
    });
    expect(engine.state).toEqual({
      premise: null,
      policies: { docker: 'use', kubectl: 'prohibit' },
      version: 2
    });
  });
});
