export class DirectiveKind {
  static readonly SET_PREMISE = 'set_premise';
  static readonly CHANGE_PREMISE = 'change_premise';
  static readonly USE_ITEM = 'use_item';
  static readonly PROHIBIT_ITEM = 'prohibit_item';
  static readonly REMOVE_POLICY = 'remove_policy';
  static readonly REPLACE_USE = 'replace_use';
  static readonly CLEAR_PREMISE = 'clear_premise';
  static readonly RESET_POLICIES = 'reset_policies';
  static readonly CLEAR_STATE = 'clear_state';
}

export class DirectiveSyntaxFailure {
  static readonly COMPOUND_DIRECTIVE = 'compound_directive';
  static readonly MISSING_REQUIRED_OPERAND = 'missing_required_operand';
  static readonly MALFORMED_DIRECTIVE = 'malformed_directive';
}

type DirectiveKindValue =
  | 'set_premise'
  | 'change_premise'
  | 'use_item'
  | 'prohibit_item'
  | 'remove_policy'
  | 'replace_use'
  | 'clear_premise'
  | 'reset_policies'
  | 'clear_state';

type Operands = Record<string, string>;

const DIRECTIVE_KINDS = new Set<string>([
  DirectiveKind.SET_PREMISE,
  DirectiveKind.CHANGE_PREMISE,
  DirectiveKind.USE_ITEM,
  DirectiveKind.PROHIBIT_ITEM,
  DirectiveKind.REMOVE_POLICY,
  DirectiveKind.REPLACE_USE,
  DirectiveKind.CLEAR_PREMISE,
  DirectiveKind.RESET_POLICIES,
  DirectiveKind.CLEAR_STATE
]);

const DIRECTIVE_SPECS: Record<DirectiveKindValue, { canonicalStart: string; operands: string[]; exact?: string }> = {
  set_premise: { canonicalStart: 'set premise', operands: ['value'] },
  change_premise: { canonicalStart: 'change premise to', operands: ['value'] },
  use_item: { canonicalStart: 'use', operands: ['item'] },
  prohibit_item: { canonicalStart: 'prohibit', operands: ['item'] },
  remove_policy: { canonicalStart: 'remove policy', operands: ['item'] },
  replace_use: { canonicalStart: 'use', operands: ['new_item', 'old_item'] },
  clear_premise: { canonicalStart: 'clear premise', operands: [], exact: 'clear premise' },
  reset_policies: { canonicalStart: 'reset policies', operands: [], exact: 'reset policies' },
  clear_state: { canonicalStart: 'clear state', operands: [], exact: 'clear state' }
};

const CANONICAL_START_ORDER: DirectiveKindValue[] = [
  'change_premise',
  'set_premise',
  'remove_policy',
  'reset_policies',
  'clear_premise',
  'clear_state',
  'prohibit_item',
  'use_item'
];

const HORIZONTAL_WHITESPACE = ' \t';
const ASCII_WHITESPACE = ' \t\n\r\v\f';
const INSTEAD_OF_DELIMITER = ' instead of ';

export class CanonicalDirective {
  readonly kind: DirectiveKindValue;
  readonly operands: Operands;
  readonly text: string;

  constructor(input: { kind: string; operands: Record<string, unknown> }) {
    const kind = normalizeDirectiveKind(input.kind);
    const operands = normalizeCanonicalOperands(kind, input.operands);
    const rendered = serializeCanonicalDirective(kind, operands);
    if (containsMultipleCanonicalDirectives(rendered)) {
      throw new Error(`Operands do not produce a canonical ${kind} directive.`);
    }
    this.kind = kind;
    this.operands = Object.freeze(operands);
    this.text = serializeCanonicalDirective(kind, operands);
    Object.freeze(this);
  }
}

export class InvalidDirectiveSyntax {
  readonly kind = 'invalid_directive_syntax';
  readonly failure: string;
  readonly directive_kind: DirectiveKindValue | null;
  readonly missing_operand: string | null;

  constructor(input: {
    failure?: string;
    directive_kind?: DirectiveKindValue | null;
    missing_operand?: string | null;
  } = {}) {
    this.failure = input.failure ?? DirectiveSyntaxFailure.MALFORMED_DIRECTIVE;
    this.directive_kind = input.directive_kind ?? null;
    this.missing_operand = input.missing_operand ?? null;
    Object.freeze(this);
  }
}

export class DirectiveMetadata {
  readonly kind: DirectiveKindValue;
  readonly canonical_start: string;
  readonly operand_names: readonly string[];

  constructor(input: { kind: DirectiveKindValue; canonical_start: string; operand_names: string[] }) {
    this.kind = input.kind;
    this.canonical_start = input.canonical_start;
    this.operand_names = Object.freeze([...input.operand_names]);
    Object.freeze(this);
  }
}

function trimAsciiWhitespace(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && ASCII_WHITESPACE.includes(text[start])) start += 1;
  while (end > start && ASCII_WHITESPACE.includes(text[end - 1])) end -= 1;
  return text.slice(start, end);
}

function collapseHorizontalWhitespace(text: string): string {
  return text
    .split('')
    .reduce<string[]>((parts, char) => {
      if (HORIZONTAL_WHITESPACE.includes(char)) {
        if (parts.length === 0 || parts[parts.length - 1] !== ' ') parts.push(' ');
      } else {
        parts.push(char);
      }
      return parts;
    }, [])
    .join('');
}

function normalizedForMatching(text: string): string {
  return collapseHorizontalWhitespace(trimAsciiWhitespace(text)).toLowerCase();
}

function operandHasContent(value: string): boolean {
  return trimAsciiWhitespace(value) !== '';
}

function operandStartsWithToken(value: string, token: string): boolean {
  const normalized = normalizedForMatching(value);
  return normalized === token || normalized.startsWith(`${token} `);
}

function matchDirectiveToken(text: string, start: number, token: string, requireSpaceOrEnd: boolean): number | null {
  let index = start;
  let tokenIndex = 0;
  while (tokenIndex < token.length) {
    if (index >= text.length) return null;
    const tokenChar = token[tokenIndex];
    if (tokenChar === ' ') {
      if (!HORIZONTAL_WHITESPACE.includes(text[index])) return null;
      while (index < text.length && HORIZONTAL_WHITESPACE.includes(text[index])) index += 1;
    } else {
      if (text[index].toLowerCase() !== tokenChar) return null;
      index += 1;
    }
    tokenIndex += 1;
  }
  if (index === text.length) return index;
  const next = text[index];
  if (requireSpaceOrEnd) return HORIZONTAL_WHITESPACE.includes(next) ? index : null;
  return /[A-Za-z]/.test(next) ? null : index;
}

function matchCanonicalStart(text: string, start: number): number | null {
  if (start < 0 || start >= text.length) return null;
  if (start > 0 && /[A-Za-z]/.test(text[start - 1])) return null;
  const seen = new Set<string>();
  for (const kind of CANONICAL_START_ORDER) {
    const spec = DIRECTIVE_SPECS[kind];
    const key = `${spec.canonicalStart}:${spec.operands.length > 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const end = matchDirectiveToken(text, start, spec.canonicalStart, spec.operands.length > 0);
    if (end != null) return end;
  }
  return null;
}

function containsMultipleCanonicalDirectives(text: string): boolean {
  const first = matchCanonicalStart(text, 0);
  if (first == null) return false;
  for (let index = first; index < text.length; index += 1) {
    if (matchCanonicalStart(text, index) != null) return true;
  }
  return false;
}

function startsWithDirectiveFamily(text: string): boolean {
  return (
    matchDirectiveToken(text, 0, 'change premise', true) != null ||
    CANONICAL_START_ORDER.some((kind) => {
      const spec = DIRECTIVE_SPECS[kind];
      return matchDirectiveToken(text, 0, spec.canonicalStart, spec.operands.length > 0) != null;
    })
  );
}

function invalid(
  failure: string,
  directive_kind?: DirectiveKindValue,
  missing_operand?: string
): InvalidDirectiveSyntax {
  return new InvalidDirectiveSyntax({ failure, directive_kind, missing_operand });
}

function parseReplacement(text: string): CanonicalDirective | null {
  const match = /^use[ \t]+(.*?)[ \t]+instead[ \t]+of[ \t]+(.+)$/i.exec(text);
  if (match == null) return null;
  const [, newItem, oldItem] = match;
  if (!operandHasContent(newItem) || !operandHasContent(oldItem)) return null;
  if (normalizedForMatching(newItem).includes(INSTEAD_OF_DELIMITER) || normalizedForMatching(oldItem).includes(INSTEAD_OF_DELIMITER)) {
    return null;
  }
  if (normalizedForMatching(text).split(INSTEAD_OF_DELIMITER).length !== 2) return null;
  return new CanonicalDirective({ kind: 'replace_use', operands: { new_item: newItem, old_item: oldItem } });
}

export function decompose_directive(text: string): CanonicalDirective | InvalidDirectiveSyntax | null {
  const trimmed = trimAsciiWhitespace(text);
  if (trimmed === '' || !startsWithDirectiveFamily(trimmed)) return null;
  if (containsMultipleCanonicalDirectives(trimmed)) return invalid(DirectiveSyntaxFailure.COMPOUND_DIRECTIVE);

  const normalized = normalizedForMatching(trimmed);
  if (normalized === 'clear premise') return new CanonicalDirective({ kind: 'clear_premise', operands: {} });
  if (normalized === 'reset policies') return new CanonicalDirective({ kind: 'reset_policies', operands: {} });
  if (normalized === 'clear state') return new CanonicalDirective({ kind: 'clear_state', operands: {} });

  if (normalized === 'set premise') return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'set_premise', 'value');
  if (normalized.startsWith('set premise ')) {
    const match = /^set[ \t]+premise[ \t]+(.+)$/i.exec(trimmed);
    if (match == null || !operandHasContent(match[1]) || operandStartsWithToken(match[1], 'to')) {
      return invalid(DirectiveSyntaxFailure.MALFORMED_DIRECTIVE, 'set_premise');
    }
    return new CanonicalDirective({ kind: 'set_premise', operands: { value: match[1] } });
  }

  if (normalized === 'change premise to') return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'change_premise', 'value');
  if (normalized.startsWith('change premise to ')) {
    const match = /^change[ \t]+premise[ \t]+to[ \t]+(.+)$/i.exec(trimmed);
    if (match == null || !operandHasContent(match[1])) return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'change_premise', 'value');
    return new CanonicalDirective({ kind: 'change_premise', operands: { value: match[1] } });
  }

  const replacement = parseReplacement(trimmed);
  if (replacement != null) return replacement;
  if (normalized === 'use') return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'use_item', 'item');
  if (normalized.startsWith('use ')) {
    const match = /^use[ \t]+(.+)$/i.exec(trimmed);
    if (match == null || !operandHasContent(match[1])) return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'use_item', 'item');
    const item = match[1];
    const normalizedItem = normalizedForMatching(item);
    if (normalizedItem === 'instead of' || normalizedItem.startsWith('instead of ')) return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'replace_use', 'new_item');
    if (normalizedItem.endsWith(' instead of')) return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'replace_use', 'old_item');
    if (normalizedItem.includes(INSTEAD_OF_DELIMITER)) return invalid(DirectiveSyntaxFailure.MALFORMED_DIRECTIVE, 'use_item');
    return new CanonicalDirective({ kind: 'use_item', operands: { item } });
  }

  if (normalized === 'prohibit') return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'prohibit_item', 'item');
  if (normalized.startsWith('prohibit ')) {
    const match = /^prohibit[ \t]+(.+)$/i.exec(trimmed);
    if (match == null || !operandHasContent(match[1])) return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'prohibit_item', 'item');
    return new CanonicalDirective({ kind: 'prohibit_item', operands: { item: match[1] } });
  }

  if (normalized === 'remove policy') return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'remove_policy', 'item');
  if (normalized.startsWith('remove policy ')) {
    const match = /^remove[ \t]+policy[ \t]+(.+)$/i.exec(trimmed);
    if (match == null || !operandHasContent(match[1])) return invalid(DirectiveSyntaxFailure.MISSING_REQUIRED_OPERAND, 'remove_policy', 'item');
    return new CanonicalDirective({ kind: 'remove_policy', operands: { item: match[1] } });
  }

  return invalid(DirectiveSyntaxFailure.MALFORMED_DIRECTIVE);
}

export function get_directive_metadata(): readonly DirectiveMetadata[] {
  return Object.freeze(Object.values(DIRECTIVE_SPECS).map(
    (spec) => new DirectiveMetadata({ kind: Object.keys(DIRECTIVE_SPECS).find((kind) => DIRECTIVE_SPECS[kind as DirectiveKindValue] === spec) as DirectiveKindValue, canonical_start: spec.canonicalStart, operand_names: spec.operands })
  ));
}

function normalizeDirectiveKind(kind: string): DirectiveKindValue {
  if (!DIRECTIVE_KINDS.has(kind)) throw new Error(`Unsupported directive kind: ${JSON.stringify(kind)}`);
  return kind as DirectiveKindValue;
}

function normalizeCanonicalOperands(kind: DirectiveKindValue, operands: Record<string, unknown>): Operands {
  const expected = new Set(DIRECTIVE_SPECS[kind].operands);
  const actual = new Set(Object.keys(operands));
  const missing = [...expected].filter((name) => !actual.has(name));
  const unexpected = [...actual].filter((name) => !expected.has(name));
  if (missing.length > 0) throw new Error(`Missing required operands for ${kind}: ${missing.sort().join(', ')}`);
  if (unexpected.length > 0) throw new Error(`Unexpected operands for ${kind}: ${unexpected.sort().join(', ')}`);
  const normalized: Operands = {};
  for (const name of DIRECTIVE_SPECS[kind].operands) {
    const value = operands[name];
    if (typeof value !== 'string') throw new Error(`Operand '${name}' for ${kind} must be a string.`);
    if (!operandHasContent(value)) throw new Error(`Operand '${name}' for ${kind} cannot be empty.`);
    normalized[name] = value;
  }
  if (kind === 'set_premise' && operandStartsWithToken(normalized.value, 'to')) throw new Error(`Operands do not produce a canonical ${kind} directive.`);
  if (kind === 'use_item' && (normalizedForMatching(normalized.item) === 'instead of' || normalizedForMatching(normalized.item).startsWith('instead of ') || normalizedForMatching(normalized.item).includes(INSTEAD_OF_DELIMITER))) throw new Error(`Operands do not produce a canonical ${kind} directive.`);
  if (kind === 'replace_use' && (normalizedForMatching(normalized.new_item).includes(INSTEAD_OF_DELIMITER) || normalizedForMatching(normalized.old_item).includes(INSTEAD_OF_DELIMITER))) throw new Error(`Operands do not produce a canonical ${kind} directive.`);
  return normalized;
}

function serializeCanonicalDirective(kind: DirectiveKindValue, operands: Operands): string {
  const spec = DIRECTIVE_SPECS[kind];
  if (spec.exact != null) return spec.exact;
  if (kind === 'replace_use') return `use ${operands.new_item}${INSTEAD_OF_DELIMITER}${operands.old_item}`;
  return `${spec.canonicalStart} ${operands[spec.operands[0]]}`;
}
