import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';
import { CanonicalDirective } from '../src/grammar.js';
import type { Decision } from '../src/index.js';

// Compile-time smoke checks for intentional TS-only type exports that are not part
// of the canonical Python runtime export set.
const _typeCheckDecision: Decision = new cc.NoDirectiveDecision();
void _typeCheckDecision;

type ParamSpec = {
  name: string;
  kind: string;
  has_default: boolean;
};

type SignatureSpec = {
  params: ParamSpec[];
};

type ReturnShape =
  | { kind: 'engine_instance' }
  | {
      type: 'boolean' | 'string' | 'number' | 'object';
      const?: unknown;
      required_keys?: string[];
      properties?: Record<string, ReturnShape>;
    };

type ShapeProbe = {
  kwargs: Record<string, unknown>;
  return_shape: ReturnShape;
};

type ExportMemberSpec = {
  kind: 'type' | 'type_alias' | 'constant' | 'class' | 'callable';
  value?: unknown;
  signature?: SignatureSpec;
  shape_probes?: ShapeProbe[];
  construction_probes?: Array<Record<string, unknown>>;
};

type EngineMemberSpec = {
  kind: 'method' | 'property';
  signature?: SignatureSpec;
};

type ApiContractFixture = {
  forbidden_exports: string[];
  exports: {
    mode: 'exact';
    names: string[];
    members: Record<string, ExportMemberSpec>;
  };
  engine: {
    type: string;
    public_members: {
      mode: 'exact';
      members: Record<string, EngineMemberSpec>;
    };
  };
};

function loadApiContractFixture(): ApiContractFixture {
  const path = resolve(process.cwd(), 'tests', 'fixtures', 'conformance', 'api', 'public-api-v2.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as ApiContractFixture;
}

function getCanonicalRuntimeExportNames(fixture: ApiContractFixture): string[] {
  return fixture.exports.names.filter((name) => {
    const member = fixture.exports.members[name];
    return member.kind === 'callable' || member.kind === 'constant' || member.kind === 'class';
  });
}

function getRuntimeExportNames(): string[] {
  return Object.keys(cc).sort();
}

function getEngineRuntimePublicMembers(engine: object): string[] {
  const prototype = Object.getPrototypeOf(engine) as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) => !name.startsWith('_'))
    .sort();
}

function getEngineDescriptor(engine: object, name: string): PropertyDescriptor | undefined {
  const prototype = Object.getPrototypeOf(engine);
  return Object.getOwnPropertyDescriptor(prototype, name);
}

function expectPortableCallableArity(fn: (...args: unknown[]) => unknown, signature: SignatureSpec, label: string): void {
  const requiredCount = signature.params.filter((param) => !param.has_default).length;
  const totalCount = signature.params.length;
  expect(
    fn.length,
    `${label}: callable arity ${fn.length} should be between required=${requiredCount} and total=${totalCount}`
  ).toBeGreaterThanOrEqual(requiredCount);
  expect(
    fn.length,
    `${label}: callable arity ${fn.length} should be between required=${requiredCount} and total=${totalCount}`
  ).toBeLessThanOrEqual(totalCount);
}

function materializeProbeValue(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const maybeFixture = value as { fixture?: unknown };
    if (maybeFixture.fixture === 'empty_engine') {
      return new cc.Engine();
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = materializeProbeValue(nested);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((item) => materializeProbeValue(item));
  }
  return value;
}

function expectShape(value: unknown, shape: ReturnShape, label: string): void {
  if ('kind' in shape) {
    if (shape.kind === 'engine_instance') {
      expect(value, `${label}: expected engine instance`).toBeTruthy();
      expect(typeof value).toBe('object');
      expect(value).not.toBeNull();
      if (value && typeof value === 'object') {
        expect('step' in value, `${label}: engine instance should expose step`).toBe(true);
      }
    }
    return;
  }

  if (shape.type === 'boolean' || shape.type === 'string' || shape.type === 'number') {
    expect(typeof value, `${label}: wrong primitive type`).toBe(shape.type);
    if ('const' in shape) {
      expect(value, `${label}: wrong primitive value`).toBe(shape.const);
    }
    return;
  }

  expect(typeof value, `${label}: expected object`).toBe('object');
  expect(value, `${label}: expected non-null object`).not.toBeNull();
  if (value === null || typeof value !== 'object') {
    return;
  }

  for (const key of shape.required_keys ?? []) {
    expect(key in value, `${label}: missing required key '${key}'`).toBe(true);
  }

  for (const [key, propertyShape] of Object.entries(shape.properties ?? {})) {
    expectShape((value as Record<string, unknown>)[key], propertyShape, `${label}.${key}`);
  }

  if ('const' in shape) {
    expect(value, `${label}: wrong object value`).toEqual(shape.const);
  }
}

describe('public API parity contract (conformance fixture)', () => {
  it('syncs the stricter canonical Python fixture schema', () => {
    const fixture = loadApiContractFixture();
    expect(fixture.exports.mode).toBe('exact');
    expect(fixture.engine.public_members.mode).toBe('exact');
    expect(fixture.forbidden_exports.length).toBeGreaterThan(0);
  });

  it('exposes exactly the canonical runtime exports', () => {
    const fixture = loadApiContractFixture();
    const canonicalRuntimeExports = getCanonicalRuntimeExportNames(fixture);
    expect(getRuntimeExportNames()).toEqual(canonicalRuntimeExports.sort());
  });

  it('exposes every canonical runtime export from the Python fixture', () => {
    const fixture = loadApiContractFixture();
    for (const exportName of getCanonicalRuntimeExportNames(fixture)) {
      expect(Object.prototype.hasOwnProperty.call(cc, exportName), `Missing canonical export '${exportName}'`).toBe(true);
    }
  });

  it('does not expose forbidden runtime exports', () => {
    const fixture = loadApiContractFixture();
    for (const exportName of fixture.forbidden_exports) {
      expect(Object.prototype.hasOwnProperty.call(cc, exportName), `Forbidden export '${exportName}' should not exist`).toBe(false);
    }
  });

  it('enforces portable runtime export kinds and constant values', () => {
    const fixture = loadApiContractFixture();
    for (const exportName of getCanonicalRuntimeExportNames(fixture)) {
      const member = fixture.exports.members[exportName];
      expect(member, `Missing member schema for export '${exportName}'`).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(cc, exportName), `Missing canonical export '${exportName}'`).toBe(true);
      if (!Object.prototype.hasOwnProperty.call(cc, exportName)) {
        continue;
      }

      const value = cc[exportName as keyof typeof cc];
      if (member.kind === 'constant') {
        expect(typeof value, `Export '${exportName}' should be a constant`).toBe('string');
        expect(value, `Export '${exportName}' has the wrong constant value`).toBe(member.value);
      } else if (member.kind === 'callable') {
        expect(typeof value, `Export '${exportName}' should be callable`).toBe('function');
      } else if (member.kind === 'class') {
        expect(typeof value, `Export '${exportName}' should be a class constructor`).toBe('function');
        expect('prototype' in (value as object), `Export '${exportName}' should expose a prototype`).toBe(true);
      }
    }
  });

  it('enforces portable callable signatures for canonical runtime exports', () => {
    const fixture = loadApiContractFixture();
    for (const exportName of getCanonicalRuntimeExportNames(fixture)) {
      const member = fixture.exports.members[exportName];
      if (member.kind !== 'callable' && member.kind !== 'class') {
        continue;
      }
      expect(Object.prototype.hasOwnProperty.call(cc, exportName), `Missing canonical export '${exportName}'`).toBe(true);
      if (!Object.prototype.hasOwnProperty.call(cc, exportName) || !member.signature) {
        continue;
      }
      const value = cc[exportName as keyof typeof cc];
      expect(typeof value).toBe('function');
      expectPortableCallableArity(value as (...args: unknown[]) => unknown, member.signature, `Export '${exportName}'`);
    }
  });

  it('runs canonical decision construction probes', () => {
    const fixture = loadApiContractFixture();
    expect(new cc.NoDirectiveDecision()).toMatchObject({ kind: 'no_directive' });

    const updateProbe = fixture.exports.members.UpdateDecision.construction_probes?.[0];
    const updateKwargs = updateProbe?.kwargs as Record<string, unknown>;
    expect(new cc.UpdateDecision(Boolean(updateKwargs.changed))).toMatchObject({ kind: 'update', changed: true });

    const errorProbe = fixture.exports.members.SemanticErrorDecision.construction_probes?.[0];
    expect(errorProbe?.kwargs).toHaveProperty('failure');
    const directive = new CanonicalDirective({ kind: 'use_item', operands: { item: 'docker' } });
    const error = new cc.SemanticErrorDecision({
      failure: cc.SemanticFailure.ITEM_PROHIBITED,
      directive
    });
    expect(error).toMatchObject({
      kind: 'error',
      failure: cc.SemanticFailure.ITEM_PROHIBITED,
      directive,
      repairs: []
    });
    expect(typeof error.message).toBe('string');
  });

  it('runs lightweight canonical API-shape probes where portable', () => {
    const fixture = loadApiContractFixture();
    for (const exportName of getCanonicalRuntimeExportNames(fixture)) {
      const member = fixture.exports.members[exportName];
      if (member.kind !== 'callable' || !member.shape_probes || !Object.prototype.hasOwnProperty.call(cc, exportName)) {
        continue;
      }
      const fn = cc[exportName as keyof typeof cc];
      expect(typeof fn, `Export '${exportName}' should be callable`).toBe('function');
      for (const [index, probe] of member.shape_probes.entries()) {
        const args = (member.signature?.params ?? []).map((param) => materializeProbeValue(probe.kwargs[param.name]));
        const result = (fn as (...callArgs: unknown[]) => unknown)(...args);
        expectShape(result, probe.return_shape, `${exportName} probe ${index}`);
      }
    }
  });

  it('exposes exactly the canonical Engine public members', () => {
    const fixture = loadApiContractFixture();
    const engine = new cc.Engine();
    const canonicalMembers = Object.keys(fixture.engine.public_members.members);
    expect(getEngineRuntimePublicMembers(engine)).toEqual(canonicalMembers.sort());
  });

  it('exposes every canonical engine public member from the Python fixture', () => {
    const fixture = loadApiContractFixture();
    const engine = new cc.Engine();
    for (const memberName of Object.keys(fixture.engine.public_members.members)) {
      expect(memberName in engine, `Missing canonical engine member '${memberName}'`).toBe(true);
    }
  });

  it('enforces portable engine member kinds and signatures', () => {
    const fixture = loadApiContractFixture();
    const engine = new cc.Engine();
    for (const [memberName, memberSpec] of Object.entries(fixture.engine.public_members.members)) {
      expect(memberName in engine, `Missing canonical engine member '${memberName}'`).toBe(true);
      if (!(memberName in engine)) {
        continue;
      }

      const descriptor = getEngineDescriptor(engine, memberName);
      expect(descriptor, `Missing engine descriptor for '${memberName}'`).toBeDefined();
      if (!descriptor) {
        continue;
      }

      if (memberSpec.kind === 'property') {
        expect(typeof descriptor.get, `Engine member '${memberName}' should be a getter property`).toBe('function');
        continue;
      }

      expect(typeof descriptor.value, `Engine member '${memberName}' should be a method`).toBe('function');
      if (typeof descriptor.value === 'function' && memberSpec.signature) {
        expectPortableCallableArity(descriptor.value as (...args: unknown[]) => unknown, memberSpec.signature, `Engine member '${memberName}'`);
      }
    }
  });

});
