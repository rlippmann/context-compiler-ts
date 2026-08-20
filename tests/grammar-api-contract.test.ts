import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as grammar from '../src/grammar.js';

type GrammarApiContract = {
  exports: {
    names: string[];
    members: Record<string, { kind: string }>;
  };
};

const path = resolve(process.cwd(), 'tests', 'fixtures', 'conformance', 'api', 'public-grammar-v1.json');
const contract = JSON.parse(readFileSync(path, 'utf8')) as GrammarApiContract;

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
      const construct = () => new grammar.CanonicalDirective(probe.kwargs as { kind: string; operands: Record<string, unknown> });
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
      const actual = new grammar.DirectiveMetadata(probe.kwargs as {
        kind: 'use_item';
        canonical_start: string;
        operand_names: string[];
      });
      const shape = probe.return_shape as Record<string, any>;
      expect({
        kind: 'directive_metadata',
        directive_kind: actual.kind,
        canonical_start: actual.canonical_start,
        operand_names: actual.operand_names
      }).toEqual(shape);
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
          kind: shape.kind,
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
