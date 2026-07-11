import { describe, expect, it } from 'vitest';
import { createEngine, getPolicyItems } from '../src/index.js';

describe('engine hardening parity', () => {
  it('clarifies and does not mutate when setting a premise that already exists', () => {
    const engine = createEngine({ state: { premise: 'concise', policies: { docker: 'use' }, version: 2 } });
    const before = engine.state;

    const decision = engine.step('set premise formal tone');

    expect(decision).toEqual({
      kind: 'clarify',
      state: null,
      prompt_to_user: "Premise already set.\nUse 'change premise to <value>' to modify it."
    });
    expect(engine.state).toEqual(before);
  });

  it('clarifies and does not mutate when changing a premise before one exists', () => {
    const engine = createEngine();
    const before = engine.state;

    const decision = engine.step('change premise to formal tone');

    expect(decision).toEqual({
      kind: 'clarify',
      state: null,
      prompt_to_user: "No premise is set.\nUse 'set premise <value>' to define one."
    });
    expect(engine.state).toEqual(before);
  });

  it('successfully replaces an existing use policy', () => {
    const engine = createEngine({ state: { premise: null, policies: { docker: 'use', pytest: 'prohibit' }, version: 2 } });

    const decision = engine.step('use podman instead of docker');

    expect(decision.kind).toBe('update');
    expect(engine.state).toEqual({
      premise: null,
      policies: { podman: 'use', pytest: 'prohibit' },
      version: 2
    });
  });

  it('treats normalized identity replacements as no-op updates', () => {
    const engine = createEngine({ state: { premise: null, policies: { docker: 'use' }, version: 2 } });

    const decision = engine.step('use The   Docker instead of docker');

    expect(decision).toEqual({
      kind: 'update',
      state: { premise: null, policies: { docker: 'use' }, version: 2 },
      prompt_to_user: null
    });
    expect(engine.state).toEqual({ premise: null, policies: { docker: 'use' }, version: 2 });
  });

  it('matches normalized items for remove-policy paths', () => {
    const engine = createEngine({ state: { premise: null, policies: { 'docker cli': 'use', pytest: 'prohibit' }, version: 2 } });

    const decision = engine.step('remove policy   The   DOCKER   CLI   ');

    expect(decision.kind).toBe('update');
    expect(engine.state).toEqual({
      premise: null,
      policies: { pytest: 'prohibit' },
      version: 2
    });
  });

  it('suspends admin commands while pending clarification exists', () => {
    const engine = createEngine({ state: { premise: 'baseline', policies: { docker: 'use' }, version: 2 } });
    const first = engine.step('use kubectl instead of podman');
    const before = engine.state;

    expect(first.kind).toBe('clarify');
    expect(engine.has_pending_clarification()).toBe(true);

    for (const input of ['clear state', 'reset policies', 'remove policy docker', 'maybe later']) {
      const decision = engine.step(input);
      expect(decision).toEqual({
        kind: 'clarify',
        state: null,
        prompt_to_user: first.prompt_to_user
      });
      expect(engine.state).toEqual(before);
      expect(engine.has_pending_clarification()).toBe(true);
    }
  });

  it('accepts the broader confirmation token matrix with spacing and punctuation normalization', () => {
    const affirmativeCases = ['yes', ' yes please ', 'yep!', 'yeah.', 'sure?', 'ok', 'okay...'];
    for (const token of affirmativeCases) {
      const engine = createEngine();
      engine.step('use kubectl instead of docker');

      const decision = engine.step(token);

      expect(decision.kind).toBe('update');
      expect(engine.state).toEqual({ premise: null, policies: { kubectl: 'use' }, version: 2 });
      expect(engine.has_pending_clarification()).toBe(false);
    }

    const negativeCases = ['no', ' nope ', 'no thanks!', 'no.'];
    for (const token of negativeCases) {
      const engine = createEngine({ state: { premise: null, policies: { docker: 'use' }, version: 2 } });
      engine.step('use kubectl instead of podman');

      const decision = engine.step(token);

      expect(decision.kind).toBe('update');
      expect(engine.state).toEqual({ premise: null, policies: { docker: 'use' }, version: 2 });
      expect(engine.has_pending_clarification()).toBe(false);
    }
  });

  it('clears pending clarification when importJson replaces authoritative state', () => {
    const engine = createEngine();
    engine.step('use kubectl instead of docker');

    expect(engine.has_pending_clarification()).toBe(true);

    engine.importJson('{"premise":"  Ｋｅｅｐ   `focus`  ","policies":{"Docker":"use","pytest":"prohibit"},"version":2}');

    expect(engine.has_pending_clarification()).toBe(false);
    expect(engine.state).toEqual({
      premise: "Keep 'focus'",
      policies: { docker: 'use', pytest: 'prohibit' },
      version: 2
    });
  });

  it('restores equivalent behavior from checkpoint object and checkpoint json', () => {
    const source = createEngine({ state: { premise: null, policies: { docker: 'use', kubectl: 'prohibit' }, version: 2 } });
    const clarify = source.step('use kubectl instead of docker');

    expect(clarify.kind).toBe('clarify');

    const checkpointObject = source.exportCheckpoint();
    const checkpointJson = source.exportCheckpointJson();

    const viaObject = createEngine();
    viaObject.importCheckpoint(checkpointObject);

    const viaJson = createEngine();
    viaJson.importCheckpointJson(checkpointJson);

    const objectDecision = viaObject.step('yes please');
    const jsonDecision = viaJson.step('yes please');

    expect(objectDecision).toEqual(jsonDecision);
    expect(viaObject.state).toEqual(viaJson.state);
    expect(viaObject.state).toEqual({ premise: null, policies: { kubectl: 'use' }, version: 2 });
  });

  it('rejects invalid checkpoint pending shapes atomically across a broader matrix', () => {
    const invalidPendings: unknown[] = [
      'bad',
      { kind: 'replacement' },
      { kind: 'wrong', replacement: { kind: 'use_only', new_item: 'x', old_item: null }, prompt_to_user: 'p' },
      { kind: 'replacement', replacement: { kind: 'use_only', new_item: 'x', old_item: null }, prompt_to_user: 1 },
      { kind: 'replacement', replacement: 'bad', prompt_to_user: 'confirm?' },
      { kind: 'replacement', replacement: { kind: 'use_only', new_item: 'x' }, prompt_to_user: 'confirm?' },
      { kind: 'replacement', replacement: { kind: 'other', new_item: 'x', old_item: null }, prompt_to_user: 'confirm?' },
      { kind: 'replacement', replacement: { kind: 'use_only', new_item: 1, old_item: null }, prompt_to_user: 'confirm?' },
      { kind: 'replacement', replacement: { kind: 'use_only', new_item: 'x', old_item: 'y' }, prompt_to_user: 'confirm?' },
      { kind: 'replacement', replacement: { kind: 'replace_use', new_item: 'x', old_item: null }, prompt_to_user: 'confirm?' }
    ];

    for (const pending of invalidPendings) {
      const engine = createEngine({ state: { premise: 'baseline', policies: { docker: 'use' }, version: 2 } });
      const snapshot = engine.exportCheckpointJson();

      expect(() =>
        engine.importCheckpoint({
          checkpoint_version: 1,
          authoritative_state: { premise: 'new premise', policies: { pytest: 'use' }, version: 2 },
          pending: pending as never
        })
      ).toThrowError('Invalid checkpoint payload.');
      expect(engine.exportCheckpointJson()).toBe(snapshot);
    }
  });

  it('rejects structurally invalid state payloads atomically across a broader matrix', () => {
    const invalidPayloads = [
      '{"premise":1,"policies":{},"version":2}',
      '{"premise":null,"policies":null,"version":2}',
      '{"premise":null,"policies":[],"version":2}',
      '{"premise":null,"policies":{"docker":"maybe"},"version":2}',
      '{"premise":null,"policies":{"docker":"use"},"version":3}',
      '{"premise":null,"version":2}',
      '{"premise":null,"policies":{"docker":"use"},"version":2,"extra":true}',
      '{"premise":null,"policies":{"a":"use"},"version":2}'
    ];

    for (const payload of invalidPayloads) {
      const engine = createEngine({ state: { premise: 'baseline', policies: { docker: 'use' }, version: 2 } });
      const before = engine.state;

      expect(() => engine.importJson(payload)).toThrowError();
      expect(engine.state).toEqual(before);
    }
  });

  it('restores exact valid state from importJson with premise sanitization and sorted policy accessors', () => {
    const engine = createEngine();

    engine.importJson(
      '{"premise":"  Ｋｅｅｐ   `focus`   steady  ","policies":{"pytest":"prohibit","Docker":"use","Alpha":"use"},"version":2}'
    );

    expect(engine.state).toEqual({
      premise: "Keep 'focus' steady",
      policies: { alpha: 'use', docker: 'use', pytest: 'prohibit' },
      version: 2
    });
    expect(getPolicyItems(engine.state)).toEqual(['alpha', 'docker', 'pytest']);
    expect(getPolicyItems(engine.state, 'use')).toEqual(['alpha', 'docker']);
    expect(getPolicyItems(engine.state, 'prohibit')).toEqual(['pytest']);
  });

  it('rejects compound directives with the canonical clarify prompt and no mutation', () => {
    const engine = createEngine({ state: { premise: 'baseline', policies: { docker: 'use' }, version: 2 } });
    const before = engine.state;

    const decision = engine.step('clear state then set premise project');

    expect(decision).toEqual({
      kind: 'clarify',
      state: null,
      prompt_to_user: 'Multiple directives are not supported in one input.\nSubmit each directive separately.'
    });
    expect(engine.state).toEqual(before);
    expect(engine.has_pending_clarification()).toBe(false);
  });

  it('preserves valid single replacement syntax', () => {
    const engine = createEngine({ state: { premise: null, policies: { docker: 'use' }, version: 2 } });

    const decision = engine.step('use podman instead of docker');

    expect(decision.kind).toBe('update');
    expect(engine.state).toEqual({
      premise: null,
      policies: { podman: 'use' },
      version: 2
    });
  });

  it('treats quoted leading directive text as passthrough', () => {
    const engine = createEngine();

    const decision = engine.step('"use docker and prohibit peanuts"');

    expect(decision).toEqual({
      kind: 'passthrough',
      state: null,
      prompt_to_user: null
    });
    expect(engine.state).toEqual({ premise: null, policies: {}, version: 2 });
  });

  it('does not treat quoted payloads as protected from compound scanning', () => {
    const engine = createEngine();

    const decision = engine.step('use "docker and prohibit peanuts"');

    expect(decision).toEqual({
      kind: 'clarify',
      state: null,
      prompt_to_user: 'Multiple directives are not supported in one input.\nSubmit each directive separately.'
    });
    expect(engine.state).toEqual({ premise: null, policies: {}, version: 2 });
  });

  it('checks compound directives only after pending-confirmation precedence', () => {
    const engine = createEngine({ state: { premise: null, policies: { docker: 'use', kubectl: 'prohibit' }, version: 2 } });
    const pending = engine.step('use kubectl instead of docker');

    const decision = engine.step('use docker and prohibit peanuts');

    expect(pending.kind).toBe('clarify');
    expect(decision).toEqual({
      kind: 'clarify',
      state: null,
      prompt_to_user: pending.prompt_to_user
    });
    expect(engine.has_pending_clarification()).toBe(true);
  });

  it('requires token boundaries for second canonical directive detection', () => {
    const engine = createEngine();

    const passthrough = engine.step('abuse docker');
    const single = engine.step('use dockerandprohibit peanuts');

    expect(passthrough.kind).toBe('passthrough');
    expect(single.kind).toBe('update');
    expect(engine.state).toEqual({ premise: null, policies: { 'dockerandprohibit peanuts': 'use' }, version: 2 });
  });
});
