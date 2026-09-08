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

const policyAtomPairArb = fc.constantFrom(
  ['alpha', 'ALPHA'],
  ['docker', 'ＤＯＣＫＥＲ'],
  ["don't", 'DON’T'],
  ['café', 'cafe\u0301'],
  ['straße', 'STRASSE'],
  ['ǰ', 'J\u030C'],
  ['οδός', 'ΟΔΌΣ'],
  ['kelvin', 'KELVIN']
).map(([base, equivalent]) => ({ base, equivalent }));

const equivalentPolicyPairArb = fc.record({
  atoms: fc.array(policyAtomPairArb, { minLength: 1, maxLength: 5 }),
  separators: fc.array(fc.constantFrom(' ', '   ', '\t', '\u00a0'), { minLength: 0, maxLength: 4 }),
  apostrophe: fc.boolean(),
  caseVariant: fc.boolean()
}).map(({ atoms, separators, apostrophe, caseVariant }) => {
  const base = atoms.map(({ base }) => base).join(' ');
  let variant = atoms.map(({ equivalent }) => equivalent).join(' ');
  if (separators.length > 0) {
    variant = atoms.map(({ equivalent }, index) => index === atoms.length - 1
      ? equivalent
      : equivalent + separators[index % separators.length]).join('');
  }
  if (apostrophe) variant = variant.replaceAll("'", '’');
  if (caseVariant) variant = variant.toUpperCase();
  return [base, variant] as const;
});

type StatePayload = { premise: string | null; policies: Record<string, 'use' | 'prohibit'>; version: 2 };

const validStatePayloadArb = reachableSequenceArb.map((directives): StatePayload => {
  const engine = new Engine();
  applySequence(engine, directives);
  return JSON.parse(engine.export_json()) as StatePayload;
});

const whitespaceOnlyArb = fc.array(fc.constantFrom(' ', '\t', '\n', '\u00a0'), { minLength: 1, maxLength: 8 })
  .map((parts) => parts.join(''));
const invalidJsonArb = fc.string().map((value) => JSON.stringify(value).slice(0, -1));
const invalidPremiseValueArb = fc.oneof(fc.integer(), fc.boolean(), fc.array(fc.integer()), fc.dictionary(fc.string(), fc.integer()));
const invalidPolicyValueArb = fc.oneof(fc.constant(null), fc.integer(), fc.boolean(), fc.array(fc.string()), fc.constant('invalid'));

const invalidPayloadArb = fc.oneof(
  invalidJsonArb,
  fc.oneof(fc.constant(null), fc.boolean(), fc.integer(), fc.array(fc.string())).map((value) => JSON.stringify(value)),
  validStatePayloadArb.chain((state) => fc.constantFrom('premise', 'policies', 'version').map((missing) => {
    const invalid = { ...state } as Partial<StatePayload>;
    delete invalid[missing as keyof StatePayload];
    return JSON.stringify(invalid);
  })),
  validStatePayloadArb.chain((state) => fc.oneof(
    fc.integer({ max: 1 }),
    fc.integer({ min: 3 }),
    fc.constant('2'),
    fc.constant(null)
  ).map((version) => JSON.stringify({ ...state, version }))),
  validStatePayloadArb.chain((state) => invalidPremiseValueArb.map((premise) => JSON.stringify({ ...state, premise }))),
  validStatePayloadArb.chain((state) => fc.oneof(
    fc.constant(null),
    fc.array(fc.string()),
    fc.string()
  ).map((policies) => JSON.stringify({ ...state, policies }))),
  validStatePayloadArb.chain((state) => invalidPolicyValueArb.map((value) => JSON.stringify({
    ...state,
    policies: { item: value }
  }))),
  whitespaceOnlyArb.chain((premise) => validStatePayloadArb.map((state) => JSON.stringify({ ...state, premise }))),
  whitespaceOnlyArb.map((key) => JSON.stringify({ premise: null, policies: { [key]: 'use' }, version: 2 })),
  equivalentPolicyPairArb.map(([base, equivalent]) => JSON.stringify({
    premise: null,
    policies: { [base]: 'use', [equivalent]: 'prohibit' },
    version: 2
  }))
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
      expect(() => engine.import_json(payload)).toThrow();
      expect(engine.export_json()).toBe(before);
    }), { numRuns: 200 });
});
});
