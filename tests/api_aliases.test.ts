import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';
import * as pre from '../src/experimental/preprocessor/index.js';

describe('root API aliases', () => {
  it('keeps snake_case exports and adds camelCase aliases', () => {
    expect(cc.compileTranscript).toBe(cc.compile_transcript);
    expect(cc.isUpdate).toBe(cc.is_update);
    expect(cc.isClarify).toBe(cc.is_clarify);
    expect(cc.isPassthrough).toBe(cc.is_passthrough);
    expect(cc.getClarifyPrompt).toBe(cc.get_clarify_prompt);
    expect(cc.getDecisionState).toBe(cc.get_decision_state);
    expect(cc.stateDiff).toBe(cc.state_diff);
  });

  it('exposes camelCase engine method aliases without changing behavior', () => {
    const engine = cc.createEngine();
    expect(engine.hasPendingClarification()).toBe(engine.has_pending_clarification());
    expect(engine.applyTranscript([])).toEqual(engine.apply_transcript([]));
  });
});

describe('preprocessor API aliases', () => {
  it('adds camelCase aliases for snake_case preprocessor exports', () => {
    expect(pre.validatePreprocessorOutput).toBe(pre.validate_preprocessor_output);
    expect(pre.parsePreprocessorOutput).toBe(pre.parse_preprocessor_output);
    expect(pre.preprocessHeuristic).toBe(pre.preprocess_heuristic);
    expect(pre.renderPrompt).toBe(pre.render_prompt);
  });
});
