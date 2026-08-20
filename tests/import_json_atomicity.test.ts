import { describe, expect, it } from 'vitest';
import { create_engine } from '../src/engine.js';

describe('import_json atomicity', () => {
  it('import_json is atomic when encountering invalid normalized keys', () => {
    const engine = create_engine();
    engine.import_json('{"premise":null,"policies":{"Docker":"use"},"version":2}');

    const snapshot = JSON.parse(JSON.stringify(engine._state_snapshot()));
    const invalidPayload = '{"premise":null,"policies":{"Docker":"use","a":"use"},"version":2}';

    expect(() => engine.import_json(invalidPayload)).toThrowError('Invalid state payload.');
    expect(engine._state_snapshot()).toEqual(snapshot);
  });

  it('no partial policy insertion before failure', () => {
    const engine = create_engine();
    const invalidPayload = '{"premise":null,"policies":{"Docker":"use","a":"use"},"version":2}';

    expect(() => engine.import_json(invalidPayload)).toThrowError('Invalid state payload.');
    expect(engine._state_snapshot().policies).toEqual({});
  });
});
