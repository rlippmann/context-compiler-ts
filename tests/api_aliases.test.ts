import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';

describe('root API aliases', () => {
  it('keeps snake_case exports and adds camelCase aliases', () => {
    expect(cc.isUpdate).toBe(cc.is_update);
    expect(cc.isClarify).toBe(cc.is_clarify);
    expect(cc.isPassthrough).toBe(cc.is_passthrough);
    expect(cc.getClarifyPrompt).toBe(cc.get_clarify_prompt);
    expect(cc.getDecisionState).toBe(cc.get_decision_state);
    expect(cc.getStepDecision).toBe(cc.get_step_decision);
    expect(cc.getStepState).toBe(cc.get_step_state);
    expect(cc.getPreviewDecision).toBe(cc.get_preview_decision);
    expect(cc.getPreviewStateAfter).toBe(cc.get_preview_state_after);
    expect(cc.previewWouldMutate).toBe(cc.preview_would_mutate);
    expect(cc.diffHasChanges).toBe(cc.diff_has_changes);
    expect(cc.stateDiff).toBe(cc.state_diff);
  });

  it('exposes camelCase engine method aliases without changing behavior', () => {
    const engine = cc.createEngine();
    expect(engine.hasPendingClarification()).toBe(engine.has_pending_clarification());
  });
});
