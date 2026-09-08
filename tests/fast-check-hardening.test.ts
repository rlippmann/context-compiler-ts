import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';
import { CanonicalDirective, InvalidDirectiveSyntax, decompose_directive } from '../src/grammar.js';

const wordArb = fc.constantFrom('alpha', 'docker', 'focus', 'project', 'rollout', 'staging');
const itemArb = fc.array(wordArb, { minLength: 1, maxLength: 3 }).map((words) => words.join(' '));
const premiseValueArb = fc.array(wordArb, { minLength: 1, maxLength: 4 }).map((words) => words.join(' '));

const canonicalDirectiveArb = fc.oneof(
  premiseValueArb.map((value) => new CanonicalDirective('set_premise', { value })),
  premiseValueArb.map((value) => new CanonicalDirective('change_premise', { value })),
  itemArb.map((item) => new CanonicalDirective('use_item', { item })),
  itemArb.map((item) => new CanonicalDirective('prohibit_item', { item })),
  itemArb.map((item) => new CanonicalDirective('remove_policy', { item })),
  fc.tuple(itemArb, itemArb).map(([newItem, oldItem]) => new CanonicalDirective('replace_use', { new_item: newItem, old_item: oldItem })),
  fc.constant(new CanonicalDirective('clear_premise', {})),
  fc.constant(new CanonicalDirective('reset_policies', {})),
  fc.constant(new CanonicalDirective('clear_state', {}))
);

const reachableSequenceArb = fc.array(canonicalDirectiveArb, { maxLength: 8 });

function applySequence(engine: Engine, directives: CanonicalDirective[]): void {
  for (const directive of directives) engine.apply_directive(directive);
}

const equivalentPolicyPairArb = fc.record({
  base: fc.constantFrom("don't panic", 'the docker', 'ǰ rollout', 'straße'),
  upper: fc.boolean(),
  whitespace: fc.boolean(),
  apostrophe: fc.boolean()
}).map(({ base, upper, whitespace, apostrophe }) => {
  let variant = upper ? base.toUpperCase() : base;
  if (whitespace) variant = variant.replaceAll(' ', '   ');
  if (apostrophe) variant = variant.replaceAll("'", '’');
  return [base, variant] as const;
});

const invalidPayloadArb = fc.constantFrom(
  '{',
  JSON.stringify(null),
  JSON.stringify([]),
  JSON.stringify({ premise: null, policies: {}, version: 1 }),
  JSON.stringify({ premise: 42, policies: {}, version: 2 }),
  JSON.stringify({ premise: null, policies: [], version: 2 }),
  JSON.stringify({ premise: null, policies: { docker: 'invalid' }, version: 2 }),
  JSON.stringify({ premise: null, policies: { A: 'use', a: 'prohibit' }, version: 2 }),
  JSON.stringify({ premise: null, policies: { '   ': 'use' }, version: 2 }),
  JSON.stringify({ premise: '   ', policies: {}, version: 2 }),
  JSON.stringify({ premise: null, policies: {} })
);

describe('fast-check property hardening', () => {
  it('classifies arbitrary grammar strings without throwing', () => {
    fc.assert(fc.property(fc.string({ maxLength: 160 }), (input) => {
      const engine = new Engine();
      const before = engine.export_json();
      let result: unknown;
      expect(() => { result = decompose_directive(input); }).not.toThrow();
      expect(result === null || result instanceof CanonicalDirective || result instanceof InvalidDirectiveSyntax).toBe(true);
      expect(() => engine.step(input)).not.toThrow();
      if (!(result instanceof CanonicalDirective)) expect(engine.export_json()).toBe(before);
    }), { numRuns: 300 });
  });

  it('round-trips generated canonical directives through public grammar', () => {
    fc.assert(fc.property(canonicalDirectiveArb, (directive) => {
      const roundTrip = decompose_directive(directive.text);
      expect(roundTrip).toBeInstanceOf(CanonicalDirective);
      expect(roundTrip).toMatchObject({ kind: directive.kind, operands: directive.operands, text: directive.text });
    }), { numRuns: 200 });
  });

  it('keeps equivalent policy operands at one identity and idempotent', () => {
    fc.assert(fc.property(equivalentPolicyPairArb, ([base, variant]) => {
      const engine = new Engine();
      engine.step('use ' + base);
      const before = engine.export_json();
      const decision = engine.step('use ' + variant);
      expect(decision).toMatchObject({ kind: 'update', changed: false });
      expect(engine.export_json()).toBe(before);
    }), { numRuns: 150 });
  });

  it('preserves state after generated semantic errors', () => {
    fc.assert(fc.property(reachableSequenceArb, canonicalDirectiveArb, (prefix, directive) => {
      const engine = new Engine();
      applySequence(engine, prefix);
      const before = engine.export_json();
      const decision = engine.apply_directive(directive);
      if (decision.kind === 'error') expect(engine.export_json()).toBe(before);
    }), { numRuns: 250 });
  });

  it('keeps reachable state export/import at a canonical fixed point', () => {
    fc.assert(fc.property(reachableSequenceArb, (directives) => {
      const engine = new Engine();
      applySequence(engine, directives);
      const payload = engine.export_json();
      const restored = new Engine();
      restored.import_json(payload);
      expect(restored.export_json()).toBe(payload);
    }), { numRuns: 200 });
  });

  it('preserves state when generated invalid imports are rejected', () => {
    fc.assert(fc.property(reachableSequenceArb, invalidPayloadArb, (directives, payload) => {
      const engine = new Engine();
      applySequence(engine, directives);
      const before = engine.export_json();
      try {
        engine.import_json(payload);
      } catch {
        expect(engine.export_json()).toBe(before);
      }
    }), { numRuns: 200 });
  });
});
