import { describe, expect, it } from 'vitest';

import { runExample01 } from '../examples/01_persistent_guardrails.js';
import { runExample02 } from '../examples/02_configuration_and_correction.js';
import { runExample03 } from '../examples/03_ambiguity_with_clarification.js';
import { runExample04 } from '../examples/04_tool_governance_denylist.js';
import { runExample05 } from '../examples/05_llm_integration_pattern.js';
import { runExample06 } from '../examples/06_transcript_replay.js';
import { runExample07 } from '../examples/07_single_policy_correction.js';

describe('examples smoke', () => {
  it('01 persistent guardrails', () => {
    const result = runExample01();
    expect(result.turn1Kind).toBe('update');
    expect(result.prohibitedPolicies).toContain('peanuts');
  });

  it('02 configuration and correction', () => {
    const result = runExample02();
    expect(result.setKind).toBe('update');
    expect(result.finalPremise).toBe('vegan curry');
  });

  it('03 ambiguity with clarification', () => {
    const result = runExample03();
    expect(result.clarifyKind).toBe('clarify');
    expect(result.llmCalled).toBe(false);
  });

  it('04 tool governance denylist', () => {
    const result = runExample04();
    expect(result.decisionKind).toBe('update');
    expect(result.blockedTools).toContain('docker');
  });

  it('05 llm integration pattern', () => {
    const result = runExample05();
    expect(result.actions[0]).toBe('call_llm_without_state');
    expect(result.finalState.premise).toBeNull();
  });

  it('06 transcript replay', () => {
    const result = runExample06();
    expect(result.freshReplayKind).toBe('state');
    expect(result.currentPolicies).toContain('shellfish');
  });

  it('07 single policy correction', () => {
    const result = runExample07();
    expect(result.stepKinds).toEqual(['update', 'update', 'update']);
    expect(result.finalPolicy).toBe('use');
  });
});
