import { createEngine } from '../src/index.js';

declare const process: { argv: string[] };

export function runExample06(): {
  decisions: ReturnType<ReturnType<typeof createEngine>['step']>[];
  restoredState: ReturnType<typeof createEngine>['state'];
} {
  const engine = createEngine();
  const turns = [
    'prohibit peanuts',
    'set premise vegetarian curry',
    'change premise to vegan curry'
  ];

  console.log('Sequence directives through engine.step():');

  const decisions = turns.map((turn) => {
    console.log(`User: ${turn}`);
    const decision = engine.step(turn);
    console.log(JSON.stringify(decision, null, 2));
    return decision;
  });

  const checkpoint = engine.export_checkpoint_json();
  const restored = createEngine();
  restored.import_checkpoint_json(checkpoint);

  console.log();
  console.log('Checkpoint restore keeps authority state:');
  console.log(JSON.stringify(restored.state, null, 2));

  return {
    decisions,
    restoredState: restored.state
  };
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file://').href
) {
  runExample06();
}