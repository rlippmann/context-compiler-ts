import type { Decision, EngineState, StepResult } from './types.js';

export interface Engine {
  step(input: string): StepResult;
  readonly state: EngineState;
}

export interface EngineInit {
  state?: EngineState;
}

export function createEngine(_init: EngineInit): Engine {
  return {
    get state(): EngineState {
      throw new Error('Engine not implemented yet');
    },
    step(_input: string): StepResult {
      throw new Error('Engine not implemented yet');
    }
  };
}

export function compile_transcript(_messages: unknown[]): unknown {
  throw new Error('Engine not implemented yet');
}

export type { Decision, EngineState, StepResult };
