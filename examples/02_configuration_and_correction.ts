import { createEngine, getPremiseValue } from '../src/index.js';

declare const process: { argv: string[] };

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

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample02();
  console.log('example 02: configuration and correction');
  console.log(JSON.stringify(result, null, 2));
}
