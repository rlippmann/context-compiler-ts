import { createEngine, getPolicyItems } from '../src/index.js';

export function runExample01(): {
  turn1Kind: string;
  turn2Kind: string;
  prohibitedPolicies: string[];
} {
  const engine = createEngine();

  const decision1 = engine.step('prohibit peanuts');
  const decision2 = engine.step('how should I make this curry?');

  return {
    turn1Kind: decision1.kind,
    turn2Kind: decision2.kind,
    prohibitedPolicies: getPolicyItems(engine.state, 'prohibit')
  };
}
