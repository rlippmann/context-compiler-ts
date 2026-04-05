export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Decision {
  kind: string;
  [key: string]: JsonValue;
}

export type EngineState = Record<string, JsonValue>;

export interface StepResult {
  decision: Decision;
  state: EngineState;
}
