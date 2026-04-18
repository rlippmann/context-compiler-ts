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
