import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';

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
    const runtime = cc as unknown as Record<string, unknown>;
    for (const name of contract.exports.names) {
      expect(Object.prototype.hasOwnProperty.call(runtime, name), `Missing canonical grammar export '${name}'`).toBe(
        true
      );
    }
  });

  it('matches canonical grammar export kinds', () => {
    const runtime = cc as unknown as Record<string, unknown>;
    for (const [name, member] of Object.entries(contract.exports.members)) {
      const value = runtime[name];
      if (member.kind === 'callable' || member.kind === 'class') {
        expect(typeof value, `Grammar export '${name}' should be callable`).toBe('function');
      }
    }
  });
});
