import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as cc from '../src/index.js';
import type { ApplyResult, Transcript, TranscriptMessage } from '../src/index.js';

// Compile-time API parity checks for type exports in the Python contract fixture.
const _typeCheckMessage: TranscriptMessage = { role: 'user', content: 'hello' };
const _typeCheckTranscript: Transcript = [_typeCheckMessage];
const _typeCheckApplyResult: ApplyResult = cc.compile_transcript(_typeCheckTranscript);
void _typeCheckApplyResult;

type ApiContractFixture = {
  required_exports: string[];
  engine: {
    required_members: string[];
  };
};

const PYTHON_TO_TS_EXPORT_MAP: Record<string, string> = {
  create_engine: 'createEngine',
  compile_transcript: 'compile_transcript',
  get_premise_value: 'getPremiseValue',
  get_policy_items: 'getPolicyItems',
  is_update: 'is_update',
  is_clarify: 'is_clarify',
  is_passthrough: 'is_passthrough',
  get_clarify_prompt: 'get_clarify_prompt',
  get_decision_state: 'get_decision_state',
  DECISION_PASSTHROUGH: 'DECISION_PASSTHROUGH',
  DECISION_UPDATE: 'DECISION_UPDATE',
  DECISION_CLARIFY: 'DECISION_CLARIFY',
  POLICY_USE: 'POLICY_USE',
  POLICY_PROHIBIT: 'POLICY_PROHIBIT',
  TranscriptMessage: '__type_only__',
  Transcript: '__type_only__',
  ApplyResult: '__type_only__'
};

const PYTHON_TO_TS_ENGINE_MEMBER_MAP: Record<string, string> = {
  step: 'step',
  state: 'state',
  export_json: 'exportJson',
  import_json: 'importJson',
  apply_transcript: 'apply_transcript',
  export_checkpoint: 'exportCheckpoint',
  import_checkpoint: 'importCheckpoint',
  export_checkpoint_json: 'exportCheckpointJson',
  import_checkpoint_json: 'importCheckpointJson',
  has_pending_clarification: 'has_pending_clarification'
};

function loadApiContractFixture(): ApiContractFixture {
  const path = resolve(process.cwd(), 'tests', 'fixtures', 'conformance', 'api', 'public-api-v1.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as ApiContractFixture;
}

describe('public API parity contract (conformance fixture)', () => {
  it('exposes required top-level exports with intentional TS mappings', () => {
    const fixture = loadApiContractFixture();
    for (const pyName of fixture.required_exports) {
      const tsName = PYTHON_TO_TS_EXPORT_MAP[pyName];
      expect(tsName, `No TS mapping for Python export '${pyName}'`).toBeDefined();
      if (tsName === '__type_only__') {
        continue;
      }
      expect(Object.prototype.hasOwnProperty.call(cc, tsName), `Missing TS export '${tsName}'`).toBe(true);
    }
  });

  it('exposes required engine instance members with intentional TS mappings', () => {
    const fixture = loadApiContractFixture();
    const engine = cc.createEngine();
    for (const pyName of fixture.engine.required_members) {
      const tsName = PYTHON_TO_TS_ENGINE_MEMBER_MAP[pyName];
      expect(tsName, `No TS mapping for Python engine member '${pyName}'`).toBeDefined();
      expect(tsName in engine, `Missing engine member '${tsName}'`).toBe(true);
    }
  });
});
