import type { EngineState } from './types.js';
import { CanonicalDirective, DirectiveKind as GrammarDirectiveKind, decompose_directive } from './grammar.js';
import {
  NoDirectiveDecision,
  type Decision as SemanticDecision,
  SemanticErrorDecision,
  SemanticFailure,
  UpdateDecision
} from './decision.js';

interface EngineInit {
  state?: EngineState;
}

export const POLICY_USE = 'use' as const;
export const POLICY_PROHIBIT = 'prohibit' as const;

export class Engine {
  private _state: EngineState;

  constructor(state?: EngineState | EngineInit) {
    const normalizedState = normalizeEngineInit(state);
    this._state = normalizedState ? loadStateObject(normalizedState) : initialState();
  }

  get premise(): string | null {
    return this._state.premise;
  }

  get policies(): Record<string, 'use' | 'prohibit'> {
    return { ...this._state.policies };
  }

  export_json(): string {
    return stringifyCanonicalJson(sortKeysDeep(this._state));
  }

  import_json(payload: string): void {
    this._state = loadStateJson(payload);
  }

  apply_directive(directive: CanonicalDirective): SemanticDecision {
    if (!(directive instanceof CanonicalDirective)) {
      throw new TypeError('apply_directive requires a CanonicalDirective.');
    }
    const previous = cloneState(this._state);
    const failure = this.#semanticFailure(directive);
    if (failure !== null) {
      this._state = previous;
      return failure;
    }

    this.#applyCanonicalDirective(directive);
    return new UpdateDecision(!statesEqual(previous, this._state));
  }

  #semanticFailure(directive: CanonicalDirective): SemanticErrorDecision | null {
    if (directive.kind === GrammarDirectiveKind.SET_PREMISE && this._state.premise !== null) {
      return new SemanticErrorDecision({
        failure: SemanticFailure.PREMISE_ALREADY_SET,
        directive,
        repairs: [this.#repair(GrammarDirectiveKind.CHANGE_PREMISE, { value: directive.operands.value })]
      });
    }

    if (directive.kind === GrammarDirectiveKind.CHANGE_PREMISE && this._state.premise === null) {
      return new SemanticErrorDecision({
        failure: SemanticFailure.PREMISE_NOT_SET,
        directive,
        repairs: [this.#repair(GrammarDirectiveKind.SET_PREMISE, { value: directive.operands.value })]
      });
    }

    if (directive.kind === GrammarDirectiveKind.USE_ITEM) {
      const itemKey = normalizeItem(directive.operands.item);
      if (this._state.policies[itemKey] === POLICY_PROHIBIT) {
        return new SemanticErrorDecision({
          failure: SemanticFailure.ITEM_PROHIBITED,
          directive,
          repairs: [
            this.#repair(GrammarDirectiveKind.REMOVE_POLICY, { item: directive.operands.item }),
            this.#repair(GrammarDirectiveKind.USE_ITEM, { item: directive.operands.item })
          ]
        });
      }
    }

    if (directive.kind === GrammarDirectiveKind.PROHIBIT_ITEM) {
      const itemKey = normalizeItem(directive.operands.item);
      if (this._state.policies[itemKey] === POLICY_USE) {
        return new SemanticErrorDecision({
          failure: SemanticFailure.ITEM_ALREADY_IN_USE,
          directive,
          repairs: [
            this.#repair(GrammarDirectiveKind.REMOVE_POLICY, { item: directive.operands.item }),
            this.#repair(GrammarDirectiveKind.PROHIBIT_ITEM, { item: directive.operands.item })
          ]
        });
      }
    }

    if (directive.kind === GrammarDirectiveKind.REPLACE_USE) {
      const newItem = directive.operands.new_item;
      const oldItem = directive.operands.old_item;
      const newKey = normalizeItem(newItem);
      const oldKey = normalizeItem(oldItem);
      if (newKey === oldKey) return null;

      if (this._state.policies[oldKey] === POLICY_PROHIBIT) {
        return new SemanticErrorDecision({
          failure: SemanticFailure.REPLACEMENT_SOURCE_PROHIBITED,
          directive
        });
      }
      if (this._state.policies[newKey] === POLICY_PROHIBIT) {
        return new SemanticErrorDecision({
          failure: SemanticFailure.REPLACEMENT_TARGET_PROHIBITED,
          directive,
          repairs: [
            this.#repair(GrammarDirectiveKind.REMOVE_POLICY, { item: newItem }),
            directive
          ]
        });
      }
      if (this._state.policies[oldKey] !== POLICY_USE) {
        return new SemanticErrorDecision({
          failure: SemanticFailure.REPLACEMENT_SOURCE_MISSING,
          directive
        });
      }
    }

    return null;
  }

  #repair(kind: string, operands: Record<string, string>): CanonicalDirective {
    return new CanonicalDirective({ kind, operands });
  }

  #applyCanonicalDirective(directive: CanonicalDirective): void {
    if (directive.kind === GrammarDirectiveKind.SET_PREMISE || directive.kind === GrammarDirectiveKind.CHANGE_PREMISE) {
      this._state.premise = sanitizePremiseValue(directive.operands.value);
      return;
    }
    if (directive.kind === GrammarDirectiveKind.USE_ITEM) {
      this._state.policies[normalizeItem(directive.operands.item)] = POLICY_USE;
      return;
    }
    if (directive.kind === GrammarDirectiveKind.PROHIBIT_ITEM) {
      this._state.policies[normalizeItem(directive.operands.item)] = POLICY_PROHIBIT;
      return;
    }
    if (directive.kind === GrammarDirectiveKind.REMOVE_POLICY) {
      delete this._state.policies[normalizeItem(directive.operands.item)];
      return;
    }
    if (directive.kind === GrammarDirectiveKind.REPLACE_USE) {
      const oldKey = normalizeItem(directive.operands.old_item);
      const newKey = normalizeItem(directive.operands.new_item);
      if (oldKey !== newKey) {
        delete this._state.policies[oldKey];
        this._state.policies[newKey] = POLICY_USE;
      }
      return;
    }
    if (directive.kind === GrammarDirectiveKind.CLEAR_PREMISE) {
      this._state.premise = null;
      return;
    }
    if (directive.kind === GrammarDirectiveKind.RESET_POLICIES) {
      this._state.policies = {};
      return;
    }
    if (directive.kind === GrammarDirectiveKind.CLEAR_STATE) {
      this._state = initialState();
    }
  }

  step(input: string): SemanticDecision {
    const directive = decompose_directive(input);
    if (!(directive instanceof CanonicalDirective)) {
      return new NoDirectiveDecision();
    }
    return this.apply_directive(directive);
  }
}

function normalizeEngineInit(stateOrInit?: EngineState | EngineInit): EngineState | undefined {
  if (stateOrInit === undefined) {
    return undefined;
  }
  if ('state' in stateOrInit && Object.keys(stateOrInit).length <= 1) {
    return stateOrInit.state;
  }
  return stateOrInit as EngineState;
}

function initialState(): EngineState {
  return {
    premise: null,
    policies: {},
    version: 2
  };
}

function cloneState(state: EngineState): EngineState {
  return {
    premise: state.premise,
    policies: { ...state.policies },
    version: 2
  };
}

function statesEqual(left: EngineState, right: EngineState): boolean {
  if (left.premise !== right.premise) return false;
  const leftKeys = Object.keys(left.policies);
  const rightKeys = Object.keys(right.policies);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left.policies[key] === right.policies[key]);
}

function loadStateJson(payload: string): EngineState {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    throw new Error('Invalid JSON payload.');
  }
  return loadStateObject(raw);
}

function loadStateObject(raw: unknown): EngineState {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('Invalid state payload.');
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 3 || !keys.includes('premise') || !keys.includes('policies') || !keys.includes('version')) {
    throw new Error('Invalid state payload.');
  }
  if (obj.version !== 2) {
    throw new Error(`Unsupported state version: ${String(obj.version)}`);
  }
  if (obj.premise !== null && typeof obj.premise !== 'string') {
    throw new Error('Invalid state payload.');
  }
  if (obj.policies === null || typeof obj.policies !== 'object' || Array.isArray(obj.policies)) {
    throw new Error('Invalid state payload.');
  }

  const normalizedPolicies: Record<string, 'use' | 'prohibit'> = {};
  for (const [key, value] of Object.entries(obj.policies)) {
    if (value !== 'use' && value !== 'prohibit') {
      throw new Error('Invalid state payload.');
    }
    const normalizedKey = normalizeItem(key);
    if (normalizedKey === '') {
      throw new Error('Invalid state payload.');
    }
    if (Object.prototype.hasOwnProperty.call(normalizedPolicies, normalizedKey)) {
      throw new Error('Invalid state payload.');
    }
    normalizedPolicies[normalizedKey] = value;
  }

  const premise = obj.premise === null ? null : sanitizePremiseValue(obj.premise);
  if (premise !== null && premise === '') {
    throw new Error('Invalid state payload.');
  }

  const sortedEntries = Object.entries(normalizedPolicies).sort(([a], [b]) => compareStringsByCodepoint(a, b));
  const sortedPolicies: Record<string, 'use' | 'prohibit'> = {};
  for (const [key, value] of sortedEntries) {
    sortedPolicies[key] = value;
  }

  return {
    premise,
    policies: sortedPolicies,
    version: 2
  };
}

function sanitizePremiseValue(value: string): string {
  let sanitized = value.normalize('NFKC');
  sanitized = sanitized.replaceAll('’', "'").replaceAll('`', "'");
  return sanitized.replace(/\s+/g, ' ').trim();
}

function normalizeItem(value: string): string {
  let normalized = value.normalize('NFKC');
  normalized = normalized.replaceAll('’', "'").replaceAll('`', "'");
  normalized = normalized.toLowerCase();
  normalized = normalized.replaceAll('ß', 'ss');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized.trim();
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeysDeep(v));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => compareStringsByCodepoint(a, b));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

function compareStringsByCodepoint(left: string, right: string): number {
  const leftCodepoints = Array.from(left);
  const rightCodepoints = Array.from(right);
  const limit = Math.min(leftCodepoints.length, rightCodepoints.length);

  for (let idx = 0; idx < limit; idx += 1) {
    const leftCodepoint = leftCodepoints[idx].codePointAt(0) as number;
    const rightCodepoint = rightCodepoints[idx].codePointAt(0) as number;
    if (leftCodepoint < rightCodepoint) {
      return -1;
    }
    if (leftCodepoint > rightCodepoint) {
      return 1;
    }
  }

  if (leftCodepoints.length < rightCodepoints.length) {
    return -1;
  }
  if (leftCodepoints.length > rightCodepoints.length) {
    return 1;
  }
  return 0;
}

function stringifyCanonicalJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u0080-\uFFFF]/g, (char) =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

export type { EngineState };
