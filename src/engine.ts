import type { Decision, EngineState, TranscriptResult } from './types.js';

export interface Engine {
  step(input: string): Decision;
  readonly state: EngineState;
  exportJson(): string;
  importJson(payload: string): void;
}

export interface EngineInit {
  state?: EngineState;
}

const PASSTHROUGH: Decision = {
  kind: 'passthrough',
  state: null,
  prompt_to_user: null
};

type Action =
  | { kind: 'clear_premise' }
  | { kind: 'reset_policies' }
  | { kind: 'clear_state' }
  | { kind: 'set_premise'; value: string }
  | { kind: 'change_premise'; value: string }
  | { kind: 'set_premise_to_variant'; value: string }
  | { kind: 'change_premise_missing_to_variant'; value: string }
  | { kind: 'use_item'; item: string }
  | { kind: 'prohibit_item'; item: string }
  | { kind: 'remove_policy_item'; item: string }
  | { kind: 'replace_use'; new_item: string; old_item: string }
  | { kind: 'replace_use_incomplete' };

type PendingReplacement =
  | { kind: 'use_only'; new_item: string }
  | { kind: 'replace_use'; new_item: string; old_item: string };

const AFFIRMATIVE_CONFIRMATIONS = new Set(['yes', 'yes please', 'yep', 'yeah', 'sure', 'ok', 'okay']);
const NEGATIVE_CONFIRMATIONS = new Set(['no', 'nope', 'no thanks']);

class EngineImpl implements Engine {
  private _state: EngineState;
  private _pendingReplacement: PendingReplacement | null;
  private _pendingPrompt: string | null;

  constructor(init?: EngineInit) {
    this._state = init?.state ? loadStateObject(init.state) : initialState();
    this._pendingReplacement = null;
    this._pendingPrompt = null;
  }

  get state(): EngineState {
    return cloneState(this._state);
  }

  exportJson(): string {
    return JSON.stringify(sortKeysDeep(this._state));
  }

  importJson(payload: string): void {
    this._replaceState(loadStateJson(payload));
  }

  step(input: string): Decision {
    if (this._pendingReplacement !== null) {
      return this.resolveOrRepromptPending(input);
    }

    const action = parseDirective(input);
    if (action === null) {
      return { ...PASSTHROUGH };
    }

    const clarifyDecision = this.preMutationClarify(action);
    if (clarifyDecision !== null) {
      return clarifyDecision;
    }

    if (action.kind === 'set_premise' || action.kind === 'change_premise') {
      this._state.premise = sanitizePremiseValue(action.value);
      return updateDecision(this._state);
    }

    if (action.kind === 'use_item') {
      const itemKey = normalizeItem(action.item);
      this._state.policies[itemKey] = 'use';
      return updateDecision(this._state);
    }

    if (action.kind === 'prohibit_item') {
      const itemKey = normalizeItem(action.item);
      this._state.policies[itemKey] = 'prohibit';
      return updateDecision(this._state);
    }

    if (action.kind === 'remove_policy_item') {
      const itemKey = normalizeItem(action.item);
      delete this._state.policies[itemKey];
      return updateDecision(this._state);
    }

    if (action.kind === 'replace_use') {
      this.applyReplacementExplicit(action.new_item, action.old_item);
      return updateDecision(this._state);
    }

    if (action.kind === 'clear_premise') {
      this._state.premise = null;
      return updateDecision(this._state);
    }

    if (action.kind === 'reset_policies') {
      this._state.policies = {};
      return updateDecision(this._state);
    }

    if (action.kind === 'clear_state') {
      this._state = initialState();
      return updateDecision(this._state);
    }

    return { ...PASSTHROUGH };
  }

  private _replaceState(state: EngineState): void {
    this._state = state;
    this._pendingReplacement = null;
    this._pendingPrompt = null;
  }

  private resolveOrRepromptPending(userInput: string): Decision {
    const normalized = normalizeConfirmation(userInput);
    if (AFFIRMATIVE_CONFIRMATIONS.has(normalized)) {
      const pending = this._pendingReplacement as PendingReplacement;
      this._pendingReplacement = null;
      this._pendingPrompt = null;
      if (pending.kind === 'use_only') {
        const newKey = normalizeItem(pending.new_item);
        this._state.policies[newKey] = 'use';
      } else {
        this.applyReplacementExplicit(pending.new_item, pending.old_item);
      }
      return updateDecision(this._state);
    }

    if (NEGATIVE_CONFIRMATIONS.has(normalized)) {
      this._pendingReplacement = null;
      this._pendingPrompt = null;
      return updateDecision(this._state);
    }

    return clarify(this._pendingPrompt as string);
  }

  private applyReplacementExplicit(newItem: string, oldItem: string): void {
    const newKey = normalizeItem(newItem);
    const oldKey = normalizeItem(oldItem);
    if (newKey === oldKey) {
      return;
    }
    delete this._state.policies[oldKey];
    this._state.policies[newKey] = 'use';
  }

  private preMutationClarify(action: Action): Decision | null {
    if (action.kind === 'set_premise' || action.kind === 'change_premise') {
      if (sanitizePremiseValue(action.value) === '') {
        if (action.kind === 'set_premise') {
          return clarify("Premise value cannot be empty.\nUse 'set premise ...' with a non-empty value.");
        }
        return clarify("Premise value cannot be empty.\nUse 'change premise to ...' with a non-empty value.");
      }
    }

    if (action.kind === 'set_premise_to_variant') {
      return clarify(`Did you mean 'set premise ${action.value}'?`);
    }
    if (action.kind === 'change_premise_missing_to_variant') {
      return clarify(`Did you mean 'change premise to ${action.value}'?`);
    }

    if (action.kind === 'set_premise' && this._state.premise !== null) {
      return clarify(
        "Premise already exists.\nUse 'change premise to ...' to replace it.\nPremise is a single slot.\nTo keep multiple ideas, rewrite them as one premise value."
      );
    }

    if (action.kind === 'change_premise' && this._state.premise === null) {
      return clarify("No premise exists yet. Use 'set premise ...' first.");
    }

    if (action.kind === 'remove_policy_item') {
      if (normalizeItem(action.item) === '') {
        return clarify("Policy item cannot be empty.\nUse 'remove policy <item>' with a non-empty value.");
      }
    }

    if (action.kind === 'use_item') {
      const itemKey = normalizeItem(action.item);
      if (itemKey === '') {
        return clarify("Policy item cannot be empty.\nUse 'use <item>' with a non-empty value.");
      }
      if (this._state.policies[itemKey] === 'prohibit') {
        return clarify(
          `'${itemKey}' is already prohibited.\nOnly one policy per item is allowed.\nUse 'reset policies' to change it.`
        );
      }
    }

    if (action.kind === 'prohibit_item') {
      const itemKey = normalizeItem(action.item);
      if (itemKey === '') {
        return clarify("Policy item cannot be empty.\nUse 'prohibit <item>' with a non-empty value.");
      }
      if (this._state.policies[itemKey] === 'use') {
        return clarify(
          `'${itemKey}' is already in use.\nOnly one policy per item is allowed.\nUse 'reset policies' to change it.`
        );
      }
    }

    if (action.kind === 'replace_use_incomplete') {
      return clarify(
        "Replacement requires both new and old items.\nUse 'use <new item> instead of <old item>' with non-empty values."
      );
    }

    if (action.kind === 'replace_use') {
      const newKey = normalizeItem(action.new_item);
      const oldKey = normalizeItem(action.old_item);
      if (newKey === oldKey) {
        return null;
      }

      const oldState = this._state.policies[oldKey];
      const newState = this._state.policies[newKey];
      if (!Object.prototype.hasOwnProperty.call(this._state.policies, oldKey)) {
        const promptLines = [
          `No exact policy found for "${action.old_item}".`,
          'Replacement requires an exact policy match.'
        ];
        const diagnosticHints = diagnosticPolicyContainsHints(this._state.policies, action.old_item);
        if (diagnosticHints !== '') {
          promptLines.push(`Existing policies containing that text: ${diagnosticHints}.`);
          promptLines.push(`Confirm to use "${action.new_item}" and keep ${diagnosticHints}?`);
        } else {
          promptLines.push(`Confirm to use "${action.new_item}" and keep existing policies?`);
        }
        const prompt = promptLines.join('\n');
        this._pendingReplacement = { kind: 'use_only', new_item: action.new_item };
        this._pendingPrompt = prompt;
        return clarify(prompt);
      }
      if (oldState === 'prohibit') {
        const prompt = `"${action.old_item}" is currently prohibited. Did you mean to remove it and use "${action.new_item}" instead?`;
        this._pendingReplacement = { kind: 'replace_use', new_item: action.new_item, old_item: action.old_item };
        this._pendingPrompt = prompt;
        return clarify(prompt);
      }
      if (newState === 'prohibit') {
        const prompt = `"${action.new_item}" is currently prohibited. Did you mean to remove "${action.old_item}" and use "${action.new_item}" instead?`;
        this._pendingReplacement = { kind: 'replace_use', new_item: action.new_item, old_item: action.old_item };
        this._pendingPrompt = prompt;
        return clarify(prompt);
      }
      if (oldState !== 'use') {
        return clarify(
          `'${action.old_item}' is not a use policy.\nReplacement requires an existing use policy.\nUse 'reset policies' to change it.`
        );
      }
    }

    return null;
  }
}

export function createEngine(init?: EngineInit): Engine {
  return new EngineImpl(init);
}

export function compile_transcript(messages: unknown[]): TranscriptResult {
  const engine = createEngine();
  for (const content of iterUserContents(messages)) {
    const decision = engine.step(content);
    if (decision.kind === 'clarify') {
      return {
        kind: 'confirm',
        prompt_to_user: decision.prompt_to_user as string
      };
    }
  }
  return {
    kind: 'state',
    state: engine.state
  };
}

export function getPremiseValue(state: EngineState): string | null {
  return state.premise;
}

export function getPolicyItems(state: EngineState, value?: 'use' | 'prohibit' | null): string[] {
  if (value == null) {
    return Object.keys(state.policies).sort((a, b) => a.localeCompare(b));
  }
  return Object.entries(state.policies)
    .filter(([, policy]) => policy === value)
    .map(([item]) => item)
    .sort((a, b) => a.localeCompare(b));
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
    normalizedPolicies[normalizeItem(key)] = value;
  }

  const sortedEntries = Object.entries(normalizedPolicies).sort(([a], [b]) => a.localeCompare(b));
  const sortedPolicies: Record<string, 'use' | 'prohibit'> = {};
  for (const [key, value] of sortedEntries) {
    sortedPolicies[key] = value;
  }

  return {
    premise: obj.premise === null ? null : sanitizePremiseValue(obj.premise),
    policies: sortedPolicies,
    version: 2
  };
}

function parseDirective(userInput: string): Action | null {
  if (userInput === 'clear premise') {
    return { kind: 'clear_premise' };
  }
  if (userInput === 'reset policies') {
    return { kind: 'reset_policies' };
  }
  if (userInput === 'clear state') {
    return { kind: 'clear_state' };
  }

  if (userInput === 'remove policy') {
    return { kind: 'remove_policy_item', item: '' };
  }
  const removePolicyPrefix = 'remove policy ';
  if (userInput.startsWith(removePolicyPrefix)) {
    return { kind: 'remove_policy_item', item: userInput.slice(removePolicyPrefix.length) };
  }

  const setToPrefix = 'set premise to ';
  if (userInput.startsWith(setToPrefix)) {
    const value = userInput.slice(setToPrefix.length).trim();
    if (value !== '') {
      return { kind: 'set_premise_to_variant', value };
    }
  }

  const changeMissingToPrefix = 'change premise ';
  if (
    userInput.startsWith(changeMissingToPrefix) &&
    !userInput.startsWith('change premise to ') &&
    userInput !== 'change premise to'
  ) {
    const value = userInput.slice(changeMissingToPrefix.length).trim();
    if (value !== '') {
      return { kind: 'change_premise_missing_to_variant', value };
    }
  }

  const setBase = 'set premise';
  if (userInput === setBase) {
    return { kind: 'set_premise', value: '' };
  }
  const setPrefix = `${setBase} `;
  if (userInput.startsWith(setPrefix)) {
    return { kind: 'set_premise', value: userInput.slice(setPrefix.length) };
  }

  const changeBase = 'change premise to';
  if (userInput === changeBase) {
    return { kind: 'change_premise', value: '' };
  }
  const changePrefix = `${changeBase} `;
  if (userInput.startsWith(changePrefix)) {
    return { kind: 'change_premise', value: userInput.slice(changePrefix.length) };
  }

  if (userInput === 'use') {
    return { kind: 'use_item', item: '' };
  }
  const usePrefix = 'use ';
  if (userInput.startsWith(usePrefix)) {
    const payload = userInput.slice(usePrefix.length);
    const insteadOf = ' instead of ';
    const idx = payload.indexOf(insteadOf);
    if (idx !== -1) {
      const left = payload.slice(0, idx);
      const right = payload.slice(idx + insteadOf.length);
      if (left.trim() !== '' && right.trim() !== '') {
        return { kind: 'replace_use', new_item: left, old_item: right };
      }
      return { kind: 'replace_use_incomplete' };
    }
    if (payload.trim() === '') {
      return { kind: 'use_item', item: '' };
    }
    if (payload.startsWith('instead of ') || payload.endsWith(' instead of')) {
      return { kind: 'replace_use_incomplete' };
    }
    return { kind: 'use_item', item: payload };
  }

  if (userInput === 'prohibit') {
    return { kind: 'prohibit_item', item: '' };
  }
  const prohibitPrefix = 'prohibit ';
  if (userInput.startsWith(prohibitPrefix)) {
    return { kind: 'prohibit_item', item: userInput.slice(prohibitPrefix.length) };
  }

  return null;
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
  normalized = normalized.replace(/\bdont\b/g, "don't");
  normalized = normalized.replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/^(?:a|an|the)\b\s*/, '');
  return normalized.trim();
}

function normalizeConfirmation(text: string): string {
  let normalized = text.normalize('NFKC');
  normalized = normalized.toLowerCase().trim();
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/[.,!?]+$/g, '').trim();
  return normalized.replace(/\s+/g, ' ');
}

function diagnosticPolicyContainsHints(policies: Record<string, 'use' | 'prohibit'>, rawItem: string): string {
  const probe = normalizeItem(rawItem);
  if (probe === '') {
    return '';
  }
  const matches = Object.keys(policies).filter((key) => key.includes(probe)).sort((a, b) => a.localeCompare(b));
  if (matches.length === 0) {
    return '';
  }
  return matches.map((key) => `"${key}"`).join(', ');
}

function clarify(prompt: string): Decision {
  return {
    kind: 'clarify',
    state: null,
    prompt_to_user: prompt
  };
}

function updateDecision(state: EngineState): Decision {
  return {
    kind: 'update',
    state: cloneState(state),
    prompt_to_user: null
  };
}

function iterUserContents(messages: unknown[]): string[] {
  const userContents: string[] = [];
  for (const message of messages) {
    if (message === null || typeof message !== 'object' || Array.isArray(message)) {
      continue;
    }
    const role = (message as Record<string, unknown>).role;
    const content = (message as Record<string, unknown>).content;
    if (role === 'user' && typeof content === 'string') {
      userContents.push(content);
    }
  }
  return userContents;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeysDeep(v));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

export type { Decision, EngineState, TranscriptResult };
