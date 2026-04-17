import { createEngine, getPremiseValue } from '../src/index.js';

export function runExample02(): {
  setKind: string;
  changeKind: string;
  finalPremise: string | null;
} {
  const engine = createEngine();

  const decision1 = engine.step('set premise vegetarian curry');
  const decision2 = engine.step('change premise to vegan curry');

  return {
    setKind: decision1.kind,
    changeKind: decision2.kind,
    finalPremise: getPremiseValue(engine.state)
  };
}
