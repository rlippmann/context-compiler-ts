import { createEngine, getPolicyItems } from '../src/index.js';

declare const process: { argv: string[] };

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

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample01();
  console.log('example 01: persistent guardrails');
  console.log(JSON.stringify(result, null, 2));
}
