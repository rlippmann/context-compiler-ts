import { compile_transcript, createEngine, type TranscriptResult } from '../src/index.js';

declare const process: { argv: string[] };

type TranscriptMessage = {
  role: string;
  content: unknown;
};

function applyTranscriptOnCurrentEngine(
  engine: ReturnType<typeof createEngine>,
  messages: TranscriptMessage[]
): TranscriptResult {
  for (const message of messages) {
    if (message.role !== 'user' || typeof message.content !== 'string') {
      continue;
    }
    const decision = engine.step(message.content);
    if (decision.kind === 'clarify') {
      return {
        kind: 'confirm',
        prompt_to_user: decision.prompt_to_user as string
      };
    }
  }

  return {
    kind: 'state',
    state: engine.state
  };
}

export function runExample06(): {
  freshReplayKind: string;
  currentReplayKind: string;
  freshPolicies: string[];
  currentPolicies: string[];
} {
  const transcript: TranscriptMessage[] = [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'prohibit peanuts' },
    { role: 'assistant', content: 'Understood' },
    { role: 'user', content: 'set premise vegetarian curry' },
    { role: 'user', content: 'change premise to vegan curry' }
  ];

  const freshReplay = compile_transcript(transcript);

  const engine = createEngine();
  engine.step('prohibit shellfish');
  const currentReplay = applyTranscriptOnCurrentEngine(engine, transcript);

  const freshPolicies =
    freshReplay.kind === 'state' ? Object.keys(freshReplay.state.policies).sort((a, b) => a.localeCompare(b)) : [];
  const currentPolicies =
    currentReplay.kind === 'state'
      ? Object.keys(currentReplay.state.policies).sort((a, b) => a.localeCompare(b))
      : [];

  return {
    freshReplayKind: freshReplay.kind,
    currentReplayKind: currentReplay.kind,
    freshPolicies,
    currentPolicies
  };
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample06();
  console.log('example 06: transcript replay');
  console.log(JSON.stringify(result, null, 2));
}
