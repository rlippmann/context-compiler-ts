export interface EngineState {
  premise: string | null;
  policies: Record<string, 'use' | 'prohibit'>;
  version: 2;
}

export type PolicyValue = 'use' | 'prohibit';
