export { createEngine, compile_transcript, getPremiseValue, getPolicyItems } from './engine.js';
export { OUTPUT_VERSION, preview, state_diff, step } from './controller.js';
export type { Engine, EngineInit } from './engine.js';
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

export function is_clarify(decision: Decision): boolean {
  return decision.kind === DECISION_CLARIFY;
}

export function is_passthrough(decision: Decision): boolean {
  return decision.kind === DECISION_PASSTHROUGH;
}

export function get_clarify_prompt(decision: Decision): string | null {
  return is_clarify(decision) ? decision.prompt_to_user : null;
}

export function get_decision_state(decision: Decision): EngineState | null {
  return decision.state;
}

export type {
  ApplyResult,
  CheckpointPendingReplacement,
  Decision,
  EngineCheckpointPending,
  EngineCheckpoint,
  EngineState,
  Transcript,
  TranscriptMessage,
  TranscriptResult,
  TranscriptStateResult,
  TranscriptConfirmResult
} from './types.js';
