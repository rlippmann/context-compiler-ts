import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Engine } from '../src/engine.js';
import {
  CanonicalDirective,
  decompose_directive,
  decomposeDirective,
  get_directive_metadata,
  getDirectiveMetadata
} from '../src/grammar.js';

describe('TypeScript camelCase API aliases', () => {
  it('exposes the aliases in package exports and generated declarations', async () => {
    const packageRoot = await import('@rlippmann/context-compiler');
    const packageGrammar = await import('@rlippmann/context-compiler/grammar');

    expect(typeof packageRoot.Engine.prototype.exportJson).toBe('function');
    expect(typeof packageRoot.Engine.prototype.importJson).toBe('function');
    expect(typeof packageRoot.Engine.prototype.applyDirective).toBe('function');
    expect(typeof packageGrammar.decomposeDirective).toBe('function');
    expect(typeof packageGrammar.getDirectiveMetadata).toBe('function');
    expect(typeof Engine.prototype.exportJson).toBe('function');
    expect(typeof Engine.prototype.importJson).toBe('function');
    expect(typeof Engine.prototype.applyDirective).toBe('function');
    expect(typeof decomposeDirective).toBe('function');
    expect(typeof getDirectiveMetadata).toBe('function');

    const engineDeclaration = readFileSync(resolve(process.cwd(), 'dist', 'src', 'engine.d.ts'), 'utf8');
    const grammarDeclaration = readFileSync(resolve(process.cwd(), 'dist', 'src', 'grammar.d.ts'), 'utf8');
    expect(engineDeclaration).toMatch(/exportJson\(\): string/);
    expect(engineDeclaration).toMatch(/importJson\(payload: string\): void/);
    expect(engineDeclaration).toMatch(/applyDirective\(directive: CanonicalDirective\)/);
    expect(grammarDeclaration).toMatch(/export declare function decomposeDirective/);
    expect(grammarDeclaration).toMatch(/export declare function getDirectiveMetadata/);
  });

  it('exposes both spellings with equivalent engine behavior', () => {
    const snake = new Engine();
    const camel = new Engine();
    expect(snake.export_json()).toBe(snake.exportJson());

    snake.import_json('{"premise":null,"policies":{"docker":"use"},"version":2}');
    camel.importJson('{"premise":null,"policies":{"docker":"use"},"version":2}');
    expect(camel.exportJson()).toBe(snake.export_json());

    const directive = new CanonicalDirective('use_item', { item: 'sqlite' });
    expect(camel.applyDirective(directive)).toEqual(snake.apply_directive(directive));
    expect(camel.exportJson()).toBe(snake.export_json());
  });

  it('exposes both grammar helper spellings with equivalent results', () => {
    expect(decomposeDirective('use sqlite')).toEqual(decompose_directive('use sqlite'));
    expect(decomposeDirective('not a directive')).toEqual(decompose_directive('not a directive'));
    expect(getDirectiveMetadata()).toEqual(get_directive_metadata());
  });
});
