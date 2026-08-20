export {
  Engine,
  create_engine,
  createEngine,
  get_premise_value,
  get_policy_items,
  getPremiseValue,
  getPolicyItems
} from './engine.js';
export {
  diff_has_changes,
  diffHasChanges,
  get_preview_decision,
  get_preview_state_after,
  get_step_decision,
  get_step_state,
  getPreviewDecision,
  getPreviewStateAfter,
  getStepDecision,
  getStepState,
  preview,
  preview_would_mutate,
  previewWouldMutate,
  state_diff,
  stateDiff,
  step
} from './controller.js';
export type { EngineInit } from './engine.js';
export type { PreviewResult, StepResult, StructuralDiff } from './controller.js';
import type { Decision, EngineState } from './types.js';
export const DECISION_PASSTHROUGH = 'passthrough' as const;
export const DECISION_UPDATE = 'update' as const;
export const DECISION_CLARIFY = 'clarify' as const;
export const POLICY_USE = 'use' as const;
export const POLICY_PROHIBIT = 'prohibit' as const;

export function is_update(decision: Decision): boolean {
  return decision.kind === DECISION_UPDATE;
}

export const isUpdate = is_update;

export function is_clarify(decision: Decision): boolean {
  return decision.kind === DECISION_CLARIFY;
}

export const isClarify = is_clarify;

export function is_passthrough(decision: Decision): boolean {
  return decision.kind === DECISION_PASSTHROUGH;
}

export const isPassthrough = is_passthrough;

export function get_clarify_prompt(decision: Decision): string | null {
  return is_clarify(decision) ? decision.prompt_to_user : null;
}

export const getClarifyPrompt = get_clarify_prompt;

export function get_decision_state(decision: Decision): EngineState | null {
  return decision.state;
}

export const getDecisionState = get_decision_state;

export type {
  EngineCheckpoint as Checkpoint,
  CheckpointPendingReplacement,
  Decision,
  EngineCheckpointPending,
  EngineCheckpoint,
  EngineState as State,
  EngineState
} from './types.js';
export {
  CanonicalDirective,
  DirectiveKind,
  DirectiveMetadata,
  DirectiveSyntaxFailure,
  InvalidDirectiveSyntax,
  decompose_directive,
  get_directive_metadata
} from './grammar.js';
