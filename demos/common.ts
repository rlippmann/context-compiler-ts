import { createEngine, getPolicyItems, getPremiseValue } from '../src/index.js';
import type { Decision, EngineState } from '../src/index.js';
import type { Message } from './llm_client.js';

export const VERBOSE_ENV_VAR = 'CONTEXT_COMPILER_DEMO_VERBOSE';

export type DemoReport = {
  name: string;
  expected: string;
  actual: string;
  baseline_pass: boolean;
  compiler_pass: boolean;
  compiler_compact_pass?: boolean;
  demo_pass: boolean;
};

export type InfoReport = {
  name: string;
  baseline_context_length: number;
  compiled_context_length: number;
  context_reduction_percent: number;
  baseline_prompt_length: number;
  compiled_prompt_length: number;
  prompt_reduction_percent: number;
  compacted_context_length?: number;
  compacted_context_reduction_percent?: number;
  compacted_prompt_length?: number;
  compacted_prompt_reduction_percent?: number;
};

let lastReport: DemoReport | null = null;
let lastInfoReport: InfoReport | null = null;

function policyValuesText(state: EngineState, value: 'use' | 'prohibit'): string {
  const items = getPolicyItems(state, value);
  return items.length > 0 ? items.join(', ') : '(none)';
}

function printStateSummary(state: EngineState): void {
  const premiseValue = getPremiseValue(state);
  const premiseText = premiseValue ?? '(none)';
  console.log('compiled state:');
  console.log(`- premise: ${premiseText}`);
  console.log(`- use policies: ${policyValuesText(state, 'use')}`);
  console.log(`- prohibit policies: ${policyValuesText(state, 'prohibit')}`);
}

function printMultilinePrompt(label: string, prompt: string): void {
  console.log(`${label}:`);
  for (const line of prompt.split('\n')) {
    console.log(`- ${line}`);
  }
}

export function isVerbose(): boolean {
  const raw = process.env[VERBOSE_ENV_VAR]?.toLowerCase() ?? '';
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function printUserInputs(inputs: string[]): void {
  if (!isVerbose()) {
    return;
  }
  console.log('User inputs:');
  for (let index = 0; index < inputs.length; index += 1) {
    console.log(`  ${index + 1}. ${inputs[index]}`);
  }
  console.log('');
}

export function printDecision(title: string, decision: Decision, state: EngineState): void {
  if (!isVerbose()) {
    return;
  }
  console.log(`Compiler decision (${title}):`);
  if (decision.kind === 'update') {
    console.log('result: updated');
    printStateSummary(state);
  } else if (decision.kind === 'clarify') {
    console.log('result: clarify');
    if (decision.prompt_to_user) {
      printMultilinePrompt('clarify prompt', decision.prompt_to_user);
    }
    printStateSummary(state);
  } else {
    console.log('result: passthrough');
    printStateSummary(state);
  }
  console.log('');
}

export function printMessages(label: string, messages: Message[]): void {
  if (!isVerbose()) {
    return;
  }
  console.log(`Prompt/messages sent to LLM (${label}):`);
  if (messages.length === 0) {
    console.log('- (none)');
  }
  for (const message of messages) {
    const lines = message.content.split('\n');
    if (lines.length === 0) {
      console.log(`- ${message.role}:`);
      continue;
    }
    console.log(`- ${message.role}: ${lines[0]}`);
    for (let i = 1; i < lines.length; i += 1) {
      console.log(`  ${lines[i]}`);
    }
  }
  console.log('');
}

export function excerptLines(text: string, maxLines = 3): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return text;
  }
  return `${lines.slice(0, maxLines).join('\n')}\n[...]`;
}

export function printModelOutput(label: string, output: string): void {
  if (!isVerbose()) {
    return;
  }
  console.log(`${label} output excerpt:`);
  console.log(excerptLines(output));
  console.log('');
}

export function extractTagValue(output: string, tag: string): string | null {
  const pattern = new RegExp(`^\\s*${tag.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*:\\s*([^\\n]+)\\s*$`, 'im');
  const match = output.match(pattern);
  if (!match) {
    return null;
  }
  return match[1].trim();
}

export function printTagComparison(tag: string, baselineOutput: string, mediatedOutput: string): void {
  if (!isVerbose()) {
    return;
  }
  const baseline = extractTagValue(baselineOutput, tag) ?? 'MISSING';
  const mediated = extractTagValue(mediatedOutput, tag) ?? 'MISSING';
  console.log(`TAG_CHECK ${tag} baseline=${baseline} mediated=${mediated}`);
  console.log('');
}

export function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

export function printHostCheck(name: string, value: string, context: string): void {
  if (!isVerbose()) {
    return;
  }
  console.log(`HOST_CHECK ${name}: ${value} (${context})`);
}

export function printSpecReport(input: {
  testName: string;
  baselinePass: boolean;
  compilerPass: boolean;
  compilerCompactPass?: boolean;
  assertionOutcome?: string;
  expected: string;
  actual: string;
  passed: boolean;
  resultPass: string;
  resultFail: string;
}): void {
  const report: DemoReport = {
    name: input.testName,
    expected: input.expected,
    actual: input.actual,
    baseline_pass: input.baselinePass,
    compiler_pass: input.compilerPass,
    demo_pass: input.passed
  };
  if (input.compilerCompactPass !== undefined) {
    report.compiler_compact_pass = input.compilerCompactPass;
  }
  lastReport = report;

  console.log(input.testName);
  console.log(`baseline: ${input.baselinePass ? 'PASS' : 'FAIL'}`);
  console.log(`compiler: ${input.compilerPass ? 'PASS' : 'FAIL'}`);
  if (input.compilerCompactPass !== undefined) {
    console.log(`compiler+compact: ${input.compilerCompactPass ? 'PASS' : 'FAIL'}`);
  }
  console.log(`expected: ${input.expected}`);
  console.log(`actual: ${input.actual}`);
  if (input.assertionOutcome) {
    console.log(`assertion: ${input.assertionOutcome}`);
  }
  console.log(`result: ${input.passed ? input.resultPass : input.resultFail}`);
  if (isVerbose()) {
    console.log('');
  }
}

export function consumeLastReport(): DemoReport | null {
  const value = lastReport;
  lastReport = null;
  return value;
}

export function printInfoReport(report: InfoReport): void {
  lastInfoReport = report;
}

export function consumeLastInfoReport(): InfoReport | null {
  const value = lastInfoReport;
  lastInfoReport = null;
  return value;
}

export function compactUserTurns(userTurns: string[]): {
  compactedTurns: string[];
  state: EngineState;
  promptToUser: string | null;
} {
  const engine = createEngine();
  const compactedTurns: string[] = [];
  let promptToUser: string | null = null;

  for (const turn of userTurns) {
    const decision = engine.step(turn);
    if (decision.kind === 'update') {
      continue;
    }
    compactedTurns.push(turn);
    if (decision.kind === 'clarify') {
      promptToUser = decision.prompt_to_user;
      break;
    }
  }

  return {
    compactedTurns,
    state: engine.state,
    promptToUser
  };
}

export function buildCompiledSystemPrompt(state: EngineState): string {
  const premise = getPremiseValue(state) ?? '(unset)';
  const useItems = getPolicyItems(state, 'use');
  const prohibitItems = getPolicyItems(state, 'prohibit');
  const useText = useItems.length > 0 ? useItems.join(', ') : '(none)';
  const prohibitText = prohibitItems.length > 0 ? prohibitItems.join(', ') : '(none)';

  return [
    'Follow authoritative compiled state exactly.',
    `- premise: ${premise}`,
    `- use policy items: ${useText}`,
    `- prohibited policy items: ${prohibitText}`,
    'Compiled state overrides transcript drift and conflicts. Do not violate prohibited items.'
  ].join('\n');
}

export function buildBaselineMessages(userTurns: string[], baselineSystemPrompt?: string): Message[] {
  const messages: Message[] = [];
  if (baselineSystemPrompt) {
    messages.push({ role: 'system', content: baselineSystemPrompt });
  }
  for (const turn of userTurns) {
    messages.push({ role: 'user', content: turn });
  }
  return messages;
}

export function buildMediatedMessagesFromTranscript(
  state: EngineState,
  userTurns: string[],
  extraSystemPrompt?: string
): Message[] {
  let systemPrompt = buildCompiledSystemPrompt(state);
  if (extraSystemPrompt) {
    systemPrompt = `${systemPrompt}\n${extraSystemPrompt}`;
  }

  const messages: Message[] = [{ role: 'system', content: systemPrompt }];
  for (const turn of userTurns) {
    messages.push({ role: 'user', content: turn });
  }
  return messages;
}

export function buildMediatedMessages(state: EngineState, userRequest: string, extraSystemPrompt?: string): Message[] {
  let systemPrompt = buildCompiledSystemPrompt(state);
  if (extraSystemPrompt) {
    systemPrompt = `${systemPrompt}\n${extraSystemPrompt}`;
  }
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userRequest }
  ];
}
