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
import { completeMessages, getDefaultLlmDelay, setDefaultLlmDelay } from './llm_client.js';

const PLAN_HEADING_RE = /^\s*(dinner plan|ingredients?|steps?|instructions?|directions?|menu|plan)\s*:\s*(.*)$/i;
const LIST_ITEM_RE = /^\s*(?:[-*]|\d+[.)])\s+/;
const NON_VEG_RE = /\b(chicken|beef|pork|bacon|ham|sausage|fish|salmon|tuna|shrimp|lamb|turkey)\b/i;
const NEGATION_RE = /\b(no|without|avoid|exclude|instead of)\b/i;

const ORIGINAL_DIRECTIVE = 'set premise vegetarian curry';
const EXPECTED_PREMISE = 'vegetarian curry';
const FINAL_PROMPT =
  'Now give me a dinner plan. First line must be PREMISE:<value>. Keep the plan consistent with that premise.';
const FORMAT_CONTRACT_SYSTEM_PROMPT =
  'Output contract:\n- First line must be exactly PREMISE:<value>.\n- Then provide a short dinner plan consistent with that premise.';

const DISTRACTOR_TOPICS = [
  'travel photography',
  'city walking routes',
  'weekend train trips',
  'mountain day hikes',
  'pour-over coffee brewing',
  'espresso dialing',
  'architecture sketching',
  'museum planning',
  'weather map reading',
  'atlas navigation',
  'independent bookstores',
  'historical nonfiction reading',
  'film photography',
  'macro photography',
  'night sky viewing',
  'rail station architecture',
  'public transit maps',
  'urban design tours',
  'coastal trail planning',
  'desert trail planning',
  'baking crust hydration',
  'pan sauce reduction',
  'knife-skill practice',
  'tea brewing',
  'city museum circuits'
] as const;
const DISTRACTOR_PROMPT_TEMPLATES = [
  'Quick question on {topic}: which beginner book gives solid fundamentals?',
  'For {topic}, what common pitfall surprises newcomers?',
  'In {topic}, which metric helps compare two options fairly?',
  'How would you plan a one-day itinerary around {topic}?',
  'For {topic}, what gear checklist keeps things practical?',
  'In {topic}, what weather factor changes decisions the most?',
  'What map detail matters most when preparing for {topic}?',
  'For {topic}, which habit improves consistency over months?',
  'How can someone budget for {topic} without losing quality?',
  'For {topic}, what tradeoff appears between speed and accuracy?',
  'What museum exhibit style pairs well with interest in {topic}?',
  'For {topic}, which train route offers the most scenic segments?'
] as const;

function buildMasterDistractorSequence(): string[] {
  const sequence = ['Also I like hiking and jazz.', 'What camera should I buy for travel?'];
  for (const topic of DISTRACTOR_TOPICS) {
    for (const template of DISTRACTOR_PROMPT_TEMPLATES) {
      sequence.push(template.replace('{topic}', topic));
    }
  }
  return sequence;
}

const MASTER_DISTRACTOR_SEQUENCE = buildMasterDistractorSequence();
if (MASTER_DISTRACTOR_SEQUENCE.length < 240) {
  throw new Error('Demo 5 distractor sequence must support at least 240 turns.');
}

const LADDER_TURNS = [10, 30, 60, 120, 240];
const DEFAULT_TURNS = 2;

const ORIGINAL_DEFAULT_TRANSCRIPT = [
  ORIGINAL_DIRECTIVE,
  'Also I like hiking and jazz.',
  'What camera should I buy for travel?',
  FINAL_PROMPT
];

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

function planIncludesNonVegetarianItem(output: string): boolean {
  for (const line of planLines(output)) {
    if (!NON_VEG_RE.test(line)) {
      continue;
    }
    if (NEGATION_RE.test(line)) {
      continue;
    }
    return true;
  }
  return false;
}

function validateTurns(turns: number): void {
  const maxTurns = MASTER_DISTRACTOR_SEQUENCE.length;
  if (turns < 0) {
    throw new Error('turns must be at least 0.');
  }
  if (turns > maxTurns) {
    throw new Error(`turns must be <= ${maxTurns}.`);
  }
}

function buildContextTurns(turns: number): string[] {
  validateTurns(turns);
  return [ORIGINAL_DIRECTIVE, ...MASTER_DISTRACTOR_SEQUENCE.slice(0, turns)];
}

function buildUserInputs(turns: number): string[] {
  return [...buildContextTurns(turns), FINAL_PROMPT];
}

function parseArgs(argv: string[]): { turns: number; llmDelay: number | null } {
  let turns = DEFAULT_TURNS;
  let llmDelay: number | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--turns') {
      const parsed = Number(argv[i + 1] ?? '');
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new Error('Invalid --turns value.');
      }
      turns = parsed;
      i += 1;
      continue;
    }
    if (token === '--llm-delay') {
      const parsed = Number(argv[i + 1] ?? '');
      if (!Number.isFinite(parsed)) {
        throw new Error('Invalid --llm-delay value.');
      }
      llmDelay = parsed;
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      const maxTurns = MASTER_DISTRACTOR_SEQUENCE.length;
      console.log(
        `Run Demo 5 with deterministic distractor distance for prompt-drift stress testing.\n\nOptions:\n  --turns <n>      Number of distractor turns between directive and final prompt (0-${maxTurns}).\n                   Ladder points: ${LADDER_TURNS.join(', ')}.\n  --llm-delay <s>  Delay between LLM calls in seconds.`
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  validateTurns(turns);
  return { turns, llmDelay };
}

function premiseMatchesExpected(output: string, expected: string): boolean {
  const premise = extractTagValue(output, 'PREMISE');
  if (premise === null) {
    return false;
  }
  return premise.trim().toLowerCase() === expected.trim().toLowerCase();
}

async function runDemo(turns: number): Promise<void> {
  const engine = createEngine();
  const userInputs = buildUserInputs(turns);

  if (turns === DEFAULT_TURNS) {
    const same = JSON.stringify(userInputs) === JSON.stringify(ORIGINAL_DEFAULT_TRANSCRIPT);
    if (!same) {
      throw new Error('Demo 5 default transcript diverged from original behavior.');
    }
  }

  printUserInputs(userInputs);

  for (let i = 0; i < userInputs.length; i += 1) {
    const decision = engine.step(userInputs[i]);
    printDecision(`turn ${i + 1}`, decision, engine.state);
  }

  const baselineMessages = buildBaselineMessages(
    userInputs,
    `Be a helpful assistant. Use the conversation context to provide a useful answer.\n${FORMAT_CONTRACT_SYSTEM_PROMPT}`
  );
  printMessages('baseline', baselineMessages);
  const baselineOutput = await completeMessages(baselineMessages);
  printModelOutput('Baseline', baselineOutput);

  const mediatedMessages = buildMediatedMessagesFromTranscript(engine.state, userInputs, FORMAT_CONTRACT_SYSTEM_PROMPT);
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
    const compactMessages = buildMediatedMessagesFromTranscript(
      compacted.state,
      compacted.compactedTurns,
      FORMAT_CONTRACT_SYSTEM_PROMPT
    );
    printMessages('compiler-mediated + compact', compactMessages);
    compactOutput = await completeMessages(compactMessages);
    printModelOutput('Compiler-mediated + compact', compactOutput);
  }

  printTagComparison('PREMISE', baselineOutput, mediatedOutput);

  const baselinePremise = extractTagValue(baselineOutput, 'PREMISE');
  const mediatedPremise = extractTagValue(mediatedOutput, 'PREMISE');
  const compactPremise = extractTagValue(compactOutput, 'PREMISE');

  const baselineMatches = premiseMatchesExpected(baselineOutput, EXPECTED_PREMISE);
  const mediatedMatches = premiseMatchesExpected(mediatedOutput, EXPECTED_PREMISE);
  const compactMatches = compacted.promptToUser === null && premiseMatchesExpected(compactOutput, EXPECTED_PREMISE);

  const baselineNonVeg = planIncludesNonVegetarianItem(baselineOutput);
  const mediatedNonVeg = planIncludesNonVegetarianItem(mediatedOutput);
  const compactNonVeg = planIncludesNonVegetarianItem(compactOutput);

  const baselineRespects = baselineMatches && !baselineNonVeg;
  const mediatedRespects = mediatedMatches && !mediatedNonVeg;
  const compactRespects = compactMatches && !compactNonVeg;

  printHostCheck(
    'PREMISE_AND_PLAN',
    `premise_tag=${baselinePremise ?? 'MISSING'}, premise_matches_expected=${yesNo(baselineMatches)}, plan_includes_non_vegetarian=${yesNo(baselineNonVeg)}`,
    'baseline'
  );
  printHostCheck(
    'PREMISE_AND_PLAN',
    `premise_tag=${mediatedPremise ?? 'MISSING'}, premise_matches_expected=${yesNo(mediatedMatches)}, plan_includes_non_vegetarian=${yesNo(mediatedNonVeg)}`,
    'compiler-mediated'
  );
  printHostCheck(
    'PREMISE_AND_PLAN',
    `premise_tag=${compactPremise ?? 'MISSING'}, premise_matches_expected=${yesNo(compactMatches)}, plan_includes_non_vegetarian=${yesNo(compactNonVeg)}`,
    'compiler-mediated + compact'
  );

  printSpecReport({
    testName: '05_prompt_drift — preserve premise across long transcript',
    baselinePass: baselineRespects,
    compilerPass: mediatedRespects,
    compilerCompactPass: compactRespects,
    expected: 'compiler-mediated should preserve the authoritative premise and keep the plan consistent',
    actual:
      mediatedRespects && compactRespects && !baselineRespects
        ? 'baseline drifted from premise; both compiler-mediated paths preserved premise-consistent plans'
        : baselineRespects && mediatedRespects && compactRespects
          ? 'all three paths preserved premise-consistent plan'
          : !mediatedRespects || !compactRespects
            ? 'at least one compiler-mediated path failed premise consistency'
            : 'baseline preserved premise consistency, but at least one compiler-mediated path failed',
    passed: mediatedRespects && compactRespects,
    resultPass: 'premise consistency preserved',
    resultFail: 'premise consistency not preserved'
  });
}

export async function main(argv: string[] = []): Promise<void> {
  const args = parseArgs(argv);
  const oldDelay = getDefaultLlmDelay();
  if (args.llmDelay !== null) {
    setDefaultLlmDelay(args.llmDelay > 0 ? args.llmDelay : 0);
  }
  try {
    await runDemo(args.turns);
  } finally {
    if (args.llmDelay !== null) {
      setDefaultLlmDelay(oldDelay);
    }
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  await main(process.argv.slice(2));
}
