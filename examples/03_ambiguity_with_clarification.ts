import { createEngine } from '../src/index.js';

declare const process: { argv: string[] };

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

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample03();
  console.log('example 03: ambiguity with clarification');
  console.log(JSON.stringify(result, null, 2));
}
