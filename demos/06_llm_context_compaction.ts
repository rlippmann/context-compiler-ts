import { compile_transcript, getPremiseValue } from '../src/index.js';
import { compactUserTurns, isVerbose, printInfoReport } from './common.js';

const DEMO_NAME = '06_context_compaction — superseded directives eliminated';
const FINAL_PREMISE = 'chickpea curry';
const SCALING_TURNS = [5, 20, 50] as const;

type TranscriptMessage = { role: 'user'; content: string };

function buildBaselinePrompt(transcriptTurns: string[]): string {
  const transcriptLines = transcriptTurns.map((turn) => `User: ${turn}`).join('\n');
  return [
    'You are a helpful assistant.',
    'Use the full transcript context below:',
    transcriptLines,
    'Respond using the latest user preference.'
  ].join('\n');
}

function buildCompiledPrompt(compiledPremise: string): string {
  return [
    'You are a helpful assistant.',
    'Host-side authoritative compiled context:',
    `- premise: ${compiledPremise}`,
    'Use only this compiled state as the active context.'
  ].join('\n');
}

function buildTurns(turnCount: number): string[] {
  if (turnCount < 2) {
    throw new Error('turn_count must be at least 2');
  }
  const variants = ['vegan', 'tofu', 'lentil', 'vegetarian'];
  const turns = ['set premise vegetarian curry'];
  for (let index = 0; index < turnCount - 2; index += 1) {
    turns.push(`change premise to ${variants[index % variants.length]} curry`);
  }
  turns.push(`change premise to ${FINAL_PREMISE}`);
  return turns;
}

function compilePremise(turns: string[]): string {
  const messages: TranscriptMessage[] = turns.map((turn) => ({ role: 'user', content: turn }));
  const result = compile_transcript(messages);
  if (result.kind !== 'state') {
    throw new Error('Unexpected clarification while compiling transcript');
  }
  const compiledPremise = getPremiseValue(result.state);
  if (compiledPremise === null) {
    throw new Error('Compiled premise missing');
  }
  return compiledPremise;
}

function contextMetrics(turns: string[], compiledContext: string): { baseline: number; compiled: number; reduction: number } {
  const baselineContext = turns.map((turn) => `User: ${turn}`).join('\n');
  const baselineLength = baselineContext.length;
  const compiledLength = compiledContext.length;
  const reduction = Math.round((1 - compiledLength / baselineLength) * 100);
  return { baseline: baselineLength, compiled: compiledLength, reduction };
}

function printVerboseReport(args: {
  transcriptTurns: string[];
  compiledContext: string;
  baselinePrompt: string;
  compiledPrompt: string;
  compactedContext: string;
  compactedPrompt: string;
  baselineContextLength: number;
  compiledContextLength: number;
  compactedContextLength: number;
  contextReduction: number;
  compactedContextReduction: number;
  baselinePromptLength: number;
  compiledPromptLength: number;
  compactedPromptLength: number;
  promptReduction: number;
  compactedPromptReduction: number;
  scalingRows: Array<{ turns: number; baseline: number; compiled: number; reduction: number }>;
}): void {
  console.log(DEMO_NAME);
  console.log('');
  console.log('Raw transcript context:');
  for (const turn of args.transcriptTurns) {
    console.log(`User: ${turn}`);
  }
  console.log('');
  console.log('Compiled context:');
  console.log(args.compiledContext);
  console.log('');
  console.log('Compacted transcript context:');
  console.log(args.compactedContext || '(none)');
  console.log('');
  console.log('Baseline prompt:');
  console.log(args.baselinePrompt);
  console.log('');
  console.log('Compiled prompt:');
  console.log(args.compiledPrompt);
  console.log('');
  console.log('Compacted prompt:');
  console.log(args.compactedPrompt);
  console.log('');
  console.log('Context scaling:');
  console.log('');
  for (const row of args.scalingRows) {
    console.log(`Turns: ${row.turns}`);
    console.log(`context (state-only): ${row.baseline} → ${row.compiled} chars`);
    console.log(`reduction (state-only): ${row.reduction}%`);
    console.log('');
  }
  console.log(`context (compacted): ${args.baselineContextLength} → ${args.compactedContextLength} chars`);
  console.log(`reduction (compacted): ${args.compactedContextReduction}%`);
  console.log(`prompt (state-only): ${args.baselinePromptLength} → ${args.compiledPromptLength} chars`);
  console.log(`reduction (state-only): ${args.promptReduction}%`);
  console.log(`prompt (compacted): ${args.baselinePromptLength} → ${args.compactedPromptLength} chars`);
  console.log(`reduction (compacted): ${args.compactedPromptReduction}%`);
  console.log('');
  console.log('result: transcript grows linearly; compiled context stays constant');
}

function printCompactReport(args: {
  scalingRows: Array<{ turns: number; baseline: number; compiled: number; reduction: number }>;
  baselineContextLength: number;
  compactedContextLength: number;
  compactedContextReduction: number;
}): void {
  const rowByTurns = new Map<number, { baseline: number; compiled: number; reduction: number }>();
  for (const row of args.scalingRows) {
    rowByTurns.set(row.turns, row);
  }
  const five = rowByTurns.get(5);
  const fifty = rowByTurns.get(50);
  if (!five || !fifty) {
    throw new Error('Missing scaling rows for compact report.');
  }

  console.log(DEMO_NAME);
  console.log(
    `context scaling: 5 turns ${five.baseline} → ${five.compiled} chars (${five.reduction}% reduction); 50 turns ${fifty.baseline} → ${fifty.compiled} chars (${fifty.reduction}% reduction)`
  );
  console.log(
    `compacted transcript: ${args.baselineContextLength} → ${args.compactedContextLength} chars (${args.compactedContextReduction}% reduction)`
  );
  console.log('result: transcript grows linearly; compiled context stays constant');
}

export async function main(): Promise<void> {
  const transcriptTurns = buildTurns(5);
  const compiledPremise = compilePremise(transcriptTurns);
  if (compiledPremise !== FINAL_PREMISE) {
    throw new Error('Unexpected compiled premise for demo 06 baseline turns.');
  }

  const baselineContext = transcriptTurns.map((turn) => `User: ${turn}`).join('\n');
  const compiledContext = `- premise: ${compiledPremise}`;

  const compacted = compactUserTurns(transcriptTurns);
  if (compacted.promptToUser !== null) {
    throw new Error('Demo 06 should not produce clarification during compaction.');
  }
  const compactedPremise = getPremiseValue(compacted.state);
  if (compactedPremise !== FINAL_PREMISE) {
    throw new Error('Compacted state premise diverged from expected final premise.');
  }

  const compactedContext = compacted.compactedTurns.map((turn) => `User: ${turn}`).join('\n');
  const baselinePrompt = buildBaselinePrompt(transcriptTurns);
  const compiledPrompt = buildCompiledPrompt(compiledPremise);
  const compactedPromptText = [
    'You are a helpful assistant.',
    'Host-side authoritative compiled context:',
    `- premise: ${compiledPremise}`,
    'Compacted transcript context:',
    compactedContext === '' ? '(none)' : compactedContext
  ].join('\n');

  const baselineContextLength = baselineContext.length;
  const compiledContextLength = compiledContext.length;
  const contextReduction = Math.round((1 - compiledContextLength / baselineContextLength) * 100);
  const compactedContextLength = compactedContext.length;
  const compactedContextReduction = Math.round((1 - compactedContextLength / baselineContextLength) * 100);

  const baselinePromptLength = baselinePrompt.length;
  const compiledPromptLength = compiledPrompt.length;
  const promptReduction = Math.round((1 - compiledPromptLength / baselinePromptLength) * 100);
  const compactedPromptLength = compactedPromptText.length;
  const compactedPromptReduction = Math.round((1 - compactedPromptLength / baselinePromptLength) * 100);

  const scalingRows: Array<{ turns: number; baseline: number; compiled: number; reduction: number }> = [];
  for (const turns of SCALING_TURNS) {
    const scalingTurns = buildTurns(turns);
    const scalingPremise = compilePremise(scalingTurns);
    if (scalingPremise !== FINAL_PREMISE) {
      throw new Error(`Unexpected compiled premise for scaling turns=${turns}.`);
    }
    const row = contextMetrics(scalingTurns, compiledContext);
    scalingRows.push({ turns, baseline: row.baseline, compiled: row.compiled, reduction: row.reduction });
  }

  if (isVerbose()) {
    printVerboseReport({
      transcriptTurns,
      compiledContext,
      baselinePrompt,
      compiledPrompt,
      compactedContext,
      compactedPrompt: compactedPromptText,
      baselineContextLength,
      compiledContextLength,
      compactedContextLength,
      contextReduction,
      compactedContextReduction,
      baselinePromptLength,
      compiledPromptLength,
      compactedPromptLength,
      promptReduction,
      compactedPromptReduction,
      scalingRows
    });
  } else {
    printCompactReport({
      scalingRows,
      baselineContextLength,
      compactedContextLength,
      compactedContextReduction
    });
  }

  printInfoReport({
    name: DEMO_NAME,
    baseline_context_length: baselineContextLength,
    compiled_context_length: compiledContextLength,
    context_reduction_percent: contextReduction,
    baseline_prompt_length: baselinePromptLength,
    compiled_prompt_length: compiledPromptLength,
    prompt_reduction_percent: promptReduction,
    compacted_context_length: compactedContextLength,
    compacted_context_reduction_percent: compactedContextReduction,
    compacted_prompt_length: compactedPromptLength,
    compacted_prompt_reduction_percent: compactedPromptReduction
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  await main();
}
