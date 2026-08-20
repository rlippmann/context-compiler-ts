import { CanonicalDirective } from './grammar.js';

export function render_directive(
  kind: string,
  operands: Record<string, unknown>
): { text: string; directive_kind: string } {
  const directive = new CanonicalDirective({ kind, operands });
  return { text: directive.text, directive_kind: directive.kind };
}
