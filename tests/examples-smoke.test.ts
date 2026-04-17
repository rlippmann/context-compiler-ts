import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const DIST_EXAMPLES = resolve(ROOT, 'dist', 'examples');

function runExampleScript(file: string): { status: number | null; stdout: string; stderr: string } {
  const script = resolve(DIST_EXAMPLES, file);
  const run = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return {
    status: run.status,
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? ''
  };
}

describe('examples smoke', () => {
  beforeAll(() => {
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    if (build.status !== 0) {
      throw new Error(`Build failed.\nSTDOUT:\n${build.stdout}\nSTDERR:\n${build.stderr}`);
    }
  }, 120_000);

  it('01 persistent guardrails', () => {
    const run = runExampleScript('01_persistent_guardrails.js');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('example 01: persistent guardrails');
    expect(run.stdout).toContain('"prohibitedPolicies"');
  });

  it('02 configuration and correction', () => {
    const run = runExampleScript('02_configuration_and_correction.js');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('example 02: configuration and correction');
    expect(run.stdout).toContain('"finalPremise": "vegan curry"');
  });

  it('03 ambiguity with clarification', () => {
    const run = runExampleScript('03_ambiguity_with_clarification.js');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('example 03: ambiguity with clarification');
    expect(run.stdout).toContain('"clarifyKind": "clarify"');
  });

  it('04 tool governance denylist', () => {
    const run = runExampleScript('04_tool_governance_denylist.js');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('example 04: tool governance denylist');
    expect(run.stdout).toContain('"blockedTools"');
  });

  it('05 llm integration pattern', () => {
    const run = runExampleScript('05_llm_integration_pattern.js');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('example 05: llm integration pattern');
    expect(run.stdout).toContain('"actions"');
  });

  it('06 transcript replay', () => {
    const run = runExampleScript('06_transcript_replay.js');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('example 06: transcript replay');
    expect(run.stdout).toContain('"freshReplayKind": "state"');
  });

  it('07 single policy correction', () => {
    const run = runExampleScript('07_single_policy_correction.js');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('example 07: single policy correction');
    expect(run.stdout).toContain('"finalPolicy": "use"');
  });
});
