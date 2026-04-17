import { createEngine } from '../src/index.js';

type HostAction = 'call_llm_without_state' | 'call_llm_with_state' | 'show_clarify_prompt';

function handleTurn(engine: ReturnType<typeof createEngine>, input: string): HostAction {
  const decision = engine.step(input);
  if (decision.kind === 'passthrough') {
    return 'call_llm_without_state';
  }
  if (decision.kind === 'update') {
    return 'call_llm_with_state';
  }
  return 'show_clarify_prompt';
}

export function runExample05(): {
  actions: HostAction[];
  finalState: ReturnType<typeof createEngine>['state'];
} {
  const engine = createEngine();

  const actions: HostAction[] = [];
  actions.push(handleTurn(engine, 'hello there'));
  actions.push(handleTurn(engine, 'set premise concise replies'));
  actions.push(handleTurn(engine, 'prohibit peanuts'));
  actions.push(handleTurn(engine, 'remove policy peanuts'));
  actions.push(handleTurn(engine, 'use peanuts'));
  actions.push(handleTurn(engine, 'clear state'));

  return {
    actions,
    finalState: engine.state
  };
}
