import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine.js';

describe('engine state immutability', () => {
  it('engine.state snapshot mutation does not affect internal engine state', () => {
    const engine = createEngine();
    engine.step('use docker');

    const snapshot = engine.state;
    snapshot.policies.docker = 'prohibit';

    expect(engine.state.policies.docker).toBe('use');
  });

  it('constructor does not alias caller-provided initial state object', () => {
    const init = {
      premise: null,
      policies: { docker: 'use' as const },
      version: 2 as const
    };

    const engine = createEngine({ state: init });

    init.policies.docker = 'prohibit';

    expect(engine.state.policies.docker).toBe('use');
  });

  it('decision.state mutation does not affect internal engine state', () => {
    const engine = createEngine();
    const decision = engine.step('use docker');

    expect(decision.kind).toBe('update');
    expect(decision.state).not.toBeNull();

    const decisionState = decision.state!;
    decisionState.policies.docker = 'prohibit';

    expect(engine.state.policies.docker).toBe('use');
  });
});

describe('engine error-path regressions', () => {
  function expectClarifyNoMutation(engineInput: ReturnType<typeof createEngine>, input: string, expectedPrompt: string): void {
    const before = engineInput.state;
    const decision = engineInput.step(input);

    expect(decision.kind).toBe('clarify');
    expect(decision.state).toBeNull();
    expect(decision.prompt_to_user).toBe(expectedPrompt);
    expect(engineInput.state).toEqual(before);
  }

  it('empty and whitespace use payload clarifies with no mutation', () => {
    const engine = createEngine();
    const prompt = "Policy item cannot be empty.\nUse 'use <item>' with a non-empty value.";

    expectClarifyNoMutation(engine, 'use', prompt);
    expectClarifyNoMutation(engine, 'use   ', prompt);
  });

  it('empty and whitespace prohibit payload clarifies with no mutation', () => {
    const engine = createEngine();
    const prompt = "Policy item cannot be empty.\nUse 'prohibit <item>' with a non-empty value.";

    expectClarifyNoMutation(engine, 'prohibit', prompt);
    expectClarifyNoMutation(engine, 'prohibit   ', prompt);
  });

  it('empty and whitespace remove policy payload clarifies with no mutation', () => {
    const engine = createEngine();
    const prompt = "Policy item cannot be empty.\nUse 'remove policy <item>' with a non-empty value.";

    expectClarifyNoMutation(engine, 'remove policy', prompt);
    expectClarifyNoMutation(engine, 'remove policy   ', prompt);
  });

  it('incomplete replacement intent clarifies with no mutation', () => {
    const engine = createEngine();
    const prompt =
      "Replacement requires both new and old items.\nUse 'use <new item> instead of <old item>' with non-empty values.";

    expectClarifyNoMutation(engine, 'use kubectl instead of', prompt);
    expectClarifyNoMutation(engine, 'use instead of docker', prompt);
  });

  it('contradictions clarify and preserve state in both directions', () => {
    const prohibitToUse = createEngine({ state: { premise: null, policies: { docker: 'prohibit' }, version: 2 } });
    expectClarifyNoMutation(
      prohibitToUse,
      'use docker',
      "'docker' is already prohibited.\nOnly one policy per item is allowed.\nUse 'reset policies' to change it."
    );

    const useToProhibit = createEngine({ state: { premise: null, policies: { docker: 'use' }, version: 2 } });
    expectClarifyNoMutation(
      useToProhibit,
      'prohibit docker',
      "'docker' is already in use.\nOnly one policy per item is allowed.\nUse 'reset policies' to change it."
    );
  });

  it('replacement-intent clarify prompts remain stable', () => {
    const missingSource = createEngine();
    expectClarifyNoMutation(
      missingSource,
      'use kubectl instead of docker',
      'No exact policy found for "docker".\nReplacement requires an exact policy match.\nConfirm to use "kubectl" and keep existing policies?'
    );

    const oldIsProhibit = createEngine({ state: { premise: null, policies: { docker: 'prohibit' }, version: 2 } });
    expectClarifyNoMutation(
      oldIsProhibit,
      'use kubectl instead of docker',
      '"docker" is currently prohibited. Did you mean to remove it and use "kubectl" instead?'
    );

    const newIsProhibit = createEngine({
      state: { premise: null, policies: { docker: 'use', kubectl: 'prohibit' }, version: 2 }
    });
    expectClarifyNoMutation(
      newIsProhibit,
      'use kubectl instead of docker',
      '"kubectl" is currently prohibited. Did you mean to remove "docker" and use "kubectl" instead?'
    );
  });

  it('pending clarification unmatched input reuses prompt and preserves state', () => {
    const engine = createEngine({
      state: { premise: null, policies: { docker: 'use', kubectl: 'prohibit' }, version: 2 }
    });

    const first = engine.step('use kubectl instead of docker');
    expect(first.kind).toBe('clarify');
    expect(first.state).toBeNull();
    const pendingPrompt = first.prompt_to_user;
    const before = engine.state;

    const second = engine.step('maybe later');
    expect(second.kind).toBe('clarify');
    expect(second.state).toBeNull();
    expect(second.prompt_to_user).toBe(pendingPrompt);
    expect(engine.state).toEqual(before);
  });

  it('idempotent assertion/update paths remain update (not clarify)', () => {
    const removeMissing = createEngine({ state: { premise: null, policies: { docker: 'use' }, version: 2 } });
    const removeDecision = removeMissing.step('remove policy podman');
    expect(removeDecision.kind).toBe('update');
    expect(removeDecision.prompt_to_user).toBeNull();
    expect(removeMissing.state).toEqual({ premise: null, policies: { docker: 'use' }, version: 2 });

    const keepUse = createEngine({ state: { premise: null, policies: { docker: 'use' }, version: 2 } });
    const useDecision = keepUse.step('use docker');
    expect(useDecision.kind).toBe('update');
    expect(useDecision.prompt_to_user).toBeNull();
    expect(keepUse.state).toEqual({ premise: null, policies: { docker: 'use' }, version: 2 });
  });
});
