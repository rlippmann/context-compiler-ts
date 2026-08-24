import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as grammar from '../src/grammar.js';

type GrammarApiContract = {
  exports: {
    names: string[];
    members: Record<string, { kind: string; public_fields?: string[]; immutable_definition?: boolean; member_values?: Record<string, string>; construction_probes?: Array<Record<string, any>> }>;
  };
};

const path = resolve(process.cwd(), 'tests', 'fixtures', 'conformance', 'api', 'public-grammar-v1.json');
const contract = JSON.parse(readFileSync(path, 'utf8')) as GrammarApiContract;

function constructorArgs(name: string, probe: Record<string, any>): unknown[] {
  if (Array.isArray(probe.args)) return probe.args;
  const kwargs = probe.kwargs as Record<string, any> | undefined;
  if (kwargs === undefined) return [];
  if (name === 'DirectiveMetadata') {
    return [kwargs.kind, kwargs.canonical_start, kwargs.operand_names, ...(Object.keys(kwargs).includes('unexpected') ? [true] : [])];
  }
  if (name === 'CanonicalDirective') {
    return [kwargs.kind, kwargs.operands, ...(Object.keys(kwargs).includes('unexpected') ? [true] : [])];
  }
  return [kwargs.failure, kwargs.directive_kind, kwargs.missing_operand, ...(Object.keys(kwargs).includes('unexpected') ? [true] : [])];
}

function constructGrammar(name: string, probe: Record<string, any>): unknown {
  const args = constructorArgs(name, probe);
  if (name === 'DirectiveMetadata') return new grammar.DirectiveMetadata(...args as ['use_item', string, string[]]);
  if (name === 'CanonicalDirective') return new grammar.CanonicalDirective(...args as [string, Record<string, unknown>]);
  return new grammar.InvalidDirectiveSyntax(...args as [string?, string?, string?]);
}

function expectImmutableDefinition(value: unknown, memberValues: Record<string, string>, label: string): void {
  expect(value, `${label} is present`).toBeTruthy();
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;

  const definition = value as Record<string, string>;
  for (const [memberName, expected] of Object.entries(memberValues)) {
    expect(definition[memberName], `${label}.${memberName}`).toBe(expected);
    let rejected = false;
    try {
      definition[memberName] = '__contract_mutation__';
    } catch {
      rejected = true;
    }
    if (!rejected) definition[memberName] = expected;
    expect(rejected, `${label}.${memberName} must reject mutation`).toBe(true);
    expect(definition[memberName], `${label}.${memberName} after mutation`).toBe(expected);
  }
}

describe('public grammar API parity contract (conformance fixture)', () => {
  it('exposes the canonical grammar exports', () => {
    const runtime = grammar as unknown as Record<string, unknown>;
    for (const name of contract.exports.names) {
      expect(Object.prototype.hasOwnProperty.call(runtime, name), `Missing canonical grammar export '${name}'`).toBe(
        true
      );
    }
  });

  it('does not expose private grammar helpers', () => {
    expect(Object.keys(grammar).sort()).toEqual([...contract.exports.names].sort());
  });

  it('matches canonical grammar export kinds', () => {
    const runtime = grammar as unknown as Record<string, unknown>;
    for (const [name, member] of Object.entries(contract.exports.members)) {
      const value = runtime[name];
      if (member.kind === 'callable' || member.kind === 'class') {
        expect(typeof value, `Grammar export '${name}' should be callable`).toBe('function');
      }
    }
  });

  it('matches canonical directive construction probes', () => {
    const probes = (contract.exports.members.CanonicalDirective as Record<string, any>)
      .construction_probes as Array<Record<string, any>>;
    for (const probe of probes) {
      const construct = () => constructGrammar('CanonicalDirective', probe);
      if (probe.raises != null) {
        expect(construct).toThrowError();
        continue;
      }
      const actual = construct() as unknown as Record<string, unknown>;
      const shape = probe.return_shape as Record<string, any>;
      expect({
        kind: shape.directive_kind,
        text: actual.text,
        operands: actual.operands
      }).toEqual({
        kind: shape.directive_kind,
        text: shape.text,
        operands: shape.operands
      });
    }
  });

  it('matches canonical metadata construction probes', () => {
    const probes = (contract.exports.members.DirectiveMetadata as Record<string, any>)
      .construction_probes as Array<Record<string, any>>;
    for (const probe of probes) {
      const construct = () => constructGrammar('DirectiveMetadata', probe);
      if (probe.raises != null) {
        expect(construct).toThrowError(TypeError);
        continue;
      }
      const actual = construct();
      const shape = probe.return_shape as Record<string, any>;
      expect({
        kind: 'directive_metadata',
        directive_kind: actual.kind,
        canonical_start: actual.canonical_start,
        operand_names: actual.operand_names
      }).toEqual(shape);
    }
  });

  it('matches declared public grammar object fields', () => {
    for (const [name, member] of Object.entries(contract.exports.members)) {
      if (member.public_fields === undefined) continue;
      const probe = (member.construction_probes ?? []).find((candidate) => candidate.raises == null);
      expect(probe, `${name} requires a successful construction probe`).toBeDefined();
      if (probe === undefined) continue;
      const actual = constructGrammar(name, probe) as object;
      expect(Object.keys(actual).sort(), `${name} public fields`).toEqual([...member.public_fields].sort());
    }
  });

  it('enforces immutable grammar enum-like definitions', () => {
    const runtime = grammar as unknown as Record<string, unknown>;
    for (const [name, member] of Object.entries(contract.exports.members)) {
      if (!member.immutable_definition) continue;
      expectImmutableDefinition(runtime[name], member.member_values ?? {}, `Grammar export '${name}'`);
    }
  });

  it('matches metadata and decomposition probes', () => {
    const metadataProbe = (contract.exports.members.get_directive_metadata as Record<string, any>)
      .shape_probes[0].return_shape.items;
    expect(grammar.get_directive_metadata().map((metadata) => ({
      directive_kind: metadata.kind,
      canonical_start: metadata.canonical_start,
      operand_names: metadata.operand_names
    }))).toEqual(metadataProbe);

    const decomposeProbes = (contract.exports.members.decompose_directive as Record<string, any>)
      .shape_probes;
    for (const probe of decomposeProbes) {
      const actual = grammar.decompose_directive(probe.kwargs.text as string);
      const shape = probe.return_shape as Record<string, any>;
      if (shape.type === 'null') {
        expect(actual).toBeNull();
      } else if (shape.kind === 'invalid_directive_syntax') {
        expect(actual).toEqual({
          failure: shape.failure,
          directive_kind: shape.directive_kind ?? null,
          missing_operand: shape.missing_operand ?? null
        });
      } else {
        expect(actual).toEqual({
          kind: shape.directive_kind ?? shape.kind,
          text: shape.text,
          operands: shape.operands
        });
      }
    }
    });
  });

  it('matches InvalidDirectiveSyntax construction probes', () => {
    const probes = (contract.exports.members.InvalidDirectiveSyntax as Record<string, any>)
      .construction_probes as Array<Record<string, any>>;
    for (const probe of probes) {
      const kwargs = probe.kwargs as Record<string, any> | undefined;
      const args = Array.isArray(probe.args)
        ? probe.args
        : kwargs === undefined
          ? []
          : [kwargs.failure, kwargs.directive_kind, kwargs.missing_operand, ...(Object.keys(kwargs).includes('unexpected') ? [true] : [])];
      const construct = () => new grammar.InvalidDirectiveSyntax(...args as [string?, grammar.DirectiveKindValue?, string?]);
      if (probe.raises != null) {
        expect(construct).toThrowError(TypeError);
        continue;
      }
      const actual = construct() as Record<string, unknown>;
      const shape = probe.return_shape as Record<string, any>;
      expect(actual).toMatchObject({
        failure: shape.failure,
        directive_kind: shape.directive_kind,
        missing_operand: shape.missing_operand
      });
    }
  });
