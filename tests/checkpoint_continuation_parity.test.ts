import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/index.js';

describe('checkpoint continuation parity', () => {
  it('exports and imports checkpoint with no pending state', () => {
    const engine = createEngine();
    engine.step('set premise concise replies');
    engine.step('use docker');

    const checkpoint = engine.exportCheckpoint();
    expect(checkpoint).toEqual({
      checkpoint_version: 1,
      authoritative_state: { premise: 'concise replies', policies: { docker: 'use' }, version: 2 },
      pending: null
    });

    const restored = createEngine();
    restored.importCheckpoint(checkpoint);

    expect(restored.state).toEqual(engine.state);
    expect(restored.exportCheckpoint()).toEqual(checkpoint);
  });

  it('exports and imports checkpoint with replacement pending state', () => {
    const engine = createEngine();
    const first = engine.step('use kubectl instead of docker');
    expect(first.kind).toBe('clarify');

    const checkpoint = engine.exportCheckpoint();
    expect(checkpoint.pending).toEqual({
      kind: 'replacement',
      replacement: { kind: 'use_only', new_item: 'kubectl', old_item: null },
      prompt_to_user: first.prompt_to_user
    });
    const restored = createEngine();
    restored.importCheckpoint(checkpoint);

    const replay = restored.step('maybe');
    expect(replay.kind).toBe('clarify');
    expect(replay.prompt_to_user).toBe(first.prompt_to_user);
  });

  it('round-trips checkpoint json', () => {
    const engine = createEngine();
    engine.step('use kubectl instead of docker');

    const payload = engine.exportCheckpointJson();
    const restored = createEngine();
    restored.importCheckpointJson(payload);

    expect(restored.exportCheckpointJson()).toBe(payload);
  });

  it('affirmative continuation applies pending event after restore', () => {
    const engine = createEngine();
    const before = engine.state;
    const first = engine.step('use kubectl instead of docker');
    expect(first.kind).toBe('clarify');

    const restored = createEngine();
    restored.importCheckpoint(engine.exportCheckpoint());

    const decision = restored.step('yes');
    expect(decision.kind).toBe('update');
    expect(before).toEqual({ premise: null, policies: {}, version: 2 });
    expect(restored.state).toEqual({ premise: null, policies: { kubectl: 'use' }, version: 2 });
  });

  it('negative continuation discards pending event after restore', () => {
    const engine = createEngine();
    engine.step('use kubectl instead of docker');

    const restored = createEngine();
    restored.importCheckpoint(engine.exportCheckpoint());

    const decision = restored.step('no');
    expect(decision.kind).toBe('update');
    expect(restored.state).toEqual({ premise: null, policies: {}, version: 2 });
  });

  it('unmatched continuation reuses pending prompt exactly after restore', () => {
    const engine = createEngine();
    const first = engine.step('use kubectl instead of docker');
    expect(first.kind).toBe('clarify');

    const restored = createEngine();
    restored.importCheckpoint(engine.exportCheckpoint());

    const decision = restored.step('what?');
    expect(decision.kind).toBe('clarify');
    expect(decision.prompt_to_user).toBe(first.prompt_to_user);
    expect(restored.state).toEqual({ premise: null, policies: {}, version: 2 });
  });

  it('invalid checkpoint import does not mutate current state', () => {
    const engine = createEngine();
    engine.step('set premise concise');
    engine.step('use docker');
    const snapshot = engine.exportCheckpointJson();

    const invalid = JSON.stringify({
      checkpoint_version: 1,
      authoritative_state: { premise: null, policies: {}, version: 2 },
      pending: {
        kind: 'replacement',
        replacement: { kind: 'use_only', new_item: 'kubectl', old_item: 'docker' },
        prompt_to_user: 'confirm?'
      }
    });

    expect(() => engine.importCheckpointJson(invalid)).toThrowError('Invalid checkpoint payload.');
    expect(engine.exportCheckpointJson()).toBe(snapshot);
  });
});
