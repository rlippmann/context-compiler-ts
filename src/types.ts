export interface EngineState {
  premise: string | null;
  policies: Record<string, 'use' | 'prohibit'>;
  version: 2;
}

export type CheckpointPendingReplacement =
  | { kind: 'use_only'; new_item: string; old_item: null }
  | { kind: 'replace_use'; new_item: string; old_item: string };

export interface EngineCheckpointPending {
  kind: 'replacement';
  replacement: CheckpointPendingReplacement;
  prompt_to_user: string;
}

export interface EngineCheckpoint {
  checkpoint_version: 1;
  authoritative_state: EngineState;
  pending?: EngineCheckpointPending | null;
}

export interface Decision {
  kind: 'update' | 'passthrough' | 'clarify';
  state: EngineState | null;
  prompt_to_user: string | null;
}

export interface TranscriptStateResult {
  kind: 'state';
  state: EngineState;
}

export interface TranscriptConfirmResult {
  kind: 'confirm';
  prompt_to_user: string;
}

export type TranscriptResult = TranscriptStateResult | TranscriptConfirmResult;

export interface TranscriptMessage {
  role: string;
  content: unknown;
}

export type Transcript = TranscriptMessage[];
export type ApplyResult = TranscriptResult;
