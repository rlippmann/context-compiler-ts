import type { Engine, EngineState } from './engine.js';
import type { Decision } from './decision.js';

export const OUTPUT_VERSION = 1 as const;

export interface PremiseDiff {
  before: string | null;
  after: string | null;
  changed: boolean;
}

export interface ChangedPolicyDiff {
  before: 'use' | 'prohibit';
  after: 'use' | 'prohibit';
}

export interface PoliciesDiff {
  added: Record<string, 'use' | 'prohibit'>;
  removed: Record<string, 'use' | 'prohibit'>;
  changed: Record<string, ChangedPolicyDiff>;
}

export interface StructuralDiff {
  changed: boolean;
  premise: PremiseDiff;
  policies: PoliciesDiff;
}

export interface StepResult {
  output_version: typeof OUTPUT_VERSION;
  mode: 'step';
  decision: Decision;
  state: EngineState;
}

export interface PreviewResult {
  output_version: typeof OUTPUT_VERSION;
  mode: 'preview';
  decision: Decision;
  state_before: EngineState;
  state_after: EngineState;
  diff: StructuralDiff;
  would_mutate: boolean;
}

export function state_diff(before: EngineState, after: EngineState): StructuralDiff {
  const beforePremise = before.premise;
  const afterPremise = after.premise;
  const premiseChanged = beforePremise !== afterPremise;

  const beforePolicies = before.policies;
  const afterPolicies = after.policies;

  const added: Record<string, 'use' | 'prohibit'> = {};
  const removed: Record<string, 'use' | 'prohibit'> = {};
  const changed: Record<string, ChangedPolicyDiff> = {};

  for (const [key, value] of Object.entries(afterPolicies)) {
    if (!Object.prototype.hasOwnProperty.call(beforePolicies, key)) {
      added[key] = value;
      continue;
    }
    const beforeValue = beforePolicies[key];
    if (beforeValue !== value) {
      changed[key] = { before: beforeValue, after: value };
    }
  }

  for (const [key, value] of Object.entries(beforePolicies)) {
    if (!Object.prototype.hasOwnProperty.call(afterPolicies, key)) {
      removed[key] = value;
    }
  }

  const anyPolicyChange = Object.keys(added).length > 0 || Object.keys(removed).length > 0 || Object.keys(changed).length > 0;

  return {
    changed: premiseChanged || anyPolicyChange,
    premise: {
      before: beforePremise,
      after: afterPremise,
      changed: premiseChanged
    },
    policies: {
      added,
      removed,
      changed
    }
  };
}


export function diff_has_changes(diff: StructuralDiff): boolean {
  return diff.changed;
}


export function step(engine: Engine, user_input: string): StepResult {
  const decision = engine.step(user_input);
  return {
    output_version: OUTPUT_VERSION,
    mode: 'step',
    decision,
    state: engine._state_snapshot()
  };
}

export function get_step_decision(stepResult: StepResult): Decision {
  return stepResult.decision;
}


export function get_step_state(stepResult: StepResult): EngineState {
  return stepResult.state;
}


export function preview(engine: Engine, user_input: string): PreviewResult {
  const checkpoint = engine._export_checkpoint();
  const stateBefore = engine._state_snapshot();

  let decision: Decision | null = null;
  let stateAfter: EngineState | null = null;
  try {
    decision = engine.step(user_input);
    stateAfter = engine._state_snapshot();
  } finally {
    engine._import_checkpoint(checkpoint);
  }

  const diff = state_diff(stateBefore, stateAfter as EngineState);
  return {
    output_version: OUTPUT_VERSION,
    mode: 'preview',
    decision: decision as Decision,
    state_before: stateBefore,
    state_after: stateAfter as EngineState,
    diff,
    would_mutate: diff.changed
  };
}

export function get_preview_decision(previewResult: PreviewResult): Decision {
  return previewResult.decision;
}


export function get_preview_state_after(previewResult: PreviewResult): EngineState {
  return previewResult.state_after;
}


export function preview_would_mutate(previewResult: PreviewResult): boolean {
  return previewResult.would_mutate;
}
