import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/index.js';

describe('importJson atomicity', () => {
  it('importJson is atomic when encountering invalid normalized keys', () => {
    const engine = createEngine();
    engine.importJson('{"premise":null,"policies":{"Docker":"use"},"version":2}');

    const snapshot = JSON.parse(JSON.stringify(engine.state));
    const invalidPayload = '{"premise":null,"policies":{"Docker":"use","a":"use"},"version":2}';

    expect(() => engine.importJson(invalidPayload)).toThrowError('Invalid state payload.');
    expect(engine.state).toEqual(snapshot);
  });

  it('no partial policy insertion before failure', () => {
    const engine = createEngine();
    const invalidPayload = '{"premise":null,"policies":{"Docker":"use","a":"use"},"version":2}';

    expect(() => engine.importJson(invalidPayload)).toThrowError('Invalid state payload.');
    expect(engine.state.policies).toEqual({});
  });
});
