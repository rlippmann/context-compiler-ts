import {
  DECISION_CLARIFY,
  DECISION_PASSTHROUGH,
  DECISION_UPDATE,
  POLICY_PROHIBIT,
  POLICY_USE,
  createEngine,
  getPolicyItems,
  getClarifyPrompt,
  getPremiseValue,
  getDecisionState,
  isClarify,
  isUpdate,
  preview,
  stateDiff,
  step,
  type Decision,
  type EngineState
} from '../src/index.js';

declare const process: { argv: string[] };

function summarizeState(state: EngineState): {
  premise: string | null;
  usePolicies: string[];
  prohibitPolicies: string[];
} {
  return {
    premise: getPremiseValue(state),
    usePolicies: getPolicyItems(state, POLICY_USE),
    prohibitPolicies: getPolicyItems(state, POLICY_PROHIBIT)
  };
}

function summarizeDecision(decision: Decision): {
  kind: typeof DECISION_UPDATE | typeof DECISION_CLARIFY | typeof DECISION_PASSTHROUGH;
  promptToUser: string | null;
  decisionState: ReturnType<typeof summarizeState> | null;
} {
  if (isUpdate(decision)) {
    const decisionState = getDecisionState(decision);
    return {
      kind: DECISION_UPDATE,
      promptToUser: null,
      decisionState: decisionState ? summarizeState(decisionState) : null
    };
  }

  if (isClarify(decision)) {
    return {
      kind: DECISION_CLARIFY,
      promptToUser: getClarifyPrompt(decision),
      decisionState: null
    };
  }

  return {
    kind: DECISION_PASSTHROUGH,
    promptToUser: null,
    decisionState: null
  };
}

export function runExample08(): {
  stateBeforePreview: ReturnType<typeof summarizeState>;
  preview: {
    wouldMutate: boolean;
    decision: ReturnType<typeof summarizeDecision>;
  };
  stateChangedAfterPreview: boolean;
  apply: {
    decision: ReturnType<typeof summarizeDecision>;
    stateAfterStep: ReturnType<typeof summarizeState>;
  };
} {
  const engine = createEngine();

  const stateBeforePreview = engine.state;

  const previewResult = preview(engine, 'prohibit peanuts');

  const stateAfterPreview = engine.state;
  const diffAfterPreview = stateDiff(stateBeforePreview, stateAfterPreview);

  const stepResult = step(engine, 'prohibit peanuts');

  return {
    stateBeforePreview: summarizeState(stateBeforePreview),
    preview: {
      wouldMutate: previewResult.would_mutate,
      decision: summarizeDecision(previewResult.decision)
    },
    stateChangedAfterPreview: diffAfterPreview.changed,
    apply: {
      decision: summarizeDecision(stepResult.decision),
      stateAfterStep: summarizeState(stepResult.state)
    }
  };
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample08();
  console.log('example 08: controller preview + state diff + apply flow');
  console.log(JSON.stringify(result, null, 2));
}
