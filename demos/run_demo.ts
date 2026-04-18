import {
  VERBOSE_ENV_VAR,
  consumeLastInfoReport,
  consumeLastReport,
  type DemoReport,
  type InfoReport
} from './common.js';
import {
  completeMessages,
  DemoLLMError,
  getDefaultLlmDelay,
  MissingDemoConfigError,
  setDefaultLlmDelay
} from './llm_client.js';
import { main as demo1Main } from './01_llm_contradiction_clarify.js';
import { main as demo2Main } from './02_llm_constraint_guardrail.js';
import { main as demo3Main } from './03_llm_premise_guardrail.js';
import { main as demo4Main } from './04_llm_tool_denylist_guardrail.js';
import { main as demo5Main } from './05_llm_prompt_drift_vs_state.js';
import { main as demo6Main } from './06_llm_context_compaction.js';
import { main as demo7Main } from './07_llm_prompt_vs_state.js';

type DemoFn = (argv?: string[]) => Promise<void>;

const DEMOS: Record<string, { file: string; run: DemoFn }> = {
  '1': { file: '01_llm_contradiction_clarify.ts', run: demo1Main },
  '2': { file: '02_llm_constraint_guardrail.ts', run: demo2Main },
  '3': { file: '03_llm_premise_guardrail.ts', run: demo3Main },
  '4': { file: '04_llm_tool_denylist_guardrail.ts', run: demo4Main },
  '5': { file: '05_llm_prompt_drift_vs_state.ts', run: demo5Main },
  '6': { file: '06_llm_context_compaction.ts', run: demo6Main },
  '7': { file: '07_llm_prompt_vs_state.ts', run: demo7Main }
};

const SCORED_DEMOS = new Set(['1', '2', '3', '4', '5', '7']);

function parseArgs(argv: string[]): {
  demo: string;
  verbose: boolean;
  llmDelay: number;
  demoArgs: string[];
} {
  let demo = 'all';
  let verbose = false;
  let llmDelay = 0;
  const demoArgs: string[] = [];

  const tokens = [...argv];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--') {
      demoArgs.push(...tokens.slice(i + 1));
      break;
    }

    if (token === '--verbose') {
      verbose = true;
      i += 1;
      continue;
    }

    if (token === '--llm-delay') {
      const parsed = Number(tokens[i + 1] ?? '');
      if (!Number.isFinite(parsed)) {
        throw new Error('Invalid --llm-delay value.');
      }
      llmDelay = parsed;
      i += 2;
      continue;
    }

    if (token.startsWith('--')) {
      throw new Error(`Unknown option: ${token}`);
    }

    if (demo === 'all') {
      demo = token;
    } else {
      demoArgs.push(token);
    }
    i += 1;
  }

  if (demo !== 'all' && !(demo in DEMOS)) {
    throw new Error(`Demo must be one of: all, ${Object.keys(DEMOS).join(', ')}`);
  }
  if (demo === 'all' && demoArgs.length > 0) {
    throw new Error('demo-specific args are only supported when running a single demo');
  }

  return { demo, verbose, llmDelay, demoArgs };
}

function verboseDemoLabel(filename: string): string {
  return filename.replace('.ts', '').replace('_llm', '');
}

function isCompilerRegression(result: DemoReport): boolean {
  return result.baseline_pass && !result.compiler_pass;
}

function printCompilerRegressionWarning(): void {
  console.log('');
  console.log('⚠️ MEDIATED REGRESSION');
  console.log('baseline succeeded but compiler-mediated version failed');
}

async function preflightAllMode(): Promise<void> {
  await completeMessages([{ role: 'user', content: 'Reply with exactly: OK' }], { delaySeconds: 0 });
}

function printConfigError(error: MissingDemoConfigError): void {
  const mode = error.baseUrl ? 'OpenAI-compatible endpoint' : 'OpenAI API';
  console.log('Unable to run LLM demos: missing model configuration.');
  console.log(`Assumed mode: ${mode}`);
  console.log(`Missing variables: ${error.missing.join(', ')}`);
  console.log('Example setup:');
  if (error.baseUrl) {
    console.log('  export OPENAI_BASE_URL=http://localhost:11434/v1');
    console.log('  export OPENAI_API_KEY=ollama');
    console.log('  export MODEL=llama3.1:8b');
  } else {
    console.log('  export OPENAI_API_KEY=your_key_here');
    console.log('  export MODEL=gpt-4.1-mini');
  }
}

async function runSingle(
  key: string,
  opts: { verbose: boolean; llmDelay: number; demoArgs: string[] }
): Promise<{ report: DemoReport | null; info: InfoReport | null }> {
  const entry = DEMOS[key];
  if (!entry) {
    throw new Error(`Unknown demo key: ${key}`);
  }

  if (opts.verbose) {
    console.log(`===== Running ${verboseDemoLabel(entry.file)} =====`);
  }

  const oldVerbose = process.env[VERBOSE_ENV_VAR];
  const oldDelay = getDefaultLlmDelay();

  process.env[VERBOSE_ENV_VAR] = opts.verbose ? '1' : '0';
  setDefaultLlmDelay(opts.llmDelay > 0 ? opts.llmDelay : 0);

  try {
    await entry.run(opts.demoArgs);
    return { report: consumeLastReport(), info: consumeLastInfoReport() };
  } finally {
    if (oldVerbose === undefined) {
      delete process.env[VERBOSE_ENV_VAR];
    } else {
      process.env[VERBOSE_ENV_VAR] = oldVerbose;
    }
    setDefaultLlmDelay(oldDelay);
  }
}

function printUsageAndExit(error: string): never {
  console.error(error);
  console.error('');
  console.error('Usage: node dist/demos/run_demo.js [all|1|2|3|4|5|6|7] [--verbose] [--llm-delay <seconds>] [-- <demo-args>]');
  process.exit(2);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    printUsageAndExit(error instanceof Error ? error.message : String(error));
  }

  if (args.demo === 'all') {
    try {
      await preflightAllMode();
    } catch (error) {
      if (error instanceof MissingDemoConfigError) {
        printConfigError(error);
        process.exit(2);
      }
      if (error instanceof DemoLLMError) {
        console.log(error.message);
        process.exit(2);
      }
      throw error;
    }

    let baselinePassCount = 0;
    let baselineFailCount = 0;
    let compilerPassCount = 0;
    let compilerFailCount = 0;
    let compactPassCount = 0;
    let compactFailCount = 0;
    let compilerRegressions = 0;
    const informationalReports: InfoReport[] = [];

    const keys = Object.keys(DEMOS).sort();
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (i > 0 && !args.verbose) {
        console.log('');
      }

      let result;
      try {
        result = await runSingle(key, {
          verbose: args.verbose,
          llmDelay: args.llmDelay,
          demoArgs: []
        });
      } catch (error) {
        if (error instanceof MissingDemoConfigError) {
          printConfigError(error);
          process.exit(2);
        }
        if (error instanceof DemoLLMError) {
          console.log(error.message);
          process.exit(2);
        }
        throw error;
      }

      if (result.info !== null) {
        informationalReports.push(result.info);
      }

      if (!SCORED_DEMOS.has(key)) {
        continue;
      }

      if (result.report === null) {
        baselineFailCount += 1;
        compilerFailCount += 1;
        compactFailCount += 1;
        continue;
      }

      if (result.report.baseline_pass) {
        baselinePassCount += 1;
      } else {
        baselineFailCount += 1;
      }

      if (result.report.compiler_pass) {
        compilerPassCount += 1;
      } else {
        compilerFailCount += 1;
      }

      const compactPass = result.report.compiler_compact_pass ?? result.report.compiler_pass;
      if (compactPass) {
        compactPassCount += 1;
      } else {
        compactFailCount += 1;
      }

      if (isCompilerRegression(result.report)) {
        compilerRegressions += 1;
        printCompilerRegressionWarning();
      }
    }

    console.log('');
    console.log('Summary:');
    console.log('');
    console.log('Evaluative demos:');
    console.log(`Baseline results: ${baselinePassCount} passed, ${baselineFailCount} failed`);
    console.log(`Compiler results: ${compilerPassCount} passed, ${compilerFailCount} failed`);
    console.log(`Compiler+compact results: ${compactPassCount} passed, ${compactFailCount} failed`);

    if (compilerRegressions > 0) {
      console.log('');
      if (compilerRegressions === 1) {
        console.log('*** 1 MEDIATED REGRESSION DETECTED ***');
      } else {
        console.log(`*** ${compilerRegressions} MEDIATED REGRESSIONS DETECTED ***`);
      }
    }

    if (informationalReports.length > 0) {
      console.log('');
      console.log('Informational demo:');
      for (const report of informationalReports) {
        const demoId = report.name.split(' — ', 1)[0];
        console.log(
          `${demoId} — context ${report.baseline_context_length} → ${report.compiled_context_length} chars (${report.context_reduction_percent}% reduction); prompt ${report.baseline_prompt_length} → ${report.compiled_prompt_length} chars (${report.prompt_reduction_percent}% reduction)`
        );
        if (
          report.compacted_context_length !== undefined &&
          report.compacted_context_reduction_percent !== undefined &&
          report.compacted_prompt_length !== undefined &&
          report.compacted_prompt_reduction_percent !== undefined
        ) {
          console.log(
            `${demoId} — compacted context ${report.baseline_context_length} → ${report.compacted_context_length} chars (${report.compacted_context_reduction_percent}% reduction); compacted prompt ${report.baseline_prompt_length} → ${report.compacted_prompt_length} chars (${report.compacted_prompt_reduction_percent}% reduction)`
          );
        }
      }
    }

    if (compilerRegressions > 0) {
      process.exit(1);
    }
    return;
  }

  try {
    const result = await runSingle(args.demo, {
      verbose: args.verbose,
      llmDelay: args.llmDelay,
      demoArgs: args.demoArgs
    });

    if (SCORED_DEMOS.has(args.demo) && result.report !== null && isCompilerRegression(result.report)) {
      printCompilerRegressionWarning();
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof MissingDemoConfigError) {
      printConfigError(error);
      process.exit(2);
    }
    if (error instanceof DemoLLMError) {
      console.log(error.message);
      process.exit(2);
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  await main();
}
