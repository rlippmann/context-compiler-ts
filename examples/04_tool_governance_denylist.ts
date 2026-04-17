import { createEngine, getPolicyItems } from '../src/index.js';

declare const process: { argv: string[] };

export function runExample04(): {
  decisionKind: string;
  blockedTools: string[];
  allowedTools: string[];
} {
  const engine = createEngine();

  const decision = engine.step('prohibit docker');
  const prohibited = new Set(getPolicyItems(engine.state, 'prohibit'));

  const tools = ['docker', 'kubectl'];
  const blockedTools = tools.filter((tool) => prohibited.has(tool));
  const allowedTools = tools.filter((tool) => !prohibited.has(tool));

  return {
    decisionKind: decision.kind,
    blockedTools,
    allowedTools
  };
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample04();
  console.log('example 04: tool governance denylist');
  console.log(JSON.stringify(result, null, 2));
}
