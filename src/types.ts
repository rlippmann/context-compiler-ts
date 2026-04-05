export interface EngineState {
  premise: string | null;
  policies: Record<string, 'use' | 'prohibit'>;
  version: 2;
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
