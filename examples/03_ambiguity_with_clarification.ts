import { createEngine } from '../src/index.js';

export function runExample03(): {
  clarifyKind: string;
  clarifyPrompt: string | null;
  llmCalled: boolean;
  resetKind: string;
} {
  const engine = createEngine();

  engine.step('prohibit peanuts');
  const contradictionDecision = engine.step('use peanuts');

  let llmCalled = false;
  if (contradictionDecision.kind !== 'clarify') {
    llmCalled = true;
  }

  const resetDecision = engine.step('clear state');

  return {
    clarifyKind: contradictionDecision.kind,
    clarifyPrompt: contradictionDecision.prompt_to_user,
    llmCalled,
    resetKind: resetDecision.kind
  };
}
