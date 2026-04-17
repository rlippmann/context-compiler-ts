import { createEngine } from '../src/index.js';

declare const process: { argv: string[] };

export function runExample07(): {
  stepKinds: string[];
  finalPolicy: string | null;
} {
  const engine = createEngine();

  const decision1 = engine.step('prohibit peanuts');
  const decision2 = engine.step('remove policy peanuts');
  const decision3 = engine.step('use peanuts');

  return {
    stepKinds: [decision1.kind, decision2.kind, decision3.kind],
    finalPolicy: engine.state.policies.peanuts ?? null
  };
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample07();
  console.log('example 07: single policy correction');
  console.log(JSON.stringify(result, null, 2));
}
