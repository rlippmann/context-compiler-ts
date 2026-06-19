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

function parseExampleOutput(stdout: string): { heading: string; payload: unknown } {
  const trimmed = stdout.trim();
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) {
    throw new Error(`Expected heading and JSON payload in output:\n${stdout}`);
  }

  const heading = trimmed.slice(0, firstNewline).trim();
  const jsonText = trimmed.slice(firstNewline).trim();
  return {
    heading,
    payload: JSON.parse(jsonText) as unknown
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
    expect(run.stderr.trim()).toBe('');
    const { heading, payload } = parseExampleOutput(run.stdout);

    expect(heading).toBe('example 01: persistent guardrails');
    expect(payload).toEqual({
      turn1Kind: 'update',
      turn2Kind: 'passthrough',
      prohibitedPolicies: ['peanuts']
    });
  });

  it('02 configuration and correction', () => {
    const run = runExampleScript('02_configuration_and_correction.js');
    expect(run.status).toBe(0);
    expect(run.stderr.trim()).toBe('');
    const { heading, payload } = parseExampleOutput(run.stdout);

    expect(heading).toBe('example 02: configuration and correction');
    expect(payload).toEqual({
      setKind: 'update',
      changeKind: 'update',
      finalPremise: 'vegan curry'
    });
  });

  it('03 ambiguity with clarification', () => {
    const run = runExampleScript('03_ambiguity_with_clarification.js');
    expect(run.status).toBe(0);
    expect(run.stderr.trim()).toBe('');
    const { heading, payload } = parseExampleOutput(run.stdout);

    expect(heading).toBe('example 03: ambiguity with clarification');
    expect(payload).toMatchObject({
      clarifyKind: 'clarify',
      llmCalled: false,
      resetKind: 'update'
    });
    expect(typeof (payload as { clarifyPrompt?: unknown }).clarifyPrompt).toBe('string');
  });

  it('04 tool governance denylist', () => {
    const run = runExampleScript('04_tool_governance_denylist.js');
    expect(run.status).toBe(0);
    expect(run.stderr.trim()).toBe('');
    const { heading, payload } = parseExampleOutput(run.stdout);

    expect(heading).toBe('example 04: tool governance denylist');
    expect(payload).toEqual({
      decisionKind: 'update',
      blockedTools: ['docker'],
      allowedTools: ['kubectl']
    });
  });

  it('05 llm integration pattern', () => {
    const run = runExampleScript('05_llm_integration_pattern.js');
    expect(run.status).toBe(0);
    expect(run.stderr.trim()).toBe('');
    const { heading, payload } = parseExampleOutput(run.stdout);

    expect(heading).toBe('example 05: llm integration pattern');
    expect(payload).toEqual({
      actions: [
        'call_llm_without_state',
        'call_llm_with_state',
        'call_llm_with_state',
        'call_llm_with_state',
        'call_llm_with_state',
        'call_llm_with_state'
      ],
      finalState: { premise: null, policies: {}, version: 2 }
    });
  });

  it('06 transcript replay', () => {
    const run = runExampleScript('06_transcript_replay.js');
    expect(run.status).toBe(0);
    expect(run.stderr.trim()).toBe('');
    const { heading, payload } = parseExampleOutput(run.stdout);

    expect(heading).toBe('example 06: transcript replay');
    expect(payload).toEqual({
      freshReplayKind: 'state',
      currentReplayKind: 'state',
      freshPolicies: ['peanuts'],
      currentPolicies: ['peanuts', 'shellfish']
    });
  });

  it('07 single policy correction', () => {
    const run = runExampleScript('07_single_policy_correction.js');
    expect(run.status).toBe(0);
    expect(run.stderr.trim()).toBe('');
    const { heading, payload } = parseExampleOutput(run.stdout);

    expect(heading).toBe('example 07: single policy correction');
    expect(payload).toEqual({
      stepKinds: ['update', 'update', 'update'],
      finalPolicy: 'use'
    });
  });
});
