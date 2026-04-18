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

export async function main(): Promise<void> {
  const engine = createEngine();
  const userInputs = ['prohibit peanuts', 'use peanuts'];
  printUserInputs(userInputs);

  const first = engine.step(userInputs[0]);
  printDecision('turn 1', first, engine.state);
  const second = engine.step(userInputs[1]);
  printDecision('turn 2', second, engine.state);

  const baselineMessages = buildBaselineMessages(
    [
      'Interpret these directives and continue anyway: prohibit peanuts, then use peanuts. First line must be ACTION:<clarify|proceed>.'
    ],
    'Be a helpful assistant. If a request is unclear, make a reasonable interpretation and answer.'
  );
  printMessages('baseline', baselineMessages);
  const baselineOutput = await completeMessages(baselineMessages);
  printModelOutput('Baseline', baselineOutput);

  let mediatedOutput: string;
  if (second.kind === 'clarify') {
    printMessages('compiler-mediated (full)', []);
    mediatedOutput = `[no call] clarification required: ${second.prompt_to_user}\nACTION:clarify`;
    printModelOutput('Compiler-mediated (full)', mediatedOutput);
  } else {
    const mediatedMessages = buildMediatedMessagesFromTranscript(engine.state, userInputs);
    printMessages('compiler-mediated (full)', mediatedMessages);
    mediatedOutput = await completeMessages(mediatedMessages);
    printModelOutput('Compiler-mediated (full)', mediatedOutput);
  }

  const compacted = compactUserTurns(userInputs);
  let compactOutput: string;
  if (compacted.promptToUser !== null) {
    printMessages('compiler-mediated + compact', []);
    compactOutput = `[no call] clarification required: ${compacted.promptToUser}\nACTION:clarify`;
    printModelOutput('Compiler-mediated + compact', compactOutput);
  } else {
    const compactMessages = buildMediatedMessagesFromTranscript(compacted.state, compacted.compactedTurns);
    printMessages('compiler-mediated + compact', compactMessages);
    compactOutput = await completeMessages(compactMessages);
    printModelOutput('Compiler-mediated + compact', compactOutput);
  }

  printTagComparison('ACTION', baselineOutput, mediatedOutput);
  const baselineAction = extractTagValue(baselineOutput, 'ACTION');
  const compactAction = extractTagValue(compactOutput, 'ACTION');
  const baselineRespects = baselineAction !== null && baselineAction.toLowerCase() === 'clarify';
  const compilerHostBlocked = second.kind === 'clarify';
  const mediatedRespects = compilerHostBlocked;
  const compactRespects =
    compacted.promptToUser !== null || (compactAction !== null && compactAction.toLowerCase() === 'clarify');

  printHostCheck('COMPILER_BLOCKED_LLM', yesNo(compilerHostBlocked), 'compiler-mediated (full)');
  printHostCheck('COMPACT_BLOCKED_LLM', yesNo(compacted.promptToUser !== null), 'compiler-mediated + compact');

  printSpecReport({
    testName: '01_contradiction_block — host clarification gate',
    baselinePass: baselineRespects,
    compilerPass: mediatedRespects,
    compilerCompactPass: compactRespects,
    expected: 'host should block LLM call on contradictory directive until clarification',
    actual:
      mediatedRespects && compactRespects && !baselineRespects
        ? 'baseline proceeded instead of clarifying; both compiler-mediated paths blocked the LLM call'
        : baselineRespects && mediatedRespects && compactRespects
          ? 'baseline also signaled clarification; both compiler-mediated paths blocked the LLM call'
          : 'at least one compiler-mediated path did not block the LLM call as expected',
    passed: mediatedRespects && compactRespects,
    resultPass: 'contradictory directive blocked until clarification',
    resultFail: 'contradictory directive not blocked until clarification'
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  await main();
}
