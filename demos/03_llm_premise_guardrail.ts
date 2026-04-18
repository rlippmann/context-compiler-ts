import { createEngine } from '../src/index.js';
import {
  buildBaselineMessages,
  buildMediatedMessagesFromTranscript,
  compactUserTurns,
  extractTagValue,
  printDecision,
  printHostCheck,
  printMessages,
  printModelOutput,
  printSpecReport,
  printTagComparison,
  printUserInputs,
  yesNo
} from './common.js';
import { completeMessages } from './llm_client.js';

const PLAN_HEADING_RE = /^\s*(shopping list|ingredients?|steps?|instructions?|directions?|plan)\s*:\s*(.*)$/i;
const LIST_ITEM_RE = /^\s*(?:[-*]|\d+[.)])\s+/;
const NEGATION_RE = /\b(no|without|avoid|exclude|instead of)\b/i;

function planLines(output: string): string[] {
  const lines = output.split('\n');
  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const stripped = line.trim();
    if (stripped === '') {
      continue;
    }

    const heading = stripped.match(PLAN_HEADING_RE);
    if (heading) {
      inSection = true;
      const remainder = (heading[2] ?? '').trim();
      if (remainder !== '') {
        result.push(remainder);
      }
      continue;
    }

    if (inSection || LIST_ITEM_RE.test(stripped)) {
      result.push(stripped);
    }
  }

  return result;
}

function planUsesValue(output: string, value: string): boolean {
  const token = value.toLowerCase();
  for (const line of planLines(output)) {
    const lowered = line.toLowerCase();
    if (!lowered.includes(token)) {
      continue;
    }
    if (NEGATION_RE.test(lowered)) {
      continue;
    }
    return true;
  }
  return false;
}

export async function main(): Promise<void> {
  const engine = createEngine();
  const userInputs = [
    'set premise vegetarian curry',
    'change premise to vegan curry',
    'Give me a shopping list and 3-step plan. First line must be PREMISE:<value>.'
  ];
  printUserInputs(userInputs);

  for (let i = 0; i < userInputs.length; i += 1) {
    const decision = engine.step(userInputs[i]);
    printDecision(`turn ${i + 1}`, decision, engine.state);
  }

  const baselineMessages = buildBaselineMessages(
    userInputs,
    "Be a helpful assistant. Use conversation history to infer the user's current premise."
  );
  printMessages('baseline', baselineMessages);
  const baselineOutput = await completeMessages(baselineMessages);
  printModelOutput('Baseline', baselineOutput);

  const mediatedMessages = buildMediatedMessagesFromTranscript(engine.state, userInputs);
  printMessages('compiler-mediated (full)', mediatedMessages);
  const mediatedOutput = await completeMessages(mediatedMessages);
  printModelOutput('Compiler-mediated (full)', mediatedOutput);

  const compacted = compactUserTurns(userInputs);
  let compactOutput: string;
  if (compacted.promptToUser !== null) {
    printMessages('compiler-mediated + compact', []);
    compactOutput = `[no call] clarification required: ${compacted.promptToUser}`;
    printModelOutput('Compiler-mediated + compact', compactOutput);
  } else {
    const compactMessages = buildMediatedMessagesFromTranscript(compacted.state, compacted.compactedTurns);
    printMessages('compiler-mediated + compact', compactMessages);
    compactOutput = await completeMessages(compactMessages);
    printModelOutput('Compiler-mediated + compact', compactOutput);
  }

  printTagComparison('PREMISE', baselineOutput, mediatedOutput);

  const baselinePremise = extractTagValue(baselineOutput, 'PREMISE');
  const mediatedPremise = extractTagValue(mediatedOutput, 'PREMISE');
  const compactPremise = extractTagValue(compactOutput, 'PREMISE');

  const baselineUsesVegan = planUsesValue(baselineOutput, 'vegan');
  const baselineUsesVegetarian = planUsesValue(baselineOutput, 'vegetarian');
  const mediatedUsesVegan = planUsesValue(mediatedOutput, 'vegan');
  const mediatedUsesVegetarian = planUsesValue(mediatedOutput, 'vegetarian');
  const compactUsesVegan = planUsesValue(compactOutput, 'vegan');
  const compactUsesVegetarian = planUsesValue(compactOutput, 'vegetarian');

  const baselineRespects = !baselineUsesVegetarian;
  const mediatedRespects = !mediatedUsesVegetarian;
  const compactRespects = compacted.promptToUser === null && !compactUsesVegetarian;

  printHostCheck(
    'PLAN_VALUES',
    `vegan=${yesNo(baselineUsesVegan)}, vegetarian=${yesNo(baselineUsesVegetarian)}, premise_tag=${baselinePremise ?? 'MISSING'}`,
    'baseline'
  );
  printHostCheck(
    'PLAN_VALUES',
    `vegan=${yesNo(mediatedUsesVegan)}, vegetarian=${yesNo(mediatedUsesVegetarian)}, premise_tag=${mediatedPremise ?? 'MISSING'}`,
    'compiler-mediated'
  );
  printHostCheck(
    'PLAN_VALUES',
    `vegan=${yesNo(compactUsesVegan)}, vegetarian=${yesNo(compactUsesVegetarian)}, premise_tag=${compactPremise ?? 'MISSING'}`,
    'compiler-mediated + compact'
  );

  printSpecReport({
    testName: '03_explicit_premise_change — stale value removed',
    baselinePass: baselineRespects,
    compilerPass: mediatedRespects,
    compilerCompactPass: compactRespects,
    expected: 'explicit premise change should remove the stale vegetarian value',
    actual:
      mediatedRespects && compactRespects && baselineUsesVegetarian
        ? 'baseline still used stale vegetarian value; both compiler-mediated paths used vegan value'
        : baselineRespects && mediatedRespects && compactRespects
          ? 'all three paths used vegan value'
          : !mediatedRespects || !compactRespects
            ? 'at least one compiler-mediated path included stale vegetarian value'
            : 'baseline already used vegan value; a compiler-mediated path still included stale vegetarian content',
    passed: mediatedRespects && compactRespects,
    resultPass: 'explicit premise change produced current authoritative value',
    resultFail: 'explicit premise change did not produce current authoritative value'
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  await main();
}
