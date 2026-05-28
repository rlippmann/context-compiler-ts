import { POLICY_PROHIBIT, POLICY_USE, createEngine, getPolicyItems } from '../src/index.js';

declare const process: { argv: string[] };

export function runExample07(): {
  stepKinds: string[];
  finalPolicy: string | null;
} {
  const engine = createEngine();

  const decision1 = engine.step('prohibit peanuts');
  const decision2 = engine.step('remove policy peanuts');
  const decision3 = engine.step('use peanuts');
  const useItems = getPolicyItems(engine.state, POLICY_USE);
  const prohibitItems = getPolicyItems(engine.state, POLICY_PROHIBIT);

  return {
    stepKinds: [decision1.kind, decision2.kind, decision3.kind],
    finalPolicy: useItems.includes('peanuts') ? POLICY_USE : prohibitItems.includes('peanuts') ? POLICY_PROHIBIT : null
  };
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample07();
  console.log('example 07: single policy correction');
  console.log(JSON.stringify(result, null, 2));
}
