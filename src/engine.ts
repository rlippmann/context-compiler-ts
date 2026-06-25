import type {
  CheckpointPendingReplacement,
  Decision,
  EngineCheckpoint,
  EngineCheckpointPending,
  EngineState,
  TranscriptResult
} from './types.js';

export interface EngineInit {
  state?: EngineState;
}

export interface EngineCompat {
  step(input: string): Decision;
  readonly state: EngineState;
  has_pending_clarification(): boolean;
  apply_transcript(messages: unknown[]): TranscriptResult;
  export_json(): string;
  import_json(payload: string): void;
  export_checkpoint(): EngineCheckpoint;
  import_checkpoint(payload: EngineCheckpoint): void;
  export_checkpoint_json(): string;
  import_checkpoint_json(payload: string): void;
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

type PendingReplacement = CheckpointPendingReplacement;

const AFFIRMATIVE_CONFIRMATIONS = new Set(['yes', 'yes please', 'yep', 'yeah', 'sure', 'ok', 'okay']);
const NEGATIVE_CONFIRMATIONS = new Set(['no', 'nope', 'no thanks']);

export class Engine implements EngineCompat {
  private _state: EngineState;
  private _pendingReplacement: PendingReplacement | null;
  private _pendingPrompt: string | null;

  constructor(state?: EngineState | EngineInit) {
    const normalizedState = normalizeEngineInit(state);
    this._state = normalizedState ? loadStateObject(normalizedState) : initialState();
    this._pendingReplacement = null;
    this._pendingPrompt = null;
  }

  get state(): EngineState {
    return cloneState(this._state);
  }

  has_pending_clarification(): boolean {
    return this._pendingReplacement !== null;
  }

  export_json(): string {
    return stringifyCanonicalJson(sortKeysDeep(this._state));
  }

  import_json(payload: string): void {
    this.#replaceState(loadStateJson(payload));
  }

  export_checkpoint(): EngineCheckpoint {
    const authoritativeState = loadStateJson(this.export_json());
    let pending: EngineCheckpointPending | null = null;

    if (this._pendingReplacement !== null) {
      const prompt = this._pendingPrompt as string;
      pending = {
        kind: 'replacement',
        replacement: clonePendingReplacement(this._pendingReplacement) as CheckpointPendingReplacement,
        prompt_to_user: prompt
      };
    }

    return cloneCheckpoint({
      checkpoint_version: 1,
      authoritative_state: authoritativeState,
      pending
    });
  }

  import_checkpoint(payload: EngineCheckpoint): void {
    this.#replaceCheckpoint(loadCheckpointObject(payload));
  }

  export_checkpoint_json(): string {
    return stringifyCanonicalJson(sortKeysDeep(this.export_checkpoint()));
  }

  import_checkpoint_json(payload: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(payload);
    } catch {
      throw new Error('Invalid JSON payload.');
    }
    this.#replaceCheckpoint(loadCheckpointObject(raw));
  }

  step(input: string): Decision {
    if (this._pendingReplacement !== null) {
      return this.#resolveOrRepromptPending(input);
    }

    const action = parseDirective(input);
    if (action === null) {
      return { ...PASSTHROUGH };
    }

    const clarifyDecision = this.#preMutationClarify(action);
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
      this.#applyReplacementExplicit(action.new_item, action.old_item);
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

  apply_transcript(messages: unknown[]): TranscriptResult {
    for (const content of iterUserContents(messages)) {
      const decision = this.step(content);
      if (decision.kind === 'clarify') {
        return {
          kind: 'confirm',
          prompt_to_user: decision.prompt_to_user as string
        };
      }
    }
    return {
      kind: 'state',
      state: this.state
    };
  }

  #replaceState(state: EngineState): void {
    this._state = state;
    this._pendingReplacement = null;
    this._pendingPrompt = null;
  }

  #replaceCheckpoint(checkpoint: EngineCheckpoint): void {
    this._state = checkpoint.authoritative_state;

    const pending = checkpoint.pending ?? null;
    if (pending === null) {
      this._pendingReplacement = null;
      this._pendingPrompt = null;
      return;
    }

    this._pendingReplacement = pending.replacement;
    this._pendingPrompt = pending.prompt_to_user;
  }

  #resolveOrRepromptPending(userInput: string): Decision {
    const normalized = normalizeConfirmation(userInput);
    if (AFFIRMATIVE_CONFIRMATIONS.has(normalized)) {
      const pending = this._pendingReplacement as PendingReplacement;
      this._pendingReplacement = null;
      this._pendingPrompt = null;
      if (pending.kind === 'use_only') {
        const newKey = normalizeItem(pending.new_item);
        this._state.policies[newKey] = 'use';
      } else {
        this.#applyReplacementExplicit(pending.new_item, pending.old_item);
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

  #applyReplacementExplicit(newItem: string, oldItem: string): void {
    const newKey = normalizeItem(newItem);
    const oldKey = normalizeItem(oldItem);
    if (newKey === oldKey) {
      return;
    }
    delete this._state.policies[oldKey];
    this._state.policies[newKey] = 'use';
  }

  #preMutationClarify(action: Action): Decision | null {
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
      return clarify("Premise already set.\nUse 'change premise to <value>' to modify it.");
    }

    if (action.kind === 'change_premise' && this._state.premise === null) {
      return clarify("No premise is set.\nUse 'set premise <value>' to define one.");
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
        return clarify(`"${itemKey}" is currently prohibited.\nRemove or replace it before using it.`);
      }
    }

    if (action.kind === 'prohibit_item') {
      const itemKey = normalizeItem(action.item);
      if (itemKey === '') {
        return clarify("Policy item cannot be empty.\nUse 'prohibit <item>' with a non-empty value.");
      }
      if (this._state.policies[itemKey] === 'use') {
        return clarify(`"${itemKey}" is currently in use.\nRemove or replace it before prohibiting it.`);
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
        const prompt = `Did you mean to use "${action.new_item}" instead?`;
        this._pendingReplacement = { kind: 'use_only', new_item: action.new_item, old_item: null };
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

export interface Engine {
  hasPendingClarification(): boolean;
  applyTranscript(messages: unknown[]): TranscriptResult;
  exportJson(): string;
  importJson(payload: string): void;
  exportCheckpoint(): EngineCheckpoint;
  importCheckpoint(payload: EngineCheckpoint): void;
  exportCheckpointJson(): string;
  importCheckpointJson(payload: string): void;
}

Object.defineProperties(Engine.prototype, {
  applyTranscript: {
    value: Engine.prototype.apply_transcript,
    writable: true,
    configurable: true
  },
  exportCheckpoint: {
    value: Engine.prototype.export_checkpoint,
    writable: true,
    configurable: true
  },
  exportCheckpointJson: {
    value: Engine.prototype.export_checkpoint_json,
    writable: true,
    configurable: true
  },
  exportJson: {
    value: Engine.prototype.export_json,
    writable: true,
    configurable: true
  },
  hasPendingClarification: {
    value: Engine.prototype.has_pending_clarification,
    writable: true,
    configurable: true
  },
  importCheckpoint: {
    value: Engine.prototype.import_checkpoint,
    writable: true,
    configurable: true
  },
  importCheckpointJson: {
    value: Engine.prototype.import_checkpoint_json,
    writable: true,
    configurable: true
  },
  importJson: {
    value: Engine.prototype.import_json,
    writable: true,
    configurable: true
  }
});

function normalizeEngineInit(stateOrInit?: EngineState | EngineInit): EngineState | undefined {
  if (stateOrInit === undefined) {
    return undefined;
  }
  if ('state' in stateOrInit && Object.keys(stateOrInit).length <= 1) {
    return stateOrInit.state;
  }
  return stateOrInit as EngineState;
}

export function create_engine(state?: EngineState | EngineInit): Engine {
  return new Engine(normalizeEngineInit(state));
}

export const createEngine = create_engine;

export function compile_transcript(messages: unknown[]): TranscriptResult {
  const engine = create_engine();
  return engine.apply_transcript(messages);
}

export const compileTranscript = compile_transcript;

export function get_premise_value(state: EngineState): string | null {
  return state.premise;
}

export const getPremiseValue = get_premise_value;

export function get_policy_items(state: EngineState, value?: 'use' | 'prohibit' | null): string[] {
  if (value == null) {
    return Object.keys(state.policies).sort(compareStringsByCodepoint);
  }
  return Object.entries(state.policies)
    .filter(([, policy]) => policy === value)
    .map(([item]) => item)
    .sort(compareStringsByCodepoint);
}

export const getPolicyItems = get_policy_items;

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

function loadCheckpointObject(raw: unknown): EngineCheckpoint {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid checkpoint payload.');
  }

  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  const hasValidKeySet =
    (keys.length === 2 && keys.includes('checkpoint_version') && keys.includes('authoritative_state')) ||
    (keys.length === 3 &&
      keys.includes('checkpoint_version') &&
      keys.includes('authoritative_state') &&
      keys.includes('pending'));
  if (!hasValidKeySet) {
    throw new Error('Invalid checkpoint payload.');
  }

  if (obj.checkpoint_version !== 1) {
    throw new Error(`Unsupported checkpoint version: ${String(obj.checkpoint_version)}`);
  }

  const authoritativeState = loadStateObject(obj.authoritative_state);
  const pending = loadCheckpointPending(obj.pending);

  return {
    checkpoint_version: 1,
    authoritative_state: authoritativeState,
    pending
  };
}

function loadCheckpointPending(raw: unknown): EngineCheckpointPending | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid checkpoint payload.');
  }

  const obj = raw as Record<string, unknown>;
  if (
    Object.keys(obj).length !== 3 ||
    !Object.keys(obj).includes('kind') ||
    !Object.keys(obj).includes('replacement') ||
    !Object.keys(obj).includes('prompt_to_user')
  ) {
    throw new Error('Invalid checkpoint payload.');
  }
  if (obj.kind !== 'replacement') {
    throw new Error('Invalid checkpoint payload.');
  }
  if (typeof obj.prompt_to_user !== 'string') {
    throw new Error('Invalid checkpoint payload.');
  }

  return {
    kind: 'replacement',
    replacement: loadCheckpointReplacement(obj.replacement),
    prompt_to_user: obj.prompt_to_user
  };
}

function loadCheckpointReplacement(raw: unknown): PendingReplacement {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid checkpoint payload.');
  }
  const obj = raw as Record<string, unknown>;
  if (
    Object.keys(obj).length !== 3 ||
    !Object.keys(obj).includes('kind') ||
    !Object.keys(obj).includes('new_item') ||
    !Object.keys(obj).includes('old_item')
  ) {
    throw new Error('Invalid checkpoint payload.');
  }

  if (obj.kind !== 'use_only' && obj.kind !== 'replace_use') {
    throw new Error('Invalid checkpoint payload.');
  }
  if (typeof obj.new_item !== 'string') {
    throw new Error('Invalid checkpoint payload.');
  }
  if (normalizeItem(obj.new_item) === '') {
    throw new Error('Invalid checkpoint payload.');
  }

  if (obj.kind === 'use_only') {
    if (obj.old_item !== null) {
      throw new Error('Invalid checkpoint payload.');
    }
    return { kind: 'use_only', new_item: obj.new_item, old_item: null };
  }

  if (typeof obj.old_item !== 'string') {
    throw new Error('Invalid checkpoint payload.');
  }
  if (normalizeItem(obj.old_item) === '') {
    throw new Error('Invalid checkpoint payload.');
  }

  return { kind: 'replace_use', new_item: obj.new_item, old_item: obj.old_item };
}

function clonePendingReplacement(pending: PendingReplacement | null): PendingReplacement | null {
  if (pending === null) {
    return null;
  }
  if (pending.kind === 'use_only') {
    return { kind: 'use_only', new_item: pending.new_item, old_item: null };
  }
  return { kind: 'replace_use', new_item: pending.new_item, old_item: pending.old_item };
}

function cloneCheckpoint(checkpoint: EngineCheckpoint): EngineCheckpoint {
  let pending: EngineCheckpointPending | null = null;
  if (checkpoint.pending != null) {
    pending = {
      kind: 'replacement',
      replacement: clonePendingReplacement(checkpoint.pending.replacement) as CheckpointPendingReplacement,
      prompt_to_user: checkpoint.pending.prompt_to_user
    };
  }

  return {
    checkpoint_version: 1,
    authoritative_state: cloneState(checkpoint.authoritative_state),
    pending
  };
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
    normalizedPolicies[normalizedKey] = value;
  }

  const sortedEntries = Object.entries(normalizedPolicies).sort(([a], [b]) => compareStringsByCodepoint(a, b));
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
  const matches = Object.keys(policies).filter((key) => key.includes(probe)).sort(compareStringsByCodepoint);
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

export type { Decision, EngineState, TranscriptResult };
