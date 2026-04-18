import { createEngine } from '../src/index.js';
import type { EngineState } from '../src/index.js';
import {
  buildBaselineMessages,
  buildCompiledSystemPrompt,
  compactUserTurns,
  extractTagValue,
  printDecision,
  printHostCheck,
  printMessages,
  printModelOutput,
  printSpecReport,
  printUserInputs,
  yesNo
} from './common.js';
import type { Message } from './llm_client.js';
import { completeMessages } from './llm_client.js';

const DEMO_NAME = '07_prompt_engineering_comparison — prompt engineering + authoritative state';
const EXPECTED_PREMISE = 'vegan curry';
const FINAL_REQUEST =
  'Give me a dinner plan. First line must be PREMISE:<value>. Use the current premise and then provide a short shopping list.';
const USER_INPUTS = [
  'set premise vegan curry',
  'Side note: I am planning a train trip and need camera advice later.',
  'My coworkers mentioned chicken tikka and shrimp pasta in a brainstorm.',
  'We also discussed weather apps and museum tickets for the weekend.',
  'Draft notes from another thread said beef stew, but those notes may be stale and mixed with unrelated chatter.',
  FINAL_REQUEST
];

const WEAK_SYSTEM_PROMPT = 'Be a helpful assistant.';
const STRONG_PROMPT_ENGINEERING_TEXT = [
  'You are a careful assistant.',
  "Task: determine the user's current premise for this thread and answer the final request.",
  'Rules:',
  '1) Prioritize explicit user directives over brainstorm noise and side notes.',
  '2) Keep the selected premise consistent across the response.',
  '3) If multiple ideas appear, use the current selected premise instead of popularity.',
  '4) First line must be exactly PREMISE:<value>.'
].join('\n');

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function premiseMatchesExpected(output: string, expectedPremise = EXPECTED_PREMISE): boolean {
  const premise = extractTagValue(output, 'PREMISE');
  if (premise === null) {
    return false;
  }
  return normalizeText(premise) === normalizeText(expectedPremise);
}

function buildWeakMessages(userInputs: string[]): Message[] {
  return buildBaselineMessages(userInputs, WEAK_SYSTEM_PROMPT);
}

function buildStrongMessages(userInputs: string[]): Message[] {
  return buildBaselineMessages(userInputs, STRONG_PROMPT_ENGINEERING_TEXT);
}

function buildCompilerMessages(state: EngineState, userInputs: string[]): Message[] {
  const compiledPrefix = buildCompiledSystemPrompt(state);
  return buildBaselineMessages(userInputs, `${compiledPrefix}\n${STRONG_PROMPT_ENGINEERING_TEXT}`);
}

function buildCompactCompilerMessages(state: EngineState, compactedInputs: string[]): Message[] {
  return buildCompilerMessages(state, compactedInputs);
}

function actualSummary(weakPass: boolean, strongPass: boolean, compilerPass: boolean): string {
  if (!weakPass && strongPass && compilerPass) {
    return 'basic prompting drifted, better prompting held the premise, and prompting plus compiled state also held the premise';
  }
  if (weakPass && strongPass && compilerPass) {
    return 'all three paths held the premise in this run';
  }
  if (!strongPass && compilerPass) {
    return 'better prompting alone drifted on premise, but prompting plus compiled state held the authoritative premise';
  }
  if (strongPass && !compilerPass) {
    return 'better prompting held premise, but prompting plus compiled state did not';
  }
  return 'premise handling was inconsistent across paths';
}

export async function main(): Promise<void> {
  const engine = createEngine();
  printUserInputs(USER_INPUTS);

  for (let index = 0; index < USER_INPUTS.length; index += 1) {
    const decision = engine.step(USER_INPUTS[index]);
    printDecision(`turn ${index + 1}`, decision, engine.state);
  }

  const weakMessages = buildWeakMessages(USER_INPUTS);
  printMessages('weak-baseline', weakMessages);
  const weakOutput = await completeMessages(weakMessages);
  printModelOutput('Weak baseline', weakOutput);

  const strongMessages = buildStrongMessages(USER_INPUTS);
  printMessages('strong-baseline', strongMessages);
  const strongOutput = await completeMessages(strongMessages);
  printModelOutput('Strong baseline', strongOutput);

  const compilerMessages = buildCompilerMessages(engine.state, USER_INPUTS);
  printMessages('compiler-mediated (full)', compilerMessages);
  const compilerOutput = await completeMessages(compilerMessages);
  printModelOutput('Compiler-mediated (full)', compilerOutput);

  const compacted = compactUserTurns(USER_INPUTS);
  let compactOutput: string;
  if (compacted.promptToUser !== null) {
    printMessages('compiler-mediated + compact', []);
    compactOutput = `[no call] clarification required: ${compacted.promptToUser}`;
    printModelOutput('Compiler-mediated + compact', compactOutput);
  } else {
    const compactMessages = buildCompactCompilerMessages(compacted.state, compacted.compactedTurns);
    printMessages('compiler-mediated + compact', compactMessages);
    compactOutput = await completeMessages(compactMessages);
    printModelOutput('Compiler-mediated + compact', compactOutput);
  }

  const weakPremise = extractTagValue(weakOutput, 'PREMISE');
  const strongPremise = extractTagValue(strongOutput, 'PREMISE');
  const compilerPremise = extractTagValue(compilerOutput, 'PREMISE');
  const compactPremise = extractTagValue(compactOutput, 'PREMISE');

  const weakPass = premiseMatchesExpected(weakOutput);
  const strongPass = premiseMatchesExpected(strongOutput);
  const compilerPass = premiseMatchesExpected(compilerOutput);
  const compactPass = compacted.promptToUser === null && premiseMatchesExpected(compactOutput);

  const compiledPrefix = buildCompiledSystemPrompt(engine.state);
  const sharedPromptText = compilerMessages[0].content.endsWith(STRONG_PROMPT_ENGINEERING_TEXT);
  const compilerAugmentedOnly =
    JSON.stringify(compilerMessages.slice(1)) === JSON.stringify(strongMessages.slice(1)) &&
    compilerMessages[0].content === `${compiledPrefix}\n${STRONG_PROMPT_ENGINEERING_TEXT}`;

  printHostCheck(
    'WEAK_MATCHES_EXPECTED_PREMISE',
    `${yesNo(weakPass)}, premise_tag=${weakPremise ?? 'MISSING'}`,
    'weak-baseline'
  );
  printHostCheck(
    'STRONG_MATCHES_EXPECTED_PREMISE',
    `${yesNo(strongPass)}, premise_tag=${strongPremise ?? 'MISSING'}`,
    'strong-baseline'
  );
  printHostCheck(
    'COMPILER_MATCHES_EXPECTED_PREMISE',
    `${yesNo(compilerPass)}, premise_tag=${compilerPremise ?? 'MISSING'}`,
    'compiler-mediated'
  );
  printHostCheck(
    'COMPACT_MATCHES_EXPECTED_PREMISE',
    `${yesNo(compactPass)}, premise_tag=${compactPremise ?? 'MISSING'}`,
    'compiler-mediated + compact'
  );
  printHostCheck('COMPILER_REUSES_STRONG_PROMPT_TEXT', yesNo(sharedPromptText), 'compiler-mediated');
  printHostCheck('COMPILER_ONLY_ADDS_COMPILED_STATE', yesNo(compilerAugmentedOnly), 'compiler-mediated');

  const demoPass = !weakPass && strongPass && compilerPass && compactPass && sharedPromptText && compilerAugmentedOnly;
  const assertionOutcome = demoPass ? 'demonstrated' : 'not demonstrated';

  printSpecReport({
    testName: DEMO_NAME,
    baselinePass: strongPass,
    compilerPass,
    compilerCompactPass: compactPass,
    assertionOutcome,
    expected:
      'stronger prompting should improve premise retention; compiled-state paths should be at least as reliable and reuse the same prompt text',
    actual: actualSummary(weakPass, strongPass, compilerPass),
    passed: demoPass,
    resultPass: 'compiled-state paths were clearly more reliable than prompt-only in this run',
    resultFail: 'compiled-state paths were not clearly more reliable than prompt-only in this run'
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  await main();
}
