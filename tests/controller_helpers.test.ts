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

  it('reports mixed removed and changed policies in stateDiff', () => {
    const diff = cc.stateDiff(
      { premise: null, policies: { docker: 'use', pytest: 'prohibit' }, version: 2 },
      { premise: null, policies: { docker: 'prohibit' }, version: 2 }
    );

    expect(diff).toEqual({
      changed: true,
      premise: { before: null, after: null, changed: false },
      policies: {
        added: {},
        removed: { pytest: 'prohibit' },
        changed: { docker: { before: 'use', after: 'prohibit' } }
      }
    });
  });

  it('preserves live pending state across preview confirmation flows', () => {
    const yesEngine = cc.createEngine();
    const firstYes = yesEngine.step('use kubectl instead of docker');
    const yesPreview = cc.preview(yesEngine, 'yes');

    expect(firstYes.kind).toBe('clarify');
    expect(yesPreview.decision.kind).toBe('update');
    expect(yesPreview.state_after).toEqual({ premise: null, policies: { kubectl: 'use' }, version: 2 });
    expect(yesPreview.would_mutate).toBe(true);
    expect(yesEngine.has_pending_clarification()).toBe(true);
    expect(yesEngine.state).toEqual({ premise: null, policies: {}, version: 2 });

    const noEngine = cc.createEngine({ state: { premise: null, policies: { docker: 'use' }, version: 2 } });
    const firstNo = noEngine.step('use kubectl instead of podman');
    const noPreview = cc.preview(noEngine, 'no');

    expect(firstNo.kind).toBe('clarify');
    expect(noPreview.decision.kind).toBe('update');
    expect(noPreview.state_after).toEqual({ premise: null, policies: { docker: 'use' }, version: 2 });
    expect(noPreview.would_mutate).toBe(false);
    expect(noEngine.has_pending_clarification()).toBe(true);
    expect(noEngine.state).toEqual({ premise: null, policies: { docker: 'use' }, version: 2 });
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
