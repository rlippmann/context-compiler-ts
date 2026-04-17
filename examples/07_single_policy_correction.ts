import { createEngine } from '../src/index.js';

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
