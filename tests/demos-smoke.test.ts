import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const DIST_DEMOS = resolve(ROOT, 'dist', 'demos');

function runNodeScript(file: string, args: string[] = [], envOverride?: Record<string, string | undefined>) {
  const script = resolve(DIST_DEMOS, file);
  const run = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...envOverride
    }
  });
  return {
    status: run.status,
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? ''
  };
}

function runNodeScriptWithMock(file: string, args: string[] = []) {
  // Force deterministic/offline smoke behavior in CI: no real LLM calls.
  // Mock mode keeps demo smoke runs stable and fast.
  return runNodeScript(file, args, {
    CONTEXT_COMPILER_DEMO_MOCK: '1',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '' ? process.env.OPENAI_API_KEY : 'mock-key',
    MODEL: process.env.MODEL && process.env.MODEL.trim() !== '' ? process.env.MODEL : 'mock-model'
  });
}

describe('demos smoke', () => {
  beforeAll(() => {
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    if (build.status !== 0) {
      throw new Error(`Build failed.\nSTDOUT:\n${build.stdout}\nSTDERR:\n${build.stderr}`);
    }
  }, 120_000);

  it('runner fails fast with setup instructions when config is missing', () => {
    const run = runNodeScript('run_demo.js', ['all'], {
      OPENAI_API_KEY: '',
      MODEL: ''
    });
    expect(run.status).toBe(2);
    expect(run.stderr.trim()).toBe('');
    expect(run.stdout).toContain('Unable to run LLM demos: missing model configuration.');
    expect(run.stdout).toContain('Missing variables: OPENAI_API_KEY, MODEL');
  });

  describe('with configured llm env or demo mock', () => {
    it('runs scored demos with comparative markers', () => {
      const demos = [
        ['01_llm_contradiction_clarify.js', '01_contradiction_block'],
        ['02_llm_constraint_guardrail.js', '02_constraint_drift'],
        ['03_llm_premise_guardrail.js', '03_explicit_premise_change'],
        ['04_llm_tool_denylist_guardrail.js', '04_tool_governance'],
        ['05_llm_prompt_drift_vs_state.js', '05_prompt_drift'],
        ['07_llm_prompt_vs_state.js', '07_prompt_engineering_comparison']
      ] as const;

      for (const [file, marker] of demos) {
        const run = runNodeScriptWithMock(file);
        expect(run.status).toBe(0);
        expect(run.stderr.trim()).toBe('');
        expect(run.stdout).toContain(marker);
        expect(run.stdout).toContain('baseline:');
        expect(run.stdout).toContain('compiler:');
        expect(run.stdout).toContain('compiler+compact:');
        expect(run.stdout).toContain('result:');
        expect(run.stdout).not.toContain('"version":');
        expect(run.stdout).not.toContain('"policies":');
      }
    }, 180_000);

    it('runs informational demo 06 with compaction markers', () => {
      const run = runNodeScriptWithMock('06_llm_context_compaction.js');
      expect(run.status).toBe(0);
      expect(run.stderr.trim()).toBe('');
      expect(run.stdout).toContain('06_context_compaction');
      expect(run.stdout).toContain('context scaling:');
      expect(run.stdout).toContain('compacted transcript:');
      expect(run.stdout).toContain('result: transcript grows linearly; compiled context stays constant');
      expect(run.stdout).not.toContain('baseline: PASS');
      expect(run.stdout).not.toContain('"version":');
      expect(run.stdout).not.toContain('"policies":');
    }, 120_000);

    it('runs demo runner for single and all with summary markers', () => {
      const single = runNodeScriptWithMock('run_demo.js', ['1']);
      expect(single.status).toBe(0);
      expect(single.stderr.trim()).toBe('');
      expect(single.stdout).toContain('01_contradiction_block');
      expect(single.stdout).toContain('baseline:');
      expect(single.stdout).toContain('compiler:');

      const all = runNodeScriptWithMock('run_demo.js', ['all']);
      expect(all.status).toBe(0);
      expect(all.stderr.trim()).toBe('');
      expect(all.stdout).toContain('Summary:');
      expect(all.stdout).toContain('Evaluative demos:');
      expect(all.stdout).toContain('Baseline results:');
      expect(all.stdout).toContain('Compiler results:');
      expect(all.stdout).toContain('Compiler+compact results:');
      expect(all.stdout).toContain('Informational demo:');
      expect(all.stdout).toContain('06_context_compaction');
      expect(all.stdout).not.toContain('"version":');
      expect(all.stdout).not.toContain('"policies":');
    }, 180_000);
  });
});
