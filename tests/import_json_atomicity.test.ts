import { describe, expect, it } from 'vitest';
import { create_engine } from '../src/engine.js';

describe('import_json atomicity', () => {
  it('import_json is atomic when encountering invalid normalized keys', () => {
    const engine = create_engine();
    engine.import_json('{"premise":null,"policies":{"Docker":"use"},"version":2}');

    const snapshot = JSON.parse(JSON.stringify(JSON.parse(engine.export_json())));
    const invalidPayload = '{"premise":null,"policies":{"Docker":"use"," docker ":"prohibit"},"version":2}';

    expect(() => engine.import_json(invalidPayload)).toThrowError('Invalid state payload.');
    expect(JSON.parse(engine.export_json())).toEqual(snapshot);
  });

  it('no partial policy insertion before failure', () => {
    const engine = create_engine();
    const invalidPayload = '{"premise":null,"policies":{"Docker":"use"," docker ":"prohibit"},"version":2}';

    expect(() => engine.import_json(invalidPayload)).toThrowError('Invalid state payload.');
    expect(JSON.parse(engine.export_json()).policies).toEqual({});
  });
});
