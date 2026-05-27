export { createEngine, compile_transcript, getPremiseValue, getPolicyItems } from './engine.js';
export { OUTPUT_VERSION, preview, state_diff, step } from './controller.js';
export type { Engine, EngineInit } from './engine.js';
export type { PreviewResult, StepResult, StructuralDiff } from './controller.js';
export const DECISION_PASSTHROUGH = 'passthrough' as const;
export const DECISION_UPDATE = 'update' as const;
export const DECISION_CLARIFY = 'clarify' as const;
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
