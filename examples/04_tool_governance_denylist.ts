import { createEngine, getPolicyItems } from '../src/index.js';

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
