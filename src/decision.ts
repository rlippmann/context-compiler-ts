import { CanonicalDirective } from './grammar.js';

export const DECISION_ERROR = 'error' as const;
export const DECISION_NO_DIRECTIVE = 'no_directive' as const;
export const DECISION_UPDATE = 'update' as const;

export class DecisionKind {
  static readonly NO_DIRECTIVE = DECISION_NO_DIRECTIVE;
  static readonly UPDATE = DECISION_UPDATE;
  static readonly ERROR = DECISION_ERROR;
}

export class SemanticFailure {
  static readonly PREMISE_ALREADY_SET = 'premise_already_set';
  static readonly PREMISE_NOT_SET = 'premise_not_set';
  static readonly ITEM_PROHIBITED = 'item_prohibited';
  static readonly ITEM_ALREADY_IN_USE = 'item_already_in_use';
  static readonly REPLACEMENT_SOURCE_PROHIBITED = 'replacement_source_prohibited';
  static readonly REPLACEMENT_TARGET_PROHIBITED = 'replacement_target_prohibited';
  static readonly REPLACEMENT_SOURCE_MISSING = 'replacement_source_missing';
}

export class NoDirectiveDecision {
  readonly kind = DECISION_NO_DIRECTIVE;

  constructor() {
    Object.freeze(this);
  }
}

export class UpdateDecision {
  readonly kind = DECISION_UPDATE;
  readonly changed: boolean;

  constructor(changed: boolean) {
    this.changed = changed;
    Object.freeze(this);
  }
}

export class SemanticErrorDecision {
  readonly kind = DECISION_ERROR;
  readonly failure: string;
  readonly directive: CanonicalDirective;
  readonly repairs: readonly CanonicalDirective[];
  readonly message: string;

  constructor(input: {
    failure: string;
    directive: CanonicalDirective;
    repairs?: CanonicalDirective[];
  }) {
    this.failure = input.failure;
    this.directive = freezeDirective(input.directive);
    this.repairs = Object.freeze([...(input.repairs ?? [])].map(freezeDirective));
    this.message = formatFailure(this.failure, this.directive);
    Object.freeze(this);
  }
}

export type Decision = NoDirectiveDecision | UpdateDecision | SemanticErrorDecision;

function formatFailure(failure: string, directive: CanonicalDirective): string {
  const item = directive.operands.item ?? '';
  if (failure === SemanticFailure.PREMISE_ALREADY_SET) {
    return "Premise already set.\nUse 'change premise to <value>' to modify it.";
  }
  if (failure === SemanticFailure.PREMISE_NOT_SET) {
    return "No premise is set.\nUse 'set premise <value>' to define one.";
  }
  if (failure === SemanticFailure.ITEM_PROHIBITED) {
    return `"${normalizeItemForMessage(item)}" is currently prohibited.\nRemove or replace it before using it.`;
  }
  if (failure === SemanticFailure.ITEM_ALREADY_IN_USE) {
    return `"${normalizeItemForMessage(item)}" is currently in use.\nRemove or replace it before prohibiting it.`;
  }
  if (failure === SemanticFailure.REPLACEMENT_SOURCE_MISSING) {
    return `"${directive.operands.old_item ?? ''}" is not currently in use.\nReplacement requires an active 'use' policy.`;
  }
  if (failure === SemanticFailure.REPLACEMENT_SOURCE_PROHIBITED) {
    return `"${directive.operands.old_item ?? ''}" is currently prohibited.\nSubmit explicit directive(s) to remove it or use a different item.`;
  }
  if (failure === SemanticFailure.REPLACEMENT_TARGET_PROHIBITED) {
    return `"${directive.operands.new_item ?? ''}" is currently prohibited.\nSubmit explicit directive(s) to remove it or use a different item.`;
  }
  throw new Error(`Unhandled semantic failure: ${failure}`);
}

function normalizeItemForMessage(value: string): string {
  return value
    .normalize('NFKC')
    .replaceAll('’', "'")
    .replaceAll('`', "'")
    .toLowerCase()
    .replaceAll('ß', 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

function freezeDirective(directive: CanonicalDirective): CanonicalDirective {
  const frozen = new CanonicalDirective({
    kind: directive.kind,
    operands: { ...directive.operands }
  });
  Object.freeze(frozen.operands);
  return Object.freeze(frozen);
}
