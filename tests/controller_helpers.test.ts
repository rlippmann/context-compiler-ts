import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';

describe('controller helper accessors', () => {
  it('returns step result fields through camelCase helpers', () => {
    const engine = cc.createEngine();
    const stepResult = cc.step(engine, 'set premise concise replies');

    expect(cc.getStepDecision(stepResult)).toBe(stepResult.decision);
    expect(cc.getStepState(stepResult)).toBe(stepResult.state);
  });

  it('returns preview result fields through camelCase helpers', () => {
    const engine = cc.createEngine();
    const previewResult = cc.preview(engine, 'use sqlite');

    expect(cc.getPreviewDecision(previewResult)).toBe(previewResult.decision);
    expect(cc.getPreviewStateAfter(previewResult)).toBe(previewResult.state_after);
    expect(cc.previewWouldMutate(previewResult)).toBe(previewResult.would_mutate);
  });

  it('returns diff changed flag through the camelCase helper', () => {
    const diff = cc.stateDiff(
      { premise: null, policies: {}, version: 2 },
      { premise: 'concise replies', policies: {}, version: 2 }
    );

    expect(cc.diffHasChanges(diff)).toBe(diff.changed);
  });

  it('keeps snake_case helper aliases behaviorally identical', () => {
    const engine = cc.createEngine();
    const stepResult = cc.step(engine, 'set premise concise replies');
    const previewResult = cc.preview(engine, 'use sqlite');
    const diff = cc.stateDiff(
      { premise: null, policies: {}, version: 2 },
      { premise: 'concise replies', policies: {}, version: 2 }
    );

    expect(cc.get_step_decision(stepResult)).toBe(cc.getStepDecision(stepResult));
    expect(cc.get_step_state(stepResult)).toBe(cc.getStepState(stepResult));
    expect(cc.get_preview_decision(previewResult)).toBe(cc.getPreviewDecision(previewResult));
    expect(cc.get_preview_state_after(previewResult)).toBe(cc.getPreviewStateAfter(previewResult));
    expect(cc.preview_would_mutate(previewResult)).toBe(cc.previewWouldMutate(previewResult));
    expect(cc.diff_has_changes(diff)).toBe(cc.diffHasChanges(diff));
  });
});
