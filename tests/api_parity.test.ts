import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as ts from 'typescript';
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
  probes?: Array<{
    args: unknown[];
    raises?: { type: string };
  }>;
};

type ApiContractFixture = {
  forbidden_exports: string[];
  forbidden_engine_members: string[];
  forbidden_state_keys: string[];
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

function getGeneratedDeclarationExportNames(): Map<string, string[]> {
  const root = resolve(process.cwd(), 'dist', 'src');
  const exportsByFile = new Map<string, string[]>();
  for (const fileName of readdirSync(root).filter((name) => name.endsWith('.d.ts'))) {
    const path = resolve(root, fileName);
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const names: string[] = [];
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) {
        if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) && statement.name) {
          names.push(statement.name.text);
        }
      }
      if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
        }
      }
      if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) names.push(element.name.text);
      }
    }
    exportsByFile.set(fileName, names.sort());
  }
  return exportsByFile;
}

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
    .sort();
}

function getEngineDeclarationPublicMembers(): string[] {
  const path = resolve(process.cwd(), 'dist', 'src', 'engine.d.ts');
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const engine = source.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) && statement.name?.text === 'Engine'
  );
  expect(engine, `Generated declaration '${path}' should declare Engine`).toBeDefined();
  if (!engine) return [];

  return engine.members
    .filter((member) => !member.modifiers?.some((modifier) =>
      modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword
    ))
    .map((member) => {
      if (ts.isConstructorDeclaration(member)) return null;
      if (!member.name || !ts.isIdentifier(member.name)) return null;
      return member.name.text;
    })
    .filter((name): name is string => name !== null)
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

  it('does not expose forbidden names in generated declarations', () => {
    const fixture = loadApiContractFixture();
    const forbidden = new Set(fixture.forbidden_exports);
    for (const [fileName, names] of getGeneratedDeclarationExportNames()) {
      expect(names.filter((name) => forbidden.has(name)), `${fileName}: obsolete declarations remain`).toEqual([]);
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

  it('runs all canonical Engine construction probes separately from instance probes', () => {
    const fixture = loadApiContractFixture();
    const engineSpec = fixture.exports.members.Engine;
    expect(engineSpec.signature, 'Engine constructor signature is required').toBeDefined();
    if (engineSpec.signature) {
      expectPortableCallableArity(cc.Engine as unknown as (...args: unknown[]) => unknown, engineSpec.signature, 'Engine constructor');
    }

    const probes = engineSpec.construction_probes;
    expect(probes, 'Engine construction probes are required').toBeDefined();
    expect(probes?.length, 'All Engine construction probes must be present').toBeGreaterThan(0);

    for (const [index, probe] of (probes ?? []).entries()) {
      const args = Array.isArray(probe.args) ? probe.args.map(materializeProbeValue) : [];
      const kwargs = probe.kwargs as Record<string, unknown> | undefined;
      const construct = () => {
        // Python keyword probes are represented by the corresponding object
        // argument in TypeScript so the runtime receives the exact input shape.
        const constructorArgs = kwargs === undefined ? args : [...args, materializeProbeValue(kwargs)];
        return Reflect.construct(cc.Engine, constructorArgs);
      };

      if (probe.raises != null) {
        if (probe.raises.type === 'TypeError') {
          expect(construct, `Engine construction probe ${index} should raise TypeError`).toThrowError(TypeError);
        } else {
          expect(construct, `Engine construction probe ${index} should raise`).toThrow();
        }
        continue;
      }

      const shape = probe.return_shape as ReturnShape | undefined;
      expect(shape, `Engine construction probe ${index} should define a return shape`).toBeDefined();
      if (shape) expectShape(construct(), shape, `Engine construction probe ${index}`);
    }
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

  it('does not expose forbidden Engine members', () => {
    const fixture = loadApiContractFixture();
    const engine = new cc.Engine() as unknown as Record<string, unknown>;
    for (const memberName of fixture.forbidden_engine_members) {
      expect(memberName in engine, `Forbidden Engine member '${memberName}' should not exist`).toBe(false);
    }
  });

  it('exposes exactly the canonical Engine members in generated declarations', () => {
    const fixture = loadApiContractFixture();
    const canonicalMembers = Object.keys(fixture.engine.public_members.members).sort();
    expect(getEngineDeclarationPublicMembers()).toEqual(canonicalMembers);
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

  it('executes canonical Engine member probes without adapting inputs', () => {
    const fixture = loadApiContractFixture();
    const engine = new cc.Engine();
    for (const [memberName, memberSpec] of Object.entries(fixture.engine.public_members.members)) {
      for (const [index, probe] of (memberSpec.probes ?? []).entries()) {
        const invoke = () =>
          (engine as unknown as Record<string, (...args: unknown[]) => unknown>)[memberName](...probe.args);
        if (probe.raises != null) {
          expect(invoke, `${memberName} probe ${index} should raise`).toThrow();
        } else {
          expect(invoke, `${memberName} probe ${index} should not raise`).not.toThrow();
        }
      }
    }
  });

  it('does not expose forbidden state keys', () => {
    const fixture = loadApiContractFixture();
    const state = JSON.parse(new cc.Engine().export_json()) as Record<string, unknown>;
    for (const key of fixture.forbidden_state_keys) {
      expect(Object.prototype.hasOwnProperty.call(state, key), `Forbidden state key '${key}' should not exist`).toBe(false);
    }
  });

});
